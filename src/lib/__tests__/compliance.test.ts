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
import type { BillingRecord, Document, Org, AuditEvent } from '../../types/index.ts';

describe('Cumplimiento Normativo y Registros Inalterables (compliance.ts)', () => {
  it('vector oficial SHA-256: sha256Hex("abc") produce el hash reglamentario', async () => {
    const hash = await sha256Hex('abc');
    assert.strictEqual(
      hash,
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('vector oficial AEAT para generación de huella de registro de facturación de alta (Fuente: AEAT - Especificaciones Técnicas Orden HAC/1177/2024)', async () => {
    // Fuente oficial: "Detalle de las especificaciones técnicas para la generación de la huella o hash de los registros de facturación", AEAT / RD 1007/2023.
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

  it('formatea y genera URL de verificación QR con parámetros oficiales según Orden HAC/1177/2024', async () => {
    const qrUrl = buildQrVerificationUrl({
      taxId: 'B88549126',
      seriesNumber: 'FAC-0048',
      issueDate: '2027-05-12',
      totalCents: 125050,
      hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      isVerifactu: true,
    });

    assert(qrUrl.startsWith('https://sede.agenciatributaria.gob.es/qr/validador'));
    assert(qrUrl.includes('nif=B88549126'));
    assert(qrUrl.includes('num=FAC-0048'));
    assert(qrUrl.includes('fecha=12-05-2027'));
    assert(qrUrl.includes('total=1250.50'));
    assert(qrUrl.includes('hash=ba7816bf8f01cfea'));

    // Generar código QR vectorial en SVG
    const svg = await generateQrSvg(qrUrl);
    assert(svg.includes('<svg'));
  });

  it('código QR: decodifica el payload y comprueba minuciosamente todos los parámetros oficiales', () => {
    const qrUrl = buildQrVerificationUrl({
      taxId: 'B12345678',
      seriesNumber: 'FAC-2027/01',
      issueDate: '2027-04-15',
      totalCents: 54450,
      hash: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
      isVerifactu: false,
    });

    const parsedUrl = new URL(qrUrl);
    assert.strictEqual(parsedUrl.origin, 'https://sede.agenciatributaria.gob.es');
    assert.strictEqual(parsedUrl.pathname, '/qr/cotejo');
    assert.strictEqual(parsedUrl.searchParams.get('nif'), 'B12345678');
    assert.strictEqual(parsedUrl.searchParams.get('num'), 'FAC-2027/01');
    assert.strictEqual(parsedUrl.searchParams.get('fecha'), '15-04-2027');
    assert.strictEqual(parsedUrl.searchParams.get('total'), '544.50');
    assert.strictEqual(parsedUrl.searchParams.get('hash'), '3C464DAF61ACB827');
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
});
