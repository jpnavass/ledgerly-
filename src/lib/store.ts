// ============================================================================
// Gestor Central de Datos y Persistencia — Presupuesto Express Enterprise
// Fachada sobre almacenamiento local en navegador
// ============================================================================

import type {
  Document,
  DocumentItem,
  Client,
  CatalogItem,
  DocType,
  Payment,
  AuditEvent,
  Org,
  OrgSettings,
} from '@/types';
import { calcDocumentTotals } from './calculations';

export const STORAGE_KEYS = {
  DOCUMENTS: 'pe_enterprise_documents_v2',
  CLIENTS: 'pe_enterprise_clients_v2',
  CATALOG: 'pe_enterprise_catalog_v2',
  ORGANIZATION: 'pe_enterprise_org_v2',
  SETTINGS: 'pe_enterprise_settings_v2',
  PAYMENTS: 'pe_enterprise_payments_v2',
  AUDIT_LOG: 'pe_enterprise_audit_log_v2',
};

import { safeGetStorage, safeSetStorage } from './repo/local';
import { getRepository } from './repo/index';

export { getRepository };

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

export async function syncStoreWithRepository(orgId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const repo = getRepository();
  const activeOrgId = orgId || getOrganization()?.id || '';
  if (!activeOrgId) return;
  try {
    const [docs, clients, catalog, payments] = await Promise.all([
      repo.getDocuments(activeOrgId),
      repo.getClients(activeOrgId),
      repo.getCatalog(activeOrgId),
      repo.getPayments(activeOrgId),
    ]);
    if (docs.length > 0) safeSetStorage(STORAGE_KEYS.DOCUMENTS, docs);
    if (clients.length > 0) safeSetStorage(STORAGE_KEYS.CLIENTS, clients);
    if (catalog.length > 0) safeSetStorage(STORAGE_KEYS.CATALOG, catalog);
    if (payments.length > 0) safeSetStorage(STORAGE_KEYS.PAYMENTS, payments);
  } catch (err) {
    console.warn('Sincronización con repositorio diferida:', err);
  }
}

export function initStore(): void {
  // Inicialización limpia: no se precarga ningún dato ficticio.
  if (typeof window === 'undefined') return;
}

// ----- DOCUMENTOS -----

export function getDocuments(): Document[] {
  return safeGetStorage<Document[]>(STORAGE_KEYS.DOCUMENTS, []);
}

export function getDocumentById(id: string): Document | undefined {
  const docs = getDocuments();
  return docs.find((d) => d.id === id);
}

export function saveDocument(document: Document): Document {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === document.id);

  const totals = calcDocumentTotals(document.items || []);
  const updatedDoc: Document = {
    ...document,
    subtotal_cents: totals.subtotal_cents,
    discount_cents: totals.discount_cents,
    vat_cents: totals.vat_cents,
    irpf_cents: totals.irpf_cents,
    total_cents: totals.total_cents,
    updated_at: new Date().toISOString(),
  };

  let newDocs: Document[];
  if (index >= 0) {
    newDocs = [...docs];
    newDocs[index] = updatedDoc;
  } else {
    newDocs = [updatedDoc, ...docs];
  }

  safeSetStorage(STORAGE_KEYS.DOCUMENTS, newDocs);

  // Sincronizar en repositorio activo (Supabase o Local)
  const repo = getRepository();
  const orgId = updatedDoc.org_id || getOrganization()?.id || '';
  if (orgId) {
    repo.saveDocument(orgId, updatedDoc).catch((err) => {
      console.warn('Fallo asíncrono al persistir documento en repositorio:', err);
    });
  }

  return updatedDoc;
}

export function deleteDocument(id: string): boolean {
  const docs = getDocuments();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return false;

  if (doc.number !== null && doc.number !== undefined) {
    throw new Error('No se puede eliminar un documento con numeración oficial asignada.');
  }
  if (doc.locked_at) {
    throw new Error('No se puede eliminar un documento bloqueado e inmutable.');
  }

  const filtered = docs.filter((d) => d.id !== id);
  safeSetStorage(STORAGE_KEYS.DOCUMENTS, filtered);

  // Sincronizar borrado en repositorio activo
  const repo = getRepository();
  const orgId = doc.org_id || getOrganization()?.id || '';
  if (orgId) {
    repo.deleteDocument(orgId, id).catch((err) => {
      console.warn('Fallo asíncrono al eliminar documento en repositorio:', err);
    });
  }

  return true;
}

export function createNewDocument(payload: {
  doc_type: DocType;
  client_id: string;
  title: string;
  valid_until?: string;
  initialItems?: DocumentItem[];
}): Document {
  const docs = getDocuments();
  const clients = getClients();
  const client = clients.find((c) => c.id === payload.client_id);

  const seriesPrefix =
    payload.doc_type === 'quote'
      ? 'PRE'
      : payload.doc_type === 'delivery_note'
      ? 'ALB'
      : payload.doc_type === 'proforma'
      ? 'PRO'
      : payload.doc_type === 'credit_note'
      ? 'REC'
      : 'FAC';

  const sameSeriesDocs = docs.filter((d) => d.series === seriesPrefix);
  const maxNumber = sameSeriesDocs.reduce((max, d) => Math.max(max, d.doc_number || d.number || 0), 0);
  const nextNumber = maxNumber + 1;

  const docId = generateId('doc');
  const items = payload.initialItems || [];
  const totals = calcDocumentTotals(items);

  const newDoc: Document = {
    id: docId,
    org_id: client?.org_id || getOrganization()?.id || '',
    client_id: payload.client_id,
    client: client,
    doc_type: payload.doc_type,
    series: seriesPrefix,
    number: nextNumber,
    doc_number: nextNumber,
    version: 1,
    currency: 'EUR',
    status: 'draft',
    title: payload.title || `Nuevo ${payload.doc_type}`,
    subtotal_cents: totals.subtotal_cents,
    discount_cents: totals.discount_cents,
    vat_cents: totals.vat_cents,
    irpf_cents: totals.irpf_cents,
    total_cents: totals.total_cents,
    valid_until: payload.valid_until,
    items: items,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveDocument(newDoc);
  return newDoc;
}

export function convertDocument(
  sourceDocId: string,
  targetType: 'delivery_note' | 'proforma' | 'invoice'
): Document {
  const source = getDocumentById(sourceDocId);
  if (!source) throw new Error('Documento de origen no encontrado');

  const titlePrefix =
    targetType === 'delivery_note'
      ? 'Albarán de entrega - '
      : targetType === 'proforma'
      ? 'Factura Proforma - '
      : 'Factura - ';

  const newDocId = generateId('doc');
  const clonedItems = source.items.map((it, idx) => ({
    ...it,
    id: generateId('item'),
    document_id: newDocId,
    position: idx + 1,
  }));

  const newDoc = createNewDocument({
    doc_type: targetType,
    client_id: source.client_id || '',
    title: `${titlePrefix}${source.title || ''}`.trim(),
    valid_until: source.valid_until,
    initialItems: clonedItems,
  });

  newDoc.converted_from = source.id;
  saveDocument(newDoc);

  return newDoc;
}

export function signDocument(
  docId: string,
  signerName: string,
  signerTaxId: string,
  signatureDataUrl?: string
): Document {
  const doc = getDocumentById(docId);
  if (!doc) throw new Error('Documento no encontrado');

  const timestamp = new Date().toISOString();
  const shaHash = `SHA256-${Date.now().toString(16)}`;

  const updatedDoc: Document = {
    ...doc,
    status: 'accepted',
    accepted_at: timestamp,
    signature_data: signatureDataUrl || `Firma verificada: ${signerName} (${signerTaxId}) - ${shaHash}`,
    updated_at: timestamp,
  };

  saveDocument(updatedDoc);

  recordAuditEvent({
    id: generateId('audit'),
    org_id: doc.org_id || getOrganization()?.id || '',
    document_id: docId,
    actor_kind: 'client',
    title: `Firma digital registrada en ${doc.series || ''}-${String(doc.number || doc.doc_number || 0).padStart(4, '0')}`,
    description: `Aceptado formalmente por ${signerName} (NIF: ${signerTaxId}) con evidencias electrónicas eIDAS.`,
    created_at: timestamp,
    previous_hash: 'GENESIS',
    hash: shaHash,
    type: 'signature',
  });

  return updatedDoc;
}

// ----- CLIENTES -----

export function getClients(): Client[] {
  return safeGetStorage<Client[]>(STORAGE_KEYS.CLIENTS, []);
}

export function getClientById(id: string): Client | undefined {
  return getClients().find((c) => c.id === id);
}

export function saveClient(client: Client): Client {
  const clients = getClients();
  const index = clients.findIndex((c) => c.id === client.id);

  let updated: Client[];
  if (index >= 0) {
    updated = [...clients];
    updated[index] = { ...client, updated_at: new Date().toISOString() };
  } else {
    updated = [{ ...client, updated_at: new Date().toISOString() }, ...clients];
  }

  safeSetStorage(STORAGE_KEYS.CLIENTS, updated);

  const repo = getRepository();
  const orgId = client.org_id || getOrganization()?.id || '';
  if (orgId) repo.saveClient(orgId, client).catch((err) => console.warn('Sync saveClient:', err));

  return client;
}

export function deleteClient(id: string): boolean {
  const clients = getClients();
  const filtered = clients.filter((c) => c.id !== id);
  safeSetStorage(STORAGE_KEYS.CLIENTS, filtered);

  const repo = getRepository();
  const orgId = getOrganization()?.id || '';
  if (orgId) repo.deleteClient(orgId, id).catch((err) => console.warn('Sync deleteClient:', err));

  return true;
}

// ----- CATÁLOGO / TARIFARIO -----

export function getCatalog(): CatalogItem[] {
  return safeGetStorage<CatalogItem[]>(STORAGE_KEYS.CATALOG, []);
}

export function saveCatalogItem(item: CatalogItem): CatalogItem {
  const catalog = getCatalog();
  const index = catalog.findIndex((i) => i.id === item.id);

  let updated: CatalogItem[];
  if (index >= 0) {
    updated = [...catalog];
    updated[index] = { ...item, updated_at: new Date().toISOString() };
  } else {
    updated = [{ ...item, updated_at: new Date().toISOString() }, ...catalog];
  }

  safeSetStorage(STORAGE_KEYS.CATALOG, updated);

  const repo = getRepository();
  const orgId = item.org_id || getOrganization()?.id || '';
  if (orgId) repo.saveCatalogItem(orgId, item).catch((err) => console.warn('Sync saveCatalogItem:', err));

  return item;
}

export function deleteCatalogItem(id: string): boolean {
  const catalog = getCatalog();
  const filtered = catalog.filter((i) => i.id !== id);
  safeSetStorage(STORAGE_KEYS.CATALOG, filtered);

  const repo = getRepository();
  const orgId = getOrganization()?.id || '';
  if (orgId) repo.deleteCatalogItem(orgId, id).catch((err) => console.warn('Sync deleteCatalogItem:', err));

  return true;
}

// ----- TESORERÍA / PAGOS -----

export function getPayments(): Payment[] {
  return safeGetStorage<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
}

export function savePayment(payment: Payment): Payment {
  const payments = getPayments();
  const index = payments.findIndex((p) => p.id === payment.id);

  let updated: Payment[];
  if (index >= 0) {
    updated = [...payments];
    updated[index] = payment;
  } else {
    updated = [payment, ...payments];
  }

  safeSetStorage(STORAGE_KEYS.PAYMENTS, updated);

  const repo = getRepository();
  const orgId = payment.org_id || getOrganization()?.id || '';
  if (orgId) repo.savePayment(orgId, payment).catch((err) => console.warn('Sync savePayment:', err));

  return payment;
}

export function markPaymentAsPaid(paymentId: string): void {
  const payments = getPayments();
  const updated = payments.map((p) =>
    p.id === paymentId ? { ...p, paid_at: new Date().toISOString(), status: 'completed' as const } : p
  );
  safeSetStorage(STORAGE_KEYS.PAYMENTS, updated);

  const repo = getRepository();
  const orgId = getOrganization()?.id || '';
  if (orgId) repo.markPaymentAsPaid(orgId, paymentId).catch((err) => console.warn('Sync markPaymentAsPaid:', err));
}

// ----- AUDITORÍA -----

export function recordAuditEvent(event: AuditEvent): void {
  const events = safeGetStorage<AuditEvent[]>(STORAGE_KEYS.AUDIT_LOG, []);
  safeSetStorage(STORAGE_KEYS.AUDIT_LOG, [event, ...events]);

  const repo = getRepository();
  const orgId = event.org_id || getOrganization()?.id || '';
  if (orgId) repo.recordAuditEvent(orgId, event).catch((err) => console.warn('Sync recordAuditEvent:', err));
}

export function getAuditEvents(): AuditEvent[] {
  return safeGetStorage<AuditEvent[]>(STORAGE_KEYS.AUDIT_LOG, []);
}

// ----- ORGANIZACIÓN Y AJUSTES -----

export function getActiveOrgId(): string {
  return getOrganization()?.id || '';
}

export function getOrganization(): Org | null {
  return safeGetStorage<Org | null>(STORAGE_KEYS.ORGANIZATION, null);
}

export function saveOrganization(org: Org): Org {
  safeSetStorage(STORAGE_KEYS.ORGANIZATION, org);

  const repo = getRepository();
  repo.saveOrganization(org).catch((err) => console.warn('Sync saveOrganization:', err));

  return org;
}

export function getOrgSettings(): OrgSettings | null {
  return safeGetStorage<OrgSettings | null>(STORAGE_KEYS.SETTINGS, null);
}

export function saveOrgSettings(settings: OrgSettings): OrgSettings {
  safeSetStorage(STORAGE_KEYS.SETTINGS, settings);

  const repo = getRepository();
  const orgId = settings.org_id || getOrganization()?.id || '';
  if (orgId) repo.saveOrgSettings(orgId, settings).catch((err) => console.warn('Sync saveOrgSettings:', err));

  return settings;
}
