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
