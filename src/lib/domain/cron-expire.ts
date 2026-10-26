// ============================================================================
// Dominio de Caducidad de Presupuestos (Cron Expiration Domain)
// ============================================================================

import type { DataRepository } from '../repo/types.ts';
import { checkDocumentExpiry } from './documents.ts';
import { createChainedAuditEvent } from '../compliance/audit.ts';

export interface ProcessExpiredQuotesOptions {
  repo: DataRepository;
  orgId?: string; // Opcional: si se omite, itera sobre todas las organizaciones del repositorio
  todayIso?: string;
  cronSecret?: string;
  authorizationHeader?: string | null;
}

export interface ProcessExpiredQuotesResult {
  ok: boolean;
  unauthorized?: boolean;
  organizationsCount: number;
  processedCount: number;
  expiredCount: number;
  expiredIds: string[];
  evaluatedDate: string;
}

/**
 * Ejecuta el proceso de comprobación de caducidad de presupuestos vencidos,
 * iterando sobre todas las organizaciones del repositorio o sobre una específica.
 */
export async function processExpiredQuotes(
  options: ProcessExpiredQuotesOptions
): Promise<ProcessExpiredQuotesResult> {
  const {
    repo,
    orgId,
    todayIso = new Date().toISOString().slice(0, 10),
    cronSecret,
    authorizationHeader,
  } = options;

  // 1. Verificación de autorización estricta (política fail-closed)
  // Si CRON_SECRET no está definido en el servidor o es vacío, la ejecución se bloquea por seguridad
  if (!cronSecret || cronSecret.trim().length === 0) {
    return {
      ok: false,
      unauthorized: true,
      organizationsCount: 0,
      processedCount: 0,
      expiredCount: 0,
      expiredIds: [],
      evaluatedDate: todayIso,
    };
  }

  const token = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice(7)
    : '';
  if (token !== cronSecret) {
    return {
      ok: false,
      unauthorized: true,
      organizationsCount: 0,
      processedCount: 0,
      expiredCount: 0,
      expiredIds: [],
      evaluatedDate: todayIso,
    };
  }

  // 2. Determinar las organizaciones a procesar
  let targetOrgIds: string[] = [];
  if (orgId) {
    targetOrgIds = [orgId];
  } else {
    const allOrgs = await repo.getAllOrganizations();
    targetOrgIds = allOrgs.map((o) => o.id);
  }

  let totalProcessed = 0;
  const expiredIds: string[] = [];

  // 3. Iterar cada organización vía Repository
  for (const currentOrgId of targetOrgIds) {
    const sentQuotes = await repo.getDocuments(currentOrgId, { doc_type: 'quote', status: 'sent' });
    const viewedQuotes = await repo.getDocuments(currentOrgId, { doc_type: 'quote', status: 'viewed' });
    const candidates = [...sentQuotes, ...viewedQuotes];
    totalProcessed += candidates.length;

    for (const doc of candidates) {
      const evaluated = checkDocumentExpiry(doc, todayIso);
      if (evaluated.status === 'expired' && evaluated.status !== doc.status) {
        await repo.saveDocument(currentOrgId, evaluated);
        expiredIds.push(doc.id);

        try {
          const auditEvt = await createChainedAuditEvent({
            orgId: currentOrgId,
            documentId: doc.id,
            actorKind: 'system',
            type: 'document.expired',
            description: `Presupuesto ${doc.series || 'PRE'}-${doc.number || 0} marcado como expirado automáticamente por cron (fecha evaluación: ${todayIso})`,
          });
          await repo.recordAuditEvent(currentOrgId, auditEvt);
        } catch {
          // Continuar en entornos locales
        }
      }
    }
  }

  return {
    ok: true,
    unauthorized: false,
    organizationsCount: targetOrgIds.length,
    processedCount: totalProcessed,
    expiredCount: expiredIds.length,
    expiredIds,
    evaluatedDate: todayIso,
  };
}
