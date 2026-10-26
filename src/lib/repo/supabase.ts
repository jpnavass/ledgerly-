// ============================================================================
// Repositorio de Producción con Supabase (Supabase Repository)
// Integración con base de datos Postgres y políticas RLS
// ============================================================================

import type { DataRepository, DocumentFilterParams, PaginationParams } from './types.ts';
import type { Document, Client, CatalogItem, Payment, AuditEvent, Org, OrgSettings, License, Membership, UserRole } from '../../types/index.ts';
import { createClient } from '../supabase/client.ts';

export class SupabaseRepository implements DataRepository {
  private getClient() {
    const client = createClient();
    if (!client) {
      throw new Error('Variables de entorno de Supabase no configuradas.');
    }
    return client;
  }

  // Documentos
  async getDocuments(orgId: string, params?: DocumentFilterParams): Promise<Document[]> {
    const supabase = this.getClient();
    let query = supabase
      .from('documents')
      .select('*, items:document_items(*)')
      .eq('org_id', orgId);

    if (params?.doc_type) {
      query = query.eq('doc_type', params.doc_type);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }
    if (params?.client_id) {
      query = query.eq('client_id', params.client_id);
    }
    if (params?.search) {
      query = query.ilike('title', `%${params.search}%`);
    }

    if (params?.page && params?.limit) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as Document[];
  }

  async getDocumentById(orgId: string, id: string): Promise<Document | null> {
    const supabase = this.getClient();
    let query = supabase
      .from('documents')
      .select('*, items:document_items(*)')
      .eq('id', id);

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as unknown as Document;
  }

  async findDocumentByTokenOrId(tokenOrId: string): Promise<Document | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('documents')
      .select('*, items:document_items(*)')
      .or(`public_token_hash.eq.${tokenOrId},id.eq.${tokenOrId}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as Document;
  }

  async saveDocument(orgId: string, doc: Document): Promise<Document> {
    const supabase = this.getClient();
    const { items, client, ...docData } = doc;

    const { data, error } = await supabase
      .from('documents')
      .upsert({ ...docData, org_id: orgId })
      .select()
      .single();

    if (error) throw error;

    // Si hay partidas asociadas, sincronizar
    if (items && items.length > 0) {
      const itemsToUpsert = items.map((item, idx) => ({
        ...item,
        document_id: doc.id,
        org_id: orgId,
        position: item.position ?? idx + 1,
      }));

      const { error: itemsError } = await supabase
        .from('document_items')
        .upsert(itemsToUpsert);

      if (itemsError) throw itemsError;
    }

    return { ...doc, org_id: orgId };
  }

  async deleteDocument(orgId: string, id: string): Promise<boolean> {
    const supabase = this.getClient();
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) throw error;
    return true;
  }

  // Clientes
  async getClients(orgId: string, params?: PaginationParams | string): Promise<Client[]> {
    const supabase = this.getClient();
    let query = supabase.from('clients').select('*');
    if (orgId) {
      query = query.eq('org_id', orgId);
    }
    const search = typeof params === 'string' ? params : params?.search;
    if (search) {
      query = query.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%`);
    }
    if (typeof params === 'object' && params?.page && params?.limit) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }
    const { data, error } = await query.order('name');
    if (error) throw error;
    return (data || []) as Client[];
  }

  async getClientById(orgId: string, id: string): Promise<Client | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !data) return null;
    return data as Client;
  }

  async saveClient(orgId: string, client: Client): Promise<Client> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('clients')
      .upsert({ ...client, org_id: orgId })
      .select()
      .single();

    if (error) throw error;
    return data as Client;
  }

  async deleteClient(orgId: string, id: string): Promise<boolean> {
    const supabase = this.getClient();
    const { error } = await supabase.from('clients').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw error;
    return true;
  }

  // Catálogo
  async getCatalog(orgId: string, search?: string): Promise<CatalogItem[]> {
    const supabase = this.getClient();
    let query = supabase.from('catalog_items').select('*').eq('org_id', orgId);
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    const { data, error } = await query.order('name');
    if (error) throw error;
    return (data || []) as CatalogItem[];
  }

  async getCatalogItemById(orgId: string, id: string): Promise<CatalogItem | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !data) return null;
    return data as CatalogItem;
  }

  async saveCatalogItem(orgId: string, item: CatalogItem): Promise<CatalogItem> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('catalog_items')
      .upsert({ ...item, org_id: orgId })
      .select()
      .single();

    if (error) throw error;
    return data as CatalogItem;
  }

  async deleteCatalogItem(orgId: string, id: string): Promise<boolean> {
    const supabase = this.getClient();
    const { error } = await supabase.from('catalog_items').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw error;
    return true;
  }

  // Pagos
  async getPayments(orgId: string, documentId?: string): Promise<Payment[]> {
    const supabase = this.getClient();
    let query = supabase.from('payments').select('*').eq('org_id', orgId);
    if (documentId) {
      query = query.eq('document_id', documentId);
    }
    const { data, error } = await query.order('due_date');
    if (error) throw error;
    return (data || []) as Payment[];
  }

  async savePayment(orgId: string, payment: Payment): Promise<Payment> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('payments')
      .upsert({ ...payment, org_id: orgId })
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  async markPaymentAsPaid(orgId: string, id: string): Promise<Payment> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('payments')
      .update({ paid_at: new Date().toISOString(), status: 'completed' })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  // Auditoría
  async getAuditEvents(orgId: string, documentId?: string): Promise<AuditEvent[]> {
    const supabase = this.getClient();
    let query = supabase.from('audit_events').select('*').eq('org_id', orgId);
    if (documentId) {
      query = query.eq('document_id', documentId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as AuditEvent[];
  }

  async recordAuditEvent(orgId: string, event: AuditEvent): Promise<AuditEvent> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('audit_events')
      .insert({ ...event, org_id: orgId })
      .select()
      .single();

    if (error) throw error;
    return data as AuditEvent;
  }

  // Organización y Ajustes
  async getOrganization(orgId: string): Promise<Org | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('orgs').select('*').eq('id', orgId).single();
    if (error || !data) return null;
    return data as Org;
  }

  async saveOrganization(org: Org): Promise<Org> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('orgs').upsert(org).select().single();
    if (error) throw error;
    return data as Org;
  }

  async getOrgSettings(orgId: string): Promise<OrgSettings | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('org_settings').select('*').eq('org_id', orgId).single();
    if (error || !data) return null;
    return data as OrgSettings;
  }

  async saveOrgSettings(orgId: string, settings: OrgSettings): Promise<OrgSettings> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('org_settings')
      .upsert({ ...settings, org_id: orgId })
      .select()
      .single();

    if (error) throw error;
    return data as OrgSettings;
  }

  // Licencias y Suscripciones
  async getLicense(orgId: string): Promise<License | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('licenses').select('*').eq('org_id', orgId).single();
    if (error || !data) return null;
    return data as License;
  }

  async saveLicense(license: License): Promise<License> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('licenses').upsert(license).select().single();
    if (error) throw error;
    return data as License;
  }

  async getLicenseBySubscriptionId(subId: string): Promise<License | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('licenses').select('*').eq('stripe_subscription_id', subId).single();
    if (error || !data) return null;
    return data as License;
  }

  // Miembros
  async getMembers(orgId: string): Promise<Membership[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('memberships').select('*').eq('org_id', orgId);
    if (error || !data) return [];
    return data as Membership[];
  }

  async saveMember(member: Membership): Promise<Membership> {
    const supabase = this.getClient();
    const { data, error } = await supabase.from('memberships').upsert(member).select().single();
    if (error) throw error;
    return data as Membership;
  }

  async deleteMember(orgId: string, memberId: string): Promise<boolean> {
    const supabase = this.getClient();
    const { error } = await supabase.from('memberships').delete().eq('id', memberId).eq('org_id', orgId);
    if (error) throw error;
    return true;
  }

  async getUserActiveMembership(): Promise<{ orgId: string; role: UserRole } | null> {
    const supabase = this.getClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;
    const { data, error } = await supabase
      .from('memberships')
      .select('org_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { orgId: data.org_id, role: data.role as UserRole };
  }
}

