// ============================================================================
// Repositorio Local para Desarrollo (Local Storage Repository)
// Persistencia en navegador aislada por Organización, sin datos precargados
// ============================================================================

import type { DataRepository, DocumentFilterParams, PaginationParams } from './types.ts';
import type { Document, Client, CatalogItem, Payment, AuditEvent, Org, OrgSettings, License, Membership, UserRole } from '../../types/index.ts';

const LOCAL_STORAGE_KEYS = {
  DOCUMENTS: 'pe_enterprise_documents_v2',
  CLIENTS: 'pe_enterprise_clients_v2',
  CATALOG: 'pe_enterprise_catalog_v2',
  PAYMENTS: 'pe_enterprise_payments_v2',
  AUDIT_LOG: 'pe_enterprise_audit_log_v2',
  ORGANIZATIONS: 'pe_enterprise_orgs_v2',
  SETTINGS: 'pe_enterprise_settings_v2',
  LICENSES: 'pe_enterprise_licenses_v2',
  MEMBERS: 'pe_enterprise_members_v2',
};

export function safeGetStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

export function safeSetStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('pe_store_updated'));
  } catch (err) {
    console.error('Error al persistir en almacenamiento local:', err);
  }
}

function safeGet<T>(key: string, fallback: T): T {
  return safeGetStorage(key, fallback);
}

function safeSet<T>(key: string, value: T): void {
  safeSetStorage(key, value);
}

export class LocalStorageRepository implements DataRepository {
  // Documentos
  async getDocuments(orgId: string, params?: DocumentFilterParams): Promise<Document[]> {
    const all = safeGet<Document[]>(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
    let docs = all.filter((d) => d.org_id === orgId);

    if (params?.doc_type) {
      docs = docs.filter((d) => d.doc_type === params.doc_type);
    }
    if (params?.status) {
      docs = docs.filter((d) => d.status === params.status);
    }
    if (params?.client_id) {
      docs = docs.filter((d) => d.client_id === params.client_id);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title?.toLowerCase().includes(q) ||
          d.series?.toLowerCase().includes(q) ||
          d.number?.toString().includes(q)
      );
    }

    let sorted = docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (params?.page && params?.limit) {
      const start = (params.page - 1) * params.limit;
      sorted = sorted.slice(start, start + params.limit);
    }
    return sorted;
  }

  async getDocumentById(orgId: string, id: string): Promise<Document | null> {
    const all = safeGet<Document[]>(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
    return all.find((d) => d.id === id && (!orgId || d.org_id === orgId)) || null;
  }

  async findDocumentByTokenOrId(tokenOrId: string): Promise<Document | null> {
    const all = safeGet<Document[]>(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
    return (
      all.find(
        (d) =>
          d.public_token_hash === tokenOrId ||
          d.id === tokenOrId
      ) || null
    );
  }

  async saveDocument(orgId: string, doc: Document): Promise<Document> {
    const all = safeGet<Document[]>(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
    const idx = all.findIndex((d) => d.id === doc.id);
    const toSave: Document = {
      ...doc,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };

    let updated: Document[];
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = toSave;
    } else {
      updated = [toSave, ...all];
    }

    safeSet(LOCAL_STORAGE_KEYS.DOCUMENTS, updated);
    return toSave;
  }

  async deleteDocument(orgId: string, id: string): Promise<boolean> {
    const all = safeGet<Document[]>(LOCAL_STORAGE_KEYS.DOCUMENTS, []);
    const doc = all.find((d) => d.id === id && d.org_id === orgId);
    if (!doc) return false;

    if (doc.number !== null && doc.number !== undefined) {
      throw new Error('No se puede eliminar un documento con numeración asignada.');
    }
    if (doc.locked_at) {
      throw new Error('No se puede eliminar un documento sellado e inmutable.');
    }

    const filtered = all.filter((d) => d.id !== id);
    safeSet(LOCAL_STORAGE_KEYS.DOCUMENTS, filtered);
    return true;
  }

  // Clientes
  async getClients(orgId: string, params?: PaginationParams | string): Promise<Client[]> {
    const all = safeGet<Client[]>(LOCAL_STORAGE_KEYS.CLIENTS, []);
    let list = all.filter((c) => !orgId || c.org_id === orgId);
    const search = typeof params === 'string' ? params : params?.search;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.tax_id.toLowerCase().includes(q));
    }
    if (typeof params === 'object' && params?.page && params?.limit) {
      const start = (params.page - 1) * params.limit;
      list = list.slice(start, start + params.limit);
    }
    return list;
  }

  async getClientById(orgId: string, id: string): Promise<Client | null> {
    const all = safeGet<Client[]>(LOCAL_STORAGE_KEYS.CLIENTS, []);
    return all.find((c) => c.id === id && c.org_id === orgId) || null;
  }

  async saveClient(orgId: string, client: Client): Promise<Client> {
    const all = safeGet<Client[]>(LOCAL_STORAGE_KEYS.CLIENTS, []);
    const idx = all.findIndex((c) => c.id === client.id);
    const toSave: Client = {
      ...client,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };

    let updated: Client[];
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = toSave;
    } else {
      updated = [toSave, ...all];
    }

    safeSet(LOCAL_STORAGE_KEYS.CLIENTS, updated);
    return toSave;
  }

  async deleteClient(orgId: string, id: string): Promise<boolean> {
    const all = safeGet<Client[]>(LOCAL_STORAGE_KEYS.CLIENTS, []);
    const filtered = all.filter((c) => c.id !== id);
    safeSet(LOCAL_STORAGE_KEYS.CLIENTS, filtered);
    return true;
  }

  // Catálogo
  async getCatalog(orgId: string, search?: string): Promise<CatalogItem[]> {
    const all = safeGet<CatalogItem[]>(LOCAL_STORAGE_KEYS.CATALOG, []);
    let list = all.filter((i) => i.org_id === orgId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }

  async getCatalogItemById(orgId: string, id: string): Promise<CatalogItem | null> {
    const all = safeGet<CatalogItem[]>(LOCAL_STORAGE_KEYS.CATALOG, []);
    return all.find((i) => i.id === id && i.org_id === orgId) || null;
  }

  async saveCatalogItem(orgId: string, item: CatalogItem): Promise<CatalogItem> {
    const all = safeGet<CatalogItem[]>(LOCAL_STORAGE_KEYS.CATALOG, []);
    const idx = all.findIndex((i) => i.id === item.id);
    const toSave: CatalogItem = {
      ...item,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };

    let updated: CatalogItem[];
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = toSave;
    } else {
      updated = [toSave, ...all];
    }

    safeSet(LOCAL_STORAGE_KEYS.CATALOG, updated);
    return toSave;
  }

  async deleteCatalogItem(orgId: string, id: string): Promise<boolean> {
    const all = safeGet<CatalogItem[]>(LOCAL_STORAGE_KEYS.CATALOG, []);
    const filtered = all.filter((i) => i.id !== id);
    safeSet(LOCAL_STORAGE_KEYS.CATALOG, filtered);
    return true;
  }

  // Pagos
  async getPayments(orgId: string, documentId?: string): Promise<Payment[]> {
    const all = safeGet<Payment[]>(LOCAL_STORAGE_KEYS.PAYMENTS, []);
    let list = all.filter((p) => p.org_id === orgId);
    if (documentId) {
      list = list.filter((p) => p.document_id === documentId);
    }
    return list;
  }

  async savePayment(orgId: string, payment: Payment): Promise<Payment> {
    const all = safeGet<Payment[]>(LOCAL_STORAGE_KEYS.PAYMENTS, []);
    const idx = all.findIndex((p) => p.id === payment.id);
    const toSave: Payment = {
      ...payment,
      org_id: orgId,
    };

    let updated: Payment[];
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = toSave;
    } else {
      updated = [toSave, ...all];
    }

    safeSet(LOCAL_STORAGE_KEYS.PAYMENTS, updated);
    return toSave;
  }

  async markPaymentAsPaid(orgId: string, id: string): Promise<Payment> {
    const all = safeGet<Payment[]>(LOCAL_STORAGE_KEYS.PAYMENTS, []);
    const payment = all.find((p) => p.id === id && p.org_id === orgId);
    if (!payment) throw new Error('Pago no encontrado.');

    const updatedPayment: Payment = {
      ...payment,
      paid_at: new Date().toISOString(),
      status: 'completed',
    };

    const updated = all.map((p) => (p.id === id ? updatedPayment : p));
    safeSet(LOCAL_STORAGE_KEYS.PAYMENTS, updated);
    return updatedPayment;
  }

  // Auditoría
  async getAuditEvents(orgId: string, documentId?: string): Promise<AuditEvent[]> {
    const all = safeGet<AuditEvent[]>(LOCAL_STORAGE_KEYS.AUDIT_LOG, []);
    let list = all.filter((e) => e.org_id === orgId);
    if (documentId) {
      list = list.filter((e) => e.document_id === documentId);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async recordAuditEvent(orgId: string, event: AuditEvent): Promise<AuditEvent> {
    const all = safeGet<AuditEvent[]>(LOCAL_STORAGE_KEYS.AUDIT_LOG, []);
    const toSave: AuditEvent = {
      ...event,
      org_id: orgId,
      created_at: event.created_at || new Date().toISOString(),
    };
    safeSet(LOCAL_STORAGE_KEYS.AUDIT_LOG, [toSave, ...all]);
    return toSave;
  }

  // Organización y Ajustes
  async getOrganization(orgId: string): Promise<Org | null> {
    const orgs = safeGet<Org[]>(LOCAL_STORAGE_KEYS.ORGANIZATIONS, []);
    return orgs.find((o) => o.id === orgId) || null;
  }

  async saveOrganization(org: Org): Promise<Org> {
    const orgs = safeGet<Org[]>(LOCAL_STORAGE_KEYS.ORGANIZATIONS, []);
    const idx = orgs.findIndex((o) => o.id === org.id);
    let updated: Org[];
    if (idx >= 0) {
      updated = [...orgs];
      updated[idx] = org;
    } else {
      updated = [org, ...orgs];
    }
    safeSet(LOCAL_STORAGE_KEYS.ORGANIZATIONS, updated);
    return org;
  }

  async getOrgSettings(orgId: string): Promise<OrgSettings | null> {
    const settings = safeGet<OrgSettings[]>(LOCAL_STORAGE_KEYS.SETTINGS, []);
    return settings.find((s) => s.org_id === orgId) || null;
  }

  async saveOrgSettings(orgId: string, settings: OrgSettings): Promise<OrgSettings> {
    const list = safeGet<OrgSettings[]>(LOCAL_STORAGE_KEYS.SETTINGS, []);
    const idx = list.findIndex((s) => s.org_id === orgId);
    const toSave: OrgSettings = {
      ...settings,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };
    let updated: OrgSettings[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = toSave;
    } else {
      updated = [toSave, ...list];
    }
    safeSet(LOCAL_STORAGE_KEYS.SETTINGS, updated);
    return toSave;
  }

  // Licencias y Suscripciones
  async getLicense(orgId: string): Promise<License | null> {
    const licenses = safeGet<License[]>(LOCAL_STORAGE_KEYS.LICENSES, []);
    return licenses.find((l) => l.org_id === orgId) || null;
  }

  async saveLicense(license: License): Promise<License> {
    const list = safeGet<License[]>(LOCAL_STORAGE_KEYS.LICENSES, []);
    const idx = list.findIndex((l) => l.org_id === license.org_id);
    let updated: License[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = license;
    } else {
      updated = [license, ...list];
    }
    safeSet(LOCAL_STORAGE_KEYS.LICENSES, updated);
    return license;
  }

  async getLicenseBySubscriptionId(subId: string): Promise<License | null> {
    const list = safeGet<License[]>(LOCAL_STORAGE_KEYS.LICENSES, []);
    return list.find((l) => l.stripe_subscription_id === subId) || null;
  }

  // Miembros
  async getMembers(orgId: string): Promise<Membership[]> {
    const list = safeGet<Membership[]>(LOCAL_STORAGE_KEYS.MEMBERS, []);
    return list.filter((m) => m.org_id === orgId);
  }

  async saveMember(member: Membership): Promise<Membership> {
    const list = safeGet<Membership[]>(LOCAL_STORAGE_KEYS.MEMBERS, []);
    const idx = list.findIndex((m) => m.id === member.id);
    let updated: Membership[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = member;
    } else {
      updated = [member, ...list];
    }
    safeSet(LOCAL_STORAGE_KEYS.MEMBERS, updated);
    return member;
  }

  async deleteMember(orgId: string, memberId: string): Promise<boolean> {
    const list = safeGet<Membership[]>(LOCAL_STORAGE_KEYS.MEMBERS, []);
    const filtered = list.filter((m) => m.id !== memberId || m.org_id !== orgId);
    safeSet(LOCAL_STORAGE_KEYS.MEMBERS, filtered);
    return true;
  }

  async getUserActiveMembership(): Promise<{ orgId: string; role: UserRole } | null> {
    const org = await this.getOrganization('');
    if (!org) return null;
    return { orgId: org.id, role: 'owner' };
  }
}

