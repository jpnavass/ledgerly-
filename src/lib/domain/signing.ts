// ============================================================================
// Dominio de Firma Electrónica eIDAS — Presupuesto Express Enterprise
// ============================================================================

import type { Document } from '../../types/index.ts';
import { sha256Hex } from '../compliance/hash.ts';
import { isValidSpanishTaxId } from '../validators/nif.ts';

export class SigningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SigningError';
  }
}

/**
 * Genera un token público de alta entropía (≥ 256 bits) y su huella SHA-256 para almacenamiento.
 * El token en claro se entrega al cliente en la URL y NUNCA se persiste en base de datos.
 */
export async function generatePublicToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await sha256Hex(token);
  return { token, tokenHash };
}

/**
 * Valida si un documento está en condiciones reglamentarias de ser firmado por el cliente.
 */
export function assertCanSignDocument(doc: Document): void {
  if (doc.status === 'draft') {
    throw new SigningError(
      'El documento se encuentra en fase de borrador y no ha sido remitido formalmente al cliente.'
    );
  }
  if (doc.status === 'accepted') {
    throw new SigningError('El documento ya ha sido aceptado y firmado con anterioridad.');
  }
  if (doc.status === 'rejected') {
    throw new SigningError('El documento fue formalmente rechazado y no admite firma.');
  }
  if (doc.status === 'expired') {
    throw new SigningError('El plazo de validez de esta propuesta ha expirado.');
  }
  if (doc.status !== 'sent' && doc.status !== 'viewed') {
    throw new SigningError(
      `El documento no se encuentra disponible para firma (estado actual: '${doc.status}').`
    );
  }
}

/**
 * Valida los datos identificativos del firmante conforme a la legalidad española.
 */
export function validateSignerData(name: string, taxId: string): void {
  if (!name || name.trim().length < 3) {
    throw new SigningError('El nombre completo del firmante es obligatorio.');
  }

  const taxValidation = isValidSpanishTaxId(taxId);
  if (!taxValidation.ok) {
    throw new SigningError('El NIF, CIF o NIE del firmante no es válido según algoritmo oficial de control.');
  }
}

/**
 * Valida que el servicio de correo transaccional (Resend) esté configurado.
 * Sin proveedor de comunicaciones, el proceso de firma electrónica no puede simularse ni completarse.
 */
export function assertEmailServiceConfigured(apiKey?: string): void {
  const key = apiKey !== undefined ? apiKey : (typeof process !== 'undefined' ? process.env.RESEND_API_KEY : undefined);
  if (!key || key.trim() === '') {
    throw new SigningError(
      'Servicio de correo transaccional no configurado (falta RESEND_API_KEY). El proceso de notificación y formalización de firma electrónica por el cliente está bloqueado hasta configurar el proveedor de comunicaciones.'
    );
  }
}

export interface OtpRecord {
  code: string;
  email: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  blocked: boolean;
}

/**
 * Crea un registro de código OTP de un solo uso con caducidad.
 */
export function createOtpRecord(
  email: string,
  code: string,
  expiresInSeconds: number = 600,
  currentTime: number = Date.now()
): OtpRecord {
  return {
    code,
    email: email.trim().toLowerCase(),
    attempts: 0,
    maxAttempts: 5,
    expiresAt: currentTime + expiresInSeconds * 1000,
    blocked: false,
  };
}

/**
 * Valida un intento de código OTP aplicando bloqueo tras 5 intentos fallidos y control de caducidad.
 */
export function verifyOtpAttempt(
  record: OtpRecord,
  submittedCode: string,
  currentTime: number = Date.now()
): { ok: boolean; updatedRecord: OtpRecord; error?: string } {
  if (record.blocked || record.attempts >= record.maxAttempts) {
    return {
      ok: false,
      updatedRecord: { ...record, blocked: true },
      error: 'Ha superado el número máximo de intentos permitidos (5). La sesión de firma ha sido bloqueada.',
    };
  }

  if (currentTime > record.expiresAt) {
    return {
      ok: false,
      updatedRecord: { ...record, blocked: true },
      error: 'El código OTP ha caducado. Solicite un nuevo código de verificación.',
    };
  }

  if (record.code !== submittedCode.trim()) {
    const attempts = record.attempts + 1;
    const isBlocked = attempts >= record.maxAttempts;
    return {
      ok: false,
      updatedRecord: { ...record, attempts, blocked: isBlocked },
      error: isBlocked
        ? 'Ha superado el número máximo de intentos permitidos (5). Sesión bloqueada.'
        : `Código OTP incorrecto. Intentos restantes: ${record.maxAttempts - attempts}.`,
    };
  }

  return {
    ok: true,
    updatedRecord: { ...record, attempts: record.attempts + 1 },
  };
}
