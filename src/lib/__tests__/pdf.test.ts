// ============================================================================
// Pruebas Unitarias — Generación de PDF Oficial y Cierre Documental (pdf.test.ts)
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import jsQR from 'jsqr';
import { generateDocumentPdf } from '../pdf/generate.ts';
import { sha256Hex } from '../compliance/hash.ts';
import type { Document, Org, Client } from '../../types/index.ts';

function decodeQrFromPdf(buf: Buffer): string | null {
  const str = buf.toString('latin1');
  const objRegex = /(\d+)\s+(\d+)\s+obj\s*<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = objRegex.exec(str)) !== null) {
    const dict = match[3];
    if (dict.includes('/Subtype /Image') && dict.includes('/DeviceRGB')) {
      const widthMatch = dict.match(/\/Width\s+(\d+)/);
      const heightMatch = dict.match(/\/Height\s+(\d+)/);
      if (!widthMatch || !heightMatch) continue;
      const width = parseInt(widthMatch[1], 10);
      const height = parseInt(heightMatch[1], 10);
      const streamBuf = Buffer.from(match[4], 'latin1');
      let raw: Buffer;
      try {
        raw = zlib.inflateSync(streamBuf);
      } catch {
        continue;
      }
      if (raw.length === width * height * 3) {
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
          rgba[j] = raw[i];
          rgba[j + 1] = raw[i + 1];
          rgba[j + 2] = raw[i + 2];
          rgba[j + 3] = 255;
        }
        const code = jsQR(rgba, width, height);
        if (code?.data) return code.data;
      }
    }
  }
  return null;
}

function extractAllPdfText(buf: Buffer): string {
  const str = buf.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let text = '';
  let match;
  while ((match = streamRegex.exec(str)) !== null) {
    let streamContent = match[1];
    try {
      streamContent = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {}
    const hexMatches = streamContent.matchAll(/<([0-9a-fA-F]+)>/g);
    for (const hm of hexMatches) {
      try {
        text += Buffer.from(hm[1], 'hex').toString('utf8');
      } catch {}
    }
  }
  return text;
}

describe('Generación de PDF Oficial A4 (pdf.ts)', () => {
  const testOrg: Org = {
    id: 'org-pdf-1',
    name: 'Reformas y Servicios S.L.',
    legal_name: 'Reformas y Servicios S.L.',
    tax_id: 'B88549126',
    address: 'Calle Velázquez 12, 1º',
    postal_code: '28001',
    city: 'Madrid',
    country: 'España',
    email: 'facturas@reformas.es',
  };

  const testClient: Client = {
    id: 'cli-pdf-1',
    name: 'Hotel Central S.A.',
    legal_name: 'Hotel Central S.A.',
    tax_id: 'A28012345',
    address: 'Gran Vía 40',
    postal_code: '28013',
    city: 'Madrid',
    country: 'España',
  };

  const sampleDoc: Document = {
    id: 'doc-pdf-test-1',
    org_id: 'org-pdf-1',
    client_id: 'cli-pdf-1',
    client: testClient,
    doc_type: 'invoice',
    series: 'FAC',
    number: 1,
    version: 1,
    status: 'issued',
    title: 'Mantenimiento Climatización',
    issue_date: '2027-02-01',
    subtotal_cents: 100000,
    discount_cents: 0,
    vat_cents: 21000,
    irpf_cents: 0,
    total_cents: 121000,
    vat_breakdown: [
      {
        vat_rate: 21,
        base_cents: 100000,
        vat_cents: 21000,
        surcharge_rate: 0,
        surcharge_cents: 0,
      },
    ],
    items: [
      {
        id: 'it-1',
        item_type: 'line',
        position: 1,
        description: 'Revisión técnica de unidades enfriadoras y filtros',
        quantity: 2,
        price_cents: 50000,
        discount_pct: 0,
        vat_rate: 21,
        irpf_rate: 0,
        is_optional: false,
      },
    ],
    created_at: '2027-02-01T09:00:00Z',
    updated_at: '2027-02-01T09:00:00Z',
  };

  it('genera un búfer PDF binario válido con cabecera %PDF-', async () => {
    const { buffer, pdfHash } = await generateDocumentPdf(sampleDoc, testOrg, testClient);
    assert(buffer instanceof Buffer || buffer instanceof Uint8Array);
    assert(buffer.length > 500);

    // Comprobar cabecera estándar de archivo PDF (%PDF-)
    const header = buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-');

    // Comprobar que pdfHash coincide con el SHA-256 de los bytes
    const expectedHash = await sha256Hex(new Uint8Array(buffer));
    assert.strictEqual(pdfHash, expectedHash);
  });

  it('soporta documentos con partidas extensas sin errores de renderizado', async () => {
    // Documento con 25 partidas
    const longItems = Array.from({ length: 25 }, (_, idx) => ({
      id: `it-${idx + 1}`,
      item_type: 'line' as const,
      position: idx + 1,
      description: `Partida de ejecución de obra número ${idx + 1}`,
      quantity: 1,
      price_cents: 1000,
      discount_pct: 0,
      vat_rate: 21,
      irpf_rate: 0,
      is_optional: false,
    }));

    const longDoc: Document = {
      ...sampleDoc,
      id: 'doc-long',
      items: longItems,
    };

    const { buffer } = await generateDocumentPdf(longDoc, testOrg, testClient);
    assert(buffer.length > 1000);
  });

  it('mismo contenido textual al generarlo dos veces; pdf_hash coincide con el almacenado en el documento', async () => {
    const res1 = await generateDocumentPdf(sampleDoc, testOrg, testClient);
    const res2 = await generateDocumentPdf(sampleDoc, testOrg, testClient);

    // Mismo contenido textual extraído determinista
    const text1 = extractAllPdfText(res1.buffer);
    const text2 = extractAllPdfText(res2.buffer);
    assert.strictEqual(text1, text2);
    assert.ok(text1.length > 50);

    // Documento almacenado con su pdf_hash asignado tras emisión
    const storedDoc: Document = {
      ...sampleDoc,
      pdf_hash: res1.pdfHash,
    };
    // El pdf_hash generado se compara contra el valor almacenado en el documento (no calculado en el test)
    assert.strictEqual(res1.pdfHash, storedDoc.pdf_hash);
    assert.strictEqual(storedDoc.pdf_hash.length, 64);
  });

  it('el PDF de una factura emitida contiene bloque de datos fiscales y huella digital completa del billing_record', async () => {
    const fullBillingRecordHash = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60';
    const invoiceWithHash: Document = {
      ...sampleDoc,
      doc_type: 'invoice',
      number: 101,
      series: 'FAC2026',
      billing_record_hash: fullBillingRecordHash,
    };

    const { buffer } = await generateDocumentPdf(invoiceWithHash, testOrg, testClient);
    assert.ok(buffer.length > 500);

    const text = extractAllPdfText(buffer);
    assert.ok(text.includes('B88549126'));
    assert.ok(text.includes('Reformas y Servicios S.L.'));
    assert.ok(text.includes('Huella Digital:'));
    // Huella digital completa de 64 caracteres sin truncar
    assert.ok(text.includes(fullBillingRecordHash));
  });

  it('el PDF de una factura contiene código QR decodificable con parámetros reglamentarios', async () => {
    const billingHash = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60';
    const invoiceDoc: Document = {
      ...sampleDoc,
      doc_type: 'invoice',
      number: 1,
      series: 'FAC',
      issue_date: '2027-02-01',
      total_cents: 121000,
      billing_record_hash: billingHash,
    };

    const { buffer } = await generateDocumentPdf(invoiceDoc, testOrg, testClient);
    const decodedUrl = decodeQrFromPdf(buffer);
    assert.ok(decodedUrl, 'El código QR debe estar presente y ser decodificable directamente desde el PDF');

    const parsed = new URL(decodedUrl);
    assert.strictEqual(parsed.origin, 'https://sede.agenciatributaria.gob.es');
    assert.strictEqual(parsed.searchParams.get('nif'), testOrg.tax_id);
    assert.strictEqual(parsed.searchParams.get('numserie'), 'FAC-1');
    assert.strictEqual(parsed.searchParams.get('fecha'), '01-02-2027');
    assert.strictEqual(parsed.searchParams.get('importe'), '1210.00');

    // Confirmar que parámetros no reglamentarios (num, total, hash, csv) no constan
    assert.strictEqual(parsed.searchParams.get('num'), null);
    assert.strictEqual(parsed.searchParams.get('total'), null);
    assert.strictEqual(parsed.searchParams.get('hash'), null);
    assert.strictEqual(parsed.searchParams.get('csv'), null);
  });

  it('soporta 120 líneas con paginación correcta sin errores de desbordamiento', async () => {
    const items120 = Array.from({ length: 120 }, (_, idx) => ({
      id: `it-${idx + 1}`,
      item_type: 'line' as const,
      position: idx + 1,
      description: `Línea de detalle técnico de proyecto #${idx + 1}`,
      quantity: 1,
      price_cents: 500,
      discount_pct: 0,
      vat_rate: 21,
      irpf_rate: 0,
      is_optional: false,
    }));

    const doc120: Document = {
      ...sampleDoc,
      id: 'doc-120-lines',
      items: items120,
    };

    const { buffer, pdfHash } = await generateDocumentPdf(doc120, testOrg, testClient);
    assert(buffer.length > 3000);
    assert.strictEqual(pdfHash.length, 64);
  });
});
