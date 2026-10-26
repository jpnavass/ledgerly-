'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  FileText,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Plus,
  Eye,
  Send,
  Building2,
  Download,
  Share2,
  Filter,
  Check,
  ShieldCheck,
  Workflow,
  ExternalLink,
  ChevronRight,
  FileCheck,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { getDocuments, getOrganization } from '@/lib/store';
import { getRepository } from '@/lib/repo';
import { formatCents } from '@/lib/calculations';
import { formatDate } from '@/lib/utils';
import type { Document } from '@/types';
import {
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
  DOC_STATUS_COLORS,
} from '@/types';
import Link from 'next/link';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'quote' | 'delivery_note' | 'proforma'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const isSupabase = typeof process !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const repo = getRepository();
    const currentOrg = getOrganization();
    const orgId = currentOrg?.id || '';
    try {
      if (!orgId && isSupabase) {
        throw new Error('No se ha detectado una organización activa vinculada a la sesión.');
      }
      const [docsData, orgData] = await Promise.all([
        repo.getDocuments(orgId),
        repo.getOrganization(orgId),
      ]);
      setDocs(docsData);
      setOrg(orgData || currentOrg);
      setLoadError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al sincronizar con Supabase.';
      if (isSupabase) {
        setLoadError(msg);
        setDocs([]);
      } else {
        setDocs(getDocuments());
        setOrg(getOrganization());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('pe_store_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('pe_store_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Cálculos de métricas reales
  const quotes = docs.filter((d) => d.doc_type === 'quote');
  const totalPresupuestado = quotes.reduce((acc, d) => acc + d.total_cents, 0);
  const totalAceptado = quotes
    .filter((d) => d.status === 'accepted' || d.status === 'invoiced')
    .reduce((acc, d) => acc + d.total_cents, 0);
  const totalPendiente = docs
    .filter((d) => d.status === 'sent' || d.status === 'viewed')
    .reduce((acc, d) => acc + d.total_cents, 0);
  const conversionRate = quotes.length > 0 && totalPresupuestado > 0
    ? Math.round((totalAceptado / totalPresupuestado) * 100)
    : 0;

  const filteredDocs = docs.filter((d) => {
    if (activeTab === 'all') return true;
    return d.doc_type === activeTab;
  });

  const handleCopyLink = (docId: string) => {
    const clientUrl = `${window.location.origin}/firmar/${docId}`;
    navigator.clipboard?.writeText(clientUrl);
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isFiscalConfigIncomplete = !org?.tax_id || !org?.legal_name || !org?.address;

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-[1440px] mx-auto space-y-8 animate-fade-in">
        {/* Aviso de Configuración Fiscal Pendiente (Guía de Primer Uso) */}
        {isFiscalConfigIncomplete && (
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-white">Configuración Fiscal Inicial Pendiente</h4>
                <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
                  Para emitir presupuestos y facturas conformes al Real Decreto 1619/2012, completa la razón social, NIF y domicilio fiscal de tu empresa en los ajustes.
                </p>
              </div>
            </div>
            <Link href="/ajustes" className="btn btn-primary btn-sm flex items-center gap-1.5 flex-shrink-0">
              <Settings size={15} />
              <span>Completar Ajustes</span>
            </Link>
          </div>
        )}

        {/* Banner de Bienvenida y Empresa */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#101424] via-[#12162A] to-[#151930] border border-white/10 shadow-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Ejercicio Fiscal Activo
              </span>
              <span className="text-xs text-gray-400">· Datos consolidados en tiempo real</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {org?.legal_name || org?.name || 'Presupuesto Express Enterprise'}
            </h1>
            <p className="text-xs md:text-sm text-gray-400 max-w-2xl leading-relaxed">
              Panel central de emisión y control de ofertas técnicas, certificaciones de obra y facturación proforma con validez jurídica.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/documentos/nuevo"
              className="btn btn-primary btn-lg shadow-lg shadow-indigo-600/30 font-semibold"
            >
              <Plus size={18} />
              <span>Nuevo Presupuesto</span>
            </Link>
          </div>
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-400" />
              <span>{loadError}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="px-3 py-1 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Bloque de KPIs Principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Presupuestado */}
          <div className="stat-card">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span className="uppercase tracking-wider">Total Ofertado</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <FileText size={16} />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-white">
              <span className="money">{formatCents(totalPresupuestado)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 font-mono">
              <span>{quotes.length}</span> {quotes.length === 1 ? 'presupuesto emitido' : 'presupuestos emitidos'}
            </p>
          </div>

          {/* Total Aceptado */}
          <div className="stat-card">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span className="uppercase tracking-wider">Contratado / Aceptado</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              <span className="money">{formatCents(totalAceptado)}</span>
            </div>
            <p className="text-xs text-emerald-400/80 mt-2 flex items-center gap-1 font-mono">
              <span>Tasa de éxito: {conversionRate}%</span>
            </p>
          </div>

          {/* En Negociación */}
          <div className="stat-card">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span className="uppercase tracking-wider">Pendiente Decisión</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Clock size={16} />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-amber-400">
              <span className="money">{formatCents(totalPendiente)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 font-mono">
              <span>Enviados y en estudio</span>
            </p>
          </div>

          {/* Tasa de Aceptación */}
          <div className="stat-card">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span className="uppercase tracking-wider">Conversión Real</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-purple-300">
              {conversionRate}%
            </div>
            <p className="text-xs text-purple-300/80 mt-2 flex items-center gap-1 font-mono">
              <span>Efectividad comercial</span>
            </p>
          </div>
        </div>

        {/* Tabla de Documentos Recientes */}
        <div className="bg-[#0C0E18] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Documentos Recientes del Ejercicio
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Seguimiento de estados, firmas de clientes y trazabilidad fiscal.
              </p>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveTab('quote')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'quote'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Presupuestos
              </button>
              <button
                onClick={() => setActiveTab('delivery_note')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'delivery_note'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Albaranes
              </button>
              <button
                onClick={() => setActiveTab('proforma')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'proforma'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Proformas
              </button>
            </div>
          </div>

          {/* Tabla de Registros o Estado Vacío */}
          {filteredDocs.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Cliente y CIF</th>
                    <th>Estado</th>
                    <th className="text-right">Importe Total</th>
                    <th>Fecha Emisión</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => {
                    const statusColor = DOC_STATUS_COLORS[doc.status] || { bg: 'rgba(255,255,255,0.05)', text: '#CBD5E1' };
                    const code = doc.series
                      ? `${doc.series}-${String(doc.number || doc.doc_number || 0).padStart(4, '0')}`
                      : 'BORRADOR';

                    return (
                      <tr key={doc.id}>
                        {/* Código y Título */}
                        <td>
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/documentos/editor?id=${doc.id}`}
                              className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
                            >
                              {code}
                            </Link>
                            <div>
                              <Link
                                href={`/documentos/editor?id=${doc.id}`}
                                className="font-semibold text-gray-100 hover:text-indigo-300 transition-colors line-clamp-1 max-w-sm"
                              >
                                {doc.title}
                              </Link>
                              <span className="text-[11px] text-gray-500 font-mono">
                                Versión {doc.version || 1}.0
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Cliente */}
                        <td>
                          <div className="space-y-0.5">
                            <p className="font-medium text-gray-200 line-clamp-1">
                              {doc.client?.name || 'Cliente no asignado'}
                            </p>
                            {doc.client?.tax_id && (
                              <p className="text-[11px] text-gray-500 font-mono">
                                CIF {doc.client.tax_id}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Estado */}
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: statusColor.bg,
                              color: statusColor.text,
                              border: `1px solid ${statusColor.text}40`,
                            }}
                          >
                            {doc.status === 'accepted' && <CheckCircle2 size={12} />}
                            {doc.status === 'viewed' && <Eye size={12} />}
                            {doc.status === 'sent' && <Send size={12} />}
                            {DOC_STATUS_LABELS[doc.status]}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="text-right">
                          <span className="money font-bold text-gray-100 text-base">
                            {formatCents(doc.total_cents)}
                          </span>
                        </td>

                        {/* Fecha */}
                        <td className="text-xs text-gray-400 font-mono">
                          {formatDate(doc.created_at)}
                        </td>

                        {/* Acciones */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopyLink(doc.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                              title="Copiar enlace público para el cliente"
                            >
                              {copiedId === doc.id ? (
                                <Check size={15} className="text-emerald-400" />
                              ) : (
                                <Share2 size={15} />
                              )}
                            </button>

                            <Link
                              href={`/documentos/editor?id=${doc.id}`}
                              className="btn btn-secondary btn-sm"
                            >
                              Abrir
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state my-8">
              <div className="empty-state-icon">
                <FileText size={28} />
              </div>
              <h3 className="empty-state-title">
                {docs.length === 0 ? 'Sin actividad documental todavía' : 'Sin documentos en esta categoría'}
              </h3>
              <p className="empty-state-desc">
                {docs.length === 0
                  ? 'Comienza creando tu primer presupuesto formal con desglose de partidas técnicas y firma digital.'
                  : 'No hay documentos que correspondan al filtro de serie seleccionado.'}
              </p>
              {docs.length === 0 ? (
                <div className="flex items-center gap-3">
                  <Link href="/documentos/nuevo" className="btn btn-primary">
                    <Plus size={16} />
                    <span>Crear Primer Presupuesto</span>
                  </Link>
                  <Link href="/ajustes" className="btn btn-secondary">
                    <span>Ajustes Fiscales</span>
                  </Link>
                </div>
              ) : (
                <button onClick={() => setActiveTab('all')} className="btn btn-secondary">
                  Ver todos los documentos
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sección de Seguridad y Garantía Legal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Validez Legal y RLS Seguro</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Cumplimiento con la Ley 11/2021 de medidas de prevención contra el fraude fiscal y RD 1619/2012 de facturación.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileCheck size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Firma Electrónica eIDAS</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Los clientes firman presupuestos desde cualquier dispositivo generando evidencias de IP, user-agent y hash SHA-256 verificable.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Workflow size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Ciclo Documental Integrado</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Flujo unificado: Presupuesto → Albarán de entrega → Factura Proforma → Factura Comercial con trazabilidad íntegra.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
