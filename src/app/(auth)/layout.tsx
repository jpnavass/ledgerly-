import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Luces y efectos de fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Cabecera de Marca */}
      <div className="mb-8 text-center flex flex-col items-center">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <span className="text-xl font-bold tracking-tight text-white block">
              Presupuesto Express
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 block -mt-1">
              Enterprise
            </span>
          </div>
        </Link>
        <p className="mt-3 text-xs text-slate-400 max-w-sm">
          Plataforma de facturación electrónica, presupuestación y cumplimiento legal español
        </p>
      </div>

      {/* Tarjeta de Contenido */}
      <div className="w-full max-w-md bg-[var(--bg-surface)]/90 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-xl p-8 relative z-10">
        {children}
      </div>

      {/* Pie de Página */}
      <div className="mt-8 text-center text-xs text-slate-500">
        &copy; 2027 Presupuesto Express Enterprise · Cumplimiento Ley 11/2021 y RD 1619/2012
      </div>
    </div>
  );
}
