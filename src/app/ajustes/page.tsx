'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  getOrganization,
  saveOrganization,
  getOrgSettings,
  saveOrgSettings,
  getClients,
  getCatalog,
  getDocuments,
  getPayments,
  getAuditEvents,
  recordAuditEvent,
} from '@/lib/store';
import { isValidSpanishTaxId } from '@/lib/validators/nif';
import { getActivePlan, PLAN_DEFINITIONS } from '@/lib/domain/plans';
import { can } from '@/lib/domain/permissions';
import {
  assertCanRemoveMember,
  assertCanChangeMemberRole,
  validateMemberInvitation,
  MembershipError,
} from '@/lib/domain/members';
import type { Membership, UserRole, License } from '@/types';
import {
  Building2,
  Shield,
  CreditCard,
  Bell,
  CheckCircle2,
  Save,
  Users,
  UserPlus,
  Trash2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Zap,
  Download,
  Database,
  FileCheck,
  Palette,
  Sun,
  Moon,
  Laptop,
  X,
} from 'lucide-react';
import { type ThemeMode, type AccentId, type ThemeDensity, type UiPreferences, DEFAULT_UI_PREFERENCES } from '@/lib/theme/types';
import { parseUiCookie, serializeUiCookie, UI_COOKIE_NAME } from '@/lib/theme/cookie';
import Link from 'next/link';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'fiscal' | 'subscription' | 'members' | 'portability' | 'notifications' | 'appearance'>('fiscal');
  const [uiPrefs, setUiPrefs] = useState<UiPreferences>(DEFAULT_UI_PREFERENCES);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const prefs = parseUiCookie(document.cookie);
      setUiPrefs(prefs);
    }
  }, []);

  const handleUpdateUiPref = <K extends keyof UiPreferences>(key: K, val: UiPreferences[K]) => {
    const next = { ...uiPrefs, [key]: val };
    setUiPrefs(next);

    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('theme-transition');
      window.setTimeout(() => document.documentElement.classList.remove('theme-transition'), 160);

      if (key === 'mode') {
        if (val === 'system') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = val as string;
      } else if (key === 'accent') {
        document.documentElement.dataset.accent = val as string;
      } else if (key === 'density') {
        if (val === 'compact') document.documentElement.dataset.density = 'compact';
        else delete document.documentElement.dataset.density;
      } else if (key === 'high_contrast') {
        if (val) document.documentElement.dataset.contrast = 'high';
        else delete document.documentElement.dataset.contrast;
      } else if (key === 'font_scale') {
        if (val === 100) document.documentElement.style.removeProperty('--font-scale');
        else document.documentElement.style.setProperty('--font-scale', String((val as number) / 100));
      }

      const serialized = serializeUiCookie(next);
      document.cookie = `${UI_COOKIE_NAME}=${serialized}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  const handleResetUiDefaults = () => {
    setUiPrefs(DEFAULT_UI_PREFERENCES);
    if (typeof document !== 'undefined') {
      delete document.documentElement.dataset.theme;
      document.documentElement.dataset.accent = 'indigo';
      delete document.documentElement.dataset.density;
      delete document.documentElement.dataset.contrast;
      document.documentElement.style.removeProperty('--font-scale');
      const serialized = serializeUiCookie(DEFAULT_UI_PREFERENCES);
      document.cookie = `${UI_COOKIE_NAME}=${serialized}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  const org = getOrganization();
  const settings = getOrgSettings();

  // Rol del usuario actual en esta sesión (por defecto owner)
  const [currentRole] = useState<UserRole>('owner');

  // Estados de configuración de empresa
  const [companyName, setCompanyName] = useState(org?.name || '');
  const [taxId, setTaxId] = useState(org?.tax_id || '');
  const [address, setAddress] = useState(org?.address || '');
  const [postalCity, setPostalCity] = useState(
    org?.city ? `${org?.postal_code || ''} ${org?.city}`.trim() : ''
  );
  const [phone, setPhone] = useState(org?.phone || '');
  const [email, setEmail] = useState(org?.email || '');
  const [iban, setIban] = useState(settings?.iban || '');
  const [mercantile, setMercantile] = useState(org?.mercantile_registry || '');
  const [billingMode, setBillingMode] = useState(settings?.billing_mode || 'no_verifactu');
  const [taxIdError, setTaxIdError] = useState<string | null>(null);

  // Parámetros fiscales y comerciales por defecto
  const [validityDays, setValidityDays] = useState(settings?.default_validity_days || 30);
  const [defaultTerms, setDefaultTerms] = useState(settings?.default_terms_text || '');
  const [defaultVat, setDefaultVat] = useState(settings?.default_vat_rate || 21);
  const [defaultIrpf, setDefaultIrpf] = useState(settings?.default_irpf_rate || 0);

  // Estado de Licencia y Suscripción
  const [license, setLicense] = useState<License | null>(null);
  const [stripeLoading, setStripeLoading] = useState<string | null>(null);
  const [stripeMessage, setStripeMessage] = useState<string | null>(null);
  const [stripeSuccess, setStripeSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('stripe_status');
      if (status === 'success') {
        setStripeSuccess('¡Pago confirmado en Stripe! Tu suscripción a Ledgerly ha sido procesada con éxito.');
        setTab('subscription');
      } else if (status === 'cancelled') {
        setStripeMessage('El proceso de suscripción en Stripe fue cancelado.');
        setTab('subscription');
      }
    }
  }, []);

  // Estado de Miembros del Equipo
  const [members, setMembers] = useState<Membership[]>([
    {
      id: 'mem-admin',
      org_id: org?.id || '',
      user_id: 'usr-admin',
      role: 'owner',
      is_active: true,
      created_at: '2027-01-01T00:00:00.000Z',
    },
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('employee');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);

  // Toggles de notificaciones
  const [notifyView, setNotifyView] = useState(true);
  const [notifySign, setNotifySign] = useState(true);
  const [notifyDue, setNotifyDue] = useState(true);

  const activePlanInfo = getActivePlan(license);

  const handleTaxIdBlur = () => {
    if (!taxId.trim()) {
      setTaxIdError(null);
      return;
    }
    const val = isValidSpanishTaxId(taxId);
    if (!val.ok) {
      setTaxIdError(val.error || 'NIF/CIF no válido conforme a la AEAT.');
    } else {
      setTaxIdError(null);
      setTaxId(val.normalized || taxId.trim().toUpperCase());
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (taxId.trim()) {
      const val = isValidSpanishTaxId(taxId);
      if (!val.ok) {
        setTaxIdError(val.error || 'NIF/CIF no válido.');
        return;
      }
      setTaxIdError(null);
    }

    const parts = postalCity.trim().split(' ');
    const postal_code = parts[0] || '';
    const city = parts.slice(1).join(' ') || postal_code;

    saveOrganization({
      id: org?.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : `org-${Date.now()}`),
      name: companyName,
      legal_name: companyName,
      tax_id: taxId.trim().toUpperCase(),
      address,
      postal_code,
      city,
      phone,
      email,
      mercantile_registry: mercantile,
      country: 'España',
      created_at: org?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    saveOrgSettings({
      id: settings?.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : `set-${Date.now()}`),
      org_id: org?.id || '',
      default_validity_days: validityDays,
      default_vat_rate: defaultVat,
      default_irpf_rate: defaultIrpf,
      default_terms_text: defaultTerms,
      series: settings?.series || {
        quote: { prefix: 'PRE', reset_yearly: true },
        delivery_note: { prefix: 'ALB', reset_yearly: true },
        proforma: { prefix: 'PRO', reset_yearly: true },
        invoice: { prefix: 'FAC', reset_yearly: true },
        credit_note: { prefix: 'REC', reset_yearly: true },
      },
      iban,
      billing_mode: billingMode,
      taxpayer_kind: settings?.taxpayer_kind || 'sociedad',
      created_at: settings?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExportFullOrg = () => {
    const fullBackup = {
      exported_at: new Date().toISOString(),
      system: 'Ledgerly Enterprise',
      version: '2.0.0',
      organization: getOrganization(),
      settings: getOrgSettings(),
      clients: getClients(),
      catalog: getCatalog(),
      documents: getDocuments(),
      payments: getPayments(),
      audit_events: getAuditEvents(),
    };

    const json = JSON.stringify(fullBackup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_completo_organizacion_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    recordAuditEvent({
      id: `audit-${crypto.randomUUID()}`,
      org_id: org?.id || '',
      actor_kind: 'user',
      type: 'export',
      description: 'Exportación completa de respaldo y portabilidad conforme a RGPD art. 20.',
      created_at: new Date().toISOString(),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleStripeCheckout = async (plan: 'pro' | 'business') => {
    setStripeLoading(plan);
    setStripeMessage(null);
    setStripeSuccess(null);
    try {
      const orgId = org?.id || 'org_ledgerly_primary';
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          org_id: orgId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar suscripción');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setStripeMessage(err instanceof Error ? err.message : 'Error al conectar con la pasarela de Stripe');
    } finally {
      setStripeLoading(null);
    }
  };

  const handleStripePortal = async () => {
    if (!license?.stripe_customer_id) {
      setStripeMessage('No hay una suscripción activa vinculada con Stripe para esta entidad.');
      return;
    }
    setStripeLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: license.stripe_customer_id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al acceder al portal de facturación');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setStripeMessage(err instanceof Error ? err.message : 'Error al conectar con el portal');
    } finally {
      setStripeLoading(null);
    }
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    setMemberSuccess(null);

    try {
      validateMemberInvitation(inviteEmail, inviteRole);

      // Comprobar si ya existe
      if (members.some((m) => m.user_id === inviteEmail)) {
        throw new MembershipError('Ya existe una invitación o usuario con este correo electrónico.');
      }

      const newMember: Membership = {
        id: `mem-${Date.now()}`,
        org_id: org?.id || '',
        user_id: inviteEmail,
        role: inviteRole,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setMembers([...members, newMember]);
      setInviteEmail('');
      setMemberSuccess(`Invitación enviada con éxito a ${inviteEmail} como ${inviteRole === 'owner' ? 'Propietario' : 'Empleado'}.`);
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : 'Error al invitar miembro.');
    }
  };

  const handleChangeRole = (memberId: string, newRole: UserRole) => {
    setMemberError(null);
    setMemberSuccess(null);
    try {
      assertCanChangeMemberRole(members, memberId, newRole);
      setMembers(
        members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      setMemberSuccess('Rol actualizado correctamente.');
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : 'Error al modificar rol.');
    }
  };

  const handleRemoveMember = (memberId: string) => {
    setMemberError(null);
    setMemberSuccess(null);
    try {
      assertCanRemoveMember(members, memberId);
      setMembers(members.filter((m) => m.id !== memberId));
      setMemberSuccess('Miembro revocado de la organización.');
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : 'Error al revocar miembro.');
    }
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-[1000px] mx-auto space-y-6 animate-fade-in">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ADMINISTRACIÓN
              </span>
              <span className="text-xs text-gray-400">
                Parámetros legales, licencias y equipo
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Ajustes de la Organización
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Configuración de datos fiscales para documentos oficiales, cuentas bancarias e integraciones.
            </p>
          </div>

          {can(currentRole, 'settings.edit') && (
            <button
              onClick={handleSave}
              className="btn btn-primary btn-lg shadow-lg shadow-indigo-600/30 font-semibold cursor-pointer"
            >
              <Save size={18} />
              <span>Guardar Ajustes</span>
            </button>
          )}
        </div>

        {saved && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Cambios fiscales y de configuración guardados correctamente en la base de datos.</span>
          </div>
        )}

        {/* Pestañas de Ajustes */}
        <div className="flex border-b border-white/10 gap-2 text-xs font-medium overflow-x-auto pb-px flex-nowrap scrollbar-none">
          <button
            onClick={() => setTab('fiscal')}
            className={`pb-3 px-3 transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              tab === 'fiscal'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Building2 size={15} />
            <span>Identificación Fiscal</span>
          </button>
          <button
            onClick={() => setTab('subscription')}
            className={`pb-3 px-3 transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              tab === 'subscription'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Shield size={15} />
            <span>Plan y Licencias</span>
          </button>
          <button
            onClick={() => setTab('members')}
            className={`pb-3 px-3 transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              tab === 'members'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users size={15} />
            <span>Equipo y Roles</span>
          </button>
          <button
            onClick={() => setTab('portability')}
            className={`pb-3 px-3 transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              tab === 'portability'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database size={15} />
            <span>Portabilidad & Copias</span>
          </button>
          <button
            onClick={() => setTab('notifications')}
            className={`pb-3 px-3 transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              tab === 'notifications'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Bell size={15} />
            <span>Notificaciones</span>
          </button>
          <button
            onClick={() => setTab('appearance')}
            className={`pb-3 px-3 transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              tab === 'appearance'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Palette size={15} />
            <span>Apariencia & Diseño</span>
          </button>
        </div>

        {/* PESTAÑA: IDENTIFICACIÓN FISCAL */}
        {tab === 'fiscal' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-white/10">
                <Building2 size={18} className="text-indigo-400" />
                <span>Identificación Fiscal Oficial (RD 1619/2012)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-gray-300 font-semibold block mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Denominación legal de la empresa"
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">CIF / NIF Oficial *</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    onBlur={handleTaxIdBlur}
                    placeholder="B12345678"
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs font-mono w-full px-3 py-2 rounded-xl text-white"
                  />
                  {taxIdError && <p className="text-red-400 text-[11px] mt-1">{taxIdError}</p>}
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Teléfono Corporativo</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Domicilio Fiscal</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, número, planta"
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Código Postal y Población</label>
                  <input
                    type="text"
                    value={postalCity}
                    onChange={(e) => setPostalCity(e.target.value)}
                    placeholder="28001 Madrid"
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-gray-300 font-semibold block mb-1">Email de Facturación y Avisos</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-gray-300 font-semibold block mb-1">Registro Mercantil</label>
                  <input
                    type="text"
                    value={mercantile}
                    onChange={(e) => setMercantile(e.target.value)}
                    placeholder="Tomo, Libro, Folio, Hoja de inscripción"
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs font-mono w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>

            {/* Bloque Bancario */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-white/10">
                <CreditCard size={18} className="text-indigo-400" />
                <span>Cuentas de Cobro y Facturación</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-gray-300 font-semibold block mb-1">IBAN Principal para Facturas</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs font-mono w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Modalidad de Facturación</label>
                  <select
                    value={billingMode}
                    onChange={(e) => setBillingMode(e.target.value as 'verifactu' | 'no_verifactu')}
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  >
                    <option value="no_verifactu">Registro inalterable estándar (Sin envío telemático)</option>
                    <option value="verifactu">Veri*Factu (Requiere certificado digital configurado)</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Moneda Oficial</label>
                  <input
                    type="text"
                    disabled
                    value="EUR (€) — Euro"
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs text-gray-400 cursor-not-allowed w-full px-3 py-2 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Parámetros Documentales por Defecto */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-white/10">
                <FileCheck size={18} className="text-indigo-400" />
                <span>Parámetros Documentales por Defecto</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Días de Validez de Presupuesto</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs font-mono w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Tipo IVA por Defecto (%)</label>
                  <select
                    value={defaultVat}
                    onChange={(e) => setDefaultVat(Number(e.target.value))}
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  >
                    <option value={21}>21% (General)</option>
                    <option value={10}>10% (Reducido)</option>
                    <option value={4}>4% (Superreducido)</option>
                    <option value={0}>0% (Exento)</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Retención IRPF por Defecto (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={defaultIrpf}
                    onChange={(e) => setDefaultIrpf(Number(e.target.value) || 0)}
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs font-mono w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-gray-300 font-semibold block mb-1">Condiciones Contractuales Generales (Cláusula)</label>
                  <textarea
                    rows={3}
                    value={defaultTerms}
                    onChange={(e) => setDefaultTerms(e.target.value)}
                    placeholder="Condiciones de pago, plazo de ejecución y garantías personalizadas de su empresa..."
                    className="input bg-[var(--bg-surface-2)] border-white/10 text-xs w-full px-3 py-2 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>
          </form>
        )}

        {/* PESTAÑA: PLAN Y LICENCIAS */}
        {tab === 'subscription' && (
          <div className="space-y-6">
            {stripeSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
                  <span>{stripeSuccess}</span>
                </div>
                <button
                  onClick={() => setStripeSuccess(null)}
                  className="p-1 text-emerald-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {stripeMessage && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={18} className="shrink-0 text-amber-400" />
                  <span>{stripeMessage}</span>
                </div>
                <button
                  onClick={() => setStripeMessage(null)}
                  className="p-1 text-amber-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Tarjeta de Estado Actual */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-surface)] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
                  <Shield size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-lg">{activePlanInfo.def.name}</h3>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                      {license?.is_active ? 'Activa' : 'Gratuito'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                    Límite mensual: {activePlanInfo.def.max_docs_per_month === -1 ? 'Ilimitado' : `${activePlanInfo.def.max_docs_per_month} documentos`} · Hasta {activePlanInfo.def.max_users} usuario(s) concurrente(s)
                  </p>
                </div>
              </div>

              {license?.stripe_customer_id && (
                <button
                  onClick={handleStripePortal}
                  disabled={stripeLoading === 'portal'}
                  className="btn btn-secondary text-xs flex items-center gap-2 self-start md:self-auto cursor-pointer"
                >
                  {stripeLoading === 'portal' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ExternalLink size={14} />
                  )}
                  <span>Portal de Facturación Stripe</span>
                </button>
              )}
            </div>

            {/* Opciones de Suscripción */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plan Pro */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-surface)] border border-white/10 space-y-6 relative flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-white text-lg">Plan Profesional</h4>
                    <span className="text-sm font-mono font-black text-indigo-400">19 € / mes</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                    Para pymes y profesionales en crecimiento que precisan firma electrónica y tesorería.
                  </p>
                  <ul className="text-xs text-gray-300 space-y-3 mb-6">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Hasta 100 documentos mensuales</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Firma electrónica certificada del cliente (eIDAS)</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Módulo de tesorería y cobros</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Hasta 5 usuarios concurrentes</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleStripeCheckout('pro')}
                  disabled={stripeLoading === 'pro' || activePlanInfo.plan === 'pro'}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/25"
                >
                  {stripeLoading === 'pro' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : activePlanInfo.plan === 'pro' ? (
                    <span>Plan Actual</span>
                  ) : (
                    <>
                      <Zap size={15} />
                      <span>Contratar Plan Profesional</span>
                    </>
                  )}
                </button>
              </div>

              {/* Plan Business */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-surface)] border border-indigo-500/40 space-y-6 relative flex flex-col justify-between shadow-xl shadow-indigo-500/10">
                <div className="absolute -top-3 right-6 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                  Recomendado
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-white text-lg">Plan Empresa</h4>
                    <span className="text-sm font-mono font-black text-indigo-400">49 € / mes</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                    Para organizaciones consolidadas con alto volumen y equipo multidisciplinar.
                  </p>
                  <ul className="text-xs text-gray-300 space-y-3 mb-6">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Documentos ilimitados</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Hasta 25 usuarios concurrentes</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Integración Veri*Factu directa</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Auditoría inalterable y exportación</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleStripeCheckout('business')}
                  disabled={stripeLoading === 'business' || activePlanInfo.plan === 'business'}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/25"
                >
                  {stripeLoading === 'business' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : activePlanInfo.plan === 'business' ? (
                    <span>Plan Actual</span>
                  ) : (
                    <>
                      <Zap size={15} />
                      <span>Contratar Plan Empresa</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: EQUIPO Y MIEMBROS */}
        {tab === 'members' && (
          <div className="space-y-6">
            {memberError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{memberError}</span>
              </div>
            )}

            {memberSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{memberSuccess}</span>
              </div>
            )}

            {/* Formulario de Invitación */}
            {can(currentRole, 'members.manage') && (
              <form
                onSubmit={handleInviteMember}
                className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-white/10 flex flex-col sm:flex-row sm:items-end gap-3"
              >
                <div className="flex-1 text-xs">
                  <label className="block text-gray-300 font-semibold mb-1">
                    Correo del nuevo miembro
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colaborador@empresa.es"
                    className="w-full px-3 py-2 bg-[var(--bg-surface-2)] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="w-full sm:w-48 text-xs">
                  <label className="block text-gray-300 font-semibold mb-1">Rol en la empresa</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-[var(--bg-surface-2)] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="employee">Empleado (Operativo)</option>
                    <option value="owner">Propietario (Acceso total)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 h-[36px]"
                >
                  <UserPlus size={15} />
                  <span>Invitar Miembro</span>
                </button>
              </form>
            )}

            {/* Tabla de Miembros */}
            <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-3">
              <h3 className="font-bold text-white text-sm">Miembros de la Organización</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Usuario / Email</th>
                      <th className="py-2.5 px-3">Rol</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-medium text-white">{member.user_id}</td>
                        <td className="py-3 px-3">
                          {can(currentRole, 'members.manage') ? (
                            <select
                              value={member.role}
                              onChange={(e) =>
                                handleChangeRole(member.id, e.target.value as UserRole)
                              }
                              className="px-2 py-1 bg-[var(--bg-surface-2)] border border-white/10 rounded text-[11px] text-white"
                            >
                              <option value="owner">Propietario (Owner)</option>
                              <option value="employee">Empleado</option>
                            </select>
                          ) : (
                            <span className="font-mono text-xs">
                              {member.role === 'owner' ? 'Propietario' : 'Empleado'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            Activo
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {can(currentRole, 'members.manage') && (
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Revocar acceso"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: NOTIFICACIONES */}
        {tab === 'notifications' && (
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
            <h2 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-white/10">
              <Bell size={18} className="text-indigo-400" />
              <span>Notificaciones Automáticas y Eventos</span>
            </h2>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <div>
                  <span className="font-semibold text-white block">Aviso cuando el cliente visualiza el documento</span>
                  <span className="text-gray-400 text-[11px]">Envía un correo con la hora y la dirección IP de visualización</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyView}
                  onChange={(e) => setNotifyView(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <div>
                  <span className="font-semibold text-white block">Aviso inmediato tras firma electrónica</span>
                  <span className="text-gray-400 text-[11px]">Adjunta el certificado de aceptación SHA-256 en formato PDF</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifySign}
                  onChange={(e) => setNotifySign(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <div>
                  <span className="font-semibold text-white block">Alertas de cobros próximos a vencer</span>
                  <span className="text-gray-400 text-[11px]">Notificación 7 días antes de la fecha límite pactada</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyDue}
                  onChange={(e) => setNotifyDue(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* PESTAÑA: COPIA Y PORTABILIDAD */}
        {tab === 'portability' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-white/10">
                <Database size={18} className="text-indigo-400" />
                <span>Portabilidad y Copia de Seguridad Integral (RGPD art. 20)</span>
              </h2>

              <p className="text-xs text-gray-300 leading-relaxed">
                Descargue un archivo estructurado en formato JSON con la totalidad de los datos de su organización: datos fiscales, clientes, catálogo de partidas, documentos emitidos, registros de cobros y libro de auditoría inalterable.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExportFullOrg}
                  className="btn btn-primary btn-sm flex items-center gap-2 font-semibold cursor-pointer"
                >
                  <Download size={16} />
                  <span>Descargar Copia de Seguridad Completa (JSON)</span>
                </button>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-white/10">
                <FileCheck size={18} className="text-emerald-400" />
                <span>Declaración Responsable del Productor de Software</span>
              </h2>

              <p className="text-xs text-gray-300 leading-relaxed">
                Conforme a lo dispuesto en el artículo 29.2.j de la Ley 58/2003 General Tributaria y el RD 1007/2023, este sistema garantiza la integridad, inalterabilidad, trazabilidad y legibilidad de los registros de facturación sin interpolaciones ni omisiones.
              </p>

              <div className="pt-2">
                <Link
                  href="/legal/declaracion-responsable"
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  <span>Ver Declaración Responsable Pública</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: APARIENCIA Y DISEÑO */}
        {tab === 'appearance' && (
          <div className="space-y-6">
            {/* 1. Selector de Modo */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-white/10">
                <Sun size={18} className="text-indigo-400" />
                <span>Tema de Color y Visualización</span>
              </h2>
              <p className="text-xs text-gray-400">
                Seleccione el modo visual preferido. El modo Sistema sincroniza automáticamente con el sistema operativo sin parpadeo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {[
                  { id: 'light' as const, label: 'Modo Claro', desc: 'Fondo blanco papel y alto contraste diurno', icon: Sun },
                  { id: 'dark' as const, label: 'Modo Oscuro', desc: 'Obsidiana ejecutiva y descanso visual', icon: Moon },
                  { id: 'system' as const, label: 'Automático (Sistema)', desc: 'Detecta preferencia de su dispositivo', icon: Laptop },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = uiPrefs.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleUpdateUiPref('mode', m.id)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon size={18} className={isSelected ? 'text-indigo-400' : 'text-gray-400'} />
                        {isSelected && <span className="text-[11px] font-mono text-indigo-400 font-bold">ACTIVO</span>}
                      </div>
                      <h3 className="font-bold text-white text-sm">{m.label}</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-snug">{m.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Selector de Acento */}
            <div className="card p-6 space-y-4">
              <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
                <Palette size={18} className="text-[var(--accent-fg)]" />
                <span>Acento Cromático</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Personalice el tono de énfasis utilizado en botones primarios, enlaces y elementos destacados (todos verificados WCAG AA).
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-1">
                {[
                  { id: 'indigo' as const, label: 'Índigo' },
                  { id: 'azul' as const, label: 'Azul' },
                  { id: 'esmeralda' as const, label: 'Esmeralda' },
                  { id: 'grafito' as const, label: 'Grafito' },
                  { id: 'burdeos' as const, label: 'Burdeos' },
                  { id: 'corporativo' as const, label: 'Corporativo' },
                ].map((acc) => {
                  const isSelected = uiPrefs.accent === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleUpdateUiPref('accent', acc.id)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--accent-fg)] bg-[var(--accent-subtle)] font-bold text-[var(--text-primary)] shadow-sm'
                          : 'border-[var(--border-default)] bg-[var(--bg-surface-2)] hover:border-[var(--border-input)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full mx-auto mb-2 border border-[var(--border-subtle)] shadow-sm"
                        style={{ backgroundColor: `var(--accent)` }}
                        data-accent={acc.id !== 'corporativo' ? acc.id : undefined}
                      />
                      <span className="text-xs block">{acc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Densidad y Escala */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/10 space-y-4">
              <h2 className="font-bold text-white text-base pb-3 border-b border-white/10">
                Densidad y Accesibilidad de Lectura
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-2">Densidad de Filas y Tablas</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateUiPref('density', 'comfortable')}
                      className={`py-2 px-3 rounded-lg text-xs border cursor-pointer ${
                        uiPrefs.density === 'comfortable'
                          ? 'border-indigo-500 bg-indigo-500/15 text-white font-semibold'
                          : 'border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      Cómoda (40px)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateUiPref('density', 'compact')}
                      className={`py-2 px-3 rounded-lg text-xs border cursor-pointer ${
                        uiPrefs.density === 'compact'
                          ? 'border-indigo-500 bg-indigo-500/15 text-white font-semibold'
                          : 'border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      Compacta (32px)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-2">Escala Tipográfica</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { scale: 100 as const, label: '100% (Base)' },
                      { scale: 110 as const, label: '110% (Media)' },
                      { scale: 125 as const, label: '125% (Grande)' },
                    ].map((s) => (
                      <button
                        key={s.scale}
                        type="button"
                        onClick={() => handleUpdateUiPref('font_scale', s.scale)}
                        className={`py-2 px-2 rounded-lg text-xs border cursor-pointer ${
                          uiPrefs.font_scale === s.scale
                            ? 'border-indigo-500 bg-indigo-500/15 text-white font-semibold'
                            : 'border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04]">
                  <div>
                    <span className="font-semibold text-white text-xs block">Modo Alto Contraste</span>
                    <span className="text-gray-400 text-[11px]">Refuerza bordes de tablas e inputs a ratio 3:1 o superior</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uiPrefs.high_contrast}
                    onChange={(e) => handleUpdateUiPref('high_contrast', e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetUiDefaults}
                  className="btn btn-secondary btn-sm"
                >
                  Restablecer valores por defecto
                </button>
              </div>
            </div>

            {/* 4. Panel de Vista Previa en Vivo */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] space-y-4">
              <h3 className="font-bold text-[var(--text-primary)] text-sm pb-2 border-b border-[var(--border-subtle)]">
                Vista Previa en Vivo de Componentes
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary btn-sm">Botón Primario</button>
                <button type="button" className="btn btn-secondary btn-sm">Botón Secundario</button>
                <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success-fg)' }}>
                  Aceptado
                </span>
                <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning-fg)' }}>
                  Pendiente
                </span>
                <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info-fg)' }}>
                  Enviado
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
