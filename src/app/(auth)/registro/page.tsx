'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { saveOrganization } from '@/lib/store';
import type { Org } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business' | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('plan');
      if (p === 'pro' || p === 'business') {
        setSelectedPlan(p);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.');
        setLoading(false);
        return;
      }

      // Guardar la organización de forma que esté inmediatamente disponible y vinculada
      const orgId = `org_${Date.now()}`;
      const newOrg: Org = {
        id: orgId,
        name: companyName.trim(),
        legal_name: companyName.trim(),
        tax_id: '',
        email: email.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveOrganization(newOrg);

      const supabase = createClient();
      if (supabase) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company_name: companyName,
              selected_plan: selectedPlan || 'free',
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // Si requiere confirmación por correo y no hay sesión activa aún ni plan seleccionado
        if (!data.session && !selectedPlan) {
          setSuccess(true);
          return;
        }
      }

      // Si seleccionó un plan de pago (pro o business), asociarlo directamente a Stripe
      if (selectedPlan) {
        try {
          const res = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: selectedPlan,
              org_id: orgId,
              customer_email: email.trim(),
            }),
          });
          const checkoutData = await res.json();
          if (checkoutData?.url) {
            window.location.href = checkoutData.url;
            return;
          }
        } catch (checkoutErr) {
          console.warn('Error al iniciar checkout tras registro:', checkoutErr);
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al registrar la organización.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Revisa tu correo electrónico</h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          Te hemos enviado un enlace de confirmación a <strong className="text-slate-200">{email}</strong>.
          Haz clic en el enlace para activar tu cuenta y acceder a tu panel de gestión.
        </p>
        <Link
          href={selectedPlan ? `/login?plan=${selectedPlan}` : '/login'}
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-colors"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white tracking-tight">Crea tu cuenta</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configura tu espacio para gestionar presupuestos, facturas y albaranes
        </p>
      </div>

      {selectedPlan && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Zap size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                Plan Seleccionado: {selectedPlan === 'pro' ? 'Profesional (19 € / mes)' : 'Empresa (49 € / mes)'}
              </p>
              <p className="text-[11px] text-indigo-300/80">
                Tu suscripción quedará vinculada permanentemente a esta cuenta.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-500/30">
            Paso 1: Registro
          </span>
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="companyName">
            Tu empresa o nombre comercial
          </label>
          <div className="relative">
            <div className="input-icon-left text-slate-500">
              <Building2 className="w-4 h-4" />
            </div>
            <input
              id="companyName"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ej. Reformas y Montajes García"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="fullName">
            Tu nombre completo
          </label>
          <div className="relative">
            <div className="input-icon-left text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan García Martínez"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="email">
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
          <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="password">
            Tu contraseña (mínimo 8 caracteres)
          </label>
          <div className="relative">
            <div className="input-icon-left text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Checkbox obligatorio de aceptación legal */}
        <div className="flex items-start gap-2.5 pt-1 text-xs text-slate-300">
          <input
            id="terms"
            type="checkbox"
            required
            className="w-4 h-4 mt-0.5 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="terms" className="leading-tight text-[11px] text-slate-400">
            He leído y acepto el{' '}
            <Link href="/legal/aviso-legal" target="_blank" className="text-indigo-400 hover:underline">
              Aviso Legal
            </Link>
            , la{' '}
            <Link href="/legal/privacidad" target="_blank" className="text-indigo-400 hover:underline">
              Política de Privacidad
            </Link>{' '}
            y las{' '}
            <Link href="/legal/terminos" target="_blank" className="text-indigo-400 hover:underline">
              Condiciones de Contratación
            </Link>
            .
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-3 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{selectedPlan ? 'Preparando cuenta…' : 'Creando tu cuenta…'}</span>
            </>
          ) : selectedPlan ? (
            <>
              <Zap size={16} />
              <span>Crear cuenta y proceder al pago seguro</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Crear cuenta gratis</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-400">
          ¿Ya tienes una cuenta registrada?{' '}
          <Link
            href={selectedPlan ? `/login?plan=${selectedPlan}` : '/login'}
            className="text-indigo-400 font-semibold hover:text-indigo-300"
          >
            Acceder y continuar
          </Link>
        </p>
      </div>
    </div>
  );
}
