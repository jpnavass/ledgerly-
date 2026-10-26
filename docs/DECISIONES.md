# Registro de Decisiones de Arquitectura — Presupuesto Express Enterprise

## Línea Base de Arquitectura (Fase 0)

- **Entorno de Ejecución:** Node.js `>= 22.6.0` (entorno verificado en v22.18.0) con motor V8 nativo y soporte nativo de type-stripping para TypeScript (`--experimental-strip-types`) sin necesidad de transpiladores externos (introducido oficialmente en Node.js v22.6.0).
- **Framework Principal:** Next.js 16.4.3 (React 19.3.0, Turbopack, App Router). Se utiliza la versión 16.4.3 instalada por el scaffolding del proyecto para aprovechar el soporte nativo de React 19, Turbopack, componentes cacheados (`cacheComponents: true`) y pre-renderizado parcial (`partialPrefetching: true`), garantizando la compilación más rápida y optimizaciones de servidor.
- **Estilo y Maquetación:** Tailwind CSS v4 con variables CSS semánticas en `src/styles/tokens.css` y temas conmutables.
- **Aislamiento Multiempresa:** RLS (Row Level Security) nativo en Postgres / Supabase filtrado por `org_id`.
- **Aritmética Monetaria:** Enteros en céntimos (`bigint` en SQL, `number` seguro en JS) para erradicar cualquier imprecisión de coma flotante.
- **Cumplimiento Legal:**
  - Real Decreto 1619/2012 (Reglamento de Facturación).
  - Ley 11/2021 y Real Decreto 1007/2023 (Sistemas informáticos de facturación y Veri*Factu).
  - Reglamento (UE) Nº 910/2014 (eIDAS) para firma electrónica con evidencias criptográficas SHA-256.

## Justificación de Dependencias Permitidas

1. `@supabase/supabase-js` y `@supabase/ssr`: Cliente oficial de persistencia, autenticación y storage con soporte SSR en Next.js App Router.
2. `zod`: Esquemas de validación estricta compartidos entre cliente, server actions y llamadas API.
3. `@react-pdf/renderer`: Generación determinista de documentos PDF en servidor en formato A4 estándar.
4. `qrcode`: Generación del código QR tributario según especificación técnica oficial de la Orden HAC/1177/2024.
5. `stripe`: Gestión de suscripciones y facturación periódica multi-tier.
6. `resend`: Envío de códigos OTP de firma y notificaciones documentales por correo electrónico.
7. `@tanstack/react-query`: Caché reactiva y sincronización de datos en cliente.
