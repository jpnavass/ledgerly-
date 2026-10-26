// ============================================================================
// Registro de Auditoría Inalterable Encadenado — Presupuesto Express Enterprise
// ============================================================================

import type { AuditEvent, AuditActorKind } from '../../types/index.ts';
import { sha256Hex, canonicalize } from './hash.ts';

export interface AuditEventInputs {
  orgId: string;
  documentId?: string;
  actorUserId?: string;
  actorKind: AuditActorKind;
  type: string;
  description: string;
  ip?: string;
  userAgent?: string;
  previousHash?: string;
  nowIso?: string;
}

/**
 * Formatea la cadena canónica oficial para el registro de eventos del sistema informático
 * conforme al Anexo III de la Orden HAC/1177/2024.
 */
export function formatAeatEventPayload(inputs: {
  softwareVersion: string;
  eventType: string; // '01' inicio, '02' fin, '03' anomalia
  generatedAtIso: string;
  previousHash: string;
}): string {
  return (
    `SoftwareVersion=${inputs.softwareVersion}` +
    `&TipoEvento=${inputs.eventType}` +
    `&FechaHoraHusoGenRegistro=${inputs.generatedAtIso}` +
    `&Huella=${inputs.previousHash}`
  );
}

/**
 * Construye un evento de auditoría append-only con encadenado criptográfico SHA-256.
 */
export async function createChainedAuditEvent(inputs: AuditEventInputs): Promise<AuditEvent> {
  const createdAt = inputs.nowIso || new Date().toISOString();
  const previousHash = inputs.previousHash || '';

  const payloadString = canonicalize({
    org_id: inputs.orgId,
    document_id: inputs.documentId || null,
    actor_user_id: inputs.actorUserId || null,
    actor_kind: inputs.actorKind,
    type: inputs.type,
    description: inputs.description,
    ip: inputs.ip || null,
    user_agent: inputs.userAgent || null,
    created_at: createdAt,
  });

  const hash = await sha256Hex(previousHash + payloadString);

  const event: AuditEvent = {
    id: `aud-${crypto.randomUUID()}`,
    org_id: inputs.orgId,
    document_id: inputs.documentId,
    actor_user_id: inputs.actorUserId,
    actor_kind: inputs.actorKind,
    type: inputs.type,
    description: inputs.description,
    ip: inputs.ip,
    user_agent: inputs.userAgent,
    previous_hash: previousHash,
    hash,
    created_at: createdAt,
  };

  return event;
}

/**
 * Verifica la cadena inalterable de auditoría.
 */
export async function verifyAuditChain(
  events: readonly AuditEvent[]
): Promise<{ ok: boolean; firstBrokenIndex?: number; reason?: string }> {
  for (let i = 0; i < events.length; i++) {
    const current = events[i];

    // Verificar enlace previo
    if (i === 0) {
      if (current.previous_hash && current.previous_hash !== '') {
        return { ok: false, firstBrokenIndex: 0, reason: 'El primer evento debe tener huella anterior vacía' };
      }
    } else {
      const prev = events[i - 1];
      if (current.previous_hash !== prev.hash) {
        return {
          ok: false,
          firstBrokenIndex: i,
          reason: `Rotura de encadenado en evento de índice ${i}: huella anterior no coincide`,
        };
      }
    }

    // Recalcular huella
    const payloadString = canonicalize({
      org_id: current.org_id,
      document_id: current.document_id || null,
      actor_user_id: current.actor_user_id || null,
      actor_kind: current.actor_kind,
      type: current.type,
      description: current.description,
      ip: current.ip || null,
      user_agent: current.user_agent || null,
      created_at: current.created_at,
    });

    const expectedHash = await sha256Hex((current.previous_hash || '') + payloadString);
    if (expectedHash !== current.hash) {
      return {
        ok: false,
        firstBrokenIndex: i,
        reason: `Huella digital alterada en evento de índice ${i}`,
      };
    }
  }

  return { ok: true };
}
