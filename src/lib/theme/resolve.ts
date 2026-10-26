// ============================================================================
// Resolución Pura de Modo de Apariencia (Claro / Oscuro)
// ============================================================================

import type { UiPreferences } from './types.ts';

/**
 * Resuelve el modo efectivo ('light' o 'dark') en función de las preferencias y el sistema.
 * Es una función pura y determinista.
 */
export function resolveMode(prefs: UiPreferences, systemPrefersDark: boolean): 'light' | 'dark' {
  if (prefs.mode === 'light') return 'light';
  if (prefs.mode === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}
