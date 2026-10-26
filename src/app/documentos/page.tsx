'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { getDocuments, getRepository, getOrganization } from '@/lib/store';
import {
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatCents } from '@/lib/calculations';
import { formatDate } from '@/lib/utils';
import type { Document } from '@/types';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Copy,
  Check,
  Share2,
  ExternalLink,
  CheckCircle2,
  Eye,
  Send,
  Download,
  ShieldCheck,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

type FilterType = 'all' | 'quote' | 'delivery_note' | 'proforma';
type FilterStatus = 'all' | 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'invoiced';

export default function DocumentsPage() {
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    setLoading(true);
    const isSupabase = typeof process !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const repo = getRepository();
    const org = getOrganization();
    const orgId = org?.id || '';
    try {
      if (!orgId && isSupabase) {
        throw new Error('No se ha detectado una organización activa vinculada a la sesión.');
      }
      const data = await repo.getDocuments(orgId);
      setDocs(data);
      setLoadError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al sincronizar documentos con el repositorio.';
      if (isSupabase) {
        setLoadError(msg);
        setDocs([]);
      } else {
        setDocs(getDocuments());
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

  const filtered = docs.filter((doc) => {
    if (typeFilter !== 'all' && doc.doc_type !== typeFilter) return false;
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        doc.title?.toLowerCase().includes(q) ||
        doc.client?.name.toLowerCase().includes(q) ||
        doc.client?.tax_id?.toLowerCase().includes(q) ||
        `${doc.series}-${doc.doc_number}`.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalFilteredCents = filtered.reduce((acc, d) => acc + d.total_cents, 0);

  const handleCopyLink = (docId: string) => {
    const clientUrl = `${window.location.origin}/ver/${docId}`;
    navigator.clipboard?.writeText(clientUrl);
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                SERIES OFICIALES
              </span>
              <span className="text-xs text-gray-400">Numeración correlativa sin saltos</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Gestión de Documentos
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Presupuestos técnicos, albaranes de entrega de obra y facturas proforma con validez jurídica.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/documentos/nuevo" className="btn btn-primary btn-lg shadow-lg shadow-indigo-600/30">
              <Plus size={18} />
              <span>Nuevo Documento</span>
            </Link>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="card-static p-4 bg-[var(--bg-surface)] border border-white/10 rounded-2xl">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar por código de serie, título de obra, cliente o CIF..."
                className="input pl-10 bg-white/[0.03] border-white/10 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filtro por Tipo */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as FilterType)}
                className="input bg-[var(--bg-surface-2)] border-white/10 text-xs min-w-[170px]"
              >
                <option value="all">Todos los Tipos</option>
                <option value="quote">Presupuestos (PRE)</option>
                <option value="delivery_note">Albaranes (ALB)</option>
                <option value="proforma">Facturas Proforma (PRO)</option>
              </select>

              {/* Filtro por Estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
                className="input bg-[var(--bg-surface-2)] border-white/10 text-xs min-w-[160px]"
              >
                <option value="all">Todos los Estados</option>
                <option value="draft">Borrador</option>
                <option value="sent">Enviado</option>
                <option value="viewed">Visualizado</option>
                <option value="accepted">Aceptado / Firmado</option>
                <option value="invoiced">Facturado</option>
                <option value="rejected">Rechazado</option>
              </select>
            </div>
          </div>

          {/* Resumen del filtro */}
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
            <span>
              Mostrando <strong className="text-white font-mono">{filtered.length}</strong> documentos
            </span>
            <span>
              Importe acumulado:{' '}
              <strong className="text-white font-mono text-sm">
                {formatCents(totalFilteredCents)}
              </strong>
            </span>
          </div>
        </div>

        {/* Tabla de Documentos o Estado Vacío */}
        {filtered.length > 0 ? (
          <div className="bg-[var(--bg-surface)] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Cliente y CIF</th>
                    <th>Estado</th>
                    <th className="text-right">Importe Total</th>
                    <th>Emisión</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((doc) => {
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

                        {/* Tipo */}
                        <td>
                          <span className="text-xs font-mono font-medium text-gray-300 bg-white/5 px-2 py-1 rounded">
                            {DOC_TYPE_LABELS[doc.doc_type]}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td>
                          <div className="space-y-0.5">
                            <p className="font-medium text-gray-200 line-clamp-1">
                              {doc.client?.name || 'Cliente no asignado'}
                            </p>
                            {doc.client?.tax_id && (
                              <p className="text-[11px] text-gray-500 font-mono">CIF {doc.client.tax_id}</p>
                            )}
                          </div>
                        </td>

                        {/* Estado */}
                        <td>
                          <Badge status={doc.status} />
                        </td>

                        {/* Total */}
                        <td className="text-right">
                          <span className="money text-base font-bold text-gray-100">
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
                              title="Copiar enlace de firma del cliente"
                            >
                              {copiedId === doc.id ? (
                                <Check size={15} className="text-emerald-400" />
                              ) : (
                                <Share2 size={15} />
                              )}
                            </button>

                            <Link
                              href={`/documentos/imprimir?id=${doc.id}`}
                              target="_blank"
                              className="btn btn-secondary btn-sm flex items-center gap-1"
                              title="Abrir hoja de impresión y exportar PDF"
                            >
                              <Printer size={13} />
                              <span>PDF</span>
                            </Link>

                            <Link
                              href={`/documentos/editor?id=${doc.id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Editar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {Math.ceil(filtered.length / pageSize) > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-white/10 text-xs text-gray-400">
                <span>
                  Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
                  {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} documentos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm p-1.5 disabled:opacity-30"
                    title="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-mono px-2">
                    {currentPage} / {Math.ceil(filtered.length / pageSize)}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(Math.ceil(filtered.length / pageSize), p + 1))
                    }
                    disabled={currentPage === Math.ceil(filtered.length / pageSize)}
                    className="btn btn-secondary btn-sm p-1.5 disabled:opacity-30"
                    title="Página siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state my-8">
            <div className="empty-state-icon">
              <FileText size={26} />
            </div>
            <h3 className="empty-state-title">
              {docs.length === 0 ? 'Sin documentos emitidos' : 'Sin coincidencias en la búsqueda'}
            </h3>
            <p className="empty-state-desc">
              {docs.length === 0
                ? 'Emite tu primer presupuesto oficial, albarán de obra o factura proforma con desglose de impuestos y firma digital.'
                : 'No se encontraron documentos que coincidan con los criterios de búsqueda o filtros seleccionados.'}
            </p>
            {docs.length === 0 ? (
              <Link href="/documentos/nuevo" className="btn btn-primary">
                <Plus size={16} />
                <span>Crear Primer Presupuesto</span>
              </Link>
            ) : (
              <button
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                }}
                className="btn btn-secondary"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
