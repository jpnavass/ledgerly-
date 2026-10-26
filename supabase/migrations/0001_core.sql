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
