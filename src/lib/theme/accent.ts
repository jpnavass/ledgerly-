// ============================================================================
// Derivador y Ajustador Accesible de Acentos de Marca — Presupuesto Express
// Garantiza cumplimiento de contraste WCAG AA (>= 4.5:1) sin variar el matiz
// ============================================================================

import { hexToRgb, rgbToHex, wcagContrast, pickReadableText } from './contrast.ts';

export interface AccentTokens {
  accent: string;
  accentHover: string;
  accentFg: string;
  accentSubtle: string;
  onAccent: string;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = (h % 360) / 360;
  if (h < 0) h += 1;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return { r, g, b };
}

/**
 * Deriva tokens accesibles para un color de acento dado.
 * Si el color no alcanza 4.5:1 como texto sobre la superficie, lo oscurece (claro)
 * o aclara (oscuro) manteniendo intacto el matiz cromático (desviación < 5°).
 */
export function deriveAccentTokens(hexInput: string, theme: 'light' | 'dark'): AccentTokens {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexInput.trim())) {
    throw new Error(`Color hexadecimal inválido: "${hexInput}". Debe cumplir ^#[0-9a-fA-F]{6}$`);
  }

  const hex = hexInput.trim().toUpperCase();
  const surface = theme === 'light' ? '#FFFFFF' : '#12151D';

  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // 1. Ajustar accentFg para que tenga >= 4.5:1 contra la superficie correspondiente
  let curL = l;
  let fgCandidate = hex;
  let iterations = 0;
  const maxIterations = 100;

  while (wcagContrast(fgCandidate, surface) < 4.5 && iterations < maxIterations) {
    iterations++;
    if (theme === 'light') {
      curL = Math.max(0.05, curL - 0.015);
    } else {
      curL = Math.min(0.95, curL + 0.015);
    }
    const newRgb = hslToRgb(h, s, curL);
    fgCandidate = rgbToHex(newRgb);
  }

  // 2. Determinar texto sobre botón (--on-accent)
  const onAccent = pickReadableText(hex);

  // 3. Ajustar botón primario (--accent) si no cumple >= 4.5:1 contra su texto (--on-accent)
  let btnCandidate = hex;
  let btnL = l;
  let btnIter = 0;
  while (wcagContrast(onAccent, btnCandidate) < 4.5 && btnIter < maxIterations) {
    btnIter++;
    if (onAccent === '#FFFFFF') {
      btnL = Math.max(0.05, btnL - 0.015);
    } else {
      btnL = Math.min(0.95, btnL + 0.015);
    }
    const newRgb = hslToRgb(h, s, btnL);
    btnCandidate = rgbToHex(newRgb);
  }

  // 4. Hover y Subtle
  const hoverL = theme === 'light' ? Math.max(0.05, btnL - 0.07) : Math.min(0.95, btnL + 0.07);
  const accentHover = rgbToHex(hslToRgb(h, s, hoverL));

  const subtleL = theme === 'light' ? 0.96 : 0.14;
  const subtleS = Math.min(s, 0.45);
  const accentSubtle = rgbToHex(hslToRgb(h, subtleS, subtleL));

  return {
    accent: btnCandidate,
    accentHover,
    accentFg: fgCandidate,
    accentSubtle,
    onAccent,
  };
}
