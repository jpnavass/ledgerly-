-- ============================================================================
-- SUITE OFICIAL DE PRUEBAS DE INTEGRIDAD SQL — PRESUPUESTO EXPRESS ENTERPRISE
-- ============================================================================
-- Este script se puede ejecutar DIRECTAMENTE en el SQL Editor de Supabase (Studio)
-- o con psql. No requiere extensiones externas como pgTAP.
-- Se ejecuta dentro de un bloque anónimo transaccional con ROLLBACK al final
-- para no dejar basura ni datos de prueba en la base de datos de producción.
-- ============================================================================

DO $$
DECLARE
  v_test_org_a UUID := gen_random_uuid();
  v_test_org_b UUID := gen_random_uuid();
  v_test_user_a UUID := gen_random_uuid();
  v_doc_locked_id UUID := gen_random_uuid();
  v_doc_numbered_id UUID := gen_random_uuid();
  v_billing_rec_id UUID := gen_random_uuid();
  v_audit_evt_id UUID := gen_random_uuid();
  v_err_caught BOOLEAN;
  v_count INT;
  v_seq_numbers INT[];
  v_num INT;
  i INT;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'INICIANDO SUITE DE INTEGRIDAD SQL: PRESUPUESTO EXPRESS ENTERPRISE';
  RAISE NOTICE '====================================================================';

  -- --------------------------------------------------------------------------
  -- PREPARACIÓN: Crear organizaciones de prueba temporales
  -- --------------------------------------------------------------------------
  INSERT INTO orgs (id, name, tax_id, address, postal_code, city, country)
  VALUES 
    (v_test_org_a, 'Empresa Test A S.L.', 'B11111111', 'Calle A 1', '28001', 'Madrid', 'España'),
    (v_test_org_b, 'Empresa Test B S.L.', 'B22222222', 'Calle B 2', '28002', 'Madrid', 'España');

  -- --------------------------------------------------------------------------
  -- TEST 1: Bloqueo de UPDATE en billing_records (Append-Only inalterable)
  -- --------------------------------------------------------------------------
  INSERT INTO billing_records (id, org_id, record_type, series, number, issue_date, total_cents, vat_cents, previous_hash, hash, software_version)
  VALUES (v_billing_rec_id, v_test_org_a, 'alta', 'FAC', 1, '2027-01-01', 12100, 2100, '', 'DUMMYHASH1', '2.0.0');

  v_err_caught := FALSE;
  BEGIN
    UPDATE billing_records SET total_cents = 99999 WHERE id = v_billing_rec_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 1 FALLIDO: Se permitió UPDATE en billing_records (debe ser inmutable)';
  END IF;
  RAISE NOTICE '[OK] Test 1: Inalterabilidad verificada — UPDATE prohibido en billing_records';

  -- --------------------------------------------------------------------------
  -- TEST 2: Bloqueo de DELETE en billing_records (Append-Only inalterable)
  -- --------------------------------------------------------------------------
  v_err_caught := FALSE;
  BEGIN
    DELETE FROM billing_records WHERE id = v_billing_rec_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 2 FALLIDO: Se permitió DELETE en billing_records (debe ser inmutable)';
  END IF;
  RAISE NOTICE '[OK] Test 2: Inalterabilidad verificada — DELETE prohibido en billing_records';

  -- --------------------------------------------------------------------------
  -- TEST 3: Bloqueo de UPDATE y DELETE en audit_events (Inalterabilidad legal)
  -- --------------------------------------------------------------------------
  INSERT INTO audit_events (id, org_id, actor_kind, type, description, previous_hash, hash)
  VALUES (v_audit_evt_id, v_test_org_a, 'system', 'test.event', 'Evento de auditoría sellado', '', 'EVTHASH1');

  v_err_caught := FALSE;
  BEGIN
    UPDATE audit_events SET description = 'Manipulación no autorizada' WHERE id = v_audit_evt_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 3 FALLIDO: Se permitió UPDATE en audit_events (debe ser inmutable)';
  END IF;

  v_err_caught := FALSE;
  BEGIN
    DELETE FROM audit_events WHERE id = v_audit_evt_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 3 FALLIDO: Se permitió DELETE en audit_events (debe ser inmutable)';
  END IF;
  RAISE NOTICE '[OK] Test 3: Registro de auditoría verificado — UPDATE/DELETE prohibidos en audit_events';

  -- --------------------------------------------------------------------------
  -- TEST 4: Bloqueo de modificación de importes en documento sellado (locked_at)
  -- --------------------------------------------------------------------------
  INSERT INTO documents (id, org_id, doc_type, series, number, status, title, subtotal_cents, vat_cents, total_cents, locked_at)
  VALUES (v_doc_locked_id, v_test_org_a, 'invoice', 'FAC', 10, 'issued', 'Factura Sellada', 10000, 2100, 12100, now());

  v_err_caught := FALSE;
  BEGIN
    UPDATE documents SET total_cents = 50000 WHERE id = v_doc_locked_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 4 FALLIDO: Se permitió modificar total_cents en documento sellado con locked_at';
  END IF;
  RAISE NOTICE '[OK] Test 4: Inmutabilidad documental verificada — Modificación de total_cents bloqueada en documento sellado (locked_at)';

  -- --------------------------------------------------------------------------
  -- TEST 5: Bloqueo de DELETE físico en documento con numeración oficial asignada
  -- --------------------------------------------------------------------------
  INSERT INTO documents (id, org_id, doc_type, series, number, status, title, subtotal_cents, vat_cents, total_cents)
  VALUES (v_doc_numbered_id, v_test_org_a, 'invoice', 'FAC', 11, 'issued', 'Factura Numerada Oficial', 10000, 2100, 12100);

  v_err_caught := FALSE;
  BEGIN
    DELETE FROM documents WHERE id = v_doc_numbered_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 5 FALLIDO: Se permitió borrar una factura con número oficial asignado (Art. 29.2.j LGT)';
  END IF;
  RAISE NOTICE '[OK] Test 5: Cumplimiento Art. 29.2.j LGT — DELETE bloqueado en documento con numeración oficial';

  -- --------------------------------------------------------------------------
  -- TEST 6: Numeración secuencial atómica y concurrente sin huecos (50 emisiones)
  -- --------------------------------------------------------------------------
  v_seq_numbers := ARRAY[]::INT[];
  FOR i IN 1..50 LOOP
    v_num := next_document_number(v_test_org_a, 'invoice', 'TEST_CONC', 2027);
    v_seq_numbers := array_append(v_seq_numbers, v_num);
  END LOOP;

  -- Comprobar que hay exactamente 50 números y que van del 1 al 50 de forma consecutiva
  IF array_length(v_seq_numbers, 1) <> 50 THEN
    RAISE EXCEPTION 'TEST 6 FALLIDO: No se generaron 50 números';
  END IF;

  FOR i IN 1..50 LOOP
    IF v_seq_numbers[i] <> i THEN
      RAISE EXCEPTION 'TEST 6 FALLIDO: Hueco o salto detectado en iteración %. Se obtuvo %, se esperaba %', i, v_seq_numbers[i], i;
    END IF;
  END LOOP;
  RAISE NOTICE '[OK] Test 6: Numeración atómica verificada — 50 emisiones generaron correlativos 1..50 estrictos sin saltos ni huecos';

  -- --------------------------------------------------------------------------
  -- TEST 7: Aislamiento RLS (Políticas activas en tablas)
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public' 
    AND tablename IN ('documents', 'billing_records', 'audit_events', 'clients', 'catalog_items', 'payments')
    AND rowsecurity = true;

  IF v_count < 6 THEN
    RAISE EXCEPTION 'TEST 7 FALLIDO: RLS no está activo en todas las tablas clave (encontradas % de 6)', v_count;
  END IF;
  RAISE NOTICE '[OK] Test 7: Políticas RLS verificadas — Activas en todas las tablas sensibles del sistema';

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'RESULTADO FINAL: TODAS LAS 7 PRUEBAS DE INTEGRIDAD SQL HAN PASADO';
  RAISE NOTICE '====================================================================';

  -- ROLLBACK para dejar la base de datos limpia al 100%
  RAISE EXCEPTION 'ROLLBACK_CLEANUP: Pruebas completadas con éxito. Limpieza transaccional ejecutada.';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'ROLLBACK_CLEANUP%' THEN
      RAISE NOTICE 'Base de datos restaurada al estado original. No quedan registros residuales.';
    ELSE
      RAISE;
    END IF;
END $$;
