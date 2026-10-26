'use client';

import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { getClients, saveClient, getDocuments, getOrganization } from '@/lib/store';
import { getRepository } from '@/lib/repo';
import { formatCents } from '@/lib/calculations';
import { isValidSpanishTaxId } from '@/lib/validators/nif';
import type { Client } from '@/types';
import {
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  FileText,
  ShieldCheck,
  ChevronRight,
  X,
  Upload,
  Download,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      const repo = getRepository();
      const currentOrg = getOrganization();
      const orgId = currentOrg?.id || 'org-main';
      try {
        const data = await repo.getClients(orgId);
        if (mounted) setClients(data);
      } catch (e) {
        if (mounted) setClients(getClients());
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

  // Formulario nuevo cliente
  const [newName, setNewName] = useState('');
  const [newTaxId, setNewTaxId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPostalCode, setNewPostalCode] = useState('');
  const [newProvince, setNewProvince] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [taxIdError, setTaxIdError] = useState<string | null>(null);

  // Estado de importación CSV
  const [csvPreview, setCsvPreview] = useState<{
    validRows: Partial<Client>[];
    errors: { line: number; raw: string; error: string }[];
  } | null>(null);

  const handleTaxIdBlur = () => {
    if (!newTaxId.trim()) {
      setTaxIdError(null);
      return;
    }
    const val = isValidSpanishTaxId(newTaxId);
    if (!val.ok) {
      setTaxIdError(val.error || 'Identificador fiscal no válido conforme a la AEAT.');
    } else {
      setTaxIdError(null);
      setNewTaxId(val.normalized || newTaxId);
    }
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTaxId.trim()) return;

    const val = isValidSpanishTaxId(newTaxId);
    if (!val.ok) {
      setTaxIdError(val.error || 'NIF/CIF no válido.');
      return;
    }

    const org = getOrganization();
    const newClient: Client = {
      id: `cli-${crypto.randomUUID()}`,
      org_id: org?.id || 'org-main',
      name: newName.trim(),
      tax_id: val.normalized || newTaxId.trim().toUpperCase(),
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      address: newAddress.trim() || undefined,
      city: newCity.trim() || undefined,
      postal_code: newPostalCode.trim() || undefined,
      province: newProvince.trim() || undefined,
      country: 'España',
      notes: newNotes.trim() || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveClient(newClient);
    setClients(getClients());
    setModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setNewName('');
    setNewTaxId('');
    setNewEmail('');
    setNewPhone('');
    setNewAddress('');
    setNewCity('');
    setNewPostalCode('');
    setNewProvince('');
    setNewNotes('');
    setTaxIdError(null);
  };

  // Exportar clientes a CSV
  const handleExportCsv = () => {
    const BOM = '\uFEFF';
    const headers = ['Razón Social', 'NIF/CIF', 'Email', 'Teléfono', 'Dirección', 'Código Postal', 'Ciudad', 'Provincia'];
    const rows = clients.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.tax_id || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.postal_code || '').replace(/"/g, '""')}"`,
      `"${(c.city || '').replace(/"/g, '""')}"`,
      `"${(c.province || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = BOM + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Procesar archivo CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return;

      const validRows: Partial<Client>[] = [];
      const errors: { line: number; raw: string; error: string }[] = [];

      // Detectar separador
      const firstLine = lines[0];
      const sep = firstLine.includes(';') ? ';' : ',';

      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        const cols = rawLine.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
        const name = cols[0];
        const taxId = cols[1];

        if (!name) {
          errors.push({ line: i + 1, raw: rawLine, error: 'Razón Social vacía.' });
          continue;
        }

        if (!taxId) {
          errors.push({ line: i + 1, raw: rawLine, error: 'NIF/CIF ausente.' });
          continue;
        }

        const taxCheck = isValidSpanishTaxId(taxId);
        if (!taxCheck.ok) {
          errors.push({ line: i + 1, raw: rawLine, error: `NIF inválido: ${taxCheck.error || ''}` });
          continue;
        }

        validRows.push({
          name,
          tax_id: taxCheck.normalized || taxId.toUpperCase(),
          email: cols[2] || undefined,
          phone: cols[3] || undefined,
          address: cols[4] || undefined,
          postal_code: cols[5] || undefined,
          city: cols[6] || undefined,
          province: cols[7] || undefined,
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
      const client: Client = {
        id: `cli-${crypto.randomUUID()}`,
        org_id: org?.id || 'org-main',
        name: r.name!,
        tax_id: r.tax_id!,
        email: r.email,
        phone: r.phone,
        address: r.address,
        postal_code: r.postal_code,
        city: r.city,
        province: r.province,
        country: 'España',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveClient(client);
    }

    setClients(getClients());
    setImportModalOpen(false);
    setCsvPreview(null);
  };

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.tax_id?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  // Calcular totales contratados por cliente
  const docCounts = new Map<string, { count: number; total: number }>();
  for (const doc of getDocuments()) {
    if (!doc.client_id) continue;
    const existing = docCounts.get(doc.client_id) || { count: 0, total: 0 };
    existing.count++;
    existing.total += doc.total_cents;
    docCounts.set(doc.client_id, existing);
  }

  const totalCartera = Array.from(docCounts.values()).reduce((sum, v) => sum + v.total, 0);

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                CARTERA FISCAL
              </span>
              <span className="text-xs text-gray-400">Verificación de NIF/CIF oficial de la AEAT</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Clientes & Cuentas Corporativas
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Registro mercantil, domicilios fiscales y volumen contratado por cuenta.
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
              title="Importar clientes desde archivo CSV"
            >
              <Upload size={15} />
              <span>Importar CSV</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={clients.length === 0}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              title="Exportar cartera a archivo CSV con BOM UTF-8"
            >
              <Download size={15} />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold"
            >
              <Plus size={16} />
              <span>Nuevo Cliente</span>
            </button>
          </div>
        </div>

        {/* Resumen Superior */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Cuentas Activas
            </span>
            <div className="text-2xl font-black text-white font-mono">{clients.length}</div>
            <p className="text-xs text-gray-400 mt-2">Empresas e instituciones registradas</p>
          </div>

          <div className="stat-card">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Volumen Total en Ofertas
            </span>
            <div className="text-2xl font-black text-indigo-300 font-mono">
              <span className="money">{formatCents(totalCartera)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Presupuestos y albaranes asociados</p>
          </div>

          <div className="stat-card">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Cumplimiento Fiscal
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono">100%</div>
            <p className="text-xs text-emerald-400/80 mt-2">NIFs validados con dígito de control AEAT</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="card-static p-4 bg-[#0C0E18] border border-white/10 rounded-2xl">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filtrar por razón social, CIF o email de contacto..."
              className="input pl-10 bg-white/[0.03] border-white/10 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Listado de Clientes o Estados Vacíos */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((client) => {
              const stats = docCounts.get(client.id) || { count: 0, total: 0 };

              return (
                <div
                  key={client.id}
                  className="p-5 rounded-2xl bg-[#0D101A] border border-white/10 hover:border-white/20 transition-all space-y-4 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors">
                          {client.name}
                        </h3>
                        <p className="font-mono text-xs text-gray-400">NIF/CIF: {client.tax_id}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-white/5 text-gray-300 border border-white/10">
                      {stats.count} {stats.count === 1 ? 'doc' : 'docs'}
                    </span>
                  </div>

                  {client.address && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <MapPin size={13} className="text-gray-500 flex-shrink-0" />
                      <span className="truncate">
                        {client.address}
                        {client.city ? `, ${client.city}` : ''}
                        {client.province ? ` (${client.province})` : ''}
                      </span>
                    </div>
                  )}

                  {client.notes && (
                    <p className="text-xs text-gray-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/5 leading-relaxed">
                      {client.notes}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 truncate">
                      <Mail size={14} className="text-gray-500 flex-shrink-0" />
                      <span className="truncate">{client.email || 'Sin email registrado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-gray-500 flex-shrink-0" />
                      <span>{client.phone || 'Sin teléfono'}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-mono">Facturación acumulada</span>
                      <span className="text-sm font-bold font-mono text-white">
                        <span className="money">{formatCents(stats.total)}</span>
                      </span>
                    </div>

                    <Link
                      href={`/documentos?client=${client.id}`}
                      className="btn btn-secondary btn-sm flex items-center gap-1"
                    >
                      <span>Ver Documentos</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state my-8">
            <div className="empty-state-icon">
              <Building2 size={26} />
            </div>
            <h3 className="empty-state-title">
              {clients.length === 0 ? 'Sin clientes registrados' : 'No se encontraron clientes'}
            </h3>
            <p className="empty-state-desc">
              {clients.length === 0
                ? 'Agrega tu primera ficha de cliente o importa un listado CSV para emitir presupuestos y facturas.'
                : `No existen clientes que coincidan con la búsqueda "${search}".`}
            </p>
            {clients.length === 0 ? (
              <button onClick={() => setModalOpen(true)} className="btn btn-primary">
                <Plus size={16} />
                <span>Añadir Primer Cliente</span>
              </button>
            ) : (
              <button onClick={() => setSearch('')} className="btn btn-secondary">
                Restablecer búsqueda
              </button>
            )}
          </div>
        )}

        {/* Modal Nuevo Cliente */}
        {modalOpen && (
          <div className="modal-backdrop">
            <div className="modal p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-white text-base">Registrar Nuevo Cliente</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                  aria-label="Cerrar modal"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddClient} className="space-y-3.5 text-xs">
                <div className="field">
                  <label className="field-label">Razón Social / Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Construcciones y Proyectos Alarcón S.L."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="field-label">NIF / CIF Oficial *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. B88192034"
                      value={newTaxId}
                      onChange={(e) => setNewTaxId(e.target.value)}
                      onBlur={handleTaxIdBlur}
                      aria-invalid={taxIdError ? 'true' : 'false'}
                      className="input bg-[#121626] border-white/10 text-xs font-mono"
                    />
                    {taxIdError && <span className="field-error">{taxIdError}</span>}
                  </div>
                  <div className="field">
                    <label className="field-label">Teléfono</label>
                    <input
                      type="text"
                      placeholder="+34 91 000 00 00"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Email de Facturación</label>
                  <input
                    type="email"
                    placeholder="administracion@empresa.es"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs"
                  />
                </div>

                <div className="field">
                  <label className="field-label">Domicilio Fiscal (Calle, número, piso)</label>
                  <input
                    type="text"
                    placeholder="Av. de la Constitución, 45, 2º B"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="field">
                    <label className="field-label">C.P.</label>
                    <input
                      type="text"
                      placeholder="28001"
                      value={newPostalCode}
                      onChange={(e) => setNewPostalCode(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs font-mono"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Población</label>
                    <input
                      type="text"
                      placeholder="Madrid"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Provincia</label>
                    <input
                      type="text"
                      placeholder="Madrid"
                      value={newProvince}
                      onChange={(e) => setNewProvince(e.target.value)}
                      className="input bg-[#121626] border-white/10 text-xs"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Observaciones</label>
                  <textarea
                    rows={2}
                    placeholder="Condiciones comerciales o notas de entrega..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="input bg-[#121626] border-white/10 text-xs"
                  />
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
                    Guardar Cliente
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
                <h3 className="font-bold text-white text-base">Importación de Clientes por CSV</h3>
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
                    <span className="text-gray-400 block">Filas Válidas a Insertar</span>
                    <strong className="text-emerald-400 text-base font-mono">
                      {csvPreview.validRows.length}
                    </strong>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <span className="text-gray-400 block">Filas con Error Rechazadas</span>
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
                        <th>Razón Social</th>
                        <th>NIF/CIF</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.validRows.slice(0, 10).map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.name}</td>
                          <td className="font-mono">{r.tax_id}</td>
                          <td>{r.email || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.validRows.length > 10 && (
                    <p className="p-2 text-center text-[11px] text-gray-400">
                      ... y {csvPreview.validRows.length - 10} clientes más.
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
                  Confirmar e Insertar {csvPreview.validRows.length} Clientes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
