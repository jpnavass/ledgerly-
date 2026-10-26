// ============================================================================
// Generación de Código QR Oficial y URL de Cotejo (Orden HAC/1177/2024)
// ============================================================================

import QRCode from 'qrcode';

export interface QrUrlParams {
  taxId: string;
  seriesNumber: string;
  issueDate: string; // YYYY-MM-DD
  totalCents: number;
  hash?: string;
  isVerifactu?: boolean;
}

/**
 * Construye la URL oficial de cotejo de la factura según la Orden HAC/1177/2024 Artículo 21.2.
 * Parámetros reglamentarios exclusivos: nif, numserie, fecha e importe.
 */
export function buildQrVerificationUrl(params: QrUrlParams): string {
  const { taxId, seriesNumber, issueDate, totalCents, isVerifactu = false } = params;

  // Formato DD-MM-YYYY
  const parts = issueDate.split('-');
  const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : issueDate;
  const totalEuros = (totalCents / 100).toFixed(2);

  const baseUrl = isVerifactu
    ? 'https://sede.agenciatributaria.gob.es/qr/validador'
    : 'https://sede.agenciatributaria.gob.es/qr/cotejo';

  const query = new URLSearchParams({
    nif: taxId,
    numserie: seriesNumber,
    fecha: formattedDate,
    importe: totalEuros,
  });

  return `${baseUrl}?${query.toString()}`;
}

/**
 * Genera el código QR como imagen en base64 DataURL (PNG) para su inserción en PDF o HTML.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Genera el código QR en formato vectorial SVG.
 */
export async function generateQrSvg(text: string): Promise<string> {
  return await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
  });
}
