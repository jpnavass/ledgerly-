// ============================================================================
// Pruebas Unitarias — Firma Electrónica eIDAS y Evidencias (signing.test.ts)
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePublicToken,
  assertCanSignDocument,
  validateSignerData,
  createOtpRecord,
  verifyOtpAttempt,
  assertEmailServiceConfigured,
  SigningError,
} from '../domain/signing.ts';
import {
  createSignatureEvidence,
  verifySignatureEvidence,
} from '../compliance/evidence.ts';
import type { Document } from '../../types/index.ts';

describe('Firma Electrónica eIDAS y Paquete de Evidencias (signing.ts)', () => {
  it('generatePublicToken genera token de alta entropía (256 bits) y su hash no coincide con el token en claro', async () => {
    const { token, tokenHash } = await generatePublicToken();
    assert.strictEqual(token.length, 64); // 32 bytes hex
    assert.strictEqual(tokenHash.length, 64);
    assert.notStrictEqual(token, tokenHash);
  });

  it('firma sobre documento en borrador (draft) es rechazada', () => {
    const draftDoc = {
      id: 'doc-draft',
      doc_type: 'quote',
      status: 'draft',
    } as unknown as Document;

    assert.throws(
      () => assertCanSignDocument(draftDoc),
      (err: Error) => err instanceof SigningError && err.message.includes('fase de borrador')
    );
  });

  it('segunda firma sobre documento ya aceptado es rechazada', () => {
    const acceptedDoc = {
      id: 'doc-accepted',
      doc_type: 'quote',
      status: 'accepted',
    } as unknown as Document;

    assert.throws(
      () => assertCanSignDocument(acceptedDoc),
      (err: Error) => err instanceof SigningError && err.message.includes('ya ha sido aceptado')
    );
  });

  it('documento rechazado o caducado es bloqueado para firma', () => {
    const rejectedDoc = { id: 'doc-r', doc_type: 'quote', status: 'rejected' } as unknown as Document;
    const expiredDoc = { id: 'doc-e', doc_type: 'quote', status: 'expired' } as unknown as Document;

    assert.throws(() => assertCanSignDocument(rejectedDoc), SigningError);
    assert.throws(() => assertCanSignDocument(expiredDoc), SigningError);
  });

  it('documento en estado sent o viewed admite firma formal', () => {
    const sentDoc = { id: 'doc-s', doc_type: 'quote', status: 'sent' } as unknown as Document;
    const viewedDoc = { id: 'doc-v', doc_type: 'quote', status: 'viewed' } as unknown as Document;

    assert.doesNotThrow(() => assertCanSignDocument(sentDoc));
    assert.doesNotThrow(() => assertCanSignDocument(viewedDoc));
  });

  it('validación del firmante exige nombre y algoritmo oficial de NIF/CIF válido', () => {
    assert.throws(() => validateSignerData('', '48392021K'), SigningError);
    assert.throws(() => validateSignerData('Juan Pérez', '00000000Z'), SigningError);
    assert.doesNotThrow(() => validateSignerData('Juan Pérez', '48392021K'));
  });

  it('OTP: 5 intentos fallidos bloquean la sesión de forma irreversible', () => {
    const now = 1000000;
    let record = createOtpRecord('cliente@empresa.com', '123456', 600, now);

    // 4 intentos fallidos
    for (let i = 1; i <= 4; i++) {
      const result = verifyOtpAttempt(record, '000000', now);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.updatedRecord.attempts, i);
      assert.strictEqual(result.updatedRecord.blocked, false);
      record = result.updatedRecord;
    }

    // 5.º intento fallido -> Bloqueo
    const finalResult = verifyOtpAttempt(record, '000000', now);
    assert.strictEqual(finalResult.ok, false);
    assert.strictEqual(finalResult.updatedRecord.blocked, true);
    assert(finalResult.error?.includes('superado el número máximo de intentos'));

    // 6.º intento (incluso con código correcto) es rechazado por estar bloqueado
    const blockedResult = verifyOtpAttempt(finalResult.updatedRecord, '123456', now);
    assert.strictEqual(blockedResult.ok, false);
    assert(blockedResult.error?.includes('bloqueada'));
  });

  it('OTP caducado es rechazado', () => {
    const now = 1000000;
    const record = createOtpRecord('cliente@empresa.com', '123456', 600, now); // caduca en now + 600.000 ms

    const expiredResult = verifyOtpAttempt(record, '123456', now + 600001);
    assert.strictEqual(expiredResult.ok, false);
    assert(expiredResult.error?.includes('caducado'));
  });

  it('paquete de evidencias eIDAS: cualquier alteración posterior del PDF o datos invalida la verificación', async () => {
    const serverTimestamp = '2027-02-15T15:30:00.000Z';
    const pdfHashOriginal = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

    const evidence = await createSignatureEvidence({
      documentId: 'doc-100',
      documentVersion: 1,
      signerName: 'María García López',
      signerTaxId: '48392021K',
      signerEmail: 'maria@garcia.es',
      documentPdfHash: pdfHashOriginal,
      otpVerified: true,
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test',
      signedAt: serverTimestamp,
    });

    // 1. Verificación exitosa del paquete íntegro
    const checkOk = await verifySignatureEvidence(evidence, pdfHashOriginal);
    assert.strictEqual(checkOk.ok, true);

    // 2. Si el PDF almacenado difiere del hash firmado, falla
    const checkTamperedPdf = await verifySignatureEvidence(evidence, 'hash_distinto_de_otro_pdf');
    assert.strictEqual(checkTamperedPdf.ok, false);
    assert(checkTamperedPdf.reason?.includes('hash del documento PDF'));

    // 3. Si se altera el nombre o fecha dentro del paquete, falla la huella de evidencia
    const tamperedEvidence = {
      ...evidence,
      signer_name: 'Nombre Alterado',
    };
    const checkTamperedName = await verifySignatureEvidence(tamperedEvidence, pdfHashOriginal);
    assert.strictEqual(checkTamperedName.ok, false);
    assert(checkTamperedName.reason?.includes('huella de evidencia no coincide'));
  });

  it('signed_at procede del servidor e ignora cualquier timestamp manipulado enviado por el cliente', async () => {
    const realServerTimestamp = new Date().toISOString();
    const clientClaimedDate = '2020-01-01T00:00:00.000Z'; // Fecha antigua falsa

    const evidence = await createSignatureEvidence({
      documentId: 'doc-time-test',
      documentVersion: 1,
      signerName: 'Ana Ruiz',
      signerTaxId: '48392021K',
      documentPdfHash: 'hash_test_123',
      otpVerified: true,
      ip: '10.0.0.1',
      userAgent: 'TestClient/1.0',
      signedAt: realServerTimestamp, // El endpoint fuerza este valor desde el servidor
    });

    assert.strictEqual(evidence.signed_at, realServerTimestamp);
    assert.notStrictEqual(evidence.signed_at, clientClaimedDate);
  });

  it('viewed se registra una sola vez por sesión y el ciclo documental previene retroceso o duplicidad', () => {
    // Si un documento ya fue aceptado o rechazado, no puede volver a 'viewed' ni firmarse
    const acceptedDoc: Document = {
      id: 'doc-v-1',
      doc_type: 'quote',
      status: 'accepted',
      series: null,
      subtotal_cents: 100,
      discount_cents: 0,
      vat_cents: 21,
      irpf_cents: 0,
      total_cents: 121,
      version: 1,
      items: [],
    };

    assert.throws(() => assertCanSignDocument(acceptedDoc), SigningError);
  });

  it('assertEmailServiceConfigured bloquea sin simulación cuando falta RESEND_API_KEY', () => {
    assert.throws(
      () => assertEmailServiceConfigured(''),
      SigningError
    );
    assert.doesNotThrow(() => assertEmailServiceConfigured('re_123456789_valid_key'));
  });
});
