'use client';

import AppLayout from '@/components/layout/AppLayout';
import { getClients, createNewDocument, getOrgSettings } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import {
  FileText,
  ClipboardList,
  Receipt,
  FileCheck,
  ArrowLeft,
  ArrowRight,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Plus,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { DocType } from '@/types';

const DOC_TYPES: {
  value: DocType;
  label: string;
  series: string;
  description: string;
  icon: typeof FileText;
  color: string;
  bg: string;
}[] = [
  {
    value: 'quote',
    label: 'Presupuesto Oficial',
    series: 'Serie PRE',
    description: 'Propuesta técnica y económica con desglose de capítulos y opción de firma digital.',
    icon: FileText,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/15 border-indigo-500/30',
  },
  {
    value: 'delivery_note',
    label: 'Albarán de Entrega',
    series: 'Serie ALB',
    description: 'Certificación de recepción de materiales en obra o ejecución de servicios parciales.',
    icon: ClipboardList,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
  },
  {
    value: 'proforma',
    label: 'Factura Proforma',
    series: 'Serie PRO',
    description: 'Documento previo justificativo para solicitud de anticipo o apertura de crédito bancario.',
    icon: Receipt,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15 border-amber-500/30',
  },
  {
    value: 'invoice',
    label: 'Factura Comercial',
    series: 'Serie FAC',
    description: 'Factura ordinaria conforme al RD 1619/2012 con registro de facturación encadenado.',
    icon: FileCheck,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15 border-purple-500/30',
  },
];

export default function NewDocumentPage() {
  const router = useRouter();
  const clients = useMemo(() => getClients(), []);
  const settings = useMemo(() => getOrgSettings(), []);

  const [step, setStep] = useState(0);
  const [docType, setDocType] = useState<DocType>('quote');
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNextStep = () => {
    setErrorMsg(null);
    if (step === 1 && !clientId) {
      setErrorMsg('Debes seleccionar un cliente existente para continuar.');
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handleCreate = () => {
    if (!clientId) {
      setErrorMsg('El cliente es obligatorio.');
      setStep(1);
      return;
    }

    const selectedType = DOC_TYPES.find((t) => t.value === docType);
    const finalTitle =
      title.trim() ||
      `${selectedType?.label || 'Documento'} - ${new Date().toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      })}`;

    // Calcular fecha de validez con org_settings.default_validity_days
    const validityDays = settings?.default_validity_days || 30;
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validityDays);
    const validUntilIso = validUntilDate.toISOString().slice(0, 10);

    const newDoc = createNewDocument({
      doc_type: docType,
      client_id: clientId,
      title: finalTitle,
      valid_until: validUntilIso,
      initialItems: [], // Documento inicialmente vacío conforme a la norma
    });

    router.push(`/documentos/editor?id=${newDoc.id}`);
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-[760px] mx-auto space-y-6 animate-fade-in">
        {/* Cabecera */}
        <div className="flex items-center gap-3">
          <Link
            href="/documentos"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Emisión de Nuevo Documento
            </h1>
            <p className="text-xs text-gray-400">
              Paso {step + 1} de 3 · Configuración de serie y destinatario fiscal
            </p>
          </div>
        </div>

        {/* Indicador de Pasos Accesible */}
        <div className="stepper">
          {[
            { num: 1, label: 'Tipo' },
            { num: 2, label: 'Cliente' },
            { num: 3, label: 'Proyecto' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className={`step-item ${step === idx ? 'active' : step > idx ? 'completed' : ''}`}>
                <div className="step-circle">{step > idx ? '✓' : s.num}</div>
                <span className="text-xs font-semibold text-gray-300 hidden sm:inline">{s.label}</span>
              </div>
              {idx < 2 && (
                <div className={`step-connector ${step > idx ? 'completed' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Paso 0: Selección de Serie y Tipo */}
        {step === 0 && (
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4 animate-fade-in">
            <h2 className="text-base font-bold text-white">
              Selecciona el tipo de documento a emitir:
            </h2>
            <div className="space-y-3">
              {DOC_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setDocType(type.value)}
                  className={`w-full p-4 rounded-xl border flex items-center gap-4 text-left transition-all ${
                    docType === type.value
                      ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-500/15'
                      : 'bg-[var(--bg-surface-2)] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${type.bg}`}
                  >
                    <type.icon size={22} className={type.color} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{type.label}</p>
                      <span className="font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">
                        {type.series}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      {type.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      docType === type.value
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-gray-600'
                    }`}
                  >
                    {docType === type.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paso 1: Selección de Cliente */}
        {step === 1 && (
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                ¿A qué cuenta o empresa va dirigido el documento?
              </h2>
              <Link href="/clientes" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                <Plus size={13} />
                <span>Nuevo Cliente</span>
              </Link>
            </div>

            {clients.length > 0 ? (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setClientId(client.id);
                      setErrorMsg(null);
                    }}
                    className={`w-full p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all ${
                      clientId === client.id
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-500/15'
                        : 'bg-[var(--bg-surface-2)] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-indigo-400 flex-shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{client.name}</p>
                      <p className="text-xs text-gray-400 font-mono">
                        CIF/NIF {client.tax_id} {client.email ? `· ${client.email}` : ''}
                      </p>
                    </div>
                    {clientId === client.id && (
                      <CheckCircle2 size={18} className="text-indigo-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <Building2 size={24} />
                </div>
                <h4 className="empty-state-title">No hay clientes registrados</h4>
                <p className="empty-state-desc">
                  Es obligatorio asignar un cliente con NIF válido antes de confeccionar un documento oficial.
                </p>
                <Link href="/clientes" className="btn btn-primary btn-sm">
                  <Plus size={15} />
                  <span>Crear Primer Cliente</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: Título y Objeto Contractual */}
        {step === 2 && (
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4 animate-fade-in">
            <h2 className="text-base font-bold text-white">
              Título y Objeto del Documento
            </h2>
            <div className="space-y-3">
              <div className="field">
                <label className="field-label">Concepto Principal / Referencia de Proyecto</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input bg-[var(--bg-surface-2)] border-white/15 text-sm py-3"
                  placeholder="Ej. Instalación Eléctrica Baja Tensión y Cuadro General"
                  autoFocus
                />
              </div>

              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
                <ShieldCheck size={20} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-300 leading-relaxed">
                  El documento se creará en estado <strong>Borrador</strong>, listo para añadir capítulos, partidas técnicas y configurar hitos de cobro en el editor.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Navegación del Flujo por Pasos */}
        <div className="flex items-center justify-between pt-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setErrorMsg(null);
              setStep(Math.max(0, step - 1));
            }}
            disabled={step === 0}
          >
            <ArrowLeft size={16} />
            <span>Atrás</span>
          </button>

          {step < 2 ? (
            <button
              className="btn btn-primary btn-sm font-semibold"
              onClick={handleNextStep}
            >
              <span>Continuar</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg shadow-lg shadow-indigo-600/30 font-semibold"
              onClick={handleCreate}
              disabled={!clientId}
            >
              <FileText size={18} />
              <span>Crear Borrador y Abrir Editor</span>
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
