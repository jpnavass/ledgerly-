// ============================================================================
// Plantilla de Documento PDF A4 Oficial (React.createElement puro para Node.js)
// ============================================================================

import React from 'react';
import {
  Document as PdfDocument,
  Page,
  Text,
  View,
  StyleSheet,
  Image as PdfImage,
} from '@react-pdf/renderer';
import type { Document, Org, Client } from '../../types/index.ts';
import { formatCents } from '../money.ts';
import { calcLineSubtotal } from '../calculations.ts';

const styles = StyleSheet.create({
  page: {
    padding: 35,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a1f36',
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e3e8ee',
    paddingBottom: 15,
  },
  brandTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 1.3,
  },
  docMeta: {
    alignItems: 'flex-end',
  },
  docType: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  docNumber: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginTop: 2,
  },
  metaText: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  addresses: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 20,
  },
  addressBox: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  addressTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  addressName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  addressDetails: {
    fontSize: 8,
    color: '#334155',
    lineHeight: 1.3,
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#334155',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 8,
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colVat: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  totalsBox: {
    width: '45%',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    fontSize: 8,
    color: '#475569',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 5,
    marginTop: 5,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  complianceBlock: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrImage: {
    width: 60,
    height: 60,
  },
  complianceDetails: {
    flex: 1,
    fontSize: 7,
    color: '#64748b',
    lineHeight: 1.3,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 35,
    right: 35,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
});

export interface DocumentPdfProps {
  document: Document;
  organization: Org;
  client: Client;
  qrDataUrl?: string;
}

const e = React.createElement;

export function DocumentPdf({
  document,
  organization,
  client,
  qrDataUrl,
}: DocumentPdfProps) {
  const isFinalInvoice = document.doc_type === 'invoice' || document.doc_type === 'credit_note';

  const docTypeName =
    document.doc_type === 'credit_note'
      ? 'Factura Rectificativa'
      : document.doc_type === 'invoice'
      ? 'Factura Oficial'
      : document.doc_type === 'quote'
      ? 'Presupuesto'
      : document.doc_type === 'proforma'
      ? 'Factura Proforma'
      : 'Albarán';

  return e(
    PdfDocument,
    {
      title: `${document.series || 'DOC'}-${document.number || 0}`,
      author: organization.legal_name || organization.name,
    },
    e(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      e(
        View,
        { style: styles.header },
        e(
          View,
          null,
          e(Text, { style: styles.brandTitle }, organization.legal_name || organization.name),
          e(Text, { style: styles.companyDetails }, `NIF/CIF: ${organization.tax_id}`),
          e(Text, { style: styles.companyDetails }, organization.address),
          e(
            Text,
            { style: styles.companyDetails },
            `${organization.postal_code} ${organization.city} (${organization.country})`
          ),
          organization.email
            ? e(Text, { style: styles.companyDetails }, `Email: ${organization.email}`)
            : null
        ),
        e(
          View,
          { style: styles.docMeta },
          e(Text, { style: styles.docType }, docTypeName),
          e(
            Text,
            { style: styles.docNumber },
            document.series ? `${document.series}-${document.number || 0}` : 'BORRADOR'
          ),
          e(
            Text,
            { style: styles.metaText },
            `Fecha de Expedición: ${document.issue_date || document.created_at.slice(0, 10)}`
          ),
          document.valid_until && document.doc_type === 'quote'
            ? e(Text, { style: styles.metaText }, `Validez hasta: ${document.valid_until}`)
            : null
        )
      ),

      // Addresses
      e(
        View,
        { style: styles.addresses },
        e(
          View,
          { style: styles.addressBox },
          e(Text, { style: styles.addressTitle }, 'Datos del Destinatario (Cliente)'),
          e(Text, { style: styles.addressName }, client.legal_name || client.name),
          e(Text, { style: styles.addressDetails }, `NIF/CIF: ${client.tax_id}`),
          e(
            Text,
            { style: styles.addressDetails },
            client.address || 'Domicilio fiscal no aportado'
          ),
          e(
            Text,
            { style: styles.addressDetails },
            `${client.postal_code || ''} ${client.city || ''} (${client.country || 'España'})`
          )
        ),
        document.rectifies_document_id
          ? e(
              View,
              { style: styles.addressBox },
              e(Text, { style: styles.addressTitle }, 'Factura Rectificada (Art. 15 RD 1619/2012)'),
              e(
                Text,
                { style: styles.addressDetails },
                `Causa: ${document.rectification_reason || 'Modificación de base'}`
              ),
              e(
                Text,
                { style: styles.addressDetails },
                `Método: ${
                  document.rectification_method === 'differences'
                    ? 'Por diferencias'
                    : 'Por sustitución'
                }`
              )
            )
          : null
      ),

      // Table
      e(
        View,
        { style: styles.table },
        e(
          View,
          { style: styles.tableHeader },
          e(Text, { style: styles.colDesc }, 'Descripción / Concepto'),
          e(Text, { style: styles.colQty }, 'Cant.'),
          e(Text, { style: styles.colPrice }, 'Precio Ud.'),
          e(Text, { style: styles.colVat }, 'IVA'),
          e(Text, { style: styles.colTotal }, 'Importe')
        ),
        ...document.items.map((item, idx) =>
          e(
            View,
            { key: item.id || idx, style: styles.tableRow, wrap: false },
            e(Text, { style: styles.colDesc }, item.description),
            e(Text, { style: styles.colQty }, item.quantity.toString()),
            e(Text, { style: styles.colPrice }, formatCents(item.price_cents)),
            e(Text, { style: styles.colVat }, `${item.vat_rate}%`),
            e(
              Text,
              { style: styles.colTotal },
              formatCents(calcLineSubtotal(item.quantity, item.price_cents, item.discount_pct || 0))
            )
          )
        )
      ),

      // Totals
      e(
        View,
        { style: styles.totalsSection },
        e(
          View,
          { style: styles.totalsBox },
          e(
            View,
            { style: styles.totalRow },
            e(Text, null, 'Base Imponible:'),
            e(Text, null, formatCents(document.subtotal_cents))
          ),
          ...(document.vat_breakdown || []).map((row, i) =>
            e(
              View,
              { key: i, style: styles.totalRow },
              e(Text, null, `Cuota IVA (${row.vat_rate}%):`),
              e(Text, null, formatCents(row.vat_cents))
            )
          ),
          document.irpf_cents > 0
            ? e(
                View,
                { style: styles.totalRow },
                e(Text, null, 'Retención IRPF:'),
                e(Text, null, `-${formatCents(document.irpf_cents)}`)
              )
            : null,
          e(
            View,
            { style: styles.grandTotalRow },
            e(Text, null, 'Total Documento:'),
            e(Text, null, formatCents(document.total_cents))
          )
        )
      ),

      // Compliance / QR block
      isFinalInvoice && qrDataUrl
        ? e(
            View,
            { style: styles.complianceBlock },
            e(PdfImage, { src: qrDataUrl, style: styles.qrImage }),
            e(
              View,
              { style: styles.complianceDetails },
              e(
                Text,
                { style: { fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 2 } },
                'Registro de Facturación Inalterable (Ley 11/2021 y RD 1007/2023)'
              ),
              e(
                Text,
                null,
                'Factura expedida con huella digital SHA-256 encadenada verificable en sede de la Agencia Tributaria.'
              ),
              e(
                Text,
                { style: { fontFamily: 'Helvetica-Bold', marginTop: 2 } },
                `Huella Digital: ${document.signature_data ? document.signature_data.slice(0, 32) : (document.pdf_hash ? document.pdf_hash.slice(0, 32) : 'REGISTRADA')}...`
              )
            )
          )
        : null,

      // Footer
      e(Text, {
        style: styles.footer,
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Página ${pageNumber} de ${totalPages} · ${organization.legal_name || organization.name} · CIF ${organization.tax_id}`,
        fixed: true,
      })
    )
  );
}
