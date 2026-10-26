# Presupuesto Express Enterprise

Plataforma SaaS multiempresa de emisión y gestión de presupuestos técnicos, albaranes, facturas proforma, facturas ordinarias y facturas rectificativas, con cumplimiento del Real Decreto 1619/2012, Ley 11/2021 de Medidas de Prevención y Lucha contra el Fraude Fiscal, Real Decreto 1007/2023 (Veri*Factu) y firma electrónica eIDAS (Reglamento UE 910/2014).

## Requisitos del Sistema

- **Node.js:** Versión `>= 22.6.0` requerida (para soporte nativo de TypeScript type-stripping con `--experimental-strip-types` y `node:test` sin transpiladores externos).
- **NPM:** `>= 10.0.0`.
- **Base de datos:** PostgreSQL / Supabase con RLS (Row Level Security).

## Puesta en Marcha

```bash
# Instalación de dependencias
npm install

# Modo desarrollo (inicia en http://localhost:3000)
npm run dev

# Ejecución de la suite completa de tests y validaciones
npm test

# Compilación de producción y verificación de tipos estricta
npm run build
```

## Modos de Funcionamiento

1. **Modo Local (Desarrollo autónomo):**
   - Sin variables de entorno de Supabase configuradas, la aplicación inicia en modo local aislado en el navegador.
   - Arranca completamente vacía (sin datos ficticios). Permite dar de alta la organización, crear clientes, presupuestos y facturas de forma inmediata.

2. **Modo Producción (Supabase):**
   - Configurando las variables de entorno en `.env.local` (según `.env.example`), la aplicación se conecta a la base de datos PostgreSQL en la nube con RLS por organización, almacenamiento de PDFs y firmas en buckets privados, y autenticación por correo electrónico.

## Variables de Entorno

Copiar el archivo de plantilla `.env.example` a `.env.local` y definir los valores correspondientes:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave pública anónima de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Clave administrativa de servidor (solo en entorno seguro de servidor).
- `APP_URL`: Dominio base de la aplicación (ej. `https://app.tuempresa.com`).
- `CRON_SECRET`: Secreto de autorización para tareas programadas (caducidad de presupuestos).
- `STRIPE_SECRET_KEY`: Clave de API de Stripe para cobros y suscripciones.
- `STRIPE_WEBHOOK_SECRET`: Secreto para verificar la firma de eventos entrantes de Stripe.
- `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS`: IDs de precios de suscripción en Stripe.
- `RESEND_API_KEY` / `MAIL_FROM`: Clave de API y remitente para envío de códigos OTP y correos.
- `AEAT_CERT_PATH` / `AEAT_CERT_PASSWORD`: Certificado electrónico en servidor para envíos oficiales Veri*Factu.

## Migraciones de Base de Datos

Las migraciones de PostgreSQL se encuentran en `supabase/migrations/`:

- `0001_core.sql`: Tablas principales (`orgs`, `memberships`, `licenses`, `clients`, `documents`, `payments`, `expenses`).
- `0002_rls.sql`: Políticas de aislamiento multiempresa por `org_id` y roles (`owner`, `employee`).
- `0003_functions.sql`: Funciones transaccionales atómicas (`next_document_number`, `issue_document`, `expire_quotes`).
- `0004_storage.sql`: Configuración de buckets seguros (`pdfs`, `signatures`, `receipts`, `logos`).

## Estructura de Scripts

- `npm run dev`: Servidor local de desarrollo en puerto 3000 con Next.js 15 Turbopack.
- `npm test`: Batería completa de pruebas unitarias, de integración, verificación de alcance y limpieza de código.
- `npm run build`: Compilación y verificación estricta de tipos de TypeScript.
- `node scripts/check-clean.mjs`: Comprobación de que no existen términos inapropiados o dependencias ficticias en el código fuente.
- `node scripts/verify-scope.mjs`: Auditoría de modificaciones acotadas estrictamente a `presupuesto-express-v2`.

## Normativa y Documentación

- [docs/CUMPLIMIENTO.md](docs/CUMPLIMIENTO.md): Mapeo reglamentario (BOE, AEAT, RD 1619/2012, Ley Antifraude, eIDAS).
- [docs/DECISIONES.md](docs/DECISIONES.md): Registro de decisiones de diseño y dependencias.
