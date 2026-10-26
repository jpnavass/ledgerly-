// ============================================================================
// Interfaz Abstracta de Repositorio y Tipos de Persistencia Multiempresa
// ============================================================================

import type { Document, DocumentItem, Client, CatalogItem, Payment, AuditEvent, Org, OrgSettings, DocType, DocStatus, License, Membership, UserRole } from '../../types/index.ts';

export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentFilterParams extends PaginationParams {
  doc_type?: DocType;
  status?: DocStatus;
  client_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface DataRepository {
  // Documentos
  getDocuments(orgId: string, params?: DocumentFilterParams): Promise<Document[]>;
  getDocumentById(orgId: string, id: string): Promise<Document | null>;
  findDocumentByTokenOrId(tokenOrId: string): Promise<Document | null>;
  saveDocument(orgId: string, doc: Document): Promise<Document>;
  deleteDocument(orgId: string, id: string): Promise<boolean>;

  // Clientes
  getClients(orgId: string, params?: PaginationParams | string): Promise<Client[]>;
  getClientById(orgId: string, id: string): Promise<Client | null>;
  saveClient(orgId: string, client: Client): Promise<Client>;
  deleteClient(orgId: string, id: string): Promise<boolean>;

  // Catálogo
  getCatalog(orgId: string, search?: string): Promise<CatalogItem[]>;
  getCatalogItemById(orgId: string, id: string): Promise<CatalogItem | null>;
  saveCatalogItem(orgId: string, item: CatalogItem): Promise<CatalogItem>;
  deleteCatalogItem(orgId: string, id: string): Promise<boolean>;

  // Tesorería / Pagos
  getPayments(orgId: string, documentId?: string): Promise<Payment[]>;
  savePayment(orgId: string, payment: Payment): Promise<Payment>;
  markPaymentAsPaid(orgId: string, id: string): Promise<Payment>;

  // Auditoría
  getAuditEvents(orgId: string, documentId?: string): Promise<AuditEvent[]>;
  recordAuditEvent(orgId: string, event: AuditEvent): Promise<AuditEvent>;

  // Organización y Ajustes
  getAllOrganizations(): Promise<Org[]>;
  getOrganization(orgId: string): Promise<Org | null>;
  saveOrganization(org: Org): Promise<Org>;
  getOrgSettings(orgId: string): Promise<OrgSettings | null>;
  saveOrgSettings(orgId: string, settings: OrgSettings): Promise<OrgSettings>;

  // Licencias y Suscripciones
  getLicense(orgId: string): Promise<License | null>;
  saveLicense(license: License): Promise<License>;
  getLicenseBySubscriptionId(subId: string): Promise<License | null>;

  // Miembros
  getMembers(orgId: string): Promise<Membership[]>;
  saveMember(member: Membership): Promise<Membership>;
  deleteMember(orgId: string, memberId: string): Promise<boolean>;
  getUserActiveMembership(): Promise<{ orgId: string; role: UserRole } | null>;
}

