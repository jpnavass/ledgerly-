// ============================================================================
// Tipos y Esquemas de Preferencias de Interfaz (Theme & Appearance)
// Alineado con la especificación técnica v2, Fase 10.2
// ============================================================================

import { z } from 'zod';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Acentos de marca definidos (Fase 10.2).
 * Identificadores en español únicamente; sin alias ingleses.
 * - indigo     #4F46E5
 * - azul       #2563EB
 * - esmeralda  #047857
 * - grafito    #334155
 * - burdeos    #9F1239
 * - corporativo  (toma Org.primary_color y lo procesa deriveAccentTokens)
 */
export type AccentId = 'indigo' | 'azul' | 'esmeralda' | 'grafito' | 'burdeos' | 'corporativo';
export type ThemeDensity = 'comfortable' | 'compact';

/** Escala de fuente como entero porcentual (100 | 110 | 125). */
export type FontScale = 100 | 110 | 125;

export interface UiPreferences {
  mode: ThemeMode;
  accent: AccentId;
  density: ThemeDensity;
  font_scale: FontScale; // 100 = 1×, 110 = 1.1×, 125 = 1.25×
  high_contrast: boolean;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  mode: 'system',
  accent: 'indigo',
  density: 'comfortable',
  font_scale: 100,
  high_contrast: false,
};

export const UiPreferencesSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']).catch('system'),
  accent: z.enum([
    'indigo',
    'azul',
    'esmeralda',
    'grafito',
    'burdeos',
    'corporativo',
  ]).catch('indigo'),
  density: z.enum(['comfortable', 'compact']).catch('comfortable'),
  font_scale: z.union([z.literal(100), z.literal(110), z.literal(125)]).catch(100),
  high_contrast: z.boolean().catch(false),
}).catch(DEFAULT_UI_PREFERENCES);

/**
 * Parsea y valida de forma segura cualquier objeto o string JSON de preferencias.
 * Si el dato es nulo, inválido, dañado o contiene valores fuera de rango,
 * devuelve valores por defecto seguros sin lanzar excepción.
 */
export function parseUiPreferences(input: unknown): UiPreferences {
  if (!input) return { ...DEFAULT_UI_PREFERENCES };

  let raw = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return { ...DEFAULT_UI_PREFERENCES };
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return { ...DEFAULT_UI_PREFERENCES };
    }
  }

  const result = UiPreferencesSchema.safeParse(raw);
  if (!result.success || !result.data) {
    return { ...DEFAULT_UI_PREFERENCES };
  }
  return result.data;
}
