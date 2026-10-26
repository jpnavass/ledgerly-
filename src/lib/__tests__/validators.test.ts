import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isValidSpanishTaxId } from '../validators/nif.ts';
import { isValidIban } from '../validators/iban.ts';
import { DocumentItemSchema, ClientSchema } from '../validators/document.ts';

describe('FASE 2: Validadores Oficiales de Dominio (validators)', () => {
  describe('Identificación Fiscal Española (NIF / NIE / CIF)', () => {
    it('Valida correctamente DNIs válidos con letra de control', () => {
      // Casos reales con letra de control calculada (48392021 % 23 = 21 -> K)
      const validDni1 = isValidSpanishTaxId('48392021K');
      assert.strictEqual(validDni1.ok, true);
      assert.strictEqual(validDni1.kind, 'DNI');

      // Con minúscula y guión
      const validDni2 = isValidSpanishTaxId('48392021-k');
      assert.strictEqual(validDni2.ok, true);
      assert.strictEqual(validDni2.normalized, '48392021K');
    });

    it('Rechaza DNIs con letra de control errónea o longitud incorrecta', () => {
      const invalidLetter = isValidSpanishTaxId('48392021A');
      assert.strictEqual(invalidLetter.ok, false);
      assert.match(invalidLetter.error || '', /Letra de control/);

      const invalidLength = isValidSpanishTaxId('1234K');
      assert.strictEqual(invalidLength.ok, false);
    });

    it('Valida correctamente NIEs de residentes comunitarios y extranjeros', () => {
      // NIE X: X1234567L
      const nieX = isValidSpanishTaxId('X1234567L');
      assert.strictEqual(nieX.ok, true);
      assert.strictEqual(nieX.kind, 'NIE');

      // NIE Y con espacios
      const nieY = isValidSpanishTaxId(' Y-1234567-X ');
      assert.strictEqual(nieY.ok, true);
      assert.strictEqual(nieY.kind, 'NIE');

      // NIE con letra errónea
      const nieBad = isValidSpanishTaxId('X1234567A');
      assert.strictEqual(nieBad.ok, false);
    });

    it('Valida CIFs de personas jurídicas (Sociedades A, B y Entidades)', () => {
      // CIF Sociedad Limitada B-88549126
      const cifB = isValidSpanishTaxId('B-88549126');
      assert.strictEqual(cifB.ok, true);
      assert.strictEqual(cifB.kind, 'CIF');

      // CIF con control por letra (Organismos públicos P: P2800000H)
      const cifP = isValidSpanishTaxId('P2800000H');
      assert.strictEqual(cifP.ok, true);
      assert.strictEqual(cifP.kind, 'CIF');

      // CIF con control dual (Sociedad colectiva C28000008 o C2800000H)
      const cifC1 = isValidSpanishTaxId('C28000008');
      assert.strictEqual(cifC1.ok, true);
      const cifC2 = isValidSpanishTaxId('C2800000H');
      assert.strictEqual(cifC2.ok, true);

      // CIF con control incorrecto
      const cifBad = isValidSpanishTaxId('B-88549120');
      assert.strictEqual(cifBad.ok, false);

      const cifBadP = isValidSpanishTaxId('P2800000A');
      assert.strictEqual(cifBadP.ok, false);

      // Formato vacío o irreconocible
      assert.strictEqual(isValidSpanishTaxId('').ok, false);
      assert.strictEqual(isValidSpanishTaxId('ZZZ999999').ok, false);
    });
  });

  describe('Validador de Cuentas Bancarias (IBAN ISO 13616)', () => {
    it('Valida códigos IBAN reales españoles con algoritmo MOD-97', () => {
      // IBAN válido de pruebas del Banco de España
      const validIban = 'ES2921000418450200051284';
      assert.strictEqual(isValidIban(validIban), true);

      // Con espacios habituales
      assert.strictEqual(isValidIban('ES29 2100 0418 4502 0005 1284'), true);
    });

    it('Rechaza IBANs alterados o con longitud inválida', () => {
      // Dígito de control cambiado
      assert.strictEqual(isValidIban('ES9221000418450200051284'), false);
      // Longitud corta
      assert.strictEqual(isValidIban('ES912100041845'), false);
      // Caracteres prohibidos
      assert.strictEqual(isValidIban('ES912100041845020005128?'), false);
    });
  });

  describe('Esquemas Zod de Cumplimiento Contractual', () => {
    it('Rechaza partidas con tipos de IVA no admitidos (ej. 7%)', () => {
      const invalidItem = {
        id: 'it-1',
        item_type: 'line',
        position: 0,
        description: 'Partida técnica',
        quantity: 1,
        price_cents: 1000,
        vat_rate: 7, // NO PERMITIDO
        discount_pct: 0,
        irpf_rate: 0,
        is_optional: false,
      };

      const result = DocumentItemSchema.safeParse(invalidItem);
      assert.strictEqual(result.success, false);
    });

    it('Rechaza descuentos superiores al 100%', () => {
      const invalidItem = {
        id: 'it-1',
        item_type: 'line',
        position: 0,
        description: 'Partida técnica',
        quantity: 1,
        price_cents: 1000,
        vat_rate: 21,
        discount_pct: 120, // NO PERMITIDO
        irpf_rate: 0,
        is_optional: false,
      };

      const result = DocumentItemSchema.safeParse(invalidItem);
      assert.strictEqual(result.success, false);
    });

    it('Rechaza cantidades con más de 3 decimales', () => {
      const invalidItem = {
        id: 'it-1',
        item_type: 'line',
        position: 0,
        description: 'Partida técnica',
        quantity: 1.1234, // 4 DECIMALES -> NO PERMITIDO
        price_cents: 1000,
        vat_rate: 21,
        discount_pct: 0,
        irpf_rate: 0,
        is_optional: false,
      };

      const result = DocumentItemSchema.safeParse(invalidItem);
      assert.strictEqual(result.success, false);
    });

    it('Valida clientes con datos fiscales completos requeridos por RD 1619/2012', () => {
      const validClient = {
        id: 'cli-001',
        name: 'Construcciones y Reformas Integrales S.L.',
        tax_id: 'B-88549126',
        address: 'Calle Mayor 14, 2º B',
        city: 'Madrid',
        postal_code: '28013',
        province: 'Madrid',
        country: 'España',
      };

      const result = ClientSchema.safeParse(validClient);
      assert.strictEqual(result.success, true);
    });
  });
});
