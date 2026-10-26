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
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 px-4 py-12 flex flex-col items-center">
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

        {!isConfigured ? (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-1">Configuración Pendiente</strong>
              Los metadatos del productor del software no han sido definidos en las variables de entorno del servidor. La activación comercial en producción se encuentra bloqueada hasta completar la parametrización oficial.
            </div>
          </div>
        ) : (
          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-xs md:text-sm text-slate-300 leading-relaxed shadow-xl">
            <div className="space-y-3 pb-6 border-b border-slate-800">
              <p>
                D./Dña. representante legal de la entidad <strong className="text-white">{producer.name}</strong>, provista de NIF <strong className="text-white font-mono">{producer.tax_id}</strong>, en calidad de persona productora del sistema informático de facturación:
              </p>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 font-mono text-xs">
                <div><span className="text-slate-500">Nombre del Sistema:</span> <span className="text-slate-200 font-semibold">{producer.software_name}</span></div>
                <div><span className="text-slate-500">Versión Certificada:</span> <span className="text-slate-200 font-semibold">{producer.software_version}</span></div>
                <div><span className="text-slate-500">Fecha de Declaración:</span> <span className="text-slate-200">{producer.declaration_date}</span></div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-bold text-white">DECLARA BAJO SU RESPONSABILIDAD:</h2>
              <ol className="list-decimal list-inside space-y-3 pl-2">
                <li>
                  Que el sistema informático de facturación referenciado cumple estrictamente con las especificaciones y requisitos establecidos en el <strong className="text-slate-100">artículo 29.2.j) de la Ley 58/2003, de 17 de diciembre, General Tributaria</strong>, introducido por la Ley 11/2021, de 9 de julio, de medidas de prevención y lucha contra el fraude fiscal.
                </li>
                <li>
                  Que se ajusta íntegramente a los requisitos técnicos de integridad, conservación, accesibilidad, legibilidad, trazabilidad e inalterabilidad de los registros exigidos por el <strong className="text-slate-100">Real Decreto 1007/2023, de 5 de diciembre</strong>, y su orden ministerial de desarrollo (<strong className="text-slate-100">Orden HAC/1177/2024</strong>).
                </li>
                <li>
                  Que el sistema incorpora mecanismos de registro de facturación de alta y anulación encadenados criptográficamente mediante algoritmo SHA-256, con imposibilidad técnica de manipulación u omisión de transacciones sin dejar evidencia constatable.
                </li>
                <li>
                  Que el sistema informático no contiene funcionalidades que permitan llevar dobles contabilidades, alterar o no reflejar de manera fidedigna las operaciones realizadas, ni destruir registros de facturación con anterioridad al plazo legal de conservación.
                </li>
              </ol>
            </div>

            <div className="pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Documento emitido conforme al Art. 13 del RD 1007/2023</span>
              </div>
              <span>Madrid, España</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
