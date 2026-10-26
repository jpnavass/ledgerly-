// ============================================================================
// Algoritmo de Luminancia Relativa y Contraste WCAG 2.1 / 2.2 AA
// ============================================================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Convierte un color hexadecimal (#RRGGBB) a RGB numérico (0-255).
 */
export function hexToRgb(hex: string): RGB {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Formato hexadecimal inválido: "${hex}". Se espera #RRGGBB.`);
  }
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/**
 * Convierte RGB numérico a formato hexadecimal #RRGGBB en mayúsculas.
 */
export function rgbToHex(rgb: RGB): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Convierte un canal sRGB de 0..255 a luminancia lineal según la fórmula WCAG.
 */
export function sRgbToLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Calcula la luminancia relativa (Y) de un color en el espacio de color sRGB (0.0 a 1.0).
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const R = sRgbToLinear(r);
  const G = sRgbToLinear(g);
  const B = sRgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calcula el ratio de contraste WCAG entre dos colores (1.0:1 a 21.0:1).
 */
export function wcagContrast(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

/**
 * Determina si el texto sobre un fondo debe ser blanco o negro para maximizar legibilidad.
 */
export function pickReadableText(bgHex: string): '#000000' | '#FFFFFF' {
  const whiteContrast = wcagContrast('#FFFFFF', bgHex);
  const blackContrast = wcagContrast('#000000', bgHex);
  return whiteContrast >= blackContrast ? '#FFFFFF' : '#000000';
}
