// ============================================================================
// Funciones Criptográficas y Canonicalización — Presupuesto Express Enterprise
// ============================================================================

/**
 * Calcula la huella digital SHA-256 en formato hexadecimal en minúsculas.
 * Emplea crypto.subtle nativo, garantizando compatibilidad total en Node.js y navegador.
 */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const data = typeof input === 'string' ? encoder.encode(input) : input;
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonicaliza un objeto o valor a una cadena JSON determinista y unívoca:
 * - Claves ordenadas alfabéticamente en todos los niveles.
 * - Sin espacios en blanco superfluos.
 * - Enteros y flotantes sin transformaciones destructivas.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalize(item)).join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const val = record[key];
    if (val !== undefined) {
      entries.push(`${JSON.stringify(key)}:${canonicalize(val)}`);
    }
  }

  return '{' + entries.join(',') + '}';
}
