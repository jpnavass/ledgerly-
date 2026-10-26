// ============================================================================
// Serialización y Lectura de Preferencias de Interfaz en Cookies
// ============================================================================

import { parseUiPreferences, type UiPreferences } from './types.ts';

export const UI_COOKIE_NAME = 'pe_ui';

/**
 * Serializa las preferencias a una cadena JSON codificada para cookie HTTP.
 */
export function serializeUiCookie(prefs: UiPreferences): string {
  const safe = parseUiPreferences(prefs);
  return encodeURIComponent(JSON.stringify(safe));
}

/**
 * Parsea el encabezado Cookie para extraer y validar las preferencias de interfaz.
 */
export function parseUiCookie(cookieHeader?: string | null): UiPreferences {
  if (!cookieHeader) return parseUiPreferences(null);

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const target = cookies.find((c) => c.startsWith(`${UI_COOKIE_NAME}=`));
  if (!target) return parseUiPreferences(null);

  const rawVal = target.substring(UI_COOKIE_NAME.length + 1);
  try {
    const decoded = decodeURIComponent(rawVal);
    return parseUiPreferences(decoded);
  } catch {
    return parseUiPreferences(null);
  }
}
