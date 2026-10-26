import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { parseUiCookie, UI_COOKIE_NAME } from '@/lib/theme/cookie';
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
  title: 'Ledgerly · Gestión de Presupuestos, Facturación y Veri*factu',
  description: 'Plataforma oficial de presupuestos, albaranes, facturación certificada Veri*factu y firma electrónica para empresas.',
};

export const instant = false;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(UI_COOKIE_NAME)?.value;
  const prefs = parseUiCookie(rawCookie ? `${UI_COOKIE_NAME}=${rawCookie}` : null);

  const htmlProps: Record<string, string | undefined> = {
    lang: 'es',
    className: `h-full antialiased ${plusJakartaSans.variable} ${jetbrainsMono.variable}`,
  };

  if (prefs.mode !== 'system') {
    htmlProps['data-theme'] = prefs.mode;
  }
  if (prefs.accent) {
    htmlProps['data-accent'] = prefs.accent;
  }
  if (prefs.density === 'compact') {
    htmlProps['data-density'] = 'compact';
  }
  if (prefs.high_contrast) {
    htmlProps['data-contrast'] = 'high';
  }

  return (
    <html
      {...htmlProps}
      style={prefs.font_scale !== 100 ? ({ '--font-scale': String(prefs.font_scale / 100) } as React.CSSProperties) : undefined}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FFFFFF" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B0D12" />
      </head>
      <body className="min-h-full min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-primary)] font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
