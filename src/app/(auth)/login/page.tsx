'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('plan');
      if (p === 'pro' || p === 'business') {
        setSelectedPlan(p);
      }
    }
  }, []);

  const handlePostLoginRedirect = async (userEmail: string) => {
    if (selectedPlan) {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: selectedPlan,
            org_id: 'org_main',
            customer_email: userEmail,
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      } catch (e) {
        console.error('Error al iniciar checkout post-login:', e);
      }
    }
    router.push('/dashboard');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        // En modo local sin backend de Supabase
        await handlePostLoginRedirect(email);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Credenciales de acceso incorrectas. Verifique correo y contraseña.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      await handlePostLoginRedirect(email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white tracking-tight">Acceso a tu cuenta</h1>
        <p className="text-xs text-slate-400 mt-1">
          Introduce tus datos de acceso para entrar a tu panel de presupuestos y facturas
        </p>
      </div>

      {selectedPlan && (
        <div className="mb-5 p-3.5 rounded-xl bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-slate-900 border border-blue-500/30 text-xs text-slate-200 flex items-start gap-3 shadow-lg">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-blue-300 flex items-center gap-1.5">
              <span>Plan Seleccionado: {selectedPlan === 'pro' ? 'Profesional (19€/mes)' : 'Empresa (49€/mes)'}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Inicia sesión con tu cuenta para vincular tu suscripción y acceder de inmediato tras el pago seguro.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="email">
            Tu correo electrónico
          </label>
          <div className="relative">
            <div className="input-icon-left text-slate-500">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-slate-300" htmlFor="password">
              Tu contraseña
            </label>
            <Link
              href="/recuperar"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              ¿Has olvidado tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <div className="input-icon-left text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Comprobando datos…</span>
            </>
          ) : (
            <>
              <span>Entrar a mi cuenta</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-400">
          ¿No tienes cuenta todavía?{' '}
          <Link
            href={selectedPlan ? `/registro?plan=${selectedPlan}` : '/registro'}
            className="text-indigo-400 font-semibold hover:text-indigo-300"
          >
            Crear cuenta gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
