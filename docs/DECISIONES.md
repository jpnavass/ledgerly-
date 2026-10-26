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
8. `lucide-react`: Sistema iconográfico SVG vectorial ligero para interfaz y navegación de alta densidad, autorizado en la Fase 10.1 para garantizar iconografía accesible, sin dependencias pesadas ni fuentes de iconos que bloqueen el renderizado.
9. `jsqr` (devDependency): Decodificador de códigos QR implementado 100% en JavaScript/TypeScript sin dependencias binarias en C++ ni bindings nativos externos. Utilizado en la suite de pruebas unitarias (`pdf.test.ts`) para extraer y validar que el código QR incrustado en los PDFs generados es legible y contiene los parámetros oficiales exigidos por el Artículo 21 de la Orden HAC/1177/2024.

## Decisiones de Arquitectura y Desviaciones Técnicas

### 1. Versión de Next.js (16.4.3 vs 15)
- **Contexto:** La especificación inicial mencionaba Next.js 15. Durante la inicialización del entorno se integró la versión estable 16.4.3 con Turbopack y React 19.3.0.
- **Justificación:** Next.js 16.4.3 ofrece soporte optimizado para React 19 Compiler, resolución nativa con Node.js v22 (`--experimental-strip-types`), `cacheComponents: true` y `partialPrefetching: true`. El código no utiliza APIs obsoletas o experimentales no retrocompatibles, y la compilación de producción se ejecuta limpiamente sin advertencias.

### 2. Estructura de Rutas y Vista Pública `/ver/[id]`
- **Rutas directas en `src/app/` (`/ajustes`, `/clientes`, `/catalogo`, `/documentos`, etc.):**
  En Next.js App Router, los Route Groups con paréntesis como `(app)` son puramente organizativos y no alteran la URL pública. Se mantuvieron directamente en la raíz de `src/app/` para simplificar la jerarquía del proyecto, evitar anidamientos redundantes y hacer explícita la correspondencia archivo-URL.
- **Ruta `/ver/[id]`:**
  Implementada como vista pública compartida de sólo lectura para que clientes receptores puedan revisar el documento formateado en navegador sin necesidad de autenticarse en el panel de administración, complementando el flujo formal de aceptación y firma en `/firmar/[token]`.

### 3. Vigencia del Sistema de Temas, Acentos y Accesibilidad (Fase 10)
- **Confirmación:** La parametrización de acentos, la escala tipográfica `font_scale` (100%, 110%, 125%), la persistencia en cookie `pe_ui` y la extracción de tokens semánticos a `src/styles/tokens.css` forman parte íntegra de la **Fase 10** ("Sistema de Diseño Semántico y Accesibilidad WCAG 2.1 / 2.2 AA") de la versión 2 vigente de la especificación técnica.
- `globals.css` se redujo deliberadamente para delegar la semántica de color y variables a `tokens.css`, asegurando paridad exacta entre `@media (prefers-color-scheme: dark)` y el atributo `[data-theme="dark"]`.

### 4. Incorporación de `jsqr` en Desarrollo (`devDependencies`)
- **Contexto:** La normativa tributaria española (Orden HAC/1177/2024, Artículo 21) exige que toda factura emitida incorpore un código QR legible con una URL oficial para el cotejo en la sede de la Agencia Tributaria.
- **Decisión:** Para garantizar contractualmente que el PDF no contiene únicamente un dibujo simulado o estático sino una imagen QR válida y escaneable, se incorporó `jsqr` como dependencia exclusiva de desarrollo y pruebas.
- **Justificación:** A diferencia de alternativas basadas en `node-canvas` o `zbar` (que exigen librerías compartidas del sistema operativo como `libcairo` o `libzbar`), `jsqr` opera directamente sobre mapas de bytes sin dependencias nativas externas, garantizando que los tests se ejecuten de forma determinista y sin fallos en cualquier entorno (Windows, Linux, macOS o CI/CD).
