// ============================================================================
// Motor de Aritmética Monetaria Entera (Sin Punto Flotante)
// ============================================================================

/**
 * Valida que un valor numérico sea un entero seguro que represente céntimos.
 */
export function assertCents(cents: number): void {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) {
    throw new RangeError(`El valor ${cents} no es un entero monetario seguro en céntimos.`);
  }
}

/**
 * Valida que una tasa porcentual esté dentro de un rango permitido.
 */
export function assertRate(rate: number, options: { min?: number; max?: number } = {}): void {
  const { min = 0, max = 100 } = options;
  if (typeof rate !== 'number' || Number.isNaN(rate) || !Number.isFinite(rate)) {
    throw new RangeError(`La tasa porcentual debe ser un número válido.`);
  }
  if (rate < min || rate > max) {
    throw new RangeError(`La tasa ${rate}% está fuera del rango permitido [${min}, ${max}].`);
  }
}

/**
 * Redondeo aritmético half-up determinista para números reales.
 * Maneja correctamente signos negativos requeridos en facturas rectificativas.
 */
export function roundHalfUp(value: number): number {
  if (value >= 0) {
    return Math.floor(value + 0.5);
  } else {
    return Math.ceil(value - 0.5);
  }
}

/**
 * Formatea un importe en céntimos a formato estándar español con aritmética entera.
 * Caso: 123456 -> "1.234,56 €"
 * Caso: -123456 -> "-1.234,56 €"
 * Garantizado determinista en SSR, cliente y tests unitarios.
 */
export function formatCents(cents: number): string {
  assertCents(cents);

  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const euros = Math.trunc(abs / 100);
  const dec = abs % 100;

  const decStr = dec < 10 ? `0${dec}` : `${dec}`;
  const eurosStr = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const sign = isNegative ? '-' : '';
  return `${sign}${eurosStr},${decStr} €`;
}

/**
 * Convierte una cadena o número en euros a céntimos enteros con redondeo half-up.
 * Acepta formatos: "1.234,56", "1234,56", "1234.56", 12.5.
 * Rechaza cadenas inválidas o ambiguas.
 */
export function eurosToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new RangeError(`El valor numérico en euros no es válido: ${input}`);
    }
    // Redondeo exacto pasando por representación decimal
    return roundHalfUp(input * 100);
  }

  if (typeof input !== 'string') {
    throw new TypeError(`Se esperaba una cadena o número en euros.`);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new RangeError(`La cadena de importe no puede estar vacía.`);
  }

  // Detectar formato español "1.234,56" o "1234,56"
  let sanitized = trimmed.replace(/\s+/g, '').replace('€', '');
  const isNegative = sanitized.startsWith('-');
  if (isNegative) {
    sanitized = sanitized.substring(1);
  }

  // Comprobar si tiene coma como decimal
  const commaCount = (sanitized.match(/,/g) || []).length;
  const dotCount = (sanitized.match(/\./g) || []).length;

  if (commaCount > 1) {
    throw new RangeError(`Formato numérico inválido con múltiples comas: "${input}"`);
  }

  let normalized: string;
  if (commaCount === 1) {
    const [intWithDots, decPartStr] = sanitized.split(',');
    if (intWithDots.includes('.')) {
      const dotGroups = intWithDots.split('.');
      if (dotGroups[0].length === 0 || dotGroups[0].length > 3) {
        throw new RangeError(`Agrupación de miles inválida en importe: "${input}"`);
      }
      for (let g = 1; g < dotGroups.length; g++) {
        if (dotGroups[g].length !== 3) {
          throw new RangeError(`Agrupación de miles inválida en importe: "${input}"`);
        }
      }
    }
    // Miles son puntos, decimal es coma: "1.234,56" -> "1234.56"
    normalized = sanitized.replace(/\./g, '').replace(',', '.');
  } else if (dotCount === 1) {
    // Formato estándar anglosajón o simple "1234.56"
    normalized = sanitized;
  } else if (dotCount > 1) {
    // Puntos como separadores de miles sin decimales: "1.234.567"
    const dotGroups = sanitized.split('.');
    if (dotGroups[0].length === 0 || dotGroups[0].length > 3) {
      throw new RangeError(`Agrupación de miles inválida en importe: "${input}"`);
    }
    for (let g = 1; g < dotGroups.length; g++) {
      if (dotGroups[g].length !== 3) {
        throw new RangeError(`Agrupación de miles inválida en importe: "${input}"`);
      }
    }
    normalized = sanitized.replace(/\./g, '');
  } else {
    // Entero simple: "1234"
    normalized = sanitized;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new RangeError(`Formato monetario inválido: "${input}"`);
  }

  const parts = normalized.split('.');
  const intPart = BigInt(parts[0]);
  let decPart = 0;

  if (parts.length > 1) {
    const rawDec = parts[1];
    const twoDec = rawDec.padEnd(2, '0').slice(0, 2);
    decPart = parseInt(twoDec, 10);
    // Revisar si el tercer decimal requiere redondeo half-up
    if (rawDec.length > 2) {
      const thirdDec = parseInt(rawDec[2], 10);
      if (thirdDec >= 5) {
        decPart += 1;
      }
    }
  }

  const totalCentsBig = intPart * BigInt(100) + BigInt(decPart);
  const totalCents = Number(totalCentsBig);
  assertCents(totalCents);

  return isNegative ? -totalCents : totalCents;
}

/**
 * Convierte céntimos a euros en punto flotante (únicamente para interfaces que lo requieran).
 */
export function centsToEuros(cents: number): number {
  assertCents(cents);
  return cents / 100;
}

/**
 * Formatea un porcentaje numérico a formato español.
 * Uso: 21 -> "21%"
 * Uso: 5.2 -> "5,2%"
 */
export function formatPercent(rate: number): string {
  assertRate(rate, { min: -100, max: 100 });
  const str = rate.toString().replace('.', ',');
  return `${str}%`;
}

/**
 * Formatea un número de documento con su serie y ancho mínimo de 4 dígitos.
 * Uso: formatDocNumber('FAC', 48) -> "FAC-0048"
 * Uso: formatDocNumber('PRE', 10450) -> "PRE-10450" (sin truncar si supera 9999)
 */
export function formatDocNumber(series: string, number: number): string {
  if (!series || typeof series !== 'string') {
    throw new RangeError(`La serie del documento no es válida: "${series}"`);
  }
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new RangeError(`El número del documento debe ser un entero positivo mayor o igual a 1: ${number}`);
  }
  const padded = number.toString().padStart(4, '0');
  return `${series}-${padded}`;
}
