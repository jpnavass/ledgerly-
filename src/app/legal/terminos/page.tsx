import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TerminosCondicionesPage() {
  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 px-4 py-12 flex flex-col items-center font-sans">
      <div className="w-full max-w-3xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al portal principal</span>
        </Link>

        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-400 block">
              Contratación de Servicios SaaS
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Condiciones de Contratación
            </h1>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-xs md:text-sm text-slate-300 leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">1. Servicios y Modalidades de Suscripción</h2>
            <p>
              Ledgerly proporciona un software en modalidad Software as a Service (SaaS) con diferentes niveles de acceso:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Plan Gratuito:</strong> Diseñado para evaluación y uso inicial básico, con límite de hasta 5 documentos mensuales.</li>
              <li><strong>Plan Profesional (19 € / mes + IVA):</strong> Para autónomos y microempresas, con hasta 100 documentos mensuales, soporte prioritario y herramientas de firma electrónica simple.</li>
              <li><strong>Plan Empresa (49 € / mes + IVA):</strong> Para empresas y equipos, con capacidad ampliada y soporte técnico preferente.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">2. Facturación, Renovación y Sin Permanencia</h2>
            <p>
              Las suscripciones de pago se facturan con carácter mensual anticipado a través de pasarela bancaria segura con tarjeta. No existe compromiso de permanencia: el usuario puede cancelar la renovación automática en cualquier momento desde su panel de control con efecto al finalizar el ciclo de facturación en curso.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">3. Responsabilidad Fiscal y Cumplimiento</h2>
            <p>
              El software está diseñado para facilitar el cumplimiento de los requisitos de inalterabilidad, trazabilidad y legibilidad establecidos en la normativa española (Ley 11/2021 y RD 1619/2012). No obstante, el usuario es el único responsable de la veracidad y legalidad de las operaciones económicas, partidas e importes reflejados en sus documentos.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">4. Disponibilidad y Soporte Técnico</h2>
            <p>
              Nos esforzamos por garantizar una disponibilidad continua del servicio. Las consultas de soporte se atienden por correo electrónico (<a href="mailto:presupuestoxpress@gmail.com" className="text-indigo-400 hover:underline">presupuestoxpress@gmail.com</a>) y a través de los canales de asistencia indicados en la plataforma.
            </p>
          </section>

          <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
            Última actualización: Octubre de {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}
