'use client';

import { Suspense, use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getDocumentById, signDocument, recordAuditEvent, getOrganization, getOrgSettings } from '@/lib/store';
import { getRepository } from '@/lib/repo';
import { formatCents, calcDocumentTotals } from '@/lib/calculations';
import { formatDate } from '@/lib/utils';
import type { Document } from '@/types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/types';
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Lock,
  Printer,
} from 'lucide-react';

function ClientViewContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const docId = resolvedParams.id;
  const router = useRouter();

  const org = getOrganization();
  const orgSettings = getOrgSettings();

  const [doc, setDoc] = useState<Document | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerTaxId, setSignerTaxId] = useState('');
  const [signatureDone, setSignatureDone] = useState(false);
  const [signingModalOpen, setSigningModalOpen] = useState(false);

  // Canvas de firma digital
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadDoc() {
      const repo = getRepository();
      const currentOrg = getOrganization();
      const orgId = currentOrg?.id || '';
      try {
        const currentDoc = (orgId ? await repo.getDocumentById(orgId, docId) : null) || (await repo.findDocumentByTokenOrId(docId)) || getDocumentById(docId);
        if (mounted && currentDoc) {
          setDoc(currentDoc);
          setSignatureDone(currentDoc.status === 'accepted' || currentDoc.status === 'invoiced');
          if (currentDoc.status === 'sent') {
            currentDoc.status = 'viewed';
            recordAuditEvent({
              id: `audit-${Date.now()}`,
              org_id: currentDoc.org_id || orgId,
              document_id: currentDoc.id,
              actor_kind: 'client',
              type: 'view',
              description: `Documento ${currentDoc.series || ''}-${String(currentDoc.number || 0).padStart(4, '0')} abierto por cliente.`,
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        const fallback = getDocumentById(docId);
        if (mounted && fallback) {
          setDoc(fallback);
          setSignatureDone(fallback.status === 'accepted' || fallback.status === 'invoiced');
        }
      }
    }
    loadDoc();
    return () => {
      mounted = false;
    };
  }, [docId]);

  if (!doc) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] text-white flex flex-col items-center justify-center p-6">
        <p className="text-lg font-bold">Documento no disponible o enlace caducado.</p>
        <p className="text-xs text-gray-400 mt-2">Por favor contacte con {org?.name || 'la empresa emisora'}.</p>
      </div>
    );
  }

  const client = doc.client;
  const totals = calcDocumentTotals(doc.items || []);
  const code = `${doc.series}-${String(doc.doc_number).padStart(4, '0')}`;

  // Manejadores del lienzo de firma
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleFormalSign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName || !signerTaxId) return;

    const canvas = canvasRef.current;
    const sigData = canvas?.toDataURL('image/png') || undefined;

    const updated = signDocument(doc.id, signerName, signerTaxId, sigData);
    setDoc(updated);
    setSignatureDone(true);
    setSigningModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Barra de Certificación de Seguridad */}
      <header className="sticky top-0 z-40 bg-[var(--bg-surface)]/90 backdrop-blur-md border-b border-white/10 px-4 md:px-8 py-3.5 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white font-mono text-sm shadow-md">
            IP
          </div>
          <div>
            <span className="text-xs font-bold text-white block">{org?.legal_name || org?.name || 'Ledgerly'}</span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <Lock size={10} /> Canal Seguro eIDAS Cifrado 256-bit
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 border border-white/10"
          >
            <Printer size={15} />
            <span>Imprimir / PDF</span>
          </button>

          {!signatureDone ? (
            <button
              onClick={() => setSigningModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <FileCheck size={16} />
              <span>Aceptar y Firmar Oferta</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={16} />
              <span>Oferta Aceptada</span>
            </div>
          )}
        </div>
      </header>

      {/* Modal de Firma Electrónica */}
      {signingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in no-print">
          <div className="w-full max-w-lg bg-[var(--bg-elevated)] border border-white/20 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-bold text-white text-base">Formalización y Firma Electrónica</h3>
                <p className="text-xs text-gray-400">Presupuesto oficial {code}</p>
              </div>
              <button
                onClick={() => setSigningModalOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormalSign} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Nombre y Apellidos del Apoderado *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Mendoza"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="input bg-[var(--bg-surface-2)] border-white/15 text-xs"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">DNI / NIF del Firmante *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 12345678A"
                    value={signerTaxId}
                    onChange={(e) => setSignerTaxId(e.target.value)}
                    className="input bg-[var(--bg-surface-2)] border-white/15 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Rúbrica / Trazo en pantalla */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 font-semibold">Rúbrica en pantalla (dibuje con ratón o dedo)</label>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[11px] text-gray-400 hover:text-indigo-400"
                  >
                    Borrar trazo
                  </button>
                </div>
                <div className="border border-white/20 rounded-xl overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={460}
                    height={140}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-32 cursor-crosshair touch-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 leading-relaxed">
                Al pulsar en <strong>Confirmar y Aceptar Oferta</strong>, declara su conformidad con las partidas y condiciones descritas, generándose un certificado de firma electrónica vinculante.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSigningModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm font-semibold"
                >
                  Confirmar y Aceptar Oferta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contenedor del Documento A4 */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div
          id="official-print-document"
          className="print-document bg-white text-slate-900 p-8 md:p-14 rounded-2xl shadow-2xl border border-slate-200 space-y-8"
        >
          {/* Cabecera */}
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

            <div className="print-card bg-slate-50 border border-slate-200 rounded-xl p-4 text-right min-w-[240px]">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                {DOC_TYPE_LABELS[doc.doc_type]}
              </p>
              <p className="text-3xl font-black font-mono text-slate-900 mt-0.5">{code}</p>
              <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-1 text-slate-600">
                <p><strong>Emisión:</strong> {formatDate(doc.created_at)}</p>
                <p><strong>Validez hasta:</strong> {formatDate(doc.valid_until || '')}</p>
                <p><strong>Estado:</strong> {DOC_STATUS_LABELS[doc.status]}</p>
              </div>
            </div>
          </div>

          {/* Datos Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print-card bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Destinatario / Razón Social
              </p>
              <p className="text-sm font-bold text-slate-900">{client?.name}</p>
              <p className="font-mono text-slate-700 mt-0.5">{client?.tax_id ? `CIF/NIF: ${client.tax_id}` : ''}</p>
              <p className="text-slate-600 mt-1">{client?.email} · {client?.phone}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Proyecto / Obra
              </p>
              <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
              <p className="text-slate-600 mt-1">Forma de Pago: {doc.payment_terms || 'Transferencia Bancaria'}{orgSettings?.iban ? ` (IBAN: ${orgSettings.iban})` : ''}</p>
            </div>
          </div>

          {/* Tabla de Partidas */}
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

          {/* Desglose Económico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
            <div className="text-[11px] text-slate-500 space-y-2 leading-relaxed">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Condiciones y Garantías
              </p>
              <p>{doc.notes_public}</p>
              <p className="text-[10px] text-slate-400">
                Tratamiento de datos conforme al RGPD (UE) 2016/679. Presupuesto formal válido como orden de ejecución tras aceptación.
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
                <span className="text-sm font-black text-slate-900 uppercase">Total Oferta:</span>
                <span className="text-xl font-black font-mono text-indigo-700">
                  {formatCents(totals.total_cents)}
                </span>
              </div>
            </div>
          </div>

          {/* Cuadro de Firma Oficial */}
          <div className="pt-4 border-t border-slate-200">
            <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-800">Conformidad y Aceptación del Cliente</p>
                <p className="text-[11px] text-slate-500">
                  Firma digital vinculante según el Reglamento eIDAS (UE) Nº 910/2014
                </p>
                {signatureDone && (
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
                          ? 'Firma electrónica simple (eIDAS Art. 25.1) registrada con hash SHA-256'
                          : doc.signature_data || 'Firma electrónica simple verificada'}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {!signatureDone ? (
                <button
                  onClick={() => setSigningModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
                >
                  Firmar Documento Ahora
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 size={16} />
                  <span>Aceptado y Firmado</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ClientViewPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-gray-400">
          Cargando documento seguro...
        </div>
      }
    >
      <ClientViewContent {...props} />
    </Suspense>
  );
}
