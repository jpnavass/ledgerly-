// ============================================================================
// Validador de Código Internacional de Cuenta Bancaria (IBAN - ISO 13616)
// ============================================================================

const IBAN_LENGTHS: Record<string, number> = {
  ES: 24, // España
  AD: 24, // Andorra
  FR: 27, // Francia
  DE: 22, // Alemania
  PT: 25, // Portugal
  IT: 27, // Italia
  GB: 22, // Reino Unido
  IE: 22, // Irlanda
  NL: 18, // Países Bajos
  BE: 16, // Bélgica
};

/**
 * Valida un código IBAN mediante el algoritmo MOD-97-10 (ISO 7064).
 */
export function isValidIban(input: string): boolean {
  if (typeof input !== 'string') return false;

  const sanitized = input.trim().toUpperCase().replace(/[\s-]/g, '');

  if (sanitized.length < 15 || sanitized.length > 34) {
    return false;
  }

  const countryCode = sanitized.substring(0, 2);
  const expectedLength = IBAN_LENGTHS[countryCode];
  if (expectedLength && sanitized.length !== expectedLength) {
    return false;
  }

  // Mover los primeros 4 caracteres al final: "ES001234..." -> "1234...ES00"
  const rearranged = sanitized.substring(4) + sanitized.substring(0, 4);

  // Convertir letras a sus números correspondientes (A = 10, B = 11, ..., Z = 35)
  let numericString = '';
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i];
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      // Dígito 0-9
      numericString += char;
    } else if (code >= 65 && code <= 90) {
      // Letra A-Z
      numericString += (code - 55).toString();
    } else {
      // Carácter no alfanumérico
      return false;
    }
  }

  try {
    const remainder = BigInt(numericString) % BigInt(97);
    return remainder === BigInt(1);
  } catch {
    return false;
  }
}
