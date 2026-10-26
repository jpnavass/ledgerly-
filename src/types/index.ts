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

export const DOC_STATUS_COLORS: Record<DocStatus, StatusStyle> = {
  draft: { bg: 'var(--neutral-bg)', text: 'var(--neutral-fg)', border: 'var(--border-default)', className: 'badge' },
  sent: { bg: 'var(--info-bg)', text: 'var(--info-fg)', border: 'var(--border-default)', className: 'badge' },
  viewed: { bg: 'var(--violet-bg)', text: 'var(--violet-fg)', border: 'var(--border-default)', className: 'badge' },
  accepted: { bg: 'var(--success-bg)', text: 'var(--success-fg)', border: 'var(--border-default)', className: 'badge' },
  rejected: { bg: 'var(--danger-bg)', text: 'var(--danger-fg)', border: 'var(--border-default)', className: 'badge' },
  expired: { bg: 'var(--muted-bg)', text: 'var(--muted-fg)', border: 'var(--border-default)', className: 'badge' },
  invoiced: { bg: 'var(--teal-bg)', text: 'var(--teal-fg)', border: 'var(--border-default)', className: 'badge' },
  issued: { bg: 'var(--info-bg)', text: 'var(--info-fg)', border: 'var(--border-default)', className: 'badge' },
  paid: { bg: 'var(--success-bg)', text: 'var(--success-fg)', border: 'var(--border-default)', className: 'badge' },
  partially_paid: { bg: 'var(--warning-bg)', text: 'var(--warning-fg)', border: 'var(--border-default)', className: 'badge' },
  void: { bg: 'var(--danger-bg)', text: 'var(--danger-fg)', border: 'var(--border-default)', className: 'badge' },
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
