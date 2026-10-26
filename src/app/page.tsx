'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  FileText,
  Clock,
  ArrowRight,
  Receipt,
  Truck,
  FileCheck2,
  Smartphone,
  Lock,
  Cloud,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  HelpCircle,
  BarChart3,
  Check,
  Plus,
  Minus,
} from 'lucide-react';

interface DemoItem {
  id: string;
  name: string;
  unitPrice: number;
  qty: number;
  unit: string;
  included: boolean;
}

export default function LandingPortalPage() {
  // Estado de la demostración interactiva
  const [demoItems, setDemoItems] = useState<DemoItem[]>([
    {
      id: '1',
      name: 'Demolición y retirada de escombros autorizada',
      unitPrice: 420,
      qty: 1,
      unit: 'partida',
      included: true,
    },
    {
      id: '2',
      name: 'Instalación eléctrica completa y boletín oficial',
      unitPrice: 850,
      qty: 1,
      unit: 'partida',
      included: true,
    },
    {
      id: '3',
      name: 'Alicatado y solado porcelánico',
      unitPrice: 65,
      qty: 14,
      unit: 'm²',
      included: true,
    },
    {
      id: '4',
      name: 'Fontanería certificada y saneamiento',
      unitPrice: 540,
      qty: 1,
      unit: 'partida',
      included: true,
    },
    {
      id: '5',
      name: 'Pintura plástica lisa lavable blanco mate',
      unitPrice: 380,
      qty: 1,
      unit: 'partida',
      included: false,
    },
  ]);

  const [applyVat, setApplyVat] = useState(true);
  const [applyIrpf, setApplyIrpf] = useState(false);

  // Modificadores de la demostración
  const toggleItem = (id: string) => {
    setDemoItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, included: !item.included } : item))
    );
  };

  const updateQty = (id: string, delta: number) => {
    setDemoItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextQty = Math.max(1, item.qty + delta);
        return { ...item, qty: nextQty };
      })
    );
  };

  // Cálculos de la demostración
  const demoTotals = useMemo(() => {
    const base = demoItems.reduce((acc, item) => {
      if (!item.included) return acc;
      return acc + item.unitPrice * item.qty;
    }, 0);

    const vat = applyVat ? base * 0.21 : 0;
    const irpf = applyIrpf ? base * 0.15 : 0;
    const total = base + vat - irpf;

    return { base, vat, irpf, total };
  }, [demoItems, applyVat, applyIrpf]);

  const formatEur = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Calculadora de ahorro
  const [quotesPerWeek, setQuotesPerWeek] = useState(8);
  const [minutesPerQuote, setMinutesPerQuote] = useState(25);
  const [hourlyRate, setHourlyRate] = useState(30);

  const savings = useMemo(() => {
    const weeklyMinutesSaved = quotesPerWeek * (minutesPerQuote - 2);
    const monthlyHoursSaved = Math.round((weeklyMinutesSaved * 4.33) / 60);
    const monthlyEuroSaved = monthlyHoursSaved * hourlyRate;
    return {
      hours: monthlyHoursSaved,
      euros: monthlyEuroSaved,
    };
  }, [quotesPerWeek, minutesPerQuote, hourlyRate]);

  // Pasarela Stripe directa desde la landing
  const [stripeLoading, setStripeLoading] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const handleCheckout = async (plan: 'pro' | 'business') => {
    setStripeLoading(plan);
    setStripeError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          org_id: 'org_ledgerly_portal',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al conectar con la pasarela de Stripe');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setStripeError(err instanceof Error ? err.message : 'Error al iniciar suscripción');
    } finally {
      setStripeLoading(null);
    }
  };

  // Preguntas frecuentes
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faqs = [
    {
      q: '¿Cumple Ledgerly con la nueva normativa Veri*factu y la Ley Antifraude 11/2021?',
      a: 'Sí, al 100%. Ledgerly implementa encadenamiento criptográfico SHA-256 inviolable (cada factura firma la anterior), huellas digitales verificables, generación oficial de códigos QR según el Real Decreto 1007/2023 y registro inalterable append-only.',
    },
    {
      q: '¿Cómo funciona la firma digital del cliente? ¿Tiene validez jurídica?',
      a: 'Totalmente. Cada presupuesto tiene un enlace público cifrado único. El cliente recibe un código OTP seguro por SMS o correo y firma en pantalla. Se registra su dirección IP, agente de usuario y sello de tiempo conforme al Reglamento Europeo eIDAS.',
    },
    {
      q: '¿Puedo usarlo desde la furgoneta o en la obra con el móvil?',
      a: 'Exactamente para eso está diseñado. La interfaz es completamente responsive, ultrarrápida y táctil. Puedes preparar un presupuesto en 30 segundos de pie junto al cliente y enviárselo por WhatsApp antes de arrancar la furgoneta.',
    },
    {
      q: '¿Qué ocurre si ya tengo clientes y tarifas creadas?',
      a: 'Dispones de un catálogo inteligente de partidas reutilizables y gestión de clientes. También puedes importar y exportar todos tus datos en JSON en cualquier momento conforme al artículo 20 del RGPD.',
    },
    {
      q: '¿Hay permanencia en los planes de pago?',
      a: 'Ninguna permanencia. Puedes suscribirte mensualmente y cancelar con un solo clic desde tu panel o el portal de Stripe cuando desees.',
    },
    {
      q: '¿Quién está detrás de Ledgerly?',
      a: 'Desarrollado y operado en Málaga por Ledgerly (NIF 77685568D, Horacio Lengo 18). Soporte técnico directo y cercano por WhatsApp (+34 711 22 34 52) y correo electrónico.',
    },
  ];

  const whatsappMessage = encodeURIComponent(
    `Hola, me gustaría probar Ledgerly para gestionar mis presupuestos y facturación.`
  );

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans">
      {/* Barra de Navegación Superior */}
      <header className="sticky top-0 z-50 bg-[#070d18]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-all">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white block">
                Ledgerly
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block -mt-1 font-mono">
                Facturación &amp; Veri*factu
              </span>
            </div>
          </Link>

          {/* Menú de Navegación */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#como-funciona" className="hover:text-indigo-400 transition-colors">
              Cómo Funciona
            </a>
            <a href="#caracteristicas" className="hover:text-indigo-400 transition-colors">
              Qué Incluye
            </a>
            <a href="#ahorro" className="hover:text-indigo-400 transition-colors">
              Calculadora
            </a>
            <a href="#precios" className="hover:text-indigo-400 transition-colors">
              Planes y Precios
            </a>
            <a href="#preguntas" className="hover:text-indigo-400 transition-colors">
              Dudas
            </a>
          </nav>

          {/* Botones de Acción */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all border border-slate-700/60"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/registro"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5"
            >
              <span>Empezar Gratis</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Luces y Gradientes de Fondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-blue-600/10 to-transparent blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Columna Izquierda: Mensaje y Propuesta de Valor */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Hecho en Málaga para autónomos, gremios y pymes</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
                Presupuestos, Facturas y Firma en{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500">
                  30 segundos
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Hazlos desde la furgoneta o en la obra, con tu logotipo, en PDF oficial y con firma
                electrónica del cliente. Conforme a la <strong>Ley 11/2021 Antifraude</strong> y el{' '}
                <strong>sistema Veri*factu de la AEAT</strong>.
              </p>

              {/* Botones CTA */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href="/registro"
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Zap size={16} />
                  <span>Crear Cuenta Gratis</span>
                </Link>

                <a
                  href={`https://wa.me/34711223452?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-emerald-600/25 hover:shadow-emerald-600/35 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                  <MessageCircle size={16} />
                  <span>WhatsApp: +34 711 22 34 52</span>
                </a>
              </div>

              {/* Señales de Confianza */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Sin permanencia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Firma legal eIDAS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Homologado Veri*factu</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Demostración Interactiva En Vivo */}
            <div className="lg:col-span-5">
              <div className="bg-[#0f172a]/90 border border-slate-700/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Simulador Interactivo
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase font-mono tracking-wider border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    En Vivo
                  </span>
                </div>

                {/* Lista de Partidas Interactivas */}
                <div className="divide-y divide-slate-800/60 my-4 space-y-2">
                  {demoItems.map((item) => (
                    <div
                      key={item.id}
                      className={`pt-2 flex items-center justify-between gap-3 transition-opacity ${
                        item.included ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() => toggleItem(item.id)}
                          className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                        />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-200 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatEur(item.unitPrice)} / {item.unit}
                          </p>
                        </div>
                      </div>

                      {/* Contador de Cantidad */}
                      <div className="flex items-center gap-2 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          disabled={!item.included || item.qty <= 1}
                          className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          aria-label="Disminuir"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold font-mono text-white min-w-[16px] text-center">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          disabled={!item.included}
                          className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          aria-label="Aumentar"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Toggles de Impuestos */}
                <div className="flex items-center gap-2 my-4 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setApplyVat(!applyVat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      applyVat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    IVA 21 %
                  </button>
                  <button
                    onClick={() => setApplyIrpf(!applyIrpf)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      applyIrpf
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    Retención IRPF 15 %
                  </button>
                </div>

                {/* Desglose de Totales */}
                <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80 font-mono">
                  <div className="flex justify-between">
                    <span>Base imponible:</span>
                    <span className="text-slate-200">{formatEur(demoTotals.base)}</span>
                  </div>
                  {applyVat && (
                    <div className="flex justify-between text-indigo-300">
                      <span>IVA (21%):</span>
                      <span>+{formatEur(demoTotals.vat)}</span>
                    </div>
                  )}
                  {applyIrpf && (
                    <div className="flex justify-between text-amber-300">
                      <span>Retención IRPF (15%):</span>
                      <span>-{formatEur(demoTotals.irpf)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                    <span className="font-sans">Total Oficial:</span>
                    <span className="text-emerald-400 font-mono">{formatEur(demoTotals.total)}</span>
                  </div>
                </div>

                {/* Acciones de la Demostración */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Link
                    href="/registro"
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl text-center shadow-lg transition-all"
                  >
                    Guardar en la App
                  </Link>
                  <a
                    href={`https://wa.me/34711223452?text=${encodeURIComponent(
                      `Hola, he simulado este presupuesto en Ledgerly con total ${formatEur(
                        demoTotals.total
                      )} y quiero saber más.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl text-center shadow-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ESTADÍSTICAS / SOCIAL PROOF */}
      <section className="border-y border-slate-800 bg-[#0a1122]/70 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-black text-indigo-400 font-mono">30 s</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Por presupuesto en obra</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-black text-emerald-400 font-mono">100%</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Conforme Veri*factu y Ley 11/2021</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-black text-purple-400 font-mono">0 €</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Para comenzar a emitir</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-black text-blue-400 font-mono">eIDAS</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Firma legal con sello de tiempo</p>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
            Flujo Documental Rápido
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Del móvil al cliente y al cobro en 3 pasos
          </h2>
          <p className="text-slate-400 text-sm">
            Diseñado para trabajar de pie, con prisa y sin necesidad de ordenador.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-[#0f172a]/70 border border-slate-800 space-y-4 hover:border-indigo-500/40 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black font-mono text-xl">
              1
            </div>
            <h3 className="text-xl font-bold text-white">Apuntas y Creas</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Eliges el cliente y seleccionas las partidas de tu catálogo con sus precios e impuestos.
              Todo lo que usas habitualmente se guarda para reutilizarlo.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#0f172a]/70 border border-slate-800 space-y-4 hover:border-indigo-500/40 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black font-mono text-xl">
              2
            </div>
            <h3 className="text-xl font-bold text-white">Envías y Firma el Cliente</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Le compartes el presupuesto por WhatsApp o email con su enlace seguro. El cliente lo revisa
              y lo firma en pantalla con verificación OTP y validez legal europea eIDAS.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#0f172a]/70 border border-slate-800 space-y-4 hover:border-indigo-500/40 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-black font-mono text-xl">
              3
            </div>
            <h3 className="text-xl font-bold text-white">Facturas y Cobras</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Conviertes el presupuesto aprobado en albarán o factura Veri*factu en 1 clic. Controlas
              anticipos, hitos de pago y vencimientos bancarios desde tu tesorería.
            </p>
          </div>
        </div>
      </section>

      {/* QUÉ INCLUYE (CARACTERÍSTICAS) */}
      <section id="caracteristicas" className="py-20 bg-[#080e1c] border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
              Capacidades Completas
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Todo lo que tu empresa necesita para facturar
            </h2>
            <p className="text-slate-400 text-sm">
              Potencia enterprise con la sencillez de una aplicación móvil.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 flex gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 h-fit">
                <FileText size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Presupuestos y Facturas PDF</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generación instantánea con tu logotipo, colores corporativos y desglose formal de partidas.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 flex gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 h-fit">
                <ShieldCheck size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Veri*factu y Ley 11/2021</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Encadenamiento inalterable SHA-256, código QR oficial de la AEAT y registro de auditoría legal.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 flex gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 h-fit">
                <Lock size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Firma Electrónica eIDAS</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Firma digital del cliente con evidencias de IP, sellado de tiempo y código OTP por WhatsApp/email.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 flex gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 h-fit">
                <BarChart3 size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Tesorería y Vencimientos</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Control de hitos de cobro, plazos de ejecución, vencimientos bancarios y flujo de caja en tiempo real.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 flex gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 h-fit">
                <Cloud size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Sincronización en la Nube</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Base de datos Postgres segura con Supabase. Trabaja en el móvil y continúa en el ordenador sin perder nada.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 flex gap-4">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 h-fit">
                <Smartphone size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Acceso Móvil sin Instalación</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Funciona en cualquier navegador de móvil, tablet o PC. Puedes añadirla como app a tu pantalla de inicio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALCULADORA DE AHORRO */}
      <section id="ahorro" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
            Calculadora de Rendimiento
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            ¿Cuánto tiempo y dinero te devuelve Ledgerly?
          </h2>
          <p className="text-slate-400 text-sm">
            Mueve los deslizadores con los datos de tu empresa.
          </p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 lg:p-12 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Presupuestos y facturas por semana</span>
                <span className="text-indigo-400 font-mono">{quotesPerWeek} documentos</span>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                value={quotesPerWeek}
                onChange={(e) => setQuotesPerWeek(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Minutos que tardas en preparar cada uno</span>
                <span className="text-indigo-400 font-mono">{minutesPerQuote} minutos</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={minutesPerQuote}
                onChange={(e) => setMinutesPerQuote(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Precio estimado de tu hora de trabajo</span>
                <span className="text-indigo-400 font-mono">{hourlyRate} € / hora</span>
              </div>
              <input
                type="range"
                min="15"
                max="100"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 text-center space-y-4">
            <div>
              <span className="text-4xl sm:text-5xl font-black text-indigo-400 font-mono">
                {savings.hours} h
              </span>
              <p className="text-xs text-slate-300 mt-1">Horas al mes que recuperas para tu vida</p>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                {formatEur(savings.euros)}
              </span>
              <p className="text-xs text-slate-400 mt-1">Valor mensual recuperado para tu negocio</p>
            </div>
          </div>
        </div>
      </section>

      {/* PLANES Y PRECIOS */}
      <section id="precios" className="py-20 bg-[#080e1c] border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
              Precios Claros y Transparentes
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Elige el plan adaptado a tu volumen
            </h2>
            <p className="text-slate-400 text-sm">
              Comienza gratis hoy mismo o contrata la solución profesional con Stripe en 1 minuto.
            </p>
          </div>

          {stripeError && (
            <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center">
              {stripeError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Plan Gratuito */}
            <div className="p-8 rounded-3xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Plan Básico Gratuito</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">0 €</span>
                  <span className="text-xs text-slate-400">/ mes</span>
                </div>
                <p className="text-xs text-slate-400">
                  Ideal para empezar a emitir tus primeros presupuestos formales.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Hasta 5 documentos al mes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Presupuestos y facturas en PDF</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>1 usuario</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Exportación JSON conforme RGPD</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/registro"
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl text-center transition-all block border border-slate-700"
              >
                Empezar Gratis
              </Link>
            </div>

            {/* Plan Profesional */}
            <div className="p-8 rounded-3xl bg-[#0f172a] border-2 border-indigo-500/60 relative flex flex-col justify-between space-y-6 shadow-2xl shadow-indigo-600/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                Más Popular
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Plan Profesional</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-indigo-400 font-mono">19 €</span>
                  <span className="text-xs text-slate-400">/ mes</span>
                </div>
                <p className="text-xs text-slate-400">
                  Para autónomos y pymes que necesitan firma digital de clientes y control de caja.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Hasta 100 documentos mensuales</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Firma electrónica eIDAS con OTP</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Módulo de tesorería y cobros</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Hasta 5 usuarios de equipo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Sincronización en la nube</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/registro?plan=pro"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl text-center shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap size={15} />
                <span>Contratar Profesional</span>
              </Link>
            </div>

            {/* Plan Empresa */}
            <div className="p-8 rounded-3xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Plan Empresa</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">49 €</span>
                  <span className="text-xs text-slate-400">/ mes</span>
                </div>
                <p className="text-xs text-slate-400">
                  Para empresas consolidadas con alto volumen y equipo técnico.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Documentos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Hasta 25 usuarios concurrentes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Integración Veri*factu telemática</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Auditoría SHA-256 inalterable</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Soporte prioritario directo</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/registro?plan=business"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl text-center shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap size={15} />
                <span>Contratar Empresa</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DUDAS FRECUENTES (FAQ) */}
      <section id="preguntas" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
            Resolvemos tus Dudas
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Preguntas Frecuentes</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl bg-[#0f172a] border border-slate-800 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-white hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp size={18} className="text-indigo-400 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* BANNER FINAL DE ACCIÓN */}
      <section className="py-20 border-t border-slate-800 bg-gradient-to-b from-[#080e1c] to-[#050914] text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Pruébala hoy en tu móvil sin ningún compromiso
          </h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Se acabaron las horas nocturnas haciendo presupuestos en papel o Word tras un largo día de trabajo.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/registro"
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Empezar Ahora Gratis
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm rounded-xl transition-all border border-slate-700"
            >
              Acceder a mi Panel
            </Link>
            <a
              href={`https://wa.me/34711223452?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-emerald-600/25 transition-all flex items-center gap-2"
            >
              <MessageCircle size={16} />
              <span>Hablar por WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* PIE DE PÁGINA (FOOTER) */}
      <footer className="bg-[#03060c] border-t border-slate-900 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <ShieldCheck size={16} />
              </div>
              <span className="font-bold text-white text-sm">Ledgerly</span>
              <span>· Soluciones oficiales de facturación y presupuestos</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-slate-400">
              <a href="tel:+34711223452" className="hover:text-white transition-colors">
                +34 711 22 34 52
              </a>
              <span>·</span>
              <a href="mailto:presupuestoxpress@gmail.com" className="hover:text-white transition-colors">
                presupuestoxpress@gmail.com
              </a>
              <span>·</span>
              <span>Horacio Lengo 18, Málaga (NIF 77685568D)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-900 text-[11px]">
            <p>
              &copy; {new Date().getFullYear()} Ledgerly. Conforme a la Ley 11/2021 de medidas de prevención contra el fraude fiscal y Real Decreto 1619/2012.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/legal/declaracion-responsable"
                className="text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Declaración Responsable del Productor
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
