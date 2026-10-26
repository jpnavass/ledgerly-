'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { getCatalog, saveCatalogItem, getOrganization } from '@/lib/store';
import { getRepository } from '@/lib/repo';
import { formatCents, eurosToCents, ALLOWED_VAT_RATES } from '@/lib/calculations';
import {
  Plus,
  Search,
  Package,
  SlidersHorizontal,
  X,
  Download,
  Upload,
  AlertCircle,
  Tag,
  TrendingUp,
} from 'lucide-react';
import type { CatalogItem } from '@/types';

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      const repo = getRepository();
      const currentOrg = getOrganization();
      const orgId = currentOrg?.id || 'org-main';
      try {
        const data = await repo.getCatalog(orgId);
        if (mounted) setCatalog(data);
      } catch (e) {
        if (mounted) setCatalog(getCatalog());
      }
    }
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('pe_store_updated', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('pe_store_updated', handleUpdate);
    };
  }, []);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('ud');
  const [priceStr, setPriceStr] = useState('0,00');
  const [costStr, setCostStr] = useState('0,00');
  const [vatRate, setVatRate] = useState<number>(21);

  // CSV Import State
  const [csvPreview, setCsvPreview] = useState<{
    validRows: Partial<CatalogItem>[];
    errors: { line: number; raw: string; error: string }[];
  } | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(catalog.map((i) => i.category).filter(Boolean));
    return ['all', ...Array.from(cats)] as string[];
  }, [catalog]);

  const filtered = catalog.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const org = getOrganization();
    let priceCents = 0;
    let costCents = 0;
    try {
      priceCents = eurosToCents(priceStr);
    } catch {
      priceCents = 0;
    }
    try {
      costCents = eurosToCents(costStr);
    } catch {
      costCents = 0;
    }

    const newItem: CatalogItem = {
      id: `cat-${crypto.randomUUID()}`,
      org_id: org?.id || 'org-main',
      category: category.trim() || 'General',
      name: name.trim(),
      description: description.trim() || undefined,
      unit: unit.trim() || 'ud',
      price_cents: priceCents,
      cost_cents: costCents,
      vat_rate: vatRate,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveCatalogItem(newItem);
    setCatalog(getCatalog());
    setModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setCategory('');
    setDescription('');
    setUnit('ud');
    setPriceStr('0,00');
    setCostStr('0,00');
    setVatRate(21);
  };

  const handleExportCsv = () => {
    const BOM = '\uFEFF';
    const headers = ['Nombre', 'Categoría', 'Descripción', 'Unidad', 'Precio Venta (€)', 'Coste (€)', 'Tipo IVA (%)'];
    const rows = catalog.map((it) => [
      `"${(it.name || '').replace(/"/g, '""')}"`,
      `"${(it.category || '').replace(/"/g, '""')}"`,
      `"${(it.description || '').replace(/"/g, '""')}"`,
      `"${(it.unit || 'ud').replace(/"/g, '""')}"`,
      `"${(it.price_cents / 100).toFixed(2).replace('.', ',')}"`,
      `"${(it.cost_cents / 100).toFixed(2).replace('.', ',')}"`,
      `"${it.vat_rate}"`,
    ]);

    const csvContent = BOM + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tarifario_catalogo_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return;

      const validRows: Partial<CatalogItem>[] = [];
      const errors: { line: number; raw: string; error: string }[] = [];

      const firstLine = lines[0];
      const sep = firstLine.includes(';') ? ';' : ',';

      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        const cols = rawLine.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
        const itemName = cols[0];
        const itemCat = cols[1] || 'General';
        const itemDesc = cols[2] || '';
        const itemUnit = cols[3] || 'ud';
        const priceRaw = cols[4] || '0';
        const costRaw = cols[5] || '0';
        const vatRaw = parseInt(cols[6] || '21', 10);

        if (!itemName) {
          errors.push({ line: i + 1, raw: rawLine, error: 'Nombre de partida vacío.' });
          continue;
        }

        let pCents = 0;
        let cCents = 0;
        try {
          pCents = eurosToCents(priceRaw);
        } catch {
          errors.push({ line: i + 1, raw: rawLine, error: `Precio inválido: "${priceRaw}".` });
          continue;
        }

        try {
          cCents = eurosToCents(costRaw);
        } catch {
          cCents = 0;
        }

        validRows.push({
          name: itemName,
          category: itemCat,
          description: itemDesc,
          unit: itemUnit,
          price_cents: pCents,
          cost_cents: cCents,
          vat_rate: ALLOWED_VAT_RATES.includes(vatRaw as any) ? vatRaw : 21,
        });
      }

      setCsvPreview({ validRows, errors });
      setImportModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!csvPreview || csvPreview.validRows.length === 0) return;
    const org = getOrganization();

    for (const r of csvPreview.validRows) {
      const item: CatalogItem = {
        id: `cat-${crypto.randomUUID()}`,
        org_id: org?.id || 'org-main',
        name: r.name!,
        category: r.category || 'General',
        description: r.description,
        unit: r.unit || 'ud',
        price_cents: r.price_cents || 0,
        cost_cents: r.cost_cents || 0,
        vat_rate: r.vat_rate || 21,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveCatalogItem(item);
    }

    setCatalog(getCatalog());
    setImportModalOpen(false);
    setCsvPreview(null);
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                TARIFARIO Y PARTIDAS
              </span>
              <span className="text-xs text-gray-400">Precios de venta, costes y márgenes previstos</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Tarifario y Catálogo Técnico
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Base de partidas y servicios para inserción ágil en presupuestos y albaranes.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              title="Importar catálogo por archivo CSV"
            >
              <Upload size={15} />
              <span>Importar CSV</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={catalog.length === 0}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              title="Exportar tarifario a CSV"
            >
              <Download size={15} />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold"
            >
              <Plus size={16} />
              <span>Nueva Partida</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="card-static p-4 bg-[#0C0E18] border border-white/10 rounded-2xl flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por concepto, descripción técnica o categoría..."
              className="input pl-10 bg-white/[0.03] border-white/10 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input bg-[#121522] border-white/10 text-xs py-2 w-auto"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'Todas las categorías' : c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Listado de Partidas o Estados Vacíos */}
        {filtered.length > 0 ? (
          <div className="bg-[#0C0E18] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Partida / Concepto</th>
                    <th>Categoría</th>
                    <th>Unidad</th>
                    <th className="text-right">Coste Est.</th>
                    <th className="text-right">Precio Venta</th>
                    <th className="text-right">Margen Bruto</th>
                    <th>IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const marginCents = item.price_cents - item.cost_cents;
                    const marginPct =
                      item.price_cents > 0 ? (marginCents / item.price_cents) * 100 : 0;

                    return (
                      <tr key={item.id}>
                        <td>
                          <div>
                            <p className="font-semibold text-white">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="text-xs font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-gray-400">{item.unit || 'ud'}</td>
                        <td className="text-right">
                          <span className="money text-gray-400">{formatCents(item.cost_cents)}</span>
                        </td>
                        <td className="text-right">
                          <span className="money text-white font-bold">{formatCents(item.price_cents)}</span>
                        </td>
                        <td className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="money text-emerald-400 font-semibold">
                              {formatCents(marginCents)}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {marginPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="font-mono text-xs text-indigo-300">{item.vat_rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-state my-8">
            <div className="empty-state-icon">
              <Package size={26} />
            </div>
            <h3 className="empty-state-title">
              {catalog.length === 0 ? 'Tarifario sin partidas registradas' : 'Sin coincidencias'}
            </h3>
            <p className="empty-state-desc">
              {catalog.length === 0
                ? 'Agrega partidas técnicas o importa tu tarifario en CSV para acelerar la confección de presupuestos.'
                : `No se encontraron partidas para la búsqueda "${search}".`}
            </p>
            {catalog.length === 0 ? (
              <button onClick={() => setModalOpen(true)} className="btn btn-primary">
                <Plus size={16} />
                <span>Añadir Primera Partida</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('all');
                }}
                className="btn btn-secondary"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        )}

        {/* Modal Nueva Partida */}
        {modalOpen && (
          <div className="modal-backdrop">
            <div className="modal p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-white text-base">Nueva Partida del Catálogo</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-3.5 text-xs">
                <div className="field">
                  <label className="field-label">Nombre del Concepto / Partida *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Suministro e instalación de cuadro de protección"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="field-label">Categoría</label>
                    <input
                      type="text"
                      placeholder="Ej. Electricidad, Fontanería..."
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Unidad de Medida</label>
                    <input
                      type="text"
                      placeholder="ud, m, m2, h, kg..."
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Descripción Técnica Detallada</label>
                  <textarea
                    rows={2}
                    placeholder="Especificaciones, marca, normativa de aplicación..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="field">
                    <label className="field-label">Coste Est. (€)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={costStr}
                      onChange={(e) => setCostStr(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs font-mono"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Precio Venta (€) *</label>
                    <input
                      type="text"
                      required
                      placeholder="0,00"
                      value={priceStr}
                      onChange={(e) => setPriceStr(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs font-mono"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Tipo IVA</label>
                    <select
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value))}
                      className="input bg-[#121626] border-white/10 text-xs"
                    >
                      <option value={21}>21% (General)</option>
                      <option value={10}>10% (Reducido)</option>
                      <option value={4}>4% (Superreducido)</option>
                      <option value={0}>0% (Exento)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm font-semibold">
                    Guardar Partida
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Previsualización de Importación CSV */}
        {importModalOpen && csvPreview && (
          <div className="modal-backdrop">
            <div className="modal p-6 max-w-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-white text-base">Importación de Tarifario por CSV</h3>
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <div>
                    <span className="text-gray-400 block">Partidas Válidas</span>
                    <strong className="text-emerald-400 text-base font-mono">
                      {csvPreview.validRows.length}
                    </strong>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <span className="text-gray-400 block">Filas Rechazadas</span>
                    <strong className="text-red-400 text-base font-mono">
                      {csvPreview.errors.length}
                    </strong>
                  </div>
                </div>

                {csvPreview.errors.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 max-h-36 overflow-y-auto space-y-1">
                    <p className="font-semibold text-red-300 flex items-center gap-1.5">
                      <AlertCircle size={14} /> Errores detectados:
                    </p>
                    {csvPreview.errors.map((err, idx) => (
                      <p key={idx} className="text-red-400 text-[11px]">
                        Línea {err.line}: {err.error}
                      </p>
                    ))}
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto border border-white/10 rounded-xl">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Partida</th>
                        <th>Categoría</th>
                        <th>Precio Venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.validRows.slice(0, 10).map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.name}</td>
                          <td>{r.category}</td>
                          <td className="font-mono">{formatCents(r.price_cents || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.validRows.length > 10 && (
                    <p className="p-2 text-center text-[11px] text-gray-400">
                      ... y {csvPreview.validRows.length - 10} partidas más.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={csvPreview.validRows.length === 0}
                  className="btn btn-primary btn-sm font-semibold"
                >
                  Confirmar e Insertar {csvPreview.validRows.length} Partidas
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
