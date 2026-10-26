import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export default function PoliticaPrivacidadPage() {
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
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-400 block">
              Protección de Datos (RGPD y LOPDGDD)
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Política de Privacidad
            </h1>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-xs md:text-sm text-slate-300 leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">1. Responsable del Tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos recabados en la plataforma es <strong>Ledgerly</strong>. Puedes contactar con nosotros para cualquier cuestión relativa a tu privacidad a través de <a href="mailto:presupuestoxpress@gmail.com" className="text-indigo-400 hover:underline">presupuestoxpress@gmail.com</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">2. Finalidad y Base Jurídica</h2>
            <p>Tratamos los datos facilitados por los usuarios con las siguientes finalidades:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Gestión del registro, autenticación y mantenimiento de la cuenta de usuario (ejecución contractual).</li>
              <li>Generación, almacenamiento y cálculo de documentos mercantiles y de facturación solicitados por el cliente (ejecución contractual y cumplimiento legal de obligaciones tributarias).</li>
              <li>Gestión del cobro de planes de suscripción a través de plataformas seguras de pago como Stripe (ejecución contractual).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">3. Destinatarios de los Datos</h2>
            <p>
              No se cederán datos a terceros salvo obligación legal o cuando sea imprescindible para la prestación del servicio (proveedores de infraestructura en la nube bajo cláusulas de confidencialidad y pasarela de pago Stripe bajo estándares PCI-DSS).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">4. Derechos del Usuario (ARCO / RGPD)</h2>
            <p>
              Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación del tratamiento, portabilidad y oposición enviando un correo electrónico a <a href="mailto:presupuestoxpress@gmail.com" className="text-indigo-400 hover:underline">presupuestoxpress@gmail.com</a> acreditando tu identidad. Asimismo, tienes derecho a reclamar ante la Agencia Española de Protección de Datos (AEPD).
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
