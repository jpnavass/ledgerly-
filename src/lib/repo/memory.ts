// ============================================================================
// Implementación en Memoria del Repositorio (Memory Repository)
// Para ejecución aislada de pruebas unitarias y entornos sin red
// ============================================================================

import type { DataRepository, DocumentFilterParams, PaginationParams } from './types.ts';
import type { Document, Client, CatalogItem, Payment, AuditEvent, Org, OrgSettings, License, Membership, UserRole } from '../../types/index.ts';

export class MemoryRepository implements DataRepository {
  private documents = new Map<string, Document>();
  private clients = new Map<string, Client>();
  private catalog = new Map<string, CatalogItem>();
  private payments = new Map<string, Payment>();
  private auditEvents = new Map<string, AuditEvent>();
  private orgs = new Map<string, Org>();
  private settings = new Map<string, OrgSettings>();

  // Documentos
  async getDocuments(orgId: string, params?: DocumentFilterParams): Promise<Document[]> {
    let docs = Array.from(this.documents.values()).filter((d) => d.org_id === orgId);

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

    return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getDocumentById(orgId: string, id: string): Promise<Document | null> {
    const doc = this.documents.get(id);
    if (!doc || doc.org_id !== orgId) return null;
    return doc;
  }

  async findDocumentByTokenOrId(identifier: string): Promise<Document | null> {
    const docs = Array.from(this.documents.values());
    const found = docs.find(
      (d) =>
        d.id === identifier ||
        d.public_token_hash === identifier
    );
    return found || null;
  }

  async saveDocument(orgId: string, doc: Document): Promise<Document> {
    const toSave: Document = {
      ...doc,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };
    this.documents.set(doc.id, toSave);
    return toSave;
  }

  async deleteDocument(orgId: string, id: string): Promise<boolean> {
    const doc = this.documents.get(id);
    if (!doc || doc.org_id !== orgId) return false;
    if (doc.number !== null && doc.number !== undefined) {
      throw new Error('No se puede eliminar un documento con numeración oficial asignada.');
    }
    if (doc.locked_at) {
      throw new Error('No se puede eliminar un documento bloqueado e inmutable.');
    }
    return this.documents.delete(id);
  }

  // Clientes
  async getClients(orgId: string, params?: PaginationParams | string): Promise<Client[]> {
    let list = Array.from(this.clients.values()).filter((c) => c.org_id === orgId);
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
    const client = this.clients.get(id);
    if (!client || client.org_id !== orgId) return null;
    return client;
  }

  async saveClient(orgId: string, client: Client): Promise<Client> {
    const toSave: Client = {
      ...client,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };
    this.clients.set(client.id, toSave);
    return toSave;
  }

  async deleteClient(orgId: string, id: string): Promise<boolean> {
    const client = this.clients.get(id);
    if (!client || client.org_id !== orgId) return false;
    return this.clients.delete(id);
  }

  // Catálogo
  async getCatalog(orgId: string, search?: string): Promise<CatalogItem[]> {
    let list = Array.from(this.catalog.values()).filter((i) => i.org_id === orgId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }

  async getCatalogItemById(orgId: string, id: string): Promise<CatalogItem | null> {
    const item = this.catalog.get(id);
    if (!item || item.org_id !== orgId) return null;
    return item;
  }

  async saveCatalogItem(orgId: string, item: CatalogItem): Promise<CatalogItem> {
    const toSave: CatalogItem = {
      ...item,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };
    this.catalog.set(item.id, toSave);
    return toSave;
  }

  async deleteCatalogItem(orgId: string, id: string): Promise<boolean> {
    const item = this.catalog.get(id);
    if (!item || item.org_id !== orgId) return false;
    return this.catalog.delete(id);
  }

  // Pagos
  async getPayments(orgId: string, documentId?: string): Promise<Payment[]> {
    let list = Array.from(this.payments.values()).filter((p) => p.org_id === orgId);
    if (documentId) {
      list = list.filter((p) => p.document_id === documentId);
    }
    return list;
  }

  async savePayment(orgId: string, payment: Payment): Promise<Payment> {
    const toSave: Payment = {
      ...payment,
      org_id: orgId,
    };
    this.payments.set(payment.id, toSave);
    return toSave;
  }

  async markPaymentAsPaid(orgId: string, id: string): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment || payment.org_id !== orgId) {
      throw new Error('Pago no encontrado.');
    }
    const updated: Payment = {
      ...payment,
      paid_at: new Date().toISOString(),
      status: 'completed',
    };
    this.payments.set(id, updated);
    return updated;
  }

  // Auditoría
  async getAuditEvents(orgId: string, documentId?: string): Promise<AuditEvent[]> {
    let list = Array.from(this.auditEvents.values()).filter((e) => e.org_id === orgId);
    if (documentId) {
      list = list.filter((e) => e.document_id === documentId);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async recordAuditEvent(orgId: string, event: AuditEvent): Promise<AuditEvent> {
    const toSave: AuditEvent = {
      ...event,
      org_id: orgId,
      created_at: event.created_at || new Date().toISOString(),
    };
    this.auditEvents.set(event.id, toSave);
    return toSave;
  }

  // Organización y Ajustes
  async getOrganization(orgId: string): Promise<Org | null> {
    return this.orgs.get(orgId) || null;
  }

  async saveOrganization(org: Org): Promise<Org> {
    this.orgs.set(org.id, org);
    return org;
  }

  async getOrgSettings(orgId: string): Promise<OrgSettings | null> {
    return this.settings.get(orgId) || null;
  }

  async saveOrgSettings(orgId: string, settings: OrgSettings): Promise<OrgSettings> {
    const toSave: OrgSettings = {
      ...settings,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };
    this.settings.set(orgId, toSave);
    return toSave;
  }

  // Licencias y Suscripciones
  private licenses = new Map<string, License>();
  private members = new Map<string, Membership>();

  async getLicense(orgId: string): Promise<License | null> {
    return this.licenses.get(orgId) || null;
  }

  async saveLicense(license: License): Promise<License> {
    this.licenses.set(license.org_id, license);
    return license;
  }

  async getLicenseBySubscriptionId(subId: string): Promise<License | null> {
    for (const lic of this.licenses.values()) {
      if (lic.stripe_subscription_id === subId) {
        return lic;
      }
    }
    return null;
  }

  // Miembros
  async getMembers(orgId: string): Promise<Membership[]> {
    return Array.from(this.members.values()).filter((m) => m.org_id === orgId);
  }

  async saveMember(member: Membership): Promise<Membership> {
    this.members.set(member.id, member);
    return member;
  }

  async deleteMember(orgId: string, memberId: string): Promise<boolean> {
    const member = this.members.get(memberId);
    if (!member || member.org_id !== orgId) return false;
    return this.members.delete(memberId);
  }

  async getUserActiveMembership(): Promise<{ orgId: string; role: UserRole } | null> {
    const list = Array.from(this.members.values());
    if (list.length > 0) {
      return { orgId: list[0].org_id, role: list[0].role };
    }
    const orgList = Array.from(this.orgs.values());
    if (orgList.length > 0) {
      return { orgId: orgList[0].id, role: 'owner' };
    }
    return null;
  }


  // Utilidad de limpieza para pruebas
  clear(): void {
    this.documents.clear();
    this.clients.clear();
    this.catalog.clear();
    this.payments.clear();
    this.auditEvents.clear();
    this.orgs.clear();
    this.settings.clear();
    this.licenses.clear();
    this.members.clear();
  }
}
