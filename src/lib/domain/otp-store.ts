// ============================================================================
// Almacén y Gestión en Memoria de Códigos OTP — Presupuesto Express Enterprise
// ============================================================================

import { createOtpRecord, verifyOtpAttempt, type OtpRecord } from './signing.ts';

const otpRecords = new Map<string, OtpRecord>();

export function issueOtpForToken(
  tokenHash: string,
  email: string,
  mockCode?: string
): string {
  let code = mockCode;
  if (!code) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    code = (100000 + (randomBuffer[0] % 900000)).toString();
  }
  const record = createOtpRecord(email, code);
  otpRecords.set(tokenHash, record);
  return code;
}

export function getOtpRecordForToken(tokenHash: string): OtpRecord | null {
  return otpRecords.get(tokenHash) || null;
}

export function verifyOtpForToken(
  tokenHash: string,
  code: string,
  nowMs?: number
): { ok: boolean; error?: string } {
  const record = otpRecords.get(tokenHash);
  if (!record) {
    return { ok: false, error: 'No se ha solicitado ningún código OTP para este documento.' };
  }

  const result = verifyOtpAttempt(record, code, nowMs);
  otpRecords.set(tokenHash, result.updatedRecord);
  return { ok: result.ok, error: result.error };
}

export function clearOtpStore(): void {
  otpRecords.clear();
}
