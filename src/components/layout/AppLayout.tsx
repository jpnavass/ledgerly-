'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Truck,
  FileCheck2,
  Receipt,
  Building2,
  Package,
  CreditCard,
  ReceiptCent,
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
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { getOrganization, getDocuments, syncStoreWithRepository } from '@/lib/store';
import { getRepository } from '@/lib/repo';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';

interface NavSection {
  title?: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    count?: number;
  }[];
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMenuOpen, setNewMenuOpen] = useState(false);
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
      } catch {
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

  // Atajos de teclado ⌘K / Ctrl+K y ⌘B para contraer
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
        setNewMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const navSections: NavSection[] = [
    {
      items: [
        { href: '/dashboard', label: 'Panel Principal', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Ventas & Facturación',
      items: [
        { href: '/documentos', label: 'Presupuestos', icon: FileText, count: docs.filter((d) => d.doc_type === 'quote').length },
        { href: '/documentos?type=delivery_note', label: 'Albaranes', icon: Truck, count: docs.filter((d) => d.doc_type === 'delivery_note').length },
        { href: '/documentos?type=proforma', label: 'Proformas', icon: FileCheck2, count: docs.filter((d) => d.doc_type === 'proforma').length },
        { href: '/documentos?type=invoice', label: 'Facturas', icon: Receipt, count: docs.filter((d) => d.doc_type === 'invoice').length },
      ],
    },
    {
      title: 'Tesorería & Caja',
      items: [
        { href: '/cobros', label: 'Cobros y Vencimientos', icon: CreditCard },
        { href: '/gastos', label: 'Gastos de Proveedor', icon: ReceiptCent },
      ],
    },
    {
      title: 'Contactos & Catálogo',
      items: [
        { href: '/clientes', label: 'Clientes y Cuentas', icon: Building2 },
        { href: '/catalogo', label: 'Catálogo de Partidas', icon: Package },
      ],
    },
    {
      title: 'Análisis & Configuración',
      items: [
        { href: '/informes', label: 'Informes y Métricas', icon: BarChart3 },
        { href: '/ajustes', label: 'Ajustes Fiscales', icon: Settings },
      ],
    },
  ];

  const filteredDocs = docs.filter(
    (d) =>
      (d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${d.series || ''}-${d.number || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.client?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const orgInitial = (org?.legal_name || org?.name || 'Ledgerly').slice(0, 2).toUpperCase();

  return (
    <div
      className="flex min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]"
      data-sidebar={collapsed ? 'collapsed' : 'expanded'}
      data-sidebar-open={mobileOpen ? 'true' : 'false'}
    >
      {/* Capa de fondo en móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modal Buscador Rápido (Command Palette ⌘K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-subtle)] gap-3">
              <Search size={18} className="text-[var(--accent-fg)]" />
              <input
                type="text"
                placeholder="Buscar presupuestos, albaranes, facturas, clientes... (ESC para salir)"
                className="w-full bg-transparent border-none text-[var(--text-primary)] text-sm focus:outline-none placeholder:text-[var(--text-tertiary)]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <span className="text-[11px] font-mono bg-[var(--bg-surface-2)] px-2 py-0.5 rounded text-[var(--text-secondary)]">ESC</span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-1.5">
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
                    className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--bg-surface-2)] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-fg)] border border-[var(--border-subtle)]">
                        {doc.series ? `${doc.series}-${String(doc.number || 0).padStart(4, '0')}` : 'BORRADOR'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">
                          {doc.title}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{doc.client?.name || 'Sin cliente asignado'}</p>
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent-fg)]" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
                  {docs.length === 0
                    ? 'No hay documentos registrados todavía.'
                    : `No se encontraron documentos para "${searchQuery}".`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra Lateral (Sidebar) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 lg:static flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] transition-all duration-200 ease-in-out ${
          collapsed ? 'w-[76px]' : 'w-[270px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Identidad de la Empresa */}
        <div className="flex items-center gap-3 px-4 h-[68px] border-b border-[var(--border-subtle)] flex-shrink-0 bg-[var(--bg-surface)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center flex-shrink-0 shadow-sm font-bold text-sm font-mono">
            {orgInitial}
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight leading-tight truncate">
                {org?.legal_name || org?.name || 'Ledgerly'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={12} className="text-[var(--success-fg)] flex-shrink-0" />
                <span className="text-[10px] font-semibold text-[var(--success-fg)] font-mono uppercase">
                  VeriFactu Ready
                </span>
                {org?.tax_id && <span className="text-[10px] text-[var(--text-tertiary)]">· {org.tax_id}</span>}
              </div>
            </div>
          )}

          <button
            className="ml-auto lg:hidden p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar navegación lateral"
          >
            <X size={18} />
          </button>
        </div>

        {/* Enlaces de Navegación agrupados */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navSections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="space-y-1">
              {section.title && !collapsed && (
                <div className="px-2 pb-1 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sidebar-link"
                  data-active={isActive(item.href) ? 'true' : 'false'}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      {typeof item.count === 'number' && item.count > 0 && (
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-surface-2)] text-[var(--text-secondary)]">
                          {item.count}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Pie de Barra Lateral: Estado de Plan y Plegado */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2 bg-[var(--bg-surface)]">
          {!collapsed && (
            <div className="p-2.5 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)] font-medium">Plan Enterprise</span>
                <span className="text-[10px] font-bold text-[var(--accent-fg)] uppercase">Activo</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                <span>Versión v2.0</span>
                <span className="flex items-center gap-1 text-[var(--success-fg)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-fg)] animate-pulse"></span>
                  Conforme RD 1007/2023
                </span>
              </div>
            </div>
          )}

          {/* Botón para contraer en escritorio */}
          <button
            className="sidebar-link w-full hidden lg:flex items-center justify-between text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {collapsed ? (
              <ChevronRight size={18} className="mx-auto" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <ChevronLeft size={18} />
                  <span className="text-xs">Plegar menú</span>
                </div>
                <span className="text-[10px] font-mono bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded text-[var(--text-tertiary)]">⌘B</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Contenido Principal con Barra Superior */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Cabecera Superior Corporativa (Topbar) */}
        <header className="top-header sticky top-0 z-30 h-[68px] border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg bg-[var(--bg-surface-2)] text-[var(--text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir navegación lateral"
            >
              <Menu size={20} />
            </button>

            {/* Buscador Rápido (⌘K) */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] text-xs transition-colors w-72 md:w-96 min-h-[38px] hover:border-[var(--border-input)]"
            >
              <Search size={15} className="text-[var(--text-tertiary)]" />
              <span className="flex-1 text-left">Buscar documentos, clientes o NIF...</span>
              <span className="text-[10px] font-mono bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)]">⌘K</span>
            </button>
          </div>

          {/* Acciones Derechas */}
          <div className="flex items-center gap-3">
            {/* Conmutador de Temas */}
            <ThemeSwitcher />

            {/* Menú "+ Nuevo" */}
            <div className="relative">
              <button
                onClick={() => setNewMenuOpen(!newMenuOpen)}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
                aria-expanded={newMenuOpen}
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Nuevo</span>
              </button>

              {newMenuOpen && (
                <div className="dropdown-menu absolute right-0 mt-2 w-52 animate-fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Emisión Rápida
                  </div>
                  <Link
                    href="/documentos/nuevo?type=quote"
                    onClick={() => setNewMenuOpen(false)}
                    className="dropdown-item"
                  >
                    <FileText size={15} />
                    <span>Presupuesto</span>
                  </Link>
                  <Link
                    href="/documentos/nuevo?type=delivery_note"
                    onClick={() => setNewMenuOpen(false)}
                    className="dropdown-item"
                  >
                    <Truck size={15} />
                    <span>Albarán</span>
                  </Link>
                  <Link
                    href="/documentos/nuevo?type=proforma"
                    onClick={() => setNewMenuOpen(false)}
                    className="dropdown-item"
                  >
                    <FileCheck2 size={15} />
                    <span>Factura Proforma</span>
                  </Link>
                  <Link
                    href="/documentos/nuevo?type=invoice"
                    onClick={() => setNewMenuOpen(false)}
                    className="dropdown-item"
                  >
                    <Receipt size={15} />
                    <span>Factura Oficial</span>
                  </Link>
                  <div className="border-t border-[var(--border-subtle)] my-1"></div>
                  <Link
                    href="/clientes?action=new"
                    onClick={() => setNewMenuOpen(false)}
                    className="dropdown-item"
                  >
                    <Building2 size={15} />
                    <span>Nuevo Cliente</span>
                  </Link>
                  <Link
                    href="/gastos?action=new"
                    onClick={() => setNewMenuOpen(false)}
                    className="dropdown-item"
                  >
                    <ReceiptCent size={15} />
                    <span>Registrar Gasto</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Identidad de la Empresa */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-[var(--border-subtle)]">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center text-xs font-bold font-mono">
                {orgInitial}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight truncate max-w-[140px]">
                  {org?.legal_name || org?.name || 'Organización'}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                  {org?.tax_id || 'Administración'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
