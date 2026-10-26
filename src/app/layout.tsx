import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Presupuesto Express Enterprise · Gestión de Presupuestos y Facturación',
  description: 'Plataforma profesional de emisión de presupuestos, albaranes, facturas proforma y firma digital para empresas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`h-full antialiased dark ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full min-h-[100dvh] bg-[#08090E] text-[#F1F3F9] font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
