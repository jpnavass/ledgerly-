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
