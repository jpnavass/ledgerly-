'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eraser,
  PenLine,
  Lock,
} from 'lucide-react';
import { formatCents } from '@/lib/money';
import { calcLineTotal } from '@/lib/calculations';

function SignDocumentContent() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<any | null>(null);

  // Datos del firmante
  const [signerName, setSignerName] = useState('');
  const [signerTaxId, setSignerTaxId] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signatureCompleted, setSignatureCompleted] = useState<string | null>(null);

  // Referencias para el canvas de firma
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    async function initSession() {
      if (!token) return;
      try {
        setLoading(true);
        const res = await fetch('/api/sign/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, requestOtp: false }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar el documento para firma.');
        }

        setDocument(data.document);
        if (data.document?.client?.name) {
          setSignerName(data.document.client.name);
        }
        if (data.document?.client?.tax_id) {
          setSignerTaxId(data.document.client.tax_id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al conectar con el servidor.');
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [token]);

  // Manejadores de dibujo en el canvas
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

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

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineTo(x, y);
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
    setHasDrawn(false);
  };

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasDrawn) {
      setError('Por favor, dibuje su firma manuscrita en el recuadro habilitado.');
      return;
    }
    if (!acceptedTerms) {
      setError('Debe aceptar las condiciones legales y la validez de la firma electrónica.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const canvas = canvasRef.current;
      const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : '';

      const res = await fetch('/api/sign/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signerName,
          signerTaxId,
          signatureImage: signatureDataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la firma.');
      }

      setSignatureCompleted(data.evidenceHash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar la firma electrónica.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-xs">Cargando sesión de firma electrónica segura…</span>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] border border-rose-500/30 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Enlace no disponible</h2>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (signatureCompleted) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-[var(--bg-surface)] border border-emerald-500/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Documento Aceptado y Firmado</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              La formalización ha concluido con éxito. El paquete de evidencias y la huella SHA-256 han sido registrados de forma inalterable.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-left space-y-1.5 font-mono text-xs">
            <div className="text-slate-500 text-[10px] uppercase">Huella de Evidencia eIDAS (SHA-256):</div>
            <div className="text-emerald-400 break-all select-all font-semibold">
              {signatureCompleted}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Se ha remitido un certificado de aceptación a la dirección de correo electrónico del emisor y destinatario.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-100 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Cabecera del Portal de Firma */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 block font-semibold">
                Portal de Aceptación Segura
              </span>
              <h1 className="text-lg font-bold text-white tracking-tight">
                {document?.title || 'Propuesta Contractual'}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Total a formalizar</span>
            <span className="text-base font-bold text-emerald-400 font-mono">
              {formatCents(document?.total_cents || 0)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resumen del Contrato / Partidas */}
        <div className="bg-[var(--bg-surface)] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileText size={15} className="text-blue-400" />
            <span>Detalle de Partidas Incluidas</span>
          </h2>

          <div className="divide-y divide-slate-800/80 text-xs">
            {document?.items?.map((item: any) => (
              <div key={item.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <span className="text-slate-200 font-medium block">{item.description}</span>
                  <span className="text-[11px] text-slate-500">
                    {item.quantity} ud(s). x {formatCents(item.price_cents)} (IVA {item.vat_rate}%)
                  </span>
                </div>
                <span className="font-mono text-slate-300">
                  {formatCents(item.total_cents ?? calcLineTotal(item.quantity, item.price_cents, item.discount_pct || 0, item.vat_rate || 0, item.irpf_rate || 0).total_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Formulario de Firma */}
        <form onSubmit={handleSubmitSignature} className="bg-[var(--bg-surface)] border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <PenLine size={15} className="text-blue-400" />
            <span>Datos y Rúbrica del Firmante</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Nombre y Apellidos</label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nombre del apoderado o titular"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">NIF / CIF / NIE</label>
              <input
                type="text"
                required
                value={signerTaxId}
                onChange={(e) => setSignerTaxId(e.target.value)}
                placeholder="48392021K"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Recuadro de Rúbrica Manuscrita */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium">Dibuje su firma en el recuadro</label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Eraser size={13} />
                <span>Borrar rúbrica</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-950/80 overflow-hidden relative touch-none">
              <canvas
                ref={canvasRef}
                width={600}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[160px] cursor-crosshair"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-xs">
                  Dibuje aquí con el ratón o el dedo
                </div>
              )}
            </div>
          </div>

          {/* Declaración Legal Honesta conforme a eIDAS */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400 leading-relaxed">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-blue-600 rounded cursor-pointer"
              />
              <span>
                Acepto los términos de la propuesta y reconozco la validez de esta <strong className="text-slate-200">firma electrónica simple</strong> con evidencias técnicas de integridad y trazabilidad conforme al Reglamento (UE) Nº 910/2014 (eIDAS). Se capturará mi dirección IP, hora del servidor y la huella criptográfica SHA-256 del documento.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !hasDrawn || !acceptedTerms}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando paquete de evidencias y formalizando…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Formalizar Firma de Aceptación</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SignDocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center text-slate-300 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs">Cargando sesión de firma electrónica segura…</span>
        </div>
      }
    >
      <SignDocumentContent />
    </Suspense>
  );
}
