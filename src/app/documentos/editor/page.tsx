'use client';

import { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  getDocumentById,
  saveDocument,
  convertDocument,
  getClients,
  getCatalog,
  getOrganization,
  getOrgSettings,
} from '@/lib/store';
import {
  calcLineSubtotal,
  calcDocumentTotals,
  formatCents,
  centsToEuros,
  eurosToCents,
  ALLOWED_VAT_RATES,
  type VatRate,
} from '@/lib/calculations';
import { formatDate } from '@/lib/utils';
import type { DocumentItem, DocStatus, DocType, Document } from '@/types';
import {
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
  DOC_STATUS_COLORS,
} from '@/types';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Share2,
  FolderPlus,
  CheckCircle2,
  Printer,
  FileCheck,
  Building2,
  ShieldCheck,
  ArrowRightLeft,
  ExternalLink,
  Copy,
  AlertTriangle,
  Lock,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = searchParams.get('id');
  const initialPreview = searchParams.get('preview') === 'true';

  const [doc, setDoc] = useState<Document | undefined>(() => (docId ? getDocumentById(docId) : undefined));
  const clients = useMemo(() => getClients(), []);
  const catalog = useMemo(() => getCatalog(), []);
  const org = useMemo(() => getOrganization(), []);
  const orgSettings = useMemo(() => getOrgSettings(), []);

  const [viewMode, setViewMode] = useState<'edit' | 'preview'>(
    initialPreview ? 'preview' : 'edit'
  );

  const [title, setTitle] = useState(doc?.title || '');
  const [status, setStatus] = useState<DocStatus>(doc?.status || 'draft');
  const [clientId, setClientId] = useState(doc?.client_id || '');
  const [validUntil, setValidUntil] = useState(doc?.valid_until || '');
  const [notesPublic, setNotesPublic] = useState(doc?.notes_public || orgSettings?.default_terms_text || '');
  const [items, setItems] = useState<DocumentItem[]>(doc?.items || []);
  const [signatureDone, setSignatureDone] = useState(doc?.status === 'accepted' || doc?.status === 'invoiced');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!docId) return;
    const loaded = getDocumentById(docId);
    if (loaded) {
      setDoc(loaded);
      setTitle(loaded.title || '');
      setStatus(loaded.status);
      setClientId(loaded.client_id || '');
      setValidUntil(loaded.valid_until || '');
      setNotesPublic(loaded.notes_public || orgSettings?.default_terms_text || '');
      setItems(loaded.items || []);
      setSignatureDone(loaded.status === 'accepted' || loaded.status === 'invoiced');
    }
  }, [docId, orgSettings]);

  const client = useMemo(() => {
    return clients.find((c) => c.id === clientId);
  }, [clients, clientId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isLocked = doc?.status !== 'draft' || Boolean(doc?.locked_at);

  // Recalcular subtotales de partidas
  const recalcItems = useCallback(
    (currentItems: DocumentItem[]): DocumentItem[] =>
      currentItems.map((item) => {
        if (item.item_type === 'chapter') return item;
        const subtotal_cents = calcLineSubtotal(
          item.quantity,
          item.price_cents,
          item.discount_pct
        );
        return { ...item, subtotal_cents };
      }),
    []
  );

  // Totales oficiales usando calculations.ts
  const totals = useMemo(
    () => calcDocumentTotals(items, { apply_surcharge: doc?.apply_surcharge || false }),
    [items, doc?.apply_surcharge]
  );

  // Actualizar campo de línea
  const updateItem = (id: string, updates: Partial<DocumentItem>) => {
    if (isLocked) return;
    setItems((prev) =>
      recalcItems(prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
    );
  };

  // Eliminar línea o capítulo
  const removeItem = (id: string) => {
    if (isLocked) return;
    setItems((prev) => prev.filter((i) => i.id !== id && i.parent_id !== id));
  };

  // Añadir línea técnica
  const addLine = (parentId?: string) => {
    if (!doc || isLocked) return;
    const newItem: DocumentItem = {
      id: crypto.randomUUID(),
      document_id: doc.id,
      org_id: doc.org_id,
      item_type: 'line',
      parent_id: parentId,
      position: items.length + 1,
      description: '',
      unit: 'ud',
      quantity: 1,
      price_cents: 0,
      cost_cents: 0,
      discount_pct: 0,
      vat_rate: (orgSettings?.default_vat_rate as VatRate) || 21,
      irpf_rate: orgSettings?.default_irpf_rate || 0,
      subtotal_cents: 0,
      is_optional: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => recalcItems([...prev, newItem]));
  };

  // Añadir capítulo organizativo
  const addChapter = () => {
    if (!doc || isLocked) return;
    const chapterNum = items.filter((i) => i.item_type === 'chapter').length + 1;
    const newChapter: DocumentItem = {
      id: crypto.randomUUID(),
      document_id: doc.id,
      org_id: doc.org_id,
      item_type: 'chapter',
      position: items.length + 1,
      description: `Capítulo 0${chapterNum}: Nuevo Desglose de Obra`,
      unit: '',
      quantity: 0,
      price_cents: 0,
      cost_cents: 0,
      discount_pct: 0,
      vat_rate: 0,
      irpf_rate: 0,
      subtotal_cents: 0,
      is_optional: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, newChapter]);
  };

  // Añadir desde catálogo
  const addFromCatalog = (catId: string, parentId?: string) => {
    if (!doc || isLocked) return;
    const cat = catalog.find((c) => c.id === catId);
    if (!cat) return;
    const newItem: DocumentItem = {
      id: crypto.randomUUID(),
      document_id: doc.id,
      org_id: doc.org_id,
      item_type: 'line',
      parent_id: parentId,
      catalog_item_id: cat.id,
      position: items.length + 1,
      description: cat.description ? `${cat.name} — ${cat.description}` : cat.name,
      unit: cat.unit,
      quantity: 1,
      price_cents: cat.price_cents,
      cost_cents: cat.cost_cents,
      discount_pct: 0,
      vat_rate: cat.vat_rate,
      irpf_rate: orgSettings?.default_irpf_rate || 0,
      subtotal_cents: cat.price_cents,
      is_optional: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => recalcItems([...prev, newItem]));
    showToast(`Partida añadida: ${cat.name.slice(0, 30)}...`);
  };

  // Guardar en almacenamiento persistente
  const handleSaveChanges = () => {
    if (!doc || isLocked) return;
    setIsSaving(true);
    const updatedDoc = saveDocument({
      ...doc,
      title,
      status,
      client_id: clientId,
      client,
      valid_until: validUntil,
      notes_public: notesPublic,
      items,
    });
    setDoc(updatedDoc);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Documento guardado y sincronizado con éxito');
    }, 200);
  };

  // Convertir documento a otro tipo
  const handleConvert = (targetType: 'delivery_note' | 'proforma' | 'invoice') => {
    if (!doc) return;
    handleSaveChanges();
    const converted = convertDocument(doc.id, targetType);
    showToast(
      `Convertido con éxito a ${DOC_TYPE_LABELS[targetType]} (${converted.series}-${String(
        converted.number || converted.doc_number || 0
      ).padStart(4, '0')})`
    );
    router.push(`/documentos/editor?id=${converted.id}`);
  };

  // Copiar enlace seguro de firma del cliente
  const handleCopyClientLink = () => {
    if (!doc) return;
    const url = `${window.location.origin}/firmar/${doc.id}`;
    navigator.clipboard?.writeText(url);
    showToast('Enlace de firma del cliente copiado al portapapeles');
  };

  // Crear nueva versión del documento
  const handleCreateNewVersion = () => {
    if (!doc) return;
    const newVersionDoc = saveDocument({
      ...doc,
      id: `doc-${crypto.randomUUID()}`,
      version: (doc.version || 1) + 1,
      status: 'draft',
      locked_at: undefined,
      series: null,
      number: null,
      doc_number: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    showToast(`Nueva versión v${newVersionDoc.version}.0 creada en modo borrador.`);
    router.push(`/documentos/editor?id=${newVersionDoc.id}`);
  };

  if (!docId || !doc) {
    return (
      <AppLayout>
        <div className="empty-state max-w-md mx-auto my-16">
          <div className="empty-state-icon">
            <AlertTriangle size={24} className="text-amber-400" />
          </div>
          <h3 className="empty-state-title">Documento no encontrado</h3>
          <p className="empty-state-desc">
            No se ha encontrado el identificador de documento especificado o ha sido eliminado.
          </p>
          <Link href="/documentos" className="btn btn-primary">
            <ArrowLeft size={16} />
            <span>Volver a Documentos</span>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const code = doc.series
    ? `${doc.series}-${String(doc.number || doc.doc_number || 0).padStart(4, '0')}`
    : 'BORRADOR (Sin Serie)';

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        {/* Toast Notificación */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl shadow-2xl border border-indigo-400 text-sm font-medium animate-fade-in no-print">
            <CheckCircle2 size={18} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Banner de Documento Inmutable */}
        {isLocked && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 text-xs no-print">
            <div className="flex items-center gap-2.5">
              <Lock size={18} className="text-amber-400 flex-shrink-0" />
              <div>
                <strong className="block text-white text-sm">
                  Documento Cerrado / Inmutable ({DOC_STATUS_LABELS[status]})
                </strong>
                <span>
                  Este documento cuenta con validez contractual o fiscal y no permite ediciones directas.
                </span>
              </div>
            </div>
            <button
              onClick={handleCreateNewVersion}
              className="btn btn-secondary btn-sm bg-amber-500/20 text-white border-amber-500/40 hover:bg-amber-500/30 font-semibold"
            >
              <Layers size={15} />
              <span>Crear Nueva Versión (v{(doc.version || 1) + 1}.0)</span>
            </button>
          </div>
        )}

        {/* Barra Superior del Editor */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-2xl bg-[#0D101A] border border-white/10 shadow-lg no-print">
          <div className="flex items-center gap-3">
            <Link
              href="/documentos"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Volver al listado"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {code}
                </span>
                <span className="text-xs font-mono text-gray-400">Versión {doc.version || 1}.0</span>
                <span
                  className="badge ml-1"
                  style={{
                    background: DOC_STATUS_COLORS[status]?.bg,
                    color: DOC_STATUS_COLORS[status]?.text,
                    border: `1px solid ${DOC_STATUS_COLORS[status]?.text}40`,
                  }}
                >
                  {status === 'accepted' && <CheckCircle2 size={12} />}
                  {DOC_STATUS_LABELS[status]}
                </span>
              </div>
              <input
                type="text"
                value={title}
                disabled={isLocked}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del proyecto o certificación técnica..."
                className="text-base md:text-lg font-bold text-white bg-transparent border-none focus:outline-none focus:ring-0 mt-1 w-full disabled:opacity-75"
              />
            </div>
          </div>

          {/* Selector de Modo y Acciones */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white/[0.05] p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'edit'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Modo Edición
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'preview'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Vista Oficial A4 (PDF)
              </button>
            </div>

            {/* Conversiones Rápidas */}
            <div className="flex items-center gap-1.5">
              {doc.doc_type === 'quote' && (
                <>
                  <button
                    onClick={() => handleConvert('delivery_note')}
                    className="btn btn-secondary btn-sm text-xs"
                    title="Convertir a Albarán de entrega"
                  >
                    <ArrowRightLeft size={13} />
                    <span>→ Albarán</span>
                  </button>
                  <button
                    onClick={() => handleConvert('proforma')}
                    className="btn btn-secondary btn-sm text-xs"
                    title="Convertir a Factura Proforma"
                  >
                    <ArrowRightLeft size={13} />
                    <span>→ Proforma</span>
                  </button>
                  <button
                    onClick={() => handleConvert('invoice')}
                    className="btn btn-secondary btn-sm text-xs"
                    title="Convertir a Factura Comercial"
                  >
                    <ArrowRightLeft size={13} />
                    <span>→ Factura</span>
                  </button>
                </>
              )}
              {doc.doc_type === 'delivery_note' && (
                <button
                  onClick={() => handleConvert('invoice')}
                  className="btn btn-secondary btn-sm text-xs"
                  title="Facturar albarán"
                >
                  <ArrowRightLeft size={13} />
                  <span>→ Factura</span>
                </button>
              )}
              {doc.doc_type === 'proforma' && (
                <button
                  onClick={() => handleConvert('invoice')}
                  className="btn btn-secondary btn-sm text-xs"
                  title="Emitir factura definitiva"
                >
                  <ArrowRightLeft size={13} />
                  <span>→ Factura</span>
                </button>
              )}
            </div>

            <button
              onClick={handleCopyClientLink}
              className="btn btn-secondary btn-sm"
              title="Copiar enlace público de firma segura para el cliente"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">Enlace Firma</span>
            </button>

            <Link
              href={`/documentos/imprimir?id=${doc.id}`}
              target="_blank"
              className="btn btn-secondary btn-sm"
              title="Abrir hoja de impresión y descargar PDF"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </Link>

            {!isLocked && (
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="btn btn-primary btn-sm font-semibold"
              >
                <Save size={15} />
                <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODO EDICIÓN TÉCNICA */}
        {/* ============================================================ */}
        {viewMode === 'edit' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
            {/* Columna Izquierda: Líneas y Partidas (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {!isLocked && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0D101A] border border-white/10">
                  <div className="flex items-center gap-2">
                    <button onClick={() => addLine()} className="btn btn-primary btn-sm">
                      <Plus size={15} />
                      <span>Añadir Partida</span>
                    </button>
                    <button onClick={addChapter} className="btn btn-secondary btn-sm">
                      <FolderPlus size={15} />
                      <span>Añadir Capítulo</span>
                    </button>
                  </div>

                  {/* Desplegable catálogo oficial */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">Desde tarifario:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addFromCatalog(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="input bg-[#131726] border-white/10 text-xs py-1.5 px-2 max-w-[220px]"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        + Insertar partida del catálogo...
                      </option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name.slice(0, 45)} ({formatCents(c.price_cents)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Lista de Partidas o Estado Vacío */}
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item) => {
                    const isChapter = item.item_type === 'chapter';

                    if (isChapter) {
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-white font-bold text-sm"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={item.description}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                              className="bg-transparent border-none text-white font-bold text-sm w-full focus:outline-none focus:ring-0 disabled:opacity-80"
                            />
                          </div>
                          {!isLocked && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => addLine(item.id)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded bg-indigo-500/10"
                              >
                                + Línea en capítulo
                              </button>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-1 text-gray-500 hover:text-red-400"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all ${
                          item.is_optional
                            ? 'bg-[#0E101B]/50 border-amber-500/20'
                            : 'bg-[#0E111C] border-white/10'
                        }`}
                      >
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                              <span className="font-mono text-[11px]">Posición #{item.position}</span>
                              {item.is_optional && (
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Partida Opcional (No computable)
                                </span>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              disabled={isLocked}
                              value={item.description}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                              placeholder="Descripción detallada de la partida o unidad de obra..."
                              className="w-full bg-white/[0.03] border border-white/10 rounded-lg p-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 disabled:opacity-75"
                            />
                          </div>

                          {/* Rejilla de importes con aritmética de calculations.ts */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div className="w-20">
                              <label className="text-[10px] text-gray-400 block mb-1">Cantidad</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={isLocked}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })
                                }
                                className="input bg-[#121626] text-center font-mono py-1 px-2 text-xs"
                              />
                            </div>

                            <div className="w-16">
                              <label className="text-[10px] text-gray-400 block mb-1">Unidad</label>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={item.unit}
                                onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                                className="input bg-[#121626] text-center py-1 px-1 text-xs"
                                placeholder="ud"
                              />
                            </div>

                            <div className="w-24">
                              <label className="text-[10px] text-gray-400 block mb-1">Precio Unit.</label>
                              <input
                                type="number"
                                step="0.01"
                                disabled={isLocked}
                                value={centsToEuros(item.price_cents)}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    price_cents: eurosToCents(parseFloat(e.target.value) || 0),
                                  })
                                }
                                className="input bg-[#121626] font-mono text-right py-1 px-2 text-xs"
                              />
                            </div>

                            <div className="w-16">
                              <label className="text-[10px] text-gray-400 block mb-1">Dto %</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={isLocked}
                                value={item.discount_pct}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    discount_pct: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="input bg-[#121626] text-center font-mono py-1 px-1 text-xs"
                              />
                            </div>

                            <div className="w-28 text-right">
                              <label className="text-[10px] text-gray-400 block mb-1">Subtotal Neto</label>
                              <div className="font-mono font-bold text-gray-100 text-sm py-1">
                                <span className="money">{formatCents(item.subtotal_cents || 0)}</span>
                              </div>
                            </div>

                            {!isLocked && (
                              <div className="flex items-center gap-1 pt-3">
                                <button
                                  onClick={() =>
                                    updateItem(item.id, { is_optional: !item.is_optional })
                                  }
                                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                    item.is_optional
                                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                  }`}
                                  title="Marcar como opcional (no computable)"
                                >
                                  Opcional
                                </button>
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5"
                                  title="Eliminar partida"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <Plus size={24} />
                  </div>
                  <h4 className="empty-state-title">Documento sin partidas registradas</h4>
                  <p className="empty-state-desc">
                    Añade partidas económicas o capítulos organizativos para calcular las bases imponibles y la cuota de IVA.
                  </p>
                  {!isLocked && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => addLine()} className="btn btn-primary btn-sm">
                        <Plus size={15} />
                        <span>Añadir Partida</span>
                      </button>
                      <button onClick={addChapter} className="btn btn-secondary btn-sm">
                        <FolderPlus size={15} />
                        <span>Añadir Capítulo</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Columna Derecha: Configuración Fiscal y Resumen (1/3) */}
            <div className="space-y-6">
              {/* Bloque del Cliente */}
              <div className="card-static p-5 bg-[#0D101A] border border-white/10 rounded-2xl space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Building2 size={16} className="text-indigo-400" />
                  <span>Destinatario Oficial</span>
                </h3>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Empresa / Destinatario</label>
                  <select
                    value={clientId}
                    disabled={isLocked}
                    onChange={(e) => setClientId(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs disabled:opacity-75"
                  >
                    <option value="" disabled>Selecciona un cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.tax_id})
                      </option>
                    ))}
                  </select>
                </div>

                {client ? (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-xs">
                    <p className="text-gray-200 font-semibold">{client.name}</p>
                    <p className="text-gray-400 font-mono">NIF/CIF: {client.tax_id}</p>
                    {client.address && (
                      <p className="text-gray-400">{client.address}{client.city ? `, ${client.city}` : ''}</p>
                    )}
                    {client.email && <p className="text-gray-400">{client.email}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-amber-400/90 italic">
                    Sin destinatario seleccionado.
                  </p>
                )}

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fecha Límite de Validez</label>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs font-mono disabled:opacity-75"
                  />
                </div>
              </div>

              {/* Desglose Económico y Rentabilidad */}
              <div className="card-static p-5 bg-[#0D101A] border border-white/10 rounded-2xl space-y-3">
                <h3 className="font-bold text-sm text-white pb-2 border-b border-white/10">
                  Desglose Fiscal y Rentabilidad
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Base Imponible Neta</span>
                    <span className="font-mono font-medium text-gray-200">
                      <span className="money">{formatCents(totals.subtotal_cents)}</span>
                    </span>
                  </div>

                  {totals.discount_cents > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Descuentos Totales</span>
                      <span className="font-mono font-medium">
                        -<span className="money">{formatCents(totals.discount_cents)}</span>
                      </span>
                    </div>
                  )}

                  {/* Desglose de IVA por tipo según RD 1619/2012 */}
                  {totals.vat_breakdown.map((vb) => (
                    <div key={vb.vat_rate} className="flex justify-between text-gray-400">
                      <span>Cuota IVA ({vb.vat_rate}%)</span>
                      <span className="font-mono font-medium text-gray-200">
                        <span className="money">{formatCents(vb.vat_cents)}</span>
                      </span>
                    </div>
                  ))}

                  {totals.irpf_cents > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Retención IRPF</span>
                      <span className="font-mono font-medium">
                        -<span className="money">{formatCents(totals.irpf_cents)}</span>
                      </span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-white">Total Oficial</span>
                    <span className="text-xl font-black font-mono text-indigo-300">
                      <span className="money">{formatCents(totals.total_cents)}</span>
                    </span>
                  </div>

                  {/* Margen comercial previsto */}
                  {totals.cost_cents > 0 && (
                    <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[11px] text-gray-400">
                      <span>Margen Previsto</span>
                      <div className="text-right">
                        <span className="money text-emerald-400 font-semibold font-mono">
                          {formatCents(totals.margin_cents)}
                        </span>
                        <span className="text-gray-500 font-mono ml-1.5">
                          ({totals.margin_pct?.toFixed(1) || 0}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleCopyClientLink}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold btn btn-secondary flex items-center justify-center gap-2"
                  >
                    <Share2 size={15} />
                    <span>Compartir Enlace con Cliente</span>
                  </button>
                </div>
              </div>

              {/* Condiciones y notas */}
              <div className="card-static p-5 bg-[#0D101A] border border-white/10 rounded-2xl space-y-2">
                <label className="text-xs font-semibold text-gray-300 block">
                  Condiciones Contractuales
                </label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  value={notesPublic}
                  onChange={(e) => setNotesPublic(e.target.value)}
                  placeholder="Condiciones de pago, validez de oferta y entrega..."
                  className="input bg-[#121626] border-white/10 text-xs w-full disabled:opacity-75"
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* DOCUMENTO OFICIAL A4 (RENDERIZADO EN PANTALLA E IMPRESIÓN) */}
        {/* ============================================================ */}
        <div className={viewMode === 'edit' ? 'hidden print:block' : 'block'}>
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 text-xs text-gray-400 no-print">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-indigo-400" />
                Documento contractual formateado para impresión oficial A4 (RD 1619/2012)
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/documentos/imprimir?id=${doc.id}`}
                  target="_blank"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink size={14} />
                  <span>Abrir Vista Limpia</span>
                </Link>
                <button
                  onClick={() => window.print()}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Printer size={15} />
                  <span>Imprimir / Guardar PDF</span>
                </button>
              </div>
            </div>

            {/* Hoja A4 Oficial */}
            <div
              id="official-print-document"
              className="print-document bg-white text-slate-900 p-8 md:p-14 rounded-2xl shadow-2xl max-w-4xl mx-auto border border-slate-200 font-sans space-y-8"
            >
              {/* Cabecera */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-indigo-700 flex items-center justify-center text-white font-mono font-black text-xl shadow-sm">
                      {(org?.legal_name || org?.name || 'PE').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">
                        {org?.legal_name || org?.name || 'Empresa Emisora'}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono">{org?.tax_id ? `CIF: ${org.tax_id}` : ''}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mt-2">
                    {org?.address || ''} {org?.postal_code || ''} {org?.city || ''}<br />
                    {org?.phone ? `Tel: ${org.phone} ` : ''}{org?.email ? `· Email: ${org.email}` : ''}
                  </p>
                </div>

                <div className="print-card bg-slate-50 border border-slate-200 rounded-xl p-4 text-right min-w-[240px]">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    {DOC_TYPE_LABELS[doc.doc_type]}
                  </p>
                  <p className="text-3xl font-black font-mono text-slate-900 mt-0.5">{code}</p>
                  <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-1 text-slate-600">
                    <p><strong>Emisión:</strong> {formatDate(doc.created_at)}</p>
                    {validUntil && <p><strong>Validez:</strong> {formatDate(validUntil)}</p>}
                    <p><strong>Estado:</strong> {DOC_STATUS_LABELS[status]}</p>
                  </div>
                </div>
              </div>

              {/* Bloque Fiscal Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print-card bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Destinatario
                  </p>
                  <p className="text-sm font-bold text-slate-900">{client?.name || 'Cliente no especificado'}</p>
                  <p className="font-mono text-slate-700 mt-0.5">{client?.tax_id ? `NIF/CIF: ${client.tax_id}` : ''}</p>
                  <p className="text-slate-600 mt-1">
                    {client?.address ? `${client.address}, ` : ''}{client?.city || ''}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Objeto Contractual
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{title || doc.title}</p>
                  {orgSettings?.iban && (
                    <p className="text-slate-600 mt-1 font-mono text-[11px]">IBAN: {orgSettings.iban}</p>
                  )}
                </div>
              </div>

              {/* Tabla de Partidas */}
              <div>
                <table className="print-table w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">Descripción / Partida Técnica</th>
                      <th className="py-2.5 px-2 text-center w-16">Uds</th>
                      <th className="py-2.5 px-2 text-center w-16">Ud</th>
                      <th className="py-2.5 px-3 text-right w-24">Precio</th>
                      <th className="py-2.5 px-2 text-center w-16">Dto</th>
                      <th className="py-2.5 px-3 text-right w-28">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((it) => {
                      if (it.item_type === 'chapter') {
                        return (
                          <tr key={it.id} className="bg-slate-100 font-bold text-slate-900">
                            <td colSpan={6} className="py-2.5 px-3 text-xs tracking-wide">
                              {it.description}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={it.id} className={it.is_optional ? 'text-slate-400 bg-slate-50/50' : 'text-slate-800'}>
                          <td className="py-3 px-3">
                            <p className="font-medium">{it.description}</p>
                            {it.is_optional && (
                              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                                (Partida opcional)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-mono">{it.quantity}</td>
                          <td className="py-3 px-2 text-center">{it.unit}</td>
                          <td className="py-3 px-3 text-right font-mono">{formatCents(it.price_cents)}</td>
                          <td className="py-3 px-2 text-center font-mono">
                            {it.discount_pct > 0 ? `${it.discount_pct}%` : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatCents(it.subtotal_cents || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales y Cláusulas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
                <div className="text-[11px] text-slate-500 space-y-2 leading-relaxed">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Condiciones Contractuales
                  </p>
                  <p>{notesPublic || 'Condiciones según acuerdo comercial.'}</p>
                  <p className="text-[10px] text-slate-400">
                    Tratamiento fiscal y contractual amparado por el RGPD (UE) 2016/679.
                  </p>
                </div>

                <div className="print-card bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Imponible Neta:</span>
                    <span className="font-mono font-medium text-slate-900">{formatCents(totals.subtotal_cents)}</span>
                  </div>
                  {totals.discount_cents > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Descuento aplicado:</span>
                      <span className="font-mono font-medium">-{formatCents(totals.discount_cents)}</span>
                    </div>
                  )}
                  {totals.vat_breakdown.map((vb) => (
                    <div key={vb.vat_rate} className="flex justify-between text-slate-600">
                      <span>IVA ({vb.vat_rate}%):</span>
                      <span className="font-mono font-medium text-slate-900">{formatCents(vb.vat_cents)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
                    <span className="text-sm font-black text-slate-900 uppercase">Total:</span>
                    <span className="text-xl font-black font-mono text-indigo-700">
                      {formatCents(totals.total_cents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Certificado de Firma */}
              <div className="pt-4 border-t border-slate-200">
                <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Conformidad y Aceptación del Cliente</p>
                    <p className="text-[11px] text-slate-500">
                      Firma electrónica simple con evidencias de trazabilidad conforme al Reglamento eIDAS (UE) Nº 910/2014
                    </p>
                    {signatureDone && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[10px] text-emerald-700 font-mono font-semibold flex items-center gap-1">
                          <span>✓</span>
                          <span>Documento firmado electrónicamente y aceptado por el cliente</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="no-print">
                    <button
                      onClick={handleCopyClientLink}
                      className="btn btn-primary btn-sm font-semibold"
                    >
                      <Share2 size={15} />
                      <span>Compartir con Cliente para Firmar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando editor...</div>}>
      <EditorContent />
    </Suspense>
  );
}
