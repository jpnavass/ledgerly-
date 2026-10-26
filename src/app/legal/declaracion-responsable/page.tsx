import React from 'react';
import Link from 'next/link';
import { ShieldCheck, FileCheck, ArrowLeft, AlertCircle } from 'lucide-react';
import { COMPLIANCE_CONFIG } from '@/lib/compliance/config';

export default function DeclaracionResponsablePage() {
  const producer = COMPLIANCE_CONFIG.producer;
  const isConfigured = Boolean(
    producer.name && producer.tax_id && producer.software_name && producer.software_version
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-100 px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al portal principal</span>
        </Link>

        {/* Cabecera */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-400 block">
              Cumplimiento Normativo Oficial
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Declaración Responsable del Productor del Sistema
            </h1>
          </div>
        </div>

        <div className="p-6 md:p-8 rounded-2xl bg-[#0f172a] border border-amber-500/30 text-slate-300 text-xs md:text-sm space-y-5 shadow-xl">
          <div className="flex items-center gap-3 text-amber-400 font-semibold text-base">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <span>Documento en Proceso de Auditoría y Validación Técnico-Legal</span>
          </div>

          <p className="leading-relaxed">
            La Declaración Responsable formal del productor de software (prevista en el artículo 13 del Real Decreto 1007/2023) se encuentra actualmente en fase de revisión técnico-legal y verificación pericial previa a su firma y publicación oficial.
          </p>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-400 font-mono">
            <div><span className="text-slate-500">Estado del documento:</span> <span className="text-amber-400 font-semibold">Borrador Técnico en Auditoría</span></div>
            <div><span className="text-slate-500">Software:</span> Ledgerly (v2.0)</div>
            <div><span className="text-slate-500">Próximo hito:</span> Validación formal con asesoría tributaria colegiada</div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            El sistema incorpora las especificaciones de inalterabilidad, trazabilidad y encadenamiento SHA-256 de facturación. La versión formalmente firmada por el representante legal acreditado será publicada y puesta a disposición de los usuarios y de la administración una vez culminada la fase de auditoría.
          </p>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Málaga, España</span>
            <span>Ledgerly Compliance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
