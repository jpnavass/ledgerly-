// ============================================================================
// Modelo de Dominio Unificado — Presupuesto Express Enterprise
// ============================================================================

import type { VatBreakdownRow } from '../lib/calculations.ts';

// ----- Organización & Multiempresa -----
export type PlanType = 'free' | 'pro' | 'business';
export type TaxpayerKind = 'sociedad' | 'autonomo' | 'otro';
export type BillingMode = 'verifactu' | 'no_verifactu';

export interface Org {
  id: string;
  name: string;
  legal_name?: string;
  trade_name?: string;
  tax_id: string;
  address: string;
  postal_code: string;
  city: string;
  province?: string;
  country: string;
  phone?: string;
  email?: string;
  website?: string;
  iban?: string;
  mercantile_registry?: string;
  logo_url?: string;
  brand_color?: string;
  plan?: PlanType;
  created_at?: string;
  updated_at?: string;
}

export interface OrgSettings {
  id?: string;
  org_id: string;
  default_validity_days: number;
  default_payment_terms?: string;
  default_terms_text?: string;
  default_vat_rate: number;
  default_irpf_rate: number;
  series: Record<DocType, { prefix: string; reset_yearly: boolean }>;
  iban?: string;
  billing_mode: BillingMode;
  taxpayer_kind: TaxpayerKind;
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'owner' | 'employee';

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
}

export interface License {
  id: string;
  org_id: string;
  plan: PlanType;
  valid_until: string;
  is_active: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at?: string;
}

// ----- Clientes -----
export interface Client {
  id: string;
  org_id?: string;
  name: string;
  legal_name?: string;
  tax_id: string;
  email?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  country?: string;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClientAddress {
  id: string;
  client_id: string;
  label?: string;
  address: string;
  city: string;
  postal_code: string;
  province?: string;
  country: string;
  is_default: boolean;
  created_at?: string;
}

// ----- Catálogo / Tarifario Oficial -----
export interface CatalogItem {
  id: string;
  org_id?: string;
  category?: string;
  name: string;
  description?: string;
  unit: string;
  price_cents: number;
  cost_cents: number;
  vat_rate: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ----- Tipos y Estados Documentales -----
export type DocType = 'quote' | 'delivery_note' | 'proforma' | 'invoice' | 'credit_note';

export type DocStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'invoiced'
  | 'issued'
  | 'paid'
  | 'partially_paid'
  | 'void';

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  quote: 'Presupuesto',
  delivery_note: 'Albarán',
  proforma: 'Factura Proforma',
  invoice: 'Factura',
  credit_note: 'Factura Rectificativa',
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  viewed: 'Visualizado',
  accepted: 'Aceptado y Firmado',
  rejected: 'Rechazado',
  expired: 'Caducado',
  invoiced: 'Facturado',
  issued: 'Emitida',
  paid: 'Cobrada',
  partially_paid: 'Cobro Parcial',
  void: 'Anulada',
};

export type Tone = 'neutral' | 'info' | 'violet' | 'success' | 'warning' | 'danger' | 'teal' | 'muted';

export const DOC_STATUS_TONE: Record<DocStatus, Tone> = {
  draft: 'neutral',
  sent: 'info',
  viewed: 'violet',
  accepted: 'success',
  rejected: 'danger',
  expired: 'muted',
  invoiced: 'teal',
  issued: 'info',
  paid: 'success',
  partially_paid: 'warning',
  void: 'danger',
};

export const DOC_STATUS_ICON: Record<DocStatus, string> = {
  draft: 'FileEdit',
  sent: 'Send',
  viewed: 'Eye',
  accepted: 'CheckCircle2',
  rejected: 'XCircle',
  expired: 'Clock',
  invoiced: 'Receipt',
  issued: 'FileCheck',
  paid: 'BadgeCheck',
  partially_paid: 'PieChart',
  void: 'Ban',
};

export interface StatusStyle {
  bg: string;
  text: string;
  border?: string;
  className: string;
}

export const TONE_STYLES: Record<Tone, StatusStyle> = {
  neutral: {
    bg: 'rgba(148, 163, 184, 0.12)',
    text: '#94A3B8',
    border: 'rgba(148, 163, 184, 0.25)',
    className: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.12)',
    text: '#60A5FA',
    border: 'rgba(59, 130, 246, 0.25)',
    className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  violet: {
    bg: 'rgba(168, 85, 247, 0.12)',
    text: '#C084FC',
    border: 'rgba(168, 85, 247, 0.25)',
    className: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  success: {
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#34D399',
    border: 'rgba(16, 185, 129, 0.25)',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#FBBF24',
    border: 'rgba(245, 158, 11, 0.25)',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  danger: {
    bg: 'rgba(239, 68, 68, 0.12)',
    text: '#F87171',
    border: 'rgba(239, 68, 68, 0.25)',
    className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  teal: {
    bg: 'rgba(20, 184, 166, 0.12)',
    text: '#2DD4BF',
    border: 'rgba(20, 184, 166, 0.25)',
    className: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  },
  muted: {
    bg: 'rgba(107, 114, 128, 0.12)',
    text: '#9CA3AF',
    border: 'rgba(107, 114, 128, 0.25)',
    className: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  },
};

export const DOC_STATUS_COLORS: Record<DocStatus, StatusStyle> = {
  draft: TONE_STYLES.neutral,
  sent: TONE_STYLES.info,
  viewed: TONE_STYLES.violet,
  accepted: TONE_STYLES.success,
  rejected: TONE_STYLES.danger,
  expired: TONE_STYLES.muted,
  invoiced: TONE_STYLES.teal,
  issued: TONE_STYLES.info,
  paid: TONE_STYLES.success,
  partially_paid: TONE_STYLES.warning,
  void: TONE_STYLES.danger,
};

// ----- Partidas y Capítulos -----
export type ItemType = 'chapter' | 'line';

export interface DocumentItem {
  id: string;
  document_id?: string;
  org_id?: string;
  item_type: ItemType;
  position: number;
  parent_id?: string;
  catalog_item_id?: string;
  description: string;
  unit?: string;
  quantity: number;
  price_cents: number;
  cost_cents?: number;
  discount_pct: number;
  vat_rate: number;
  vat_cents?: number;
  irpf_rate: number;
  irpf_cents?: number;
  subtotal_cents?: number;
  total_cents?: number;
  is_optional: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ----- Documento Contractual Principal -----
export interface Document {
  id: string;
  org_id?: string;
  client_id?: string;
  client?: Client;
  address_id?: string;

  doc_type: DocType;
  series: string | null;
  number?: number | null;
  doc_number?: number; // compatibilidad numérica
  version: number;

  status: DocStatus;

  title?: string;
  cover_summary?: string;
  notes_public?: string;
  notes_internal?: string;

  issue_date?: string; // YYYY-MM-DD
  operation_date?: string; // YYYY-MM-DD
  valid_until?: string; // YYYY-MM-DD
  accepted_at?: string;
  rejected_at?: string;
  rejected_reason?: string;
  signature_data?: string;

  converted_from?: string;
  rectifies_document_id?: string;
  rectification_reason?: string;
  rectification_method?: 'differences' | 'substitution';

  apply_surcharge?: boolean;
  subtotal_cents: number;
  discount_cents: number;
  vat_cents: number;
  surcharge_cents?: number;
  irpf_cents: number;
  total_cents: number;

  vat_breakdown?: VatBreakdownRow[];

  payment_terms?: string;
  payment_iban?: string;
  exemption_note?: string;

  items: DocumentItem[];

  pdf_url?: string;
  pdf_hash?: string;
  public_token_hash?: string;
  locked_at?: string;
  currency?: 'EUR';

  created_at: string;
  updated_at: string;
}

// ----- Firma Electrónica eIDAS -----
export interface DocumentSignature {
  id: string;
  document_id: string;
  document_version: number;
  signer_name: string;
  signer_tax_id: string;
  signer_email?: string;
  signature_image_path?: string;
  document_pdf_hash: string;
  otp_verified: boolean;
  ip?: string;
  user_agent?: string;
  signed_at: string;
  evidence_hash: string;
}

// ----- Registro de Facturación Inalterable (Ley Antifraude / Veri*Factu) -----
export type BillingRecordType = 'alta' | 'anulacion';

export interface BillingRecord {
  id: string;
  org_id: string;
  document_id: string;
  record_type: BillingRecordType;
  series: string;
  number: number;
  issue_date: string;
  total_cents: number;
  vat_cents: number;
  previous_hash: string;
  hash: string;
  generated_at: string;
  software_version: string;
  qr_payload: string;
}

// ----- Registro de Auditoría (Audit Log Append-Only) -----
export type AuditActorKind = 'user' | 'client' | 'system';

export interface AuditEvent {
  id: string;
  org_id: string;
  document_id?: string;
  actor_user_id?: string;
  actor_kind: AuditActorKind;
  type: string;
  title?: string;
  description: string;
  ip?: string;
  user_agent?: string;
  previous_hash?: string;
  hash?: string;
  created_at: string;
}

// ----- Tesorería y Pagos -----
export type PaymentStatus = 'pending' | 'completed' | 'cancelled';

export interface Payment {
  id: string;
  org_id?: string;
  document_id: string;
  label?: string;
  percentage?: number;
  amount_cents: number;
  due_date?: string;
  paid_at?: string;
  payment_method?: string;
  method?: string;
  status: PaymentStatus;
  notes?: string;
  created_at?: string;
}

// ----- Gastos y Rentabilidad -----
export interface Expense {
  id: string;
  org_id: string;
  document_id?: string;
  description: string;
  amount_cents: number;
  category?: string;
  receipt_url?: string;
  date: string;
  created_at: string;
}
