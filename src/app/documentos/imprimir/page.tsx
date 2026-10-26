'use client';

import { Suspense, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getDocumentById, getClients, getOrganization, getOrgSettings } from '@/lib/store';
import { formatCents, calcDocumentTotals } from '@/lib/calculations';
import { formatDate } from '@/lib/utils';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/types';
import { ArrowLeft, Printer, ShieldCheck, CheckCircle2 } from 'lucide-react';

function PrintDocumentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = searchParams.get('id') || '';
  const autoPrint = searchParams.get('auto') === 'true';

  const org = useMemo(() => getOrganization(), []);
  const orgSettings = useMemo(() => getOrgSettings(), []);

  const doc = useMemo(() => {
    return getDocumentById(docId);
  }, [docId]);

  const client = useMemo(() => {
    if (!doc?.client_id) return doc?.client;
    const clients = getClients();
    return clients.find((c) => c.id === doc.client_id) || doc.client;
  }, [doc]);

  useEffect(() => {
    if (autoPrint && doc) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, doc]);

  if (!doc) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-8 flex flex-col items-center justify-center">
        <p className="text-lg font-bold">Documento no encontrado</p>
        <button
          onClick={() => router.push('/documentos')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
        >
          Volver a documentos
        </button>
      </div>
    );
  }

  const totals = calcDocumentTotals(doc.items || []);
  const code = doc.series ? `${doc.series}-${String(doc.number || doc.doc_number || 0).padStart(4, '0')}` : 'BORRADOR';
  const isAccepted = doc.status === 'accepted';

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:m-0 print:bg-white print:min-h-0 text-slate-900">
      {/* Barra de control para pantalla (Oculta al imprimir) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between no-print bg-white p-4 rounded-xl shadow-md border border-slate-200">
        <button
          onClick={() => router.push(`/documentos/editor?id=${doc.id}`)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Volver al Editor</span>
        </button>

        <div className="flex items-center gap-3">
          <a
            href={`/api/documents/${doc.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-sm transition-all"
          >
            <ShieldCheck size={16} />
            <span>PDF Certificado (Servidor)</span>
          </a>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>Imprimir Navegador</span>
          </button>
        </div>
      </div>

      {/* Documento A4 Oficial */}
      <div
        id="official-print-document"
        className="print-document bg-white text-slate-900 p-10 md:p-14 rounded-2xl shadow-xl max-w-4xl mx-auto border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-8"
      >
        {/* Cabecera Corporativa */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-indigo-700 flex items-center justify-center text-white font-mono font-black text-xl shadow-sm">
                IP
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {org?.legal_name || org?.name || 'Empresa Emisora'}
                </h1>
                <p className="text-xs text-slate-500 font-mono">{org?.tax_id ? `CIF: ${org.tax_id}` : ''}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mt-2">
              {org?.address || ''} {org?.postal_code || ''} {org?.city || ''}<br />
              {org?.phone ? `Tel: ${org.phone} ` : ''}{org?.email ? `· Email: ${org.email}` : ''}
            </p>
          </div>

          {/* Bloque Número y Fecha */}
          <div className="print-card bg-slate-50 border border-slate-200 rounded-xl p-4 text-right min-w-[240px]">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              {DOC_TYPE_LABELS[doc.doc_type]}
            </p>
            <p className="text-3xl font-black font-mono text-slate-900 mt-0.5">{code}</p>
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-1 text-slate-600">
              <p>
                <strong>Emisión:</strong> {formatDate(doc.created_at)}
              </p>
              <p>
                <strong>Validez hasta:</strong> {formatDate(doc.valid_until || '')}
              </p>
              <p>
                <strong>Estado:</strong> {DOC_STATUS_LABELS[doc.status]}
              </p>
            </div>
          </div>
        </div>

        {/* Bloque Fiscal del Cliente y Obra */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print-card bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Cliente / Razón Social
            </p>
            <p className="text-sm font-bold text-slate-900">{client?.name}</p>
            <p className="font-mono text-slate-700 mt-0.5">{client?.tax_id ? `CIF/NIF: ${client.tax_id}` : ''}</p>
            <p className="text-slate-600 mt-1">{client?.email} · {client?.phone}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Obra / Proyecto
            </p>
            <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
            <p className="text-slate-600 mt-1">Forma de Pago: {doc.payment_terms || 'Transferencia Bancaria'}{orgSettings?.iban ? ` (IBAN: ${orgSettings.iban})` : ''}</p>
          </div>
        </div>

        {/* Tabla Detallada de Partidas */}
        <div>
          <table className="print-table w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Descripción de la Partida Técnica</th>
                <th className="py-2.5 px-2 text-center w-16">Uds</th>
                <th className="py-2.5 px-2 text-center w-16">Ud</th>
                <th className="py-2.5 px-3 text-right w-24">Precio</th>
                <th className="py-2.5 px-2 text-center w-16">Dto</th>
                <th className="py-2.5 px-3 text-right w-28">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {doc.items?.map((it) => {
                if (it.item_type === 'chapter') {
                  return (
                    <tr key={it.id} className="bg-slate-100 font-bold text-slate-900">
                      <td colSpan={6} className="py-2.5 px-3 text-xs tracking-wide">
                        {it.description}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={it.id} className={it.is_optional ? 'text-slate-400 bg-slate-50/50' : 'text-slate-800'}>
                    <td className="py-3 px-3">
                      <p className="font-medium">{it.description}</p>
                      {it.is_optional && (
                        <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                          (Partida opcional)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center font-mono">{it.quantity}</td>
                    <td className="py-3 px-2 text-center">{it.unit}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatCents(it.price_cents)}</td>
                    <td className="py-3 px-2 text-center font-mono">
                      {it.discount_pct > 0 ? `${it.discount_pct}%` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                      {formatCents(it.subtotal_cents || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Desglose Económico y Términos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 space-y-2 leading-relaxed">
            <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              Condiciones Contractuales
            </p>
            <p>{doc.notes_public}</p>
            <p className="text-[10px] text-slate-400">
              De conformidad con el Reglamento (UE) 2016/679 (RGPD), sus datos fiscales serán tratados para la gestión contable y contractual.
            </p>
          </div>

          <div className="print-card bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Base Imponible Neta:</span>
              <span className="font-mono font-medium text-slate-900">{formatCents(totals.subtotal_cents)}</span>
            </div>
            {totals.discount_cents > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Descuento aplicado:</span>
                <span className="font-mono font-medium">-{formatCents(totals.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>IVA Régimen General (21%):</span>
              <span className="font-mono font-medium text-slate-900">{formatCents(totals.vat_cents)}</span>
            </div>
            <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
              <span className="text-sm font-black text-slate-900 uppercase">Total Oficial:</span>
              <span className="text-xl font-black font-mono text-indigo-700">
                {formatCents(totals.total_cents)}
              </span>
            </div>
          </div>
        </div>

        {/* Certificado de Firma eIDAS */}
        <div className="pt-4 border-t border-slate-200">
          <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-800">Conformidad y Aceptación del Cliente</p>
              <p className="text-[11px] text-slate-500">
                Firma vinculante según el Reglamento eIDAS (UE) Nº 910/2014
              </p>
              {isAccepted && (
                <div className="mt-2 space-y-1.5">
                  {doc.signature_data?.startsWith('data:image/') && (
                    <div className="inline-block p-1.5 bg-white border border-slate-200 rounded-md shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doc.signature_data}
                        alt="Rúbrica de aceptación"
                        className="h-10 w-auto object-contain"
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-emerald-700 font-mono font-semibold flex items-center gap-1">
                    <span>✓</span>
                    <span>
                      {doc.signature_data?.startsWith('data:image/')
                        ? 'Firma digital eIDAS registrada con sello de tiempo criptográfico SHA-256'
                        : doc.signature_data || 'Firmado electrónicamente con hash SHA-256 verificado'}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 size={16} />
              <span>{isAccepted ? 'Firmado y Conforme' : 'Pendiente de Firma'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Generando documento oficial...</div>}>
      <PrintDocumentContent />
    </Suspense>
  );
}
