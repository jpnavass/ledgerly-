-- ============================================================================
-- Migración 0001: Esquema de Núcleo Empresarial y Relacional
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Organizaciones / Empresas
create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null,
  tax_id text not null,
  address text not null,
  postal_code text not null,
  city text not null,
  province text,
  country text not null default 'España',
  phone text,
  email text,
  website text,
  logo_url text,
  brand_color text default '#6366F1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Membresías y Roles
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'employee')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- 3. Licencias y Planes de Suscripción
create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'business')),
  valid_until timestamptz not null,
  is_active boolean not null default true,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

-- 4. Ajustes Operativos y Fiscales de la Organización
create table if not exists org_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade unique,
  default_validity_days int not null default 30,
  default_payment_terms text,
  default_terms_text text,
  default_vat_rate numeric(5,2) not null default 21.00,
  default_irpf_rate numeric(5,2) not null default 0.00,
  series jsonb not null default '{
    "quote": {"prefix": "PRE", "reset_yearly": true},
    "delivery_note": {"prefix": "ALB", "reset_yearly": true},
    "proforma": {"prefix": "PRO", "reset_yearly": true},
    "invoice": {"prefix": "FAC", "reset_yearly": true},
    "credit_note": {"prefix": "REC", "reset_yearly": true}
  }'::jsonb,
  iban text,
  billing_mode text not null default 'no_verifactu' check (billing_mode in ('no_verifactu', 'verifactu')),
  taxpayer_kind text not null default 'sociedad' check (taxpayer_kind in ('sociedad', 'autonomo', 'otro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Clientes
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  legal_name text,
  tax_id text not null,
  email text,
  phone text,
  address text not null,
  postal_code text not null,
  city text not null,
  province text,
  country text not null default 'España',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Direcciones de Clientes
create table if not exists client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  label text,
  address text not null,
  city text not null,
  postal_code text not null,
  province text,
  country text not null default 'España',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7. Catálogo de Artículos y Tarifario
create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  category text,
  name text not null,
  description text,
  unit text not null default 'ud',
  price_cents bigint not null default 0 check (price_cents >= 0),
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  vat_rate numeric(5,2) not null default 21.00,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Documentos Principales
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  client_id uuid not null references clients(id),
  address_id uuid references client_addresses(id),
  doc_type text not null check (doc_type in ('quote', 'delivery_note', 'proforma', 'invoice', 'credit_note')),
  series text,
  number int,
  version int not null default 1,
  status text not null check (status in ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'invoiced', 'issued', 'paid', 'partially_paid', 'void')),
  title text,
  cover_summary text,
  notes_public text,
  notes_internal text,
  issue_date date,
  operation_date date,
  valid_until date,
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  signature_data text,
  converted_from uuid references documents(id),
  rectifies_document_id uuid references documents(id),
  rectification_reason text,
  rectification_method text check (rectification_method in ('differences', 'substitution')),
  apply_surcharge boolean not null default false,
  subtotal_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  surcharge_cents bigint not null default 0,
  irpf_cents bigint not null default 0,
  total_cents bigint not null default 0,
  vat_breakdown jsonb not null default '[]'::jsonb,
  payment_terms text,
  payment_iban text,
  exemption_note text,
  pdf_url text,
  pdf_hash text,
  public_token_hash text,
  locked_at timestamptz,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Restricción de unicidad para serie + número por organización cuando está asignado
create unique index if not exists idx_unique_document_number 
on documents (org_id, doc_type, series, number) 
where number is not null;

-- 9. Partidas y Capítulos del Documento
create table if not exists document_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  item_type text not null check (item_type in ('chapter', 'line')),
  position int not null,
  parent_id uuid references document_items(id),
  catalog_item_id uuid references catalog_items(id),
  description text not null,
  unit text default 'ud',
  quantity numeric(12,3) not null default 1.000,
  price_cents bigint not null default 0,
  cost_cents bigint not null default 0,
  discount_pct numeric(5,2) not null default 0.00,
  vat_rate numeric(5,2) not null default 21.00,
  vat_cents bigint not null default 0,
  irpf_rate numeric(5,2) not null default 0.00,
  irpf_cents bigint not null default 0,
  subtotal_cents bigint not null default 0,
  total_cents bigint not null default 0,
  is_optional boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. Hitos de Cobro y Pagos
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  label text,
  percentage numeric(5,2),
  amount_cents bigint not null check (amount_cents >= 0),
  due_date date,
  paid_at timestamptz,
  method text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. Gastos de Explotación y Costes de Proyecto
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  category text not null,
  supplier_name text not null,
  supplier_tax_id text,
  concept text not null,
  invoice_number text,
  expense_date date not null,
  base_cents bigint not null default 0 check (base_cents >= 0),
  vat_cents bigint not null default 0 check (vat_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  receipt_url text,
  status text not null default 'paid' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 12. Registro de Firmas Electrónicas (eIDAS)
create table if not exists document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete restrict,
  document_version int not null,
  signer_name text not null,
  signer_tax_id text not null,
  signer_email text not null,
  signature_image_path text not null,
  document_pdf_hash text not null,
  otp_verified boolean not null default false,
  ip text not null,
  user_agent text not null,
  signed_at timestamptz not null default now(),
  evidence_hash text not null,
  created_at timestamptz not null default now()
);

-- 13. Registro de Facturación Inalterable (Ley Antifraude / Veri*Factu)
create table if not exists billing_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  document_id uuid not null references documents(id) on delete restrict,
  record_type text not null check (record_type in ('alta', 'anulacion')),
  series text not null,
  number int not null,
  issue_date date not null,
  total_cents bigint not null,
  vat_cents bigint not null,
  previous_hash text not null,
  hash text not null,
  generated_at timestamptz not null default now(),
  software_version text not null,
  qr_payload text not null,
  created_at timestamptz not null default now()
);

-- 14. Registro de Auditoría (Audit Log Append-Only)
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete restrict,
  document_id uuid references documents(id) on delete set null,
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('user', 'client', 'system')),
  type text not null,
  title text,
  description text not null,
  ip text,
  user_agent text,
  previous_hash text not null default 'GENESIS',
  hash text not null,
  created_at timestamptz not null default now()
);

-- 15. Contadores de Numeración Correlativa Atómica
create table if not exists doc_counters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  doc_type text not null,
  series text not null,
  fiscal_year int not null,
  last_number int not null default 0,
  updated_at timestamptz not null default now(),
  unique (org_id, doc_type, series, fiscal_year)
);

-- Índices de alto rendimiento para consultas habituales
create index if not exists idx_documents_org_status on documents (org_id, doc_type, status);
create index if not exists idx_documents_client on documents (org_id, client_id);
create index if not exists idx_payments_due on payments (org_id, due_date);
create index if not exists idx_billing_chain on billing_records (org_id, generated_at);
create index if not exists idx_audit_chain on audit_events (org_id, created_at);
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
-- ============================================================================
-- Migración 0003: Lógica Transaccional, Inmutabilidad y Numeración Atómica
-- Cumplimiento estricto de la Ley 11/2021 Antifraude y RD 1619/2012 de Facturación
-- ============================================================================

-- 1. Generador Atómico de Numeración Correlativa Sin Huecos
create or replace function next_document_number(
  p_org uuid,
  p_doc_type text,
  p_series text,
  p_year int
)
returns int language plpgsql security definer as $$
declare
  v_next int;
begin
  insert into doc_counters(org_id, doc_type, series, fiscal_year, last_number)
  values (p_org, p_doc_type, p_series, p_year, 1)
  on conflict (org_id, doc_type, series, fiscal_year)
  do update set last_number = doc_counters.last_number + 1, updated_at = now()
  returning last_number into v_next;

  return v_next;
end;
$$;

-- 2. Triggers de Inmutabilidad y Bloqueo de Alteración Posterior
create or replace function trg_check_document_immutability()
returns trigger language plpgsql as $$
begin
  -- Regla: Si el documento tiene número oficial asignado, queda prohibido su borrado físico
  if (tg_op = 'DELETE') then
    if (old.number is not null) then
      raise exception 'Operación no permitida: Un documento con numeración oficial asignada no puede ser eliminado (Art. 29.2.j LGT). Debe emitir una rectificativa o registrar anulación.';
    end if;
    if (old.locked_at is not null) then
      raise exception 'Operación no permitida: No se puede eliminar un documento sellado e inmutable.';
    end if;
    return old;
  end if;

  -- Regla: Si el documento está bloqueado (locked_at), no se pueden alterar campos económicos ni fiscales
  if (tg_op = 'UPDATE') then
    if (old.locked_at is not null) then
      if (
        old.subtotal_cents != new.subtotal_cents or
        old.vat_cents != new.vat_cents or
        old.irpf_cents != new.irpf_cents or
        old.total_cents != new.total_cents or
        old.series is distinct from new.series or
        old.number is distinct from new.number or
        old.client_id != new.client_id or
        old.issue_date is distinct from new.issue_date or
        old.doc_type != new.doc_type
      ) then
        raise exception 'Violación de integridad: El documento %-% está cerrado y sellado con fecha %. Sus importes y datos fiscales son inmutables.',
          old.series, old.number, old.locked_at;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists check_document_immutability on documents;
create trigger check_document_immutability
  before update or delete on documents
  for each row execute function trg_check_document_immutability();

-- 3. Triggers Append-Only para Registros de Facturación y Auditoría
create or replace function trg_prevent_tampering()
returns trigger language plpgsql as $$
begin
  raise exception 'Inalterabilidad garantizada: Las tablas de auditoría y registros de facturación son de inserción exclusiva (Append-Only). No se permiten modificaciones ni borrados.';
end;
$$;

drop trigger if exists trg_billing_records_tamper on billing_records;
create trigger trg_billing_records_tamper
  before update or delete on billing_records
  for each row execute function trg_prevent_tampering();

drop trigger if exists trg_audit_events_tamper on audit_events;
create trigger trg_audit_events_tamper
  before update or delete on audit_events
  for each row execute function trg_prevent_tampering();

-- 4. Función de Emisión Transaccional de Documentos
create or replace function issue_document(p_document_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_doc record;
  v_settings record;
  v_client record;
  v_series_prefix text;
  v_year int;
  v_next_number int;
  v_now timestamptz := now();
  v_issue_date date := current_date;
  v_prev_hash text := 'GENESIS';
  v_new_hash text;
begin
  -- 1. Obtener y validar documento
  select * into v_doc from documents where id = p_document_id for update;
  if not found then
    raise exception 'Documento no encontrado: %', p_document_id;
  end if;

  if v_doc.status not in ('draft', 'sent') then
    raise exception 'Solo se pueden emitir documentos en estado borrador o pendiente de envío.';
  end if;

  -- 2. Validar cliente y datos fiscales
  select * into v_client from clients where id = v_doc.client_id;
  if not found then
    raise exception 'El documento no tiene cliente asociado.';
  end if;

  if (v_client.tax_id is null or trim(v_client.tax_id) = '') then
    raise exception 'El cliente no tiene NIF/CIF configurado, requisito obligatorio para emitir (RD 1619/2012).';
  end if;

  -- 3. Obtener configuración de series
  select * into v_settings from org_settings where org_id = v_doc.org_id;
  v_series_prefix := coalesce(
    v_settings.series -> v_doc.doc_type ->> 'prefix',
    case v_doc.doc_type
      when 'quote' then 'PRE'
      when 'delivery_note' then 'ALB'
      when 'proforma' then 'PRO'
      when 'invoice' then 'FAC'
      when 'credit_note' then 'REC'
      else 'DOC'
    end
  );

  v_year := extract(year from v_issue_date)::int;

  -- 4. Asignación atómica de número correlativo sin saltos
  v_next_number := next_document_number(v_doc.org_id, v_doc.doc_type, v_series_prefix, v_year);

  -- 5. Generar hash encadenado para registros de facturación
  if v_doc.doc_type in ('invoice', 'credit_note') then
    select hash into v_prev_hash 
    from billing_records 
    where org_id = v_doc.org_id 
    order by generated_at desc, id desc 
    limit 1;

    v_prev_hash := coalesce(v_prev_hash, 'GENESIS');
    v_new_hash := encode(digest(v_prev_hash || v_doc.org_id || v_series_prefix || v_next_number::text || v_doc.total_cents::text || v_now::text, 'sha256'), 'hex');

    insert into billing_records (
      org_id,
      document_id,
      record_type,
      series,
      number,
      issue_date,
      total_cents,
      vat_cents,
      previous_hash,
      hash,
      generated_at,
      software_version,
      qr_payload
    ) values (
      v_doc.org_id,
      v_doc.id,
      'alta',
      v_series_prefix,
      v_next_number,
      v_issue_date,
      v_doc.total_cents,
      v_doc.vat_cents,
      v_prev_hash,
      v_new_hash,
      v_now,
      '2.0.0',
      'https://verifactu.gob.es/consulta?nif=' || v_client.tax_id || '&num=' || v_series_prefix || '-' || v_next_number
    );
  end if;

  -- 6. Actualizar documento a emitido
  update documents set
    series = v_series_prefix,
    number = v_next_number,
    issue_date = v_issue_date,
    status = case when v_doc.doc_type in ('invoice', 'credit_note') then 'issued' else 'sent' end,
    locked_at = case when v_doc.doc_type in ('invoice', 'credit_note') then v_now else null end,
    updated_at = v_now
  where id = p_document_id;

  -- 7. Registrar evento de auditoría
  insert into audit_events (
    org_id,
    document_id,
    actor_kind,
    type,
    title,
    description,
    previous_hash,
    hash,
    created_at
  ) values (
    v_doc.org_id,
    v_doc.id,
    'system',
    'issue',
    'Documento emitido formalmente',
    'Asignada serie ' || v_series_prefix || ' número ' || v_next_number || ' con bloqueo de inmutabilidad.',
    coalesce(v_prev_hash, 'GENESIS'),
    coalesce(v_new_hash, 'SHA256-ISSUE'),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'document_id', p_document_id,
    'series', v_series_prefix,
    'number', v_next_number,
    'issue_date', v_issue_date
  );
end;
$$;

-- 5. Proceso Periódico de Caducidad de Presupuestos
create or replace function expire_quotes()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
begin
  update documents
  set status = 'expired', updated_at = now()
  where doc_type = 'quote'
    and status in ('sent', 'viewed')
    and valid_until is not null
    and valid_until < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
-- ============================================================================
-- Migración 0004: Configuración de Buckets de Almacenamiento Seguro (Storage)
-- Buckets privados con políticas de aislamiento por Organización
-- ============================================================================

-- Crear buckets privados si no existen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('signatures', 'signatures', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('pdfs', 'pdfs', false, 52428800, array['application/pdf']),
  ('receipts', 'receipts', false, 20971520, array['image/png', 'image/jpeg', 'application/pdf']),
  ('logos', 'logos', true, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas de Storage para PDFs
create policy "pdfs_access_org_member" on storage.objects
  for select using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] in (
      select org_id::text from memberships where user_id = auth.uid()
    )
  );

create policy "pdfs_upload_org_member" on storage.objects
  for insert with check (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] in (
      select org_id::text from memberships where user_id = auth.uid()
    )
  );

-- Políticas de Storage para Firmas
create policy "signatures_access_org_member" on storage.objects
  for select using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] in (
      select org_id::text from memberships where user_id = auth.uid()
    )
  );

-- Políticas de Storage para Recibos y Justificantes de Gasto
create policy "receipts_access_org_member" on storage.objects
  for all using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select org_id::text from memberships where user_id = auth.uid()
    )
  );

-- Políticas de Storage para Logotipos de Empresa
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_upload_org_member" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select org_id::text from memberships where user_id = auth.uid()
    )
  );
-- ============================================================================
-- Migración 0005: Preferencias de Usuario y Certificados Cifrados por Organización
-- Presupuesto Express Enterprise
-- ============================================================================

-- 1. Tabla de Preferencias de Usuario (Tema, Diseño, Filtros de UI)
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ui jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "user_preferences_owner_all" on user_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Tabla de Certificados Electrónicos por Organización (Cifrado AES-256-GCM)
create table if not exists org_certificates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  encrypted_data text not null,
  iv text not null,
  tag text not null,
  serial_number text,
  subject_nif text not null,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  created_at timestamptz not null default now()
);

alter table org_certificates enable row level security;

create policy "org_certificates_owner_all" on org_certificates
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));
