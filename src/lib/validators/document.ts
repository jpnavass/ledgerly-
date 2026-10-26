// ============================================================================
// Esquemas de Validación Zod para el Modelo de Dominio Fiscal
// ============================================================================

import { z } from 'zod';
import { isValidSpanishTaxId } from './nif.ts';
import { isValidIban } from './iban.ts';

export const VatRateSchema = z.union([
  z.literal(0),
  z.literal(4),
  z.literal(10),
  z.literal(21),
]);

export const QuantitySchema = z.number().refine(
  (val) => {
    if (!Number.isFinite(val)) return false;
    const str = val.toString();
    const dec = str.split('.')[1];
    return !dec || dec.length <= 3;
  },
  { message: 'La cantidad no puede tener más de 3 decimales.' }
);

export const CentsSchema = z.number().int().refine(
  (val) => Number.isSafeInteger(val),
  { message: 'El importe en céntimos debe ser un entero seguro.' }
);

export const PercentSchema = z.number().min(0).max(100);

export const SpanishTaxIdSchema = z.string().refine(
  (val) => isValidSpanishTaxId(val).ok,
  { message: 'El NIF, NIE o CIF español no es válido o su dígito de control es incorrecto.' }
);

export const IbanSchema = z.string().refine(
  (val) => isValidIban(val),
  { message: 'El código IBAN no es válido según el algoritmo oficial MOD-97.' }
);

export const DocumentItemSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  document_id: z.string().uuid().optional(),
  item_type: z.enum(['chapter', 'line']),
  position: z.number().int().min(0),
  parent_id: z.string().optional(),
  catalog_item_id: z.string().optional(),
  description: z.string().min(1, 'La descripción de la partida es obligatoria.'),
  unit: z.string().default('ud'),
  quantity: QuantitySchema,
  price_cents: CentsSchema,
  cost_cents: CentsSchema.optional().default(0),
  discount_pct: PercentSchema.default(0),
  vat_rate: VatRateSchema.default(21),
  irpf_rate: PercentSchema.default(0),
  is_optional: z.boolean().default(false),
  notes: z.string().optional(),
});

export const ClientSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  org_id: z.string().uuid().optional(),
  name: z.string().min(1, 'El nombre o razón social del cliente es obligatorio.'),
  tax_id: SpanishTaxIdSchema,
  email: z.string().email('El correo electrónico no tiene un formato válido.').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().min(1, 'El domicilio fiscal es obligatorio para la emisión de facturas (RD 1619/2012).'),
  postal_code: z.string().min(3, 'El código postal es obligatorio.'),
  city: z.string().min(1, 'La localidad es obligatoria.'),
  province: z.string().min(1, 'La provincia es obligatoria.'),
  country: z.string().default('España'),
  is_active: z.boolean().default(true),
});

export const PaymentSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  org_id: z.string().uuid().optional(),
  document_id: z.string().uuid().or(z.string().min(1)),
  label: z.string().optional(),
  percentage: PercentSchema.optional(),
  amount_cents: CentsSchema.min(0, 'El importe del cobro debe ser positivo.'),
  due_date: z.string().optional(),
  paid_at: z.string().optional(),
  method: z.string().optional(),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  notes: z.string().optional(),
});

export const DocumentSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  org_id: z.string().uuid().optional(),
  client_id: z.string().min(1, 'El cliente es obligatorio.'),
  doc_type: z.enum(['quote', 'delivery_note', 'proforma', 'invoice', 'credit_note']),
  series: z.string().nullable().optional(),
  number: z.number().int().positive().nullable().optional(),
  version: z.number().int().min(1).default(1),
  status: z.enum([
    'draft',
    'sent',
    'viewed',
    'accepted',
    'rejected',
    'expired',
    'invoiced',
    'issued',
    'paid',
    'partially_paid',
    'void',
  ]),
  title: z.string().min(1, 'El título del proyecto o trabajo es obligatorio.'),
  issue_date: z.string().optional(),
  operation_date: z.string().optional(),
  valid_until: z.string().optional(),
  apply_surcharge: z.boolean().default(false),
  subtotal_cents: CentsSchema,
  discount_cents: CentsSchema.default(0),
  vat_cents: CentsSchema.default(0),
  surcharge_cents: CentsSchema.default(0),
  irpf_cents: CentsSchema.default(0),
  total_cents: CentsSchema,
  items: z.array(DocumentItemSchema).min(1, 'El documento debe tener al menos una partida.'),
  notes_public: z.string().optional(),
  notes_internal: z.string().optional(),
  payment_terms: z.string().optional(),
  payment_iban: z.string().optional(),
  exemption_note: z.string().optional(),
  rectifies_document_id: z.string().optional(),
  rectification_reason: z.string().optional(),
  rectification_method: z.enum(['differences', 'substitution']).optional(),
  locked_at: z.string().optional(),
  currency: z.literal('EUR').default('EUR'),
});
