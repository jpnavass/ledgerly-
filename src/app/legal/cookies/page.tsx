import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Cookie } from 'lucide-react';

export default function PoliticaCookiesPage() {
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
            <Cookie className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-400 block">
              Transparencia y Privacidad
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Política de Cookies
            </h1>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-xs md:text-sm text-slate-300 leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">1. ¿Qué son las Cookies?</h2>
            <p>
              Una cookie es un pequeño fichero de texto que los sitios web almacenan en tu navegador para recordar información sobre tu visita, mantener sesiones de usuario autenticadas y personalizar tus preferencias visuales.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">2. Cookies Utilizadas en Ledgerly</h2>
            <p>
              Ledgerly utiliza exclusivamente <strong>cookies técnicas estrictamente necesarias</strong> para el funcionamiento de la plataforma:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <strong>Cookies de sesión de autenticación (Supabase Auth):</strong> Permiten mantener la sesión iniciada de forma cifrada y segura mientras navegas por tu panel.
              </li>
              <li>
                <strong>Cookie de preferencias visuales (`pe_ui`):</strong> Almacena tu selección de tema (modo claro/oscuro), densidad y contraste para evitar parpadeos al cargar la página.
              </li>
            </ul>
            <p className="mt-2 text-slate-400">
              No utilizamos cookies publicitarias ni de seguimiento comercial invasivo.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">3. Gestión de Cookies en el Navegador</h2>
            <p>
              Puedes permitir, bloquear o eliminar las cookies instaladas en tu equipo mediante la configuración de las opciones del navegador web que utilices. Ten en cuenta que si bloqueas las cookies técnicas esenciales, es posible que no puedas iniciar sesión en la plataforma.
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
