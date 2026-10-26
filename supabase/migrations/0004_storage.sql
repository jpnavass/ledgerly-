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
