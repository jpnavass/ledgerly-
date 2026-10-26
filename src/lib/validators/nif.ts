// ============================================================================
// Validador Oficial de Identificación Fiscal Española (NIF / NIE / CIF)
// Conforme a normativas AEAT y Ley 58/2003 General Tributaria
// ============================================================================

export type TaxIdKind = 'DNI' | 'NIE' | 'CIF';

export interface TaxIdValidationResult {
  ok: boolean;
  kind?: TaxIdKind;
  error?: string;
  normalized?: string;
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_CONTROL_LETTERS = 'JABCDEFGHI';

/**
 * Valida un NIF, NIE o CIF español devolviendo tipología y control de integridad.
 */
export function isValidSpanishTaxId(input: string): TaxIdValidationResult {
  if (typeof input !== 'string') {
    return { ok: false, error: 'El identificador fiscal debe ser un texto.' };
  }

  // Sanitización: eliminar espacios, guiones y convertir a mayúsculas
  const raw = input.trim().toUpperCase().replace(/[\s-]/g, '');

  if (!raw || raw.length !== 9) {
    return { ok: false, error: 'El identificador fiscal debe tener exactamente 9 caracteres alfanuméricos.' };
  }

  // 1. Comprobar si es NIE (Inicia con X, Y, Z seguido de 7 dígitos y letra de control)
  if (/^[XYZ]\d{7}[A-Z]$/.test(raw)) {
    let niePrefix = '0';
    if (raw[0] === 'Y') niePrefix = '1';
    if (raw[0] === 'Z') niePrefix = '2';

    const fullNumber = parseInt(niePrefix + raw.substring(1, 8), 10);
    const expectedLetter = DNI_LETTERS[fullNumber % 23];

    if (raw[8] === expectedLetter) {
      return { ok: true, kind: 'NIE', normalized: raw };
    }
    return { ok: false, kind: 'NIE', error: `Letra de control de NIE incorrecta (esperada: ${expectedLetter}, recibida: ${raw[8]}).` };
  }

  // 2. Comprobar si es DNI (8 dígitos seguidos de letra de control)
  if (/^\d{8}[A-Z]$/.test(raw)) {
    const num = parseInt(raw.substring(0, 8), 10);
    const expectedLetter = DNI_LETTERS[num % 23];

    if (raw[8] === expectedLetter) {
      return { ok: true, kind: 'DNI', normalized: raw };
    }
    return { ok: false, kind: 'DNI', error: `Letra de control de DNI incorrecta (esperada: ${expectedLetter}, recibida: ${raw[8]}).` };
  }

  // 3. Comprobar si es CIF de Entidad Jurídica
  // Letras válidas de entidad: A, B, C, D, E, F, G, H, J, N, P, Q, R, S, U, V, W
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(raw)) {
    const letter = raw[0];
    const digits = raw.substring(1, 8);
    const control = raw[8];

    let sumEven = 0;
    let sumOdd = 0;

    for (let i = 0; i < 7; i++) {
      const d = parseInt(digits[i], 10);
      if (i % 2 === 0) {
        // Posiciones impares en base 1 (índices pares 0, 2, 4, 6): multiplicar por 2 y sumar dígitos
        const doubleD = d * 2;
        sumOdd += Math.floor(doubleD / 10) + (doubleD % 10);
      } else {
        // Posiciones pares en base 1 (índices impares 1, 3, 5): sumar directo
        sumEven += d;
      }
    }

    const totalSum = sumEven + sumOdd;
    const unit = totalSum % 10;
    const controlDigit = unit === 0 ? 0 : 10 - unit;
    const controlLetter = CIF_CONTROL_LETTERS[controlDigit];

    // Tipos de entidades que requieren control con letra
    const letterControlTypes = ['P', 'Q', 'S', 'W'];
    // Tipos de entidades que requieren control con número
    const numberControlTypes = ['A', 'B', 'E', 'H'];

    if (letterControlTypes.includes(letter)) {
      if (control === controlLetter) {
        return { ok: true, kind: 'CIF', normalized: raw };
      }
      return { ok: false, kind: 'CIF', error: `Dígito de control de CIF incorrecto (esperado carácter: ${controlLetter}).` };
    }

    if (numberControlTypes.includes(letter)) {
      if (control === controlDigit.toString()) {
        return { ok: true, kind: 'CIF', normalized: raw };
      }
      return { ok: false, kind: 'CIF', error: `Dígito de control de CIF incorrecto (esperado número: ${controlDigit}).` };
    }

    // Para el resto (C, D, F, G, J, N, R, U, V), se acepta tanto el número como la letra
    if (control === controlDigit.toString() || control === controlLetter) {
      return { ok: true, kind: 'CIF', normalized: raw };
    }

    return { ok: false, kind: 'CIF', error: `Dígito de control de CIF no válido.` };
  }

  return { ok: false, error: 'El formato no corresponde a ningún NIF, NIE o CIF español reconocido.' };
}
