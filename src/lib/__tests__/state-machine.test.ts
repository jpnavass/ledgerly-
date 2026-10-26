// ============================================================================
// Pruebas Unitarias — Máquina de Estados del Ciclo de Vida Documental
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertCanTransition, InvalidTransitionError } from '../domain/state-machine.ts';
import type { DocType, DocStatus } from '../../types/index.ts';

describe('Máquina de Estados Documental (state-machine.ts)', () => {
  const allDocTypes: DocType[] = ['quote', 'proforma', 'delivery_note', 'invoice', 'credit_note'];
  const allStatuses: DocStatus[] = [
    'draft',
    'sent',
    'viewed',
    'accepted',
    'rejected',
    'expired',
    'invoiced',
    'issued',
    'paid',
    'partially_paid',
    'void',
  ];

  it('transición a sí misma es rechazada si no está explícitamente definida en la matriz', () => {
    for (const dt of allDocTypes) {
      for (const st of allStatuses) {
        assert.strictEqual(canTransition(dt, st, st), false);
        assert.throws(() => assertCanTransition(dt, st, st), InvalidTransitionError);
      }
    }
  });

  it('Presupuesto: permite únicamente las transiciones de su ciclo de vida', () => {
    // Permitidas
    assert.strictEqual(canTransition('quote', 'draft', 'sent'), true);
    assert.strictEqual(canTransition('quote', 'sent', 'viewed'), true);
    assert.strictEqual(canTransition('quote', 'sent', 'accepted'), true);
    assert.strictEqual(canTransition('quote', 'sent', 'rejected'), true);
    assert.strictEqual(canTransition('quote', 'sent', 'expired'), true);
    assert.strictEqual(canTransition('quote', 'viewed', 'accepted'), true);
    assert.strictEqual(canTransition('quote', 'viewed', 'rejected'), true);
    assert.strictEqual(canTransition('quote', 'viewed', 'expired'), true);
    assert.strictEqual(canTransition('quote', 'accepted', 'invoiced'), true);

    // No permitidas (deben lanzar InvalidTransitionError)
    const forbidden = [
      ['draft', 'accepted'],
      ['draft', 'invoiced'],
      ['rejected', 'accepted'],
      ['expired', 'accepted'],
      ['accepted', 'draft'],
      ['invoiced', 'sent'],
    ] as const;

    for (const [from, to] of forbidden) {
      assert.strictEqual(canTransition('quote', from, to), false);
      assert.throws(() => assertCanTransition('quote', from, to), InvalidTransitionError);
    }
  });

  it('Factura: transiciones válidas y prohibición de retroceso a borrador', () => {
    assert.strictEqual(canTransition('invoice', 'draft', 'issued'), true);
    assert.strictEqual(canTransition('invoice', 'issued', 'partially_paid'), true);
    assert.strictEqual(canTransition('invoice', 'issued', 'paid'), true);
    assert.strictEqual(canTransition('invoice', 'issued', 'void'), true);
    assert.strictEqual(canTransition('invoice', 'partially_paid', 'paid'), true);
    assert.strictEqual(canTransition('invoice', 'partially_paid', 'void'), true);

    // Prohibido volver a borrador una vez emitida
    assert.strictEqual(canTransition('invoice', 'issued', 'draft'), false);
    assert.throws(() => assertCanTransition('invoice', 'issued', 'draft'), InvalidTransitionError);
    assert.strictEqual(canTransition('invoice', 'paid', 'draft'), false);
    assert.throws(() => assertCanTransition('invoice', 'paid', 'draft'), InvalidTransitionError);
  });

  it('Factura rectificativa: sigue el mismo ciclo inmutable que la factura', () => {
    assert.strictEqual(canTransition('credit_note', 'draft', 'issued'), true);
    assert.strictEqual(canTransition('credit_note', 'issued', 'paid'), true);
    assert.strictEqual(canTransition('credit_note', 'issued', 'draft'), false);
    assert.throws(() => assertCanTransition('credit_note', 'issued', 'draft'), InvalidTransitionError);
  });

  it('tabla exhaustiva de transiciones generada: toda transición permitida pasa y toda transición no permitida lanza InvalidTransitionError', () => {
    // Matriz canónica según especificación técnica oficial
    const expectedAllowed: Record<DocType, Partial<Record<DocStatus, DocStatus[]>>> = {
      quote: {
        draft: ['sent'],
        sent: ['viewed', 'accepted', 'rejected', 'expired'],
        viewed: ['accepted', 'rejected', 'expired'],
        accepted: ['invoiced'],
      },
      proforma: {
        draft: ['sent'],
        sent: ['accepted', 'rejected'],
        accepted: ['invoiced'],
      },
      delivery_note: {
        draft: ['sent'],
        sent: ['accepted', 'rejected'],
        accepted: ['invoiced'],
      },
      invoice: {
        draft: ['issued'],
        issued: ['paid', 'partially_paid', 'void'],
        partially_paid: ['paid', 'void'],
      },
      credit_note: {
        draft: ['issued'],
        issued: ['paid', 'partially_paid', 'void'],
        partially_paid: ['paid', 'void'],
      },
    };

    let totalChecked = 0;
    for (const dt of allDocTypes) {
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          totalChecked++;
          const isAllowed = expectedAllowed[dt]?.[from]?.includes(to) ?? false;
          if (isAllowed) {
            assert.strictEqual(canTransition(dt, from, to), true);
            assert.doesNotThrow(() => assertCanTransition(dt, from, to));
          } else {
            assert.strictEqual(canTransition(dt, from, to), false);
            assert.throws(() => assertCanTransition(dt, from, to), InvalidTransitionError);
          }
        }
      }
    }

    // 5 tipos de documentos x 11 estados origen x 11 estados destino = 605 combinaciones evaluadas
    assert.strictEqual(totalChecked, 5 * 11 * 11);
  });
});
