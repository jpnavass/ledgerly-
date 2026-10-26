// ============================================================================
// Envío Telemático AEAT Veri*Factu — Presupuesto Express Enterprise
// ============================================================================

import type { BillingRecord } from '../../types/index.ts';

export interface AeatCertificateConfig {
  certPath?: string;
  certPassword?: string;
}

export interface AeatSubmissionResult {
  status: 'accepted' | 'rejected' | 'error';
  csvCode?: string;
  message: string;
}

export interface AeatSubmissionPort {
  submit(record: BillingRecord): Promise<AeatSubmissionResult>;
}

export class AeatCertificateMissingError extends Error {
  constructor() {
    super(
      'No se puede activar la modalidad Veri*Factu: falta el certificado electrónico de la entidad o su clave (variables AEAT_CERT_PATH y AEAT_CERT_PASSWORD).'
    );
    this.name = 'AeatCertificateMissingError';
  }
}

/**
 * Valida si el entorno cuenta con los requisitos técnicos para operar en modalidad Veri*Factu.
 */
export function assertVerifactuReady(config: AeatCertificateConfig): void {
  if (!config.certPath || !config.certPassword) {
    throw new AeatCertificateMissingError();
  }
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  nowFn?: () => number;
}

/**
 * Calcula el retardo de reintento con retroceso exponencial determinista.
 */
export function calculateExponentialBackoff(attempt: number, baseDelayMs: number = 1000): number {
  return baseDelayMs * Math.pow(2, attempt);
}
