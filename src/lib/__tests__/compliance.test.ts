// ============================================================================
// Pruebas Unitarias — Cumplimiento Legal, Huella Digital y Auditoría Encadenada
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, canonicalize } from '../compliance/hash.ts';
import {
  buildBillingRecord,
  buildCancellationRecord,
  verifyBillingChain,
  formatAeatHashPayload,
  formatAeatCancellationPayload,
} from '../compliance/billing-record.ts';
import { buildQrVerificationUrl, generateQrSvg } from '../compliance/qr.ts';
import { createChainedAuditEvent, verifyAuditChain, formatAeatEventPayload } from '../compliance/audit.ts';
import {
  assertVerifactuReady,
  calculateExponentialBackoff,
  AeatCertificateMissingError,
} from '../compliance/aeat-submission.ts';
import { createSignatureEvidence, verifySignatureEvidence } from '../compliance/evidence.ts';
import type { BillingRecord, Document, Org, AuditEvent } from '../../types/index.ts';

describe('Cumplimiento Normativo y Registros Inalterables (compliance.ts)', () => {
  it('vector oficial SHA-256: sha256Hex("abc") produce el hash reglamentario', async () => {
    const hash = await sha256Hex('abc');
    assert.strictEqual(
      hash,
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('vector no contrastado con documento oficial', async () => {
    // Parámetros según especificación técnica AEAT, vector no contrastado con documento oficial.
    const payload = formatAeatHashPayload({
      taxId: '89890001K',
      seriesNumber: '12345678/G33',
      issueDate: '2024-01-01',
      invoiceType: 'F1',
      vatCents: 1235,
      totalCents: 12345,
      previousHash: '',
      generatedAtIso: '2024-01-01T19:20:30+01:00',
    });

    const expectedPayload =
      'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00';

    assert.strictEqual(payload, expectedPayload);

    const calculatedHash = (await sha256Hex(payload)).toUpperCase();
    assert.strictEqual(calculatedHash, '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');
  });

  it('registro de anulación: vector derivado, pendiente de contraste con el oficial', async () => {
    // Vector calculado a partir de la especificación técnica de campos de anulación (pendiente de contraste con vector publicado por AEAT)
    const payload = formatAeatCancellationPayload({
      taxId: '89890001K',
      seriesNumber: '12345678/G33',
      issueDate: '2024-01-01',
      previousHash: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
      generatedAtIso: '2024-01-01T19:30:00+01:00',
    });

    const expectedPayload =
      'IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345678/G33&FechaExpedicionFacturaAnulada=01-01-2024&Huella=3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60&FechaHoraHusoGenRegistro=2024-01-01T19:30:00+01:00';

    assert.strictEqual(payload, expectedPayload);

    const calculatedHash = (await sha256Hex(payload)).toUpperCase();
    assert.strictEqual(calculatedHash, '04ADDC2B4586CD1A9F8D431E453D78E92BF99DF5C1906C257B46A367876DEFA6');
  });

  it('registro de eventos: vector derivado, pendiente de contraste con el oficial', async () => {
    // Vector calculado a partir del formato de eventos de especificación técnica (pendiente de contraste con vector publicado por AEAT)
    const payload = formatAeatEventPayload({
      softwareVersion: '2.0.0',
      eventType: '01',
      generatedAtIso: '2024-01-01T08:00:00+01:00',
      previousHash: '',
    });

    const expectedPayload =
      'SoftwareVersion=2.0.0&TipoEvento=01&FechaHoraHusoGenRegistro=2024-01-01T08:00:00+01:00&Huella=';

    assert.strictEqual(payload, expectedPayload);

    const calculatedHash = (await sha256Hex(payload)).toUpperCase();
    assert.strictEqual(calculatedHash, '21B09A727DE2DC579D78F1BB233FFDF7B42087183510DA8EE8A19ADDE876BF04');
  });

  it('canonicalize serializa objetos con claves ordenadas alfabéticamente sin espacios', () => {
    const objA = { z: 1, a: 2, m: { y: 'test', b: [3, 2, 1] } };
    const objB = { a: 2, m: { b: [3, 2, 1], y: 'test' }, z: 1 };
    assert.strictEqual(canonicalize(objA), canonicalize(objB));
    assert.strictEqual(canonicalize(objA), '{"a":2,"m":{"b":[3,2,1],"y":"test"},"z":1}');
  });

  it('encadena 100 registros de facturación consecutivos y verifyBillingChain verifica su integridad', async () => {
    const org: Org = {
      id: 'org-audit-test',
      name: 'Empresa Test',
      tax_id: 'B12345678',
      address: 'Calle Mayor 1',
      postal_code: '28001',
      city: 'Madrid',
      country: 'España',
    };

    const chain: BillingRecord[] = [];
    let prev: BillingRecord | null = null;

    for (let i = 1; i <= 100; i++) {
      const doc: Document = {
        id: `doc-${i}`,
        org_id: org.id,
        doc_type: 'invoice',
        series: 'FAC',
        number: i,
        issue_date: '2027-03-01',
        total_cents: i * 10000,
        vat_cents: i * 2100,
        discount_cents: 0,
        subtotal_cents: i * 7900,
        irpf_cents: 0,
        items: [],
        version: 1,
        status: 'issued',
        created_at: `2027-03-01T10:00:${i.toString().padStart(2, '0')}Z`,
        updated_at: `2027-03-01T10:00:${i.toString().padStart(2, '0')}Z`,
      };

      const record = await buildBillingRecord(
        doc,
        org,
        prev,
        `2027-03-01T10:00:${i.toString().padStart(2, '0')}Z`
      );
      chain.push(record);
      prev = record;
    }

    assert.strictEqual(chain.length, 100);
    const verification = await verifyBillingChain(chain, org.tax_id);
    assert.strictEqual(verification.ok, true);

    // Alterar un campo del registro 37 -> detectar rotura en índice 37
    const tamperedChain = [...chain];
    tamperedChain[37] = {
      ...tamperedChain[37],
      total_cents: 999999, // Alteración maliciosa de importe
    };

    const failedVerification = await verifyBillingChain(tamperedChain, org.tax_id);
    assert.strictEqual(failedVerification.ok, false);
    assert.strictEqual(failedVerification.firstBrokenIndex, 37);

    // Borrar un registro intermedio -> detectar rotura en eslabón posterior
    const deletedChain = chain.filter((_, idx) => idx !== 50);
    const deletedVerification = await verifyBillingChain(deletedChain, org.tax_id);
    assert.strictEqual(deletedVerification.ok, false);
    assert.strictEqual(deletedVerification.firstBrokenIndex, 50);
  });

  it('formatea y genera URL de verificación QR (parámetros según especificación AEAT, no verificados)', async () => {
    const qrUrl = buildQrVerificationUrl({
      taxId: 'B88549126',
      seriesNumber: 'FAC-0048',
      issueDate: '2027-05-12',
      totalCents: 125050,
      isVerifactu: true,
    });

    assert(qrUrl.startsWith('https://sede.agenciatributaria.gob.es/qr/validador'));
    assert(qrUrl.includes('nif=B88549126'));
    assert(qrUrl.includes('numserie=FAC-0048'));
    assert(qrUrl.includes('fecha=12-05-2027'));
    assert(qrUrl.includes('importe=1250.50'));

    // Generar código QR vectorial en SVG
    const svg = await generateQrSvg(qrUrl);
    assert(svg.includes('<svg'));
  });

  it('código QR: decodifica el payload (parámetros según especificación AEAT, no verificados)', () => {
    const qrUrl = buildQrVerificationUrl({
      taxId: 'B12345678',
      seriesNumber: 'FAC-2027/01',
      issueDate: '2027-04-15',
      totalCents: 54450,
      isVerifactu: false,
    });

    const parsedUrl = new URL(qrUrl);
    assert.strictEqual(parsedUrl.origin, 'https://sede.agenciatributaria.gob.es');
    assert.strictEqual(parsedUrl.pathname, '/qr/cotejo');
    assert.strictEqual(parsedUrl.searchParams.get('nif'), 'B12345678');
    assert.strictEqual(parsedUrl.searchParams.get('numserie'), 'FAC-2027/01');
    assert.strictEqual(parsedUrl.searchParams.get('fecha'), '15-04-2027');
    assert.strictEqual(parsedUrl.searchParams.get('importe'), '544.50');

    // Confirmar que parámetros no reglamentarios (num, total, hash, csv) no constan
    assert.strictEqual(parsedUrl.searchParams.get('num'), null);
    assert.strictEqual(parsedUrl.searchParams.get('total'), null);
    assert.strictEqual(parsedUrl.searchParams.get('hash'), null);
    assert.strictEqual(parsedUrl.searchParams.get('csv'), null);
  });

  it('buildCancellationRecord genera registro de anulación y mantiene encadenamiento criptográfico', async () => {
    const org: Org = {
      id: 'org-canc-1',
      name: 'Empresa Test S.L.',
      tax_id: 'B89890001',
      address: 'Calle 1',
      postal_code: '28001',
      city: 'Madrid',
      country: 'España',
    };

    const doc: Document = {
      id: 'doc-inv-anular',
      org_id: org.id,
      doc_type: 'invoice',
      series: 'FAC',
      number: 99,
      issue_date: '2027-01-10',
      total_cents: 10000,
      vat_cents: 2100,
      discount_cents: 0,
      subtotal_cents: 7900,
      irpf_cents: 0,
      items: [],
      version: 1,
      status: 'void',
    };

    const prevRecord: BillingRecord = {
      id: 'rec-prev',
      org_id: org.id,
      document_id: 'doc-prev',
      record_type: 'alta',
      series: 'FAC',
      number: 98,
      issue_date: '2027-01-09',
      total_cents: 5000,
      vat_cents: 1050,
      previous_hash: '',
      hash: 'PREVIOUS_HASH_HEX_VALUE',
      generated_at: '2027-01-09T10:00:00Z',
      software_version: '2.0.0',
      qr_payload: '',
    };

    const cancelRecord = await buildCancellationRecord(doc, org, prevRecord, '2027-01-10T12:00:00Z');
    assert.strictEqual(cancelRecord.record_type, 'anulacion');
    assert.strictEqual(cancelRecord.previous_hash, 'PREVIOUS_HASH_HEX_VALUE');
    assert.strictEqual(cancelRecord.number, 99);
    assert.strictEqual(cancelRecord.hash.length, 64);
  });

  it('audit_events: encadena registros append-only y detecta manipulaciones', async () => {
    const orgId = 'org-aud-1';
    const events: AuditEvent[] = [];
    let prevHash = '';

    for (let i = 1; i <= 20; i++) {
      const evt = await createChainedAuditEvent({
        orgId,
        actorKind: 'user',
        type: `document.action_${i}`,
        description: `Acción contractual ${i}`,
        previousHash: prevHash,
        nowIso: `2027-01-01T12:00:${i.toString().padStart(2, '0')}Z`,
      });
      events.push(evt);
      prevHash = evt.hash;
    }

    const check = await verifyAuditChain(events);
    assert.strictEqual(check.ok, true);

    // Alterar la descripción del evento 12
    const tampered = [...events];
    tampered[12] = {
      ...tampered[12],
      description: 'Descripción alterada en base de datos',
    };

    const failCheck = await verifyAuditChain(tampered);
    assert.strictEqual(failCheck.ok, false);
    assert.strictEqual(failCheck.firstBrokenIndex, 12);
  });

  it('assertVerifactuReady bloquea activación si falta certificado digital oficial', () => {
    assert.throws(
      () => assertVerifactuReady({}),
      AeatCertificateMissingError
    );
    assert.throws(
      () => assertVerifactuReady({ certPath: '/certs/cert.p12' }),
      AeatCertificateMissingError
    );
    assert.doesNotThrow(() =>
      assertVerifactuReady({ certPath: '/certs/cert.p12', certPassword: 'password' })
    );
  });

  it('calcula retroceso exponencial determinista para reintentos de envío', () => {
    assert.strictEqual(calculateExponentialBackoff(0, 1000), 1000);
    assert.strictEqual(calculateExponentialBackoff(1, 1000), 2000);
    assert.strictEqual(calculateExponentialBackoff(2, 1000), 4000);
    assert.strictEqual(calculateExponentialBackoff(3, 1000), 8000);
  });

  it('cobertura de ramas: buildBillingRecord gestiona facturas rectificativas R1, fallbacks nulos y fechas directas', async () => {
    const org: Org = {
      id: 'org-b-1',
      name: 'Empresa R1',
      tax_id: 'B11223344',
      address: 'Calle Real 1',
      postal_code: '28001',
      city: 'Madrid',
      country: 'ES',
    };

    // Rectificativa sin serie ni fecha explícita
    const creditDoc: Document = {
      id: 'doc-credit-branch',
      org_id: org.id,
      doc_type: 'credit_note',
      series: null,
      number: null,
      total_cents: -5000,
      vat_cents: -1050,
      discount_cents: 0,
      subtotal_cents: -3950,
      irpf_cents: 0,
      items: [],
      version: 1,
      status: 'issued',
    };

    const rec = await buildBillingRecord(creditDoc, org, null, '2027-05-01T10:00:00Z');
    assert.strictEqual(rec.series, 'FAC');
    assert.strictEqual(rec.number, 0);
    assert.strictEqual(rec.record_type, 'alta');
    assert.strictEqual(rec.previous_hash, '');
    assert.strictEqual(rec.hash.length, 64);
  });

  it('cobertura de ramas: verifyBillingChain detecta primer registro con huella no vacía y valida anulaciones', async () => {
    const org: Org = {
      id: 'org-b-2',
      name: 'Empresa Cadena',
      tax_id: 'B99887766',
      address: 'Calle Mayor 2',
      postal_code: '28002',
      city: 'Madrid',
      country: 'ES',
    };

    const docBase: Document = {
      id: 'doc-chain-branch',
      org_id: org.id,
      doc_type: 'invoice',
      series: 'FAC',
      number: 1,
      issue_date: '2027-01-01',
      total_cents: 10000,
      vat_cents: 2100,
      discount_cents: 0,
      subtotal_cents: 7900,
      irpf_cents: 0,
      items: [],
      version: 1,
      status: 'issued',
    };

    const rec1 = await buildBillingRecord(docBase, org, null, '2027-01-01T08:00:00Z');
    const cancelRec = await buildCancellationRecord(docBase, org, rec1, '2027-01-01T09:00:00Z');

    // Cadena mixta alta + anulación válida
    const chainOk = await verifyBillingChain([rec1, cancelRec], org.tax_id);
    assert.strictEqual(chainOk.ok, true);

    // Caso rama: primer registro con previous_hash no vacío
    const invalidFirst: BillingRecord = {
      ...rec1,
      previous_hash: 'HASH_NO_VACIO_ILEGAL',
    };
    const failFirst = await verifyBillingChain([invalidFirst], org.tax_id);
    assert.strictEqual(failFirst.ok, false);
    assert.strictEqual(failFirst.firstBrokenIndex, 0);

    // Caso rama: registro de anulación alterado
    const tamperedCancel: BillingRecord = {
      ...cancelRec,
      hash: 'HASH_FALSO_ALTERADO_00000000000000000000000000000000000000000000000000',
    };
    const failCancel = await verifyBillingChain([rec1, tamperedCancel], org.tax_id);
    assert.strictEqual(failCancel.ok, false);
    assert.strictEqual(failCancel.firstBrokenIndex, 1);
  });

  it('evidencias de firma eIDAS (evidence.ts): generación completa y verificación de autenticidad', async () => {
    // 1. Paquete con todos los campos opcionales provistos
    const sigFull = await createSignatureEvidence({
      documentId: 'doc-sig-1',
      documentVersion: 1,
      signerName: 'Juan Pérez García ',
      signerTaxId: ' 12345678z ',
      signerEmail: ' Juan.Perez@Empresa.es ',
      signatureImagePath: 'signatures/sig1.png',
      documentPdfHash: 'AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899',
      otpVerified: true,
      ip: '192.168.1.50',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      signedAt: '2027-03-01T10:00:00Z',
    });

    assert.strictEqual(sigFull.signer_name, 'Juan Pérez García');
    assert.strictEqual(sigFull.signer_tax_id, '12345678Z');
    assert.strictEqual(sigFull.signer_email, 'juan.perez@empresa.es');
    assert.strictEqual(sigFull.evidence_hash.length, 64);

    // Verificación válida coincidiendo con el hash del PDF
    const checkFull = await verifySignatureEvidence(
      sigFull,
      'AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899'
    );
    assert.strictEqual(checkFull.ok, true);

    // 2. Paquete con campos opcionales omitidos (ip y userAgent por defecto, sin email)
    const sigDefaults = await createSignatureEvidence({
      documentId: 'doc-sig-2',
      documentVersion: 1,
      signerName: 'Ana Gómez',
      signerTaxId: '87654321A',
      documentPdfHash: '11223344556677889900AABBCCDDEEFF11223344556677889900AABBCCDDEEFF',
      otpVerified: false,
      signedAt: '2027-03-01T11:00:00Z',
    });

    assert.strictEqual(sigDefaults.signer_email, undefined);
    const checkDefaults = await verifySignatureEvidence(sigDefaults);
    assert.strictEqual(checkDefaults.ok, true);

    // 3. Rama de discrepancia de hash de documento PDF
    const checkMismatchPdf = await verifySignatureEvidence(
      sigFull,
      'HASH_DISTINTO_NO_COINCIDENTE_0000000000000000000000000000000000000'
    );
    assert.strictEqual(checkMismatchPdf.ok, false);
    assert.ok(checkMismatchPdf.reason?.includes('difiere'));

    // 4. Rama de manipulación en los datos de la firma (evidencia alterada)
    const tamperedSig = {
      ...sigFull,
      signer_name: 'Atacante Malicioso',
    };
    const checkTampered = await verifySignatureEvidence(tamperedSig);
    assert.strictEqual(checkTampered.ok, false);
    assert.ok(checkTampered.reason?.includes('manipulado'));
  });
});
