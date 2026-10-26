-- ============================================================================
-- Migración 0002: Seguridad por Nivel de Fila (Row-Level Security - RLS)
-- Aislamiento estricto multitenant por Organización y Control de Acceso Basado en Roles (RBAC)
-- ============================================================================

-- Habilitar RLS en todas las tablas
alter table orgs enable row level security;
alter table memberships enable row level security;
alter table licenses enable row level security;
alter table org_settings enable row level security;
alter table clients enable row level security;
alter table client_addresses enable row level security;
alter table catalog_items enable row level security;
alter table documents enable row level security;
alter table document_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table document_signatures enable row level security;
alter table billing_records enable row level security;
alter table audit_events enable row level security;
alter table doc_counters enable row level security;

-- Función de ayuda: verificar membresía activa del usuario en una organización
create or replace function is_org_member(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from memberships
    where org_id = p_org_id
      and user_id = auth.uid()
  );
$$;

-- Función de ayuda: verificar rol owner en una organización
create or replace function is_org_owner(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from memberships
    where org_id = p_org_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- 1. Políticas sobre ORGS
create policy "orgs_select" on orgs
  for select using (is_org_member(id));

create policy "orgs_update" on orgs
  for update using (is_org_owner(id));

-- 2. Políticas sobre MEMBERSHIPS
create policy "memberships_select" on memberships
  for select using (is_org_member(org_id));

create policy "memberships_admin" on memberships
  for all using (is_org_owner(org_id));

-- 3. Políticas sobre LICENSES
create policy "licenses_select" on licenses
  for select using (is_org_member(org_id));

create policy "licenses_admin" on licenses
  for all using (is_org_owner(org_id));

-- 4. Políticas sobre ORG_SETTINGS
create policy "settings_select" on org_settings
  for select using (is_org_member(org_id));

create policy "settings_update" on org_settings
  for update using (is_org_owner(org_id));

-- 5. Políticas sobre CLIENTS
create policy "clients_select" on clients
  for select using (is_org_member(org_id));

create policy "clients_modify" on clients
  for all using (is_org_member(org_id));

-- 6. Políticas sobre CLIENT_ADDRESSES
create policy "client_addresses_policy" on client_addresses
  for all using (is_org_member(org_id));

-- 7. Políticas sobre CATALOG_ITEMS
create policy "catalog_items_policy" on catalog_items
  for all using (is_org_member(org_id));

-- 8. Políticas sobre DOCUMENTS
create policy "documents_select" on documents
  for select using (is_org_member(org_id));

create policy "documents_insert" on documents
  for insert with check (is_org_member(org_id));

create policy "documents_update" on documents
  for update using (is_org_member(org_id));

-- 9. Políticas sobre DOCUMENT_ITEMS
create policy "document_items_policy" on document_items
  for all using (is_org_member(org_id));

-- 10. Políticas sobre PAYMENTS
create policy "payments_select" on payments
  for select using (is_org_member(org_id));

create policy "payments_modify" on payments
  for all using (is_org_member(org_id));

-- 11. Políticas sobre EXPENSES
create policy "expenses_select" on expenses
  for select using (is_org_member(org_id));

create policy "expenses_modify" on expenses
  for all using (is_org_member(org_id));

-- 12. Políticas sobre DOCUMENT_SIGNATURES
create policy "signatures_select" on document_signatures
  for select using (
    exists (
      select 1 from documents
      where documents.id = document_signatures.document_id
        and is_org_member(documents.org_id)
    )
  );

-- 13. Políticas sobre BILLING_RECORDS (Solo lectura para miembros; inserciones restringidas a funciones)
create policy "billing_records_select" on billing_records
  for select using (is_org_member(org_id));

-- 14. Políticas sobre AUDIT_EVENTS (Solo lectura para miembros; inserciones restringidas)
create policy "audit_events_select" on audit_events
  for select using (is_org_member(org_id));

create policy "audit_events_insert" on audit_events
  for insert with check (is_org_member(org_id));

-- 15. Políticas sobre DOC_COUNTERS
create policy "doc_counters_select" on doc_counters
  for select using (is_org_member(org_id));
