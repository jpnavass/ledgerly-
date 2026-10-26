'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { getPayments, markPaymentAsPaid, getDocumentById, getClientById, getOrganization, getRepository } from '@/lib/store';
import type { Payment } from '@/types';
import { formatCents } from '@/lib/calculations';
import { formatDate } from '@/lib/utils';
import {
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const org = getOrganization();

  const load = async () => {
    setLoading(true);
    const isSupabase = typeof process !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const repo = getRepository();
    const orgId = org?.id || '';
    try {
      if (!orgId && isSupabase) {
        throw new Error('No se ha detectado una organización activa vinculada a la sesión.');
      }
      const data = await repo.getPayments(orgId);
      setPayments(data);
      setLoadError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al sincronizar cobros con el repositorio.';
      if (isSupabase) {
        setLoadError(msg);
        setPayments([]);
      } else {
        setPayments(getPayments());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener('pe_store_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('pe_store_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const totalCobrado = payments
    .filter((p) => Boolean(p.paid_at))
    .reduce((sum, p) => sum + p.amount_cents, 0);

  const totalPendiente = payments
    .filter((p) => !p.paid_at)
    .reduce((sum, p) => sum + p.amount_cents, 0);

  const handleMarkAsPaid = (id: string) => {
    markPaymentAsPaid(id);
    setPayments(getPayments());
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        {loadError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-4">
            <p className="text-sm text-rose-300">{loadError}</p>
            <button onClick={load} className="btn btn-secondary btn-sm flex-shrink-0">
              Reintentar
            </button>
          </div>
        )}
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                TESORERÍA Y CAJA
              </span>
              <span className="text-xs text-gray-400">Previsión de vencimientos e ingresos</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Tesorería, Hitos y Cobros
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Seguimiento de cobros por certificación de obra, anticipos y calendario de vencimientos.
            </p>
          </div>
        </div>

        {/* Tarjetas de Tesorería */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Cobrado</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-emerald-400 font-mono">
              {formatCents(totalCobrado)}
            </div>
            <p className="text-xs text-gray-500 mt-2">Fondos ingresados y conciliados</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Pendiente de Vencimiento</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <Clock size={16} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-indigo-300 font-mono">
              {formatCents(totalPendiente)}
            </div>
            <p className="text-xs text-gray-500 mt-2">Cobros programados según calendario pactado</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Compromiso IBAN</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
                <CreditCard size={16} />
              </div>
            </div>
            <div className="text-sm font-bold text-white font-mono truncate">
              {org?.tax_id ? `IBAN Registrado` : 'Pendiente de configurar'}
            </div>
            <p className="text-xs text-gray-500 mt-2">Cuenta corporativa de tesorería</p>
          </div>
        </div>

        {/* Tabla de Hitos de Pago */}
        <div className="bg-[var(--bg-surface)] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-base font-bold text-white">Calendario de Cobros Contractuales</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Hitos vinculados a la ejecución técnica de proyectos aceptados
            </p>
          </div>

          <div className="overflow-x-auto">
            {payments.length === 0 ? (
              <div className="p-12 text-center">
                <CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white">Sin cobros ni hitos registrados</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Los vencimientos y previsiones de cobro aparecerán aquí conforme emita presupuestos y facturas.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] border-b border-white/5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Documento</th>
                    <th className="py-3.5 px-5">Cliente y CIF</th>
                    <th className="py-3.5 px-5">Hito de Pago</th>
                    <th className="py-3.5 px-5">Método Pactado</th>
                    <th className="py-3.5 px-5">Vencimiento</th>
                    <th className="py-3.5 px-5 text-right">Importe</th>
                    <th className="py-3.5 px-5 text-center">Estado</th>
                    <th className="py-3.5 px-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => {
                    const isPaid = Boolean(p.paid_at);
                    const doc = getDocumentById(p.document_id);
                    const client = doc?.client_id ? getClientById(doc.client_id) : null;
                    const docCode = doc ? `${doc.series || ''}-${String(doc.number || 0).padStart(4, '0')}` : p.document_id;

                    return (
                      <tr key={p.id} className="hover:bg-white/[0.025] transition-colors">
                        <td className="py-4 px-5">
                          <Link
                            href={`/documentos/editor?id=${p.document_id}`}
                            className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25"
                          >
                            {docCode}
                          </Link>
                        </td>

                        <td className="py-4 px-5">
                          <p className="font-semibold text-gray-200 text-xs">{client?.legal_name || client?.name || 'Cliente'}</p>
                          <p className="font-mono text-[11px] text-gray-500">{client?.tax_id ? `NIF/CIF ${client.tax_id}` : '-'}</p>
                        </td>

                        <td className="py-4 px-5 text-xs text-gray-300">
                          {p.label}
                        </td>

                        <td className="py-4 px-5 text-xs text-gray-400 font-mono">
                          {p.method || 'Transferencia Bancaria'}
                        </td>

                        <td className="py-4 px-5 text-xs font-mono text-gray-300">
                          {formatDate(p.due_date || '')}
                        </td>

                        <td className="py-4 px-5 text-right font-mono font-bold text-gray-100 text-sm">
                          {formatCents(p.amount_cents)}
                        </td>

                        <td className="py-4 px-5 text-center">
                          {isPaid ? (
                            <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={12} />
                              Cobrado
                            </span>
                          ) : (
                            <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Clock size={12} />
                              Pendiente
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-5 text-right">
                          {!isPaid ? (
                            <button
                              onClick={() => handleMarkAsPaid(p.id)}
                              className="btn btn-secondary btn-sm text-xs font-semibold"
                            >
                              <Check size={14} className="text-emerald-400" />
                              <span>Registrar Cobro</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono text-emerald-400">
                              Conciliado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
