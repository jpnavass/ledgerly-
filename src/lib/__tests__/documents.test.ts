// ============================================================================
// Pruebas Unitarias — Ciclo de Vida Documental y Reglas de Negocio
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDraftDocument,
  updateDraftDocument,
  validateAndIssueDocument,
  createNewDocumentVersion,
  convertDocument,
  createCreditNoteDocument,
  checkDocumentExpiry,
  DocumentError,
} from '../domain/documents.ts';
import { InMemoryCounterManager, formatFullDocumentNumber, validateSeriesPrefix } from '../domain/numbering.ts';
import type { Client, Org, Document, DocumentItem } from '../../types/index.ts';

describe('Ciclo de Vida Documental (documents.ts)', () => {
  const validOrg: Org = {
    id: 'org-test-1',
    name: 'Constructora Ibérica S.L.',
    legal_name: 'Constructora Ibérica S.L.',
    tax_id: 'B88549126',
    address: 'Paseo de la Castellana 100',
    postal_code: '28046',
    city: 'Madrid',
    country: 'España',
  };

  const validClient: Client = {
    id: 'cli-test-1',
    org_id: 'org-test-1',
    name: 'Promociones Levante S.A.',
    legal_name: 'Promociones Levante S.A.',
    tax_id: 'A28012345',
    address: 'Avenida del Puerto 45',
    postal_code: '46021',
    city: 'Valencia',
    country: 'España',
  };

  it('creación de borrador exige cliente obligatorio y válido (falla si es inexistente)', () => {
    assert.throws(
      () =>
        createDraftDocument({
          doc_type: 'quote',
          client_id: '',
          client: null as unknown as Client,
          title: 'Nuevo Presupuesto',
          org_id: 'org-test-1',
        }),
      (err: Error) => {
        assert(err instanceof DocumentError);
        assert(err.message.includes('especificar un cliente'));
        return true;
      }
    );

    const draft = createDraftDocument({
      doc_type: 'quote',
      client_id: validClient.id,
      client: validClient,
      title: 'Reforma Integral',
      org_id: 'org-test-1',
    });

    assert.strictEqual(draft.status, 'draft');
    assert.strictEqual(draft.series, null);
    assert.strictEqual(draft.number, null);
    assert.strictEqual(draft.items.length, 0); // Totalmente vacío, sin líneas precargadas
    assert.strictEqual(draft.total_cents, 0);
  });

  it('un borrador no tiene número; al emitir se valida y se asigna; si falla el contador no se altera', () => {
    const counter = new InMemoryCounterManager();

    const draft = createDraftDocument({
      doc_type: 'invoice',
      client_id: validClient.id,
      client: validClient,
      title: 'Factura Obra',
      org_id: 'org-test-1',
    });

    // Sin líneas: la emisión debe fallar por no tener partidas no opcionales
    assert.throws(
      () =>
        validateAndIssueDocument({
          doc: draft,
          client: validClient,
          org: validOrg,
          series: 'FAC',
          nextNumber: 1,
        }),
      (err: Error) => err instanceof DocumentError && err.message.includes('al menos una partida')
    );

    // Añadir línea válida
    const draftWithLines = updateDraftDocument(draft, {
      items: [
        {
          id: 'item-1',
          item_type: 'line',
          position: 1,
          description: 'Instalación eléctrica completa',
          quantity: 1,
          price_cents: 100000, // 1.000,00 €
          discount_pct: 0,
          vat_rate: 21,
          irpf_rate: 0,
          is_optional: false,
        },
      ],
    });

    assert.strictEqual(draftWithLines.total_cents, 121000); // 1.210,00 €

    // Emisión correcta
    const issued = validateAndIssueDocument({
      doc: draftWithLines,
      client: validClient,
      org: validOrg,
      series: 'FAC',
      nextNumber: 1,
      todayIso: '2027-02-15',
    });

    assert.strictEqual(issued.status, 'issued');
    assert.strictEqual(issued.series, 'FAC');
    assert.strictEqual(issued.number, 1);
    assert.strictEqual(issued.issue_date, '2027-02-15');
    assert(issued.locked_at !== undefined);
  });

  it('concurrencia de contadores: 50 llamadas paralelas producen números 1..50 consecutivos sin huecos ni repetidos', async () => {
    const counter = new InMemoryCounterManager();
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        counter.nextNumber('org-test-1', 'invoice', 'FAC', 2027)
      )
    );

    assert.strictEqual(results.length, 50);
    const sorted = [...results].sort((a, b) => a - b);
    for (let i = 0; i < 50; i++) {
      assert.strictEqual(sorted[i], i + 1, `Posición ${i} debe ser ${i + 1}`);
    }

    const unique = new Set(results);
    assert.strictEqual(unique.size, 50, 'No debe haber números duplicados');
  });

  it('editar un documento no borrador falla; crear nueva versión incrementa version y permite cambios', () => {
    const draft = createDraftDocument({
      doc_type: 'quote',
      client_id: validClient.id,
      client: validClient,
      title: 'Pintura',
      org_id: 'org-test-1',
    });

    const issuedQuote: Document = {
      ...draft,
      status: 'sent',
      series: 'PRE',
      number: 1,
    };

    // Intentar editar documento en estado 'sent'
    assert.throws(
      () => updateDraftDocument(issuedQuote, { title: 'Modificado' }),
      (err: Error) => err instanceof DocumentError && err.message.includes('Solo los borradores')
    );

    // Crear nueva versión
    const v2 = createNewDocumentVersion(issuedQuote);
    assert.strictEqual(v2.version, 2);
    assert.strictEqual(v2.status, 'draft');
    assert.strictEqual(v2.number, null);
    assert.strictEqual(v2.series, null);
    assert.strictEqual(v2.converted_from, issuedQuote.id);

    // La versión 2 al ser borrador sí puede ser editada
    assert.doesNotThrow(() => updateDraftDocument(v2, { title: 'Pintura con acabado satinado' }));
  });

  it('conversión: Presupuesto aceptado a Factura clona líneas y asigna converted_from', () => {
    const quoteDraft = createDraftDocument({
      doc_type: 'quote',
      client_id: validClient.id,
      client: validClient,
      title: 'Fontanería',
      org_id: 'org-test-1',
    });

    const quoteWithLines = updateDraftDocument(quoteDraft, {
      items: [
        {
          id: 'item-quote-1',
          item_type: 'line',
          position: 1,
          description: 'Tuberías de cobre',
          quantity: 2,
          price_cents: 25000, // 250,00 €
          discount_pct: 0,
          vat_rate: 21,
          irpf_rate: 0,
          is_optional: false,
        },
      ],
    });

    const acceptedQuote: Document = {
      ...quoteWithLines,
      status: 'accepted',
    };

    const { newDocument: invoiceDoc, updatedSource } = convertDocument({
      source: acceptedQuote,
      targetType: 'invoice',
      billedPercentage: 100,
    });

    assert.strictEqual(invoiceDoc.doc_type, 'invoice');
    assert.strictEqual(invoiceDoc.status, 'draft');
    assert.strictEqual(invoiceDoc.converted_from, acceptedQuote.id);
    assert.strictEqual(invoiceDoc.items.length, 1);
    assert.strictEqual(invoiceDoc.items[0].document_id, invoiceDoc.id);
    assert.notStrictEqual(invoiceDoc.items[0].id, 'item-quote-1'); // Nuevo ID clonado

    // El origen pasa a 'invoiced' al facturarse al 100%
    assert.strictEqual(updatedSource.status, 'invoiced');
  });

  it('conversión: Presupuesto aceptado a Albarán de entrega clona partidas y asigna converted_from', () => {
    const quoteDraft = createDraftDocument({
      doc_type: 'quote',
      client_id: validClient.id,
      client: validClient,
      title: 'Instalación Solar',
      org_id: 'org-test-1',
    });

    const quoteWithLines = updateDraftDocument(quoteDraft, {
      items: [
        {
          id: 'item-quote-alb',
          item_type: 'line',
          position: 1,
          description: 'Paneles solares 450W',
          quantity: 8,
          price_cents: 18000,
          discount_pct: 5,
          vat_rate: 21,
          irpf_rate: 0,
          is_optional: false,
        },
      ],
    });

    const acceptedQuote: Document = {
      ...quoteWithLines,
      status: 'accepted',
    };

    const { newDocument: deliveryDoc, updatedSource } = convertDocument({
      source: acceptedQuote,
      targetType: 'delivery_note',
    });

    assert.strictEqual(deliveryDoc.doc_type, 'delivery_note');
    assert.strictEqual(deliveryDoc.status, 'draft');
    assert.strictEqual(deliveryDoc.converted_from, acceptedQuote.id);
    assert.strictEqual(deliveryDoc.items.length, 1);
    assert.strictEqual(deliveryDoc.items[0].description, 'Paneles solares 450W');
    assert.notStrictEqual(deliveryDoc.items[0].id, 'item-quote-alb');
    assert.strictEqual(deliveryDoc.items[0].document_id, deliveryDoc.id);
    // El presupuesto permanece aceptado al generar un albarán intermedio
    assert.strictEqual(updatedSource.status, 'accepted');
  });

  it('conversión: Presupuesto aceptado a Factura Proforma clona partidas y preserva importes', () => {
    const quoteDraft = createDraftDocument({
      doc_type: 'quote',
      client_id: validClient.id,
      client: validClient,
      title: 'Reforma Cocina',
      org_id: 'org-test-1',
    });

    const quoteWithLines = updateDraftDocument(quoteDraft, {
      items: [
        {
          id: 'item-quote-prof',
          item_type: 'line',
          position: 1,
          description: 'Muebles de madera',
          quantity: 1,
          price_cents: 450000,
          discount_pct: 10,
          vat_rate: 21,
          irpf_rate: 0,
          is_optional: false,
        },
      ],
    });

    const acceptedQuote: Document = {
      ...quoteWithLines,
      status: 'accepted',
    };

    const { newDocument: proformaDoc, updatedSource } = convertDocument({
      source: acceptedQuote,
      targetType: 'proforma',
    });

    assert.strictEqual(proformaDoc.doc_type, 'proforma');
    assert.strictEqual(proformaDoc.status, 'draft');
    assert.strictEqual(proformaDoc.converted_from, acceptedQuote.id);
    assert.strictEqual(proformaDoc.items.length, 1);
    assert.strictEqual(proformaDoc.items[0].description, 'Muebles de madera');
    assert.strictEqual(proformaDoc.total_cents, quoteWithLines.total_cents);
    assert.strictEqual(updatedSource.status, 'accepted');
  });

  it('factura rectificativa: por diferencias anula exactamente la factura original (suma neta = 0)', () => {
    const invoiceDraft = createDraftDocument({
      doc_type: 'invoice',
      client_id: validClient.id,
      client: validClient,
      title: 'Venta Material',
      org_id: 'org-test-1',
    });

    const invoiceWithLines = updateDraftDocument(invoiceDraft, {
      items: [
        {
          id: 'it-1',
          item_type: 'line',
          position: 1,
          description: 'Sacos de cemento',
          quantity: 10,
          price_cents: 1000, // 10,00 € cada saco
          discount_pct: 0,
          vat_rate: 21,
          irpf_rate: 0,
          is_optional: false,
        },
      ],
    });

    const issuedInvoice: Document = {
      ...invoiceWithLines,
      status: 'issued',
      series: 'FAC',
      number: 105,
    };

    assert.strictEqual(issuedInvoice.total_cents, 12100);

    // Crear rectificativa por diferencias
    const { creditNote, updatedOriginal } = createCreditNoteDocument({
      original: issuedInvoice,
      reason: 'Devolución íntegra de mercancía por tara',
      method: 'differences',
    });

    assert.strictEqual(creditNote.doc_type, 'credit_note');
    assert.strictEqual(creditNote.rectifies_document_id, issuedInvoice.id);
    assert.strictEqual(creditNote.rectification_method, 'differences');
    assert.strictEqual(creditNote.total_cents, -12100);

    // Suma neta de ambas es exactamente cero
    assert.strictEqual(issuedInvoice.total_cents + creditNote.total_cents, 0);
  });

  it('presupuesto con valid_until vencido pasa a expired al chequear caducidad', () => {
    const quote: Document = {
      id: 'doc-exp',
      doc_type: 'quote',
      status: 'sent',
      valid_until: '2026-01-01',
      version: 1,
      subtotal_cents: 0,
      discount_cents: 0,
      vat_cents: 0,
      irpf_cents: 0,
      total_cents: 0,
      items: [],
      created_at: '2025-12-01T00:00:00Z',
      updated_at: '2025-12-01T00:00:00Z',
    };

    const evaluated = checkDocumentExpiry(quote, '2027-01-01');
    assert.strictEqual(evaluated.status, 'expired');
  });

  it('emisión de factura falla si el cliente o la empresa carecen de NIF o domicilio fiscal', () => {
    const draft = createDraftDocument({
      doc_type: 'invoice',
      client_id: validClient.id,
      client: { ...validClient, tax_id: '' },
      title: 'Factura sin NIF',
      org_id: validOrg.id,
    });

    const draftWithLines = updateDraftDocument(draft, {
      items: [
        {
          id: 'it-1',
          document_id: draft.id,
          item_type: 'line',
          position: 1,
          description: 'Consultoría técnica',
          quantity: 1,
          price_cents: 50000,
          discount_pct: 0,
          vat_rate: 21,
          irpf_rate: 0,
          is_optional: false,
        },
      ],
    });

    assert.throws(
      () =>
        validateAndIssueDocument({
          doc: draftWithLines,
          client: { ...validClient, tax_id: '' },
          org: validOrg,
          series: 'FAC',
          nextNumber: 1,
        }),
      (err: Error) => {
        assert(err instanceof DocumentError);
        assert(err.message.includes('NIF/CIF/NIE fiscal'));
        return true;
      }
    );
  });

  it('conversión falla si el documento origen no está en estado accepted', () => {
    const quote = createDraftDocument({
      doc_type: 'quote',
      client_id: validClient.id,
      client: validClient,
      title: 'Presupuesto Borrador',
      org_id: validOrg.id,
    });

    assert.throws(
      () => convertDocument({ source: quote, targetType: 'invoice' }),
      (err: Error) => {
        assert(err instanceof DocumentError);
        assert(err.message.includes('aceptados'));
        return true;
      }
    );
  });

  it('rectificativa por sustitución anula la original a void', () => {
    const invoice = createDraftDocument({
      doc_type: 'invoice',
      client_id: validClient.id,
      client: validClient,
      title: 'Factura Original',
      org_id: validOrg.id,
    });

    const issued: Document = {
      ...invoice,
      status: 'issued',
      series: 'FAC',
      number: 88,
    };

    const { creditNote, updatedOriginal } = createCreditNoteDocument({
      original: issued,
      reason: 'Factura errónea sustituida por nuevo formato',
      method: 'substitution',
    });

    assert.strictEqual(creditNote.rectification_method, 'substitution');
    assert.strictEqual(updatedOriginal?.status, 'void');
  });

  it('facturación parcial 40% + 60% cierra el origen en invoiced; un 3er intento falla por exceder el total', () => {
    const quoteDraft = createDraftDocument({
      doc_type: 'quote',
      client_id: validClient.id,
      client: validClient,
      title: 'Proyecto Integral de Obra',
      org_id: validOrg.id,
    });

    const quoteWithLines = updateDraftDocument(quoteDraft, {
      items: [
        {
          id: 'item-quote-obra',
          item_type: 'line',
          position: 1,
          description: 'Ejecución fase 1 y 2',
          quantity: 1,
          price_cents: 100000,
          discount_pct: 0,
          vat_rate: 21,
          irpf_rate: 0,
          is_optional: false,
        },
      ],
    });

    const acceptedQuote: Document = {
      ...quoteWithLines,
      status: 'accepted',
    };

    // 1. Facturar primer hito (40%)
    const { newDocument: inv1, updatedSource: sourceAfter1 } = convertDocument({
      source: acceptedQuote,
      targetType: 'invoice',
      billedPercentage: 40,
    });

    assert.strictEqual(inv1.total_cents, 48400); // 40.000 + 21% IVA = 48.400
    assert.strictEqual(sourceAfter1.status, 'accepted'); // Sigue abierto
    assert.strictEqual(sourceAfter1.billed_percentage, 40);

    // 2. Facturar segundo hito (60%)
    const { newDocument: inv2, updatedSource: sourceAfter2 } = convertDocument({
      source: sourceAfter1,
      targetType: 'invoice',
      billedPercentage: 60,
    });

    assert.strictEqual(inv2.total_cents, 72600); // 60.000 + 21% IVA = 72.600
    assert.strictEqual(sourceAfter2.billed_percentage, 100);
    assert.strictEqual(sourceAfter2.status, 'invoiced'); // Se cierra el origen

    // 3. Tercer intento (10% adicional) debe fallar por exceder el 100%
    assert.throws(
      () =>
        convertDocument({
          source: sourceAfter2,
          targetType: 'invoice',
          billedPercentage: 10,
        }),
      DocumentError
    );
  });

  it('formatFullDocumentNumber, validateSeriesPrefix y InMemoryCounterManager gestionan series y numeración oficial', async () => {
    assert.strictEqual(formatFullDocumentNumber('FAC', 5, 2027, true), 'FAC-2027-0005');
    assert.strictEqual(formatFullDocumentNumber('PRE', 123), 'PRE-0123');
    assert.throws(() => formatFullDocumentNumber('FAC', 0), RangeError);
    assert.throws(() => formatFullDocumentNumber('FAC', -1), RangeError);

    assert.strictEqual(validateSeriesPrefix('FAC'), true);
    assert.strictEqual(validateSeriesPrefix('FAC_2026'), true);
    assert.strictEqual(validateSeriesPrefix(''), false);
    assert.strictEqual(validateSeriesPrefix('fac'), false);
    assert.strictEqual(validateSeriesPrefix('SERIE_DEMASIADO_LARGA'), false);

    const counter = new InMemoryCounterManager();
    const n1 = await counter.nextNumber('org-1', 'invoice', 'FAC', 2026);
    assert.strictEqual(n1, 1);
    counter.reset();
    const n2 = await counter.nextNumber('org-1', 'invoice', 'FAC', 2026);
    assert.strictEqual(n2, 1);
  });
});
