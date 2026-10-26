import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function AvisoLegalPage() {
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
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-400 block">
              Información Legal y Regulatoria
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Aviso Legal
            </h1>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-xs md:text-sm text-slate-300 leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">1. Datos Identificativos del Prestador</h2>
            <p>
              En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa a los usuarios que la plataforma web y el software <strong>Ledgerly</strong> son gestionados por el titular del servicio, con domicilio de operaciones en Málaga, España, y correo electrónico de contacto: <a href="mailto:presupuestoxpress@gmail.com" className="text-indigo-400 hover:underline">presupuestoxpress@gmail.com</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">2. Objeto y Ámbito de Aplicación</h2>
            <p>
              El presente Aviso Legal regula el acceso y la utilización del servicio Ledgerly, destinado a facilitar a profesionales, autónomos y empresas la elaboración, gestión y custodia de presupuestos comerciales, albaranes de entrega y facturación conforme a las especificaciones técnicas aplicables de la normativa española.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">3. Condiciones de Uso y Responsabilidad</h2>
            <p>
              El usuario se compromete a hacer un uso lícito y diligente de la plataforma, absteniéndose de utilizarla para actividades contrarias a la legislación fiscal, mercantil o tributaria española. Ledgerly no se responsabiliza de los contenidos, datos contables o fiscales introducidos por los usuarios en sus respectivos espacios de trabajo.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">4. Propiedad Intelectual e Industrial</h2>
            <p>
              Todos los derechos sobre el diseño de la plataforma, código fuente, interfaz, logotipos y contenidos pertenecen legítimamente al titular de Ledgerly o cuentan con la correspondiente licencia de explotación de código abierto. Queda prohibida la reproducción total o parcial sin autorización expresa.
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
