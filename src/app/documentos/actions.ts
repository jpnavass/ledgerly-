'use server';

// ============================================================================
// Server Actions para Gestión Documental — Presupuesto Express Enterprise
// ============================================================================

import { getRepository } from '@/lib/repo';
import {
  createDraftDocument,
  updateDraftDocument,
  validateAndIssueDocument,
  createNewDocumentVersion,
  convertDocument,
  createCreditNoteDocument,
} from '@/lib/domain/documents';
import { assertCan } from '@/lib/domain/permissions';
import type { DocType, Document, UserRole } from '@/types';

export async function createDocumentAction(formData: {
  orgId: string;
  docType: DocType;
  clientId: string;
  title: string;
  userRole?: UserRole;
}) {
  const { orgId, docType, clientId, title, userRole = 'owner' } = formData;
  assertCan(userRole, 'document.create');

  const repo = getRepository();
  const client = await repo.getClientById(orgId, clientId);
  if (!client) {
    throw new Error('El cliente especificado no existe o no pertenece a la organización.');
  }

  const settings = await repo.getOrgSettings(orgId);
  const draft = createDraftDocument({
    doc_type: docType,
    client_id: clientId,
    client,
    title,
    org_id: orgId,
    org_settings: settings,
  });

  const saved = await repo.saveDocument(orgId, draft);
  return { success: true, document: saved };
}

export async function updateDocumentAction(
  orgId: string,
  docId: string,
  updates: Partial<Document>,
  userRole: UserRole = 'owner'
) {
  assertCan(userRole, 'document.edit');

  const repo = getRepository();
  const existing = await repo.getDocumentById(orgId, docId);
  if (!existing) {
    throw new Error('Documento no encontrado.');
  }

  const updated = updateDraftDocument(existing, updates);
  const saved = await repo.saveDocument(orgId, updated);
  return { success: true, document: saved };
}

export async function issueDocumentAction(
  orgId: string,
  docId: string,
  userRole: UserRole = 'owner'
) {
  assertCan(userRole, 'document.issue');

  const repo = getRepository();
  const doc = await repo.getDocumentById(orgId, docId);
  if (!doc) {
    throw new Error('Documento no encontrado.');
  }

  const org = await repo.getOrganization(orgId);
  if (!org) {
    throw new Error('Organización emisora no encontrada.');
  }

  const client = doc.client || (await repo.getClientById(orgId, doc.client_id || ''));
  if (!client) {
    throw new Error('Cliente destinatario no encontrado.');
  }

  const settings = await repo.getOrgSettings(orgId);
  const seriesConfig = settings?.series?.[doc.doc_type] || {
    prefix: doc.doc_type === 'invoice' ? 'FAC' : 'PRE',
    reset_yearly: true,
  };

  // Obtener último número y calcular siguiente
  const docs = await repo.getDocuments(orgId, { doc_type: doc.doc_type });
  const maxNumber = docs.reduce((max, d) => Math.max(max, d.number || 0), 0);
  const nextNumber = maxNumber + 1;

  const issued = validateAndIssueDocument({
    doc,
    client,
    org,
    series: seriesConfig.prefix,
    nextNumber,
  });

  const saved = await repo.saveDocument(orgId, issued);
  return { success: true, document: saved };
}

export async function convertDocumentAction(
  orgId: string,
  sourceId: string,
  targetType: DocType,
  billedPercentage: number = 100,
  userRole: UserRole = 'owner'
) {
  assertCan(userRole, 'document.create');

  const repo = getRepository();
  const source = await repo.getDocumentById(orgId, sourceId);
  if (!source) {
    throw new Error('Documento de origen no encontrado.');
  }

  const { newDocument, updatedSource } = convertDocument({
    source,
    targetType,
    billedPercentage,
  });

  const savedTarget = await repo.saveDocument(orgId, newDocument);
  await repo.saveDocument(orgId, updatedSource);

  return { success: true, targetId: savedTarget.id };
}

export async function createCreditNoteAction(
  orgId: string,
  originalId: string,
  reason: string,
  method: 'differences' | 'substitution',
  userRole: UserRole = 'owner'
) {
  assertCan(userRole, 'document.issue');

  const repo = getRepository();
  const original = await repo.getDocumentById(orgId, originalId);
  if (!original) {
    throw new Error('Factura original no encontrada.');
  }

  const { creditNote, updatedOriginal } = createCreditNoteDocument({
    original,
    reason,
    method,
  });

  const savedNote = await repo.saveDocument(orgId, creditNote);
  await repo.saveDocument(orgId, updatedOriginal);

  return { success: true, creditNoteId: savedNote.id };
}

export async function createVersionAction(
  orgId: string,
  docId: string,
  userRole: UserRole = 'owner'
) {
  assertCan(userRole, 'document.create');

  const repo = getRepository();
  const original = await repo.getDocumentById(orgId, docId);
  if (!original) {
    throw new Error('Documento no encontrado.');
  }

  const newVersion = createNewDocumentVersion(original);
  const saved = await repo.saveDocument(orgId, newVersion);
  return { success: true, newDocId: saved.id };
}
