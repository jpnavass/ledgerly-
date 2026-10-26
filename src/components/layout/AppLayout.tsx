'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Building2,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Search,
  Bell,
  Plus,
  X,
  ArrowUpRight,
  Menu,
} from 'lucide-react';
import { getOrganization, getDocuments, syncStoreWithRepository } from '@/lib/store';
import { getRepository } from '@/lib/repo';

const NAV_ITEMS = [
  { href: '/', label: 'Panel Principal', icon: LayoutDashboard },
  { href: '/documentos', label: 'Documentos', icon: FileText },
  { href: '/clientes', label: 'Clientes & Cuentas', icon: Building2 },
  { href: '/catalogo', label: 'Tarifario Oficial', icon: Package },
  { href: '/cobros', label: 'Tesorería y Cobros', icon: CreditCard },
  { href: '/informes', label: 'Informes Financieros', icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [org, setOrg] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const repo = getRepository();
      const currentOrg = getOrganization();
      const orgId = currentOrg?.id || '';
      if (!orgId) {
        if (mounted) {
          setOrg(currentOrg);
          setDocs([]);
        }
        return;
      }
      try {
        const [orgData, docsData] = await Promise.all([
          repo.getOrganization(orgId),
          repo.getDocuments(orgId),
        ]);
        if (mounted) {
          setOrg(orgData || currentOrg);
          setDocs(docsData);
        }
      } catch (e) {
        if (mounted) {
          setOrg(getOrganization());
          setDocs(getDocuments());
        }
      }
    }
    refresh();
    syncStoreWithRepository();
    window.addEventListener('pe_store_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      mounted = false;
      window.removeEventListener('pe_store_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Atajo de teclado ⌘K / Ctrl+K y ⌘B para contraer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const filteredDocs = docs.filter(
    (d) =>
      (d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${d.series || ''}-${d.number || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.client?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const orgInitial = (org?.legal_name || org?.name || 'PE').slice(0, 2).toUpperCase();

  return (
    <div
      className="flex min-h-screen bg-[var(--bg-primary)]"
      data-sidebar={collapsed ? 'collapsed' : 'expanded'}
      data-sidebar-open={mobileOpen ? 'true' : 'false'}
    >
      {/* Overlay para móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modal Buscador Rápido (Command Palette ⌘K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#0E111B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
              <Search size={18} className="text-indigo-400" />
              <input
                type="text"
                placeholder="Buscar presupuestos, albaranes, facturas o clientes... (ESC para salir)"
                className="w-full bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <span className="text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded text-gray-400">ESC</span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-1.5">
                Resultados
              </div>
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(`/documentos/editor?id=${doc.id}`);
                    }}
                    className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {doc.series ? `${doc.series}-${String(doc.number || 0).padStart(4, '0')}` : 'BORRADOR'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-200 group-hover:text-white line-clamp-1">
                          {doc.title}
                        </p>
                        <p className="text-xs text-gray-400">{doc.client?.name || 'Sin cliente asignado'}</p>
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="text-gray-500 group-hover:text-indigo-400" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">
                  {docs.length === 0
                    ? 'No hay documentos registrados todavía.'
                    : `No se encontraron documentos para "${searchQuery}".`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Corporativo */}
      <aside
        className={`sidebar ${mobileOpen ? 'open' : ''}`}
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        {/* Marca Empresarial */}
        <div className="flex items-center gap-3 px-4 h-[68px] border-b border-[var(--border-subtle)] flex-shrink-0 bg-[#0B0D14]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
            <span className="font-black text-white text-base tracking-tight font-mono">{orgInitial}</span>
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight truncate">
                {org?.legal_name || org?.name || 'Presupuesto Express'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={12} className="text-emerald-400 flex-shrink-0" />
                <span className="text-[10.5px] font-medium text-emerald-400 tracking-wide font-mono uppercase">
                  Enterprise
                </span>
                {org?.tax_id && <span className="text-[10px] text-gray-400">· {org.tax_id}</span>}
              </div>
            </div>
          )}

          {/* Botón cerrar en móvil */}
          <button
            className="ml-auto lg:hidden btn-ghost btn-icon"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar navegación lateral"
          >
            <X size={18} />
          </button>
        </div>

        {/* Enlaces de Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={19} className="flex-shrink-0" />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between sidebar-label">
                  <span>{item.label}</span>
                  {item.href === '/documentos' && docs.length > 0 && (
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                      {docs.length}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* Zona Inferior de la Barra Lateral */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-1.5 bg-[#0A0C13]">
          {!collapsed && (
            <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-2 sidebar-label">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400">Aislamiento RLS</span>
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Seguro
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono truncate">
                {org?.id ? `Tenant: ${org.id.slice(0, 8)}...` : 'Modo Seguro Local'}
              </p>
            </div>
          )}

          <Link
            href="/ajustes"
            className={`sidebar-link ${isActive('/ajustes') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Ajustes Fiscales' : undefined}
          >
            <Settings size={19} className="flex-shrink-0" />
            {!collapsed && <span className="sidebar-label">Ajustes Fiscales</span>}
          </Link>

          {/* Botón para contraer en escritorio */}
          <button
            className="sidebar-link w-full hidden lg:flex items-center justify-between text-gray-400 hover:text-white"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {collapsed ? (
              <ChevronRight size={19} className="flex-shrink-0 mx-auto" />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <ChevronLeft size={19} className="flex-shrink-0" />
                  <span className="text-xs sidebar-label">Plegar menú lateral</span>
                </div>
                <span className="kbd sidebar-label">⌘B</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Contenido Principal con Barra Superior */}
      <div className="main-content flex-1 flex flex-col min-w-0">
        {/* Cabecera Superior Corporativa (Top Bar) */}
        <header className="top-header sticky top-0 z-30 h-[68px] border-b border-[var(--border-subtle)] bg-[#090B12]/85 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir navegación lateral"
            >
              <Menu size={20} />
            </button>

            {/* Buscador Rápido (⌘K) */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-400 text-xs transition-colors w-72 md:w-96 min-h-[38px]"
            >
              <Search size={15} className="text-gray-400" />
              <span className="flex-1 text-left">Buscar documentos, clientes o CIF...</span>
              <span className="kbd">⌘K</span>
            </button>
          </div>

          {/* Acciones Derechas */}
          <div className="flex items-center gap-3">
            {/* Notificaciones */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Centro de avisos"
                aria-label="Centro de avisos del sistema"
              >
                <Bell size={18} />
              </button>

              {/* Panel Desplegable de Notificaciones */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0F121C] border border-white/15 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="font-semibold text-sm text-white">Avisos del Sistema</span>
                    <span className="text-[11px] text-gray-400 font-mono">0 pendientes</span>
                  </div>
                  <div className="py-6 text-center text-xs text-gray-400">
                    No hay notificaciones ni avisos pendientes.
                  </div>
                </div>
              )}
            </div>

            {/* Botón "+ Nuevo Presupuesto" */}
            <Link
              href="/documentos/nuevo"
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo Presupuesto</span>
              <span className="sm:hidden">Nuevo</span>
            </Link>

            {/* Identidad Corporativa */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 border border-white/20 flex items-center justify-center text-xs font-bold text-white shadow-sm font-mono">
                {orgInitial}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-white leading-tight truncate max-w-[140px]">
                  {org?.legal_name || 'Organización'}
                </p>
                <p className="text-[10px] text-gray-400 font-mono">
                  {org?.tax_id || 'Administración'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido de la Página */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
