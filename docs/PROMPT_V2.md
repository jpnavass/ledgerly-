<USER_REQUEST>
Adjunto la versión 2 del prompt técnico. Sustituye a la anterior.

Antes de escribir código, haz una auditoría y NO modifiques nada todavía:

1. Recorre las fases 0 a 12 y, para cada una, marca Hecha, Parcial o Pendiente.
   Para cada marca indica la evidencia: archivos concretos y tests que lo comprueban.
   No des nada por hecho sin comprobarlo en el código.
2. Ejecuta `npm test` y `npm run build` y pega la salida completa.
3. Ejecuta las comprobaciones de la sección 5 (definición de terminado) que se puedan
   lanzar por comando y pega los resultados.
4. Lista qué cambios de la v2 no están aplicados (Fase 10 de temas y diseño,
   certificados por organización, verificador de colores).

Entrégame el informe y para. Cuando yo lo confirme, completarás solo lo Parcial y
lo Pendiente, fase por fase, sin rehacer lo que ya cumple los criterios de aceptación.

# PROMPT TÉCNICO — Presupuesto Express Enterprise: versión de producción 100 % funcional (v2)

> **Versión 2:** esta versión sustituye a la anterior. Cambios: (1) la Fase 10 es ahora un sistema de diseño profesional con temas claro / oscuro / sistema, acentos, densidad y contraste alto; (2) los certificados de la AEAT pasan a gestionarse por organización y cifrados (Fases 3.5 y 6.4); (3) nuevas reglas de verificación de colores y contraste (Fase 12).

> Entrega este documento completo al agente. Trabaja por fases, en orden. Al cerrar cada fase deben pasar `npm test` y `npm run build` antes de empezar la siguiente. No des por terminada ninguna fase sin cumplir sus criterios de aceptación.

---

## 0. REGLAS INVIOLABLES

1. **Alcance de carpetas.** Todo el trabajo vive exclusivamente dentro de `presupuesto-express-v2/`. No se lee, modifica, mueve ni borra nada de la carpeta `bot ventas` ni de ninguna otra ruta hermana. Al final se ejecuta `scripts/verify-scope.mjs` (Fase 12) que falla si `git diff --name-only` contiene rutas fuera de `presupuesto-express-v2/`.
2. **Cero menciones a IA.** Ni en la interfaz, ni en el código, ni en comentarios, commits, README, nombres de variables, textos de error o metadatos. Prohibido: "IA", "inteligencia artificial", "prompt", "copilot", "asistente", "GPT", "Claude", "Gemini", "Antigravity", "generado automáticamente". El producto debe leerse como un ERP contable corporativo escrito por un equipo humano. La Fase 12 añade un test que escanea `src/` y falla si aparece cualquiera de esos términos.
3. **Cero datos de ejemplo.** Se elimina `src/lib/mock-data.ts` y toda referencia a `MOCK_*`, `CURRENT_ORGANIZATION`, `OFFICIAL_DOCUMENT_ITEMS`. No quedan clientes, documentos, importes, IPs, NIF, fechas ni textos de demostración en código de producción. Un usuario nuevo ve la aplicación **vacía**, con estados vacíos útiles (Fase 11). Los datos de prueba existen únicamente dentro de `src/**/__tests__/` o `tests/`.
3. **Cero `TODO`, `FIXME`, `placeholder`, `lorem`, `stub` o funciones que devuelvan valores fijos.** Si una capacidad depende de un servicio externo (certificado, claves, proveedor de correo), se implementa completa detrás de una interfaz, con configuración por variables de entorno y un error explícito y claro si falta la configuración. Nunca con valores inventados.
4. **Dinero en céntimos enteros** en todo el sistema (tipos, BD, cálculos, API). Prohibido `number` decimal para importes. Los porcentajes (`vat_rate`, `irpf_rate`, `discount_pct`, recargo) pueden ser decimales (p. ej. 5.2) pero nunca se multiplican por floats acumulados: el redondeo se aplica en puntos definidos (Fase 1).
5. **Estética y stack.** Next.js 15 (App Router, Turbopack, React 19), Tailwind v4 + CSS propio. La interfaz se rediseña como **ERP contable corporativo profesional** con **modo claro, modo oscuro y modo sistema** conmutables por el usuario (Fase 10). Esta regla y la Fase 10 sustituyen a cualquier instrucción anterior de mantener la paleta o el estilo Fintech / Glassmorphism del prototipo. Ningún componente usa colores literales: todo pasa por tokens de diseño.
6. **Dependencias nuevas permitidas (únicas):** `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `@react-pdf/renderer`, `qrcode`, `stripe`, `resend`, `@tanstack/react-query`, `lucide-react`. Cualquier otra requiere justificarse por escrito en `docs/DECISIONES.md`.
7. **Tests nativos.** Se mantiene `node --test`. La lógica de negocio debe ser pura y testeable sin navegador ni red (ver Fase 0).
8. **Idioma.** Interfaz, mensajes de error, validaciones y textos legales en español de España. Código e identificadores técnicos como están (inglés para tipos/campos de BD ya existentes).
9. **No inventar normativa.** Los requisitos legales de la Fase 6 se implementan siguiendo los textos oficiales (AEAT/BOE) citados en `docs/CUMPLIMIENTO.md`. Donde el agente no pueda verificar un formato exacto, lo deja aislado en un módulo con tests de vectores y lo documenta; no lo improvisa.

---

## 1. OBJETIVO Y RESUMEN

Convertir el prototipo actual (persistencia en `localStorage`, datos de demostración, hash simulado, numeración en cliente) en un SaaS multiempresa real para emitir **presupuestos, albaranes, proformas, facturas y facturas rectificativas**, con:

- Backend persistente multiusuario (Postgres/Supabase) con aislamiento por organización (RLS), roles y licencias.
- Numeración correlativa **sin huecos y sin duplicados**, asignada de forma atómica en servidor.
- Ciclo de vida documental con máquina de estados, conversión entre documentos e **inmutabilidad** de lo emitido/firmado.
- Cálculo fiscal correcto (desglose por tipo impositivo, IRPF, recargo de equivalencia, opcionales, capítulos, margen).
- Registro de facturación inalterable: huella SHA-256 encadenada, código QR, registro de eventos append-only y preparación para Verifactu.
- Firma electrónica del cliente mediante enlace público seguro, con paquete de evidencias verificable.
- PDF real (A4) con huella y QR, almacenado y con hash.
- Tesorería (hitos de cobro, cobros, vencimientos), gastos y rentabilidad.
- Interfaz profesional, responsive y accesible, con modo claro, oscuro y automático (preferencia persistente por usuario), sin elementos de demostración.

---

## 2. DIAGNÓSTICO DEL CÓDIGO ACTUAL (a corregir)

| ID | Archivo | Problema |
|----|---------|----------|
| H-01 | `src/lib/store.ts` | Importa `./mock-data`; los getters hacen fallback a `MOCK_*`; `getPayments` y `getAuditEvents` contienen importes, NIF, IP y fechas hardcodeados. |
| H-02 | `store.ts › createNewDocument` | `org_id: 'org-001'` fijo; crea una partida de 1.850,00 € por defecto; `valid_until` fijo `2026-11-30`; `notes_public` fijo con cláusula de garantía; `clients[0]` como cliente por defecto si no existe `client_id` (asigna cliente equivocado); id `doc-${Date.now()}` colisionable. |
| H-03 | `store.ts` | Número = `max + 1` calculado en el navegador: duplicados con dos pestañas/usuarios, huecos al borrar, asignado ya en borrador. |
| H-04 | `store.ts › saveDocument` | Permite editar documentos aceptados/facturados; no valida transiciones de estado ni líneas; no versiona. |
| H-05 | `store.ts › convertDocument` | Copia las líneas con `document_id` del origen (spread); no rellena `converted_from`; no actualiza el origen; no existe presupuesto→factura, proforma→factura ni rectificativa. |
| H-06 | `store.ts › signDocument` | Hash con `Math.random()` (no es SHA-256 ni liga el contenido); fecha tomada del cliente; no captura IP ni user-agent; texto "sello de tiempo eIDAS" afirma algo falso (un sello cualificado exige un prestador cualificado); se puede firmar en cualquier estado y firmar dos veces; `Document` no tiene campos del firmante. |
| H-07 | `store.ts` (audit) | Registro mutable en `localStorage`, editable desde DevTools, sin encadenado, solo registra firmas. |
| H-08 | `store.ts` / `index.ts` | `PaymentRecord` duplica `Payment` con campos divergentes; `getPayments` escribe en storage dentro de un getter; variable `docs` sin usar; no se valida que los hitos sumen el 100 % ni que cuadren con `total_cents`. |
| H-09 | `src/types/index.ts` | Campos duplicados (`document_id`/`doc_id`, `position`/`sort_order`) en `DocumentItem` y `Payment`; faltan estados de factura (emitida, cobrada, anulada), tipo rectificativa, token público, firmante, fecha de expedición/operación, forma de pago/IBAN, motivo de exención, domicilio fiscal del cliente; `fiscal_data: Record<string, unknown>` sin tipar. |
| H-10 | `src/lib/calculations.ts` | `calcDocumentTotals` duplica la lógica de línea en vez de reutilizarla; el IVA se redondea por línea pero la factura exige desglose por tipo impositivo (la cuota puede diferir en céntimos); sin recargo de equivalencia; sin validación de entradas (NaN, negativos, tipos fuera de 0/4/10/21); `formatCents` usa `toFixed` sobre una división flotante (usar aritmética entera); sin subtotales por capítulo; `cost_cents` sin usar (no hay margen). |
| H-11 | Arquitectura | Solo `localStorage`: no hay multiusuario, `Org/Membership/License` sin uso, sin autenticación ni roles, sin copias; las firmas en base64 dentro de JSON agotan la cuota (~5 MB). |
| H-12 | `store.ts` | Lecturas de `localStorage` durante el render y getters que devuelven un array nuevo en cada llamada: provocan desajustes de hidratación y bucles con `useSyncExternalStore`; el evento `pe_store_updated` no sincroniza pestañas (falta escuchar `storage`). |
| H-13 | `store.ts` | Ids con `v4Fallback()`/`Date.now()`; usar `crypto.randomUUID()` (o `gen_random_uuid()` en BD). |
| H-14 | Dominio | Nada transita a `expired` ni a `viewed`: no hay caducidad automática ni enlace público de visualización. |
| H-15 | Dominio | `pdf_url`/`pdf_hash` sin generación; solo hay CSS de impresión. |
| H-16 | Dominio | `Expense` sin store ni UI; no hay cálculo de rentabilidad. |
| H-17 | `src/app/globals.css` | En `@media print` se ocultan globalmente `header, footer, nav, aside, .badge`: si el documento oficial usa `<header>`/`<footer>` (cabecera del emisor, pie legal) o badges, **desaparecen al imprimir**. Sin responsive (`.sidebar` fijo + `.main-content` con `margin-left` fijo: inservible en móvil/tablet); `--sidebar-collapsed-width` sin clase asociada; `--text-tertiary` (#60667C) ≈ 3,4:1 sobre el fondo (falla WCAG AA); sin `prefers-reduced-motion`; `transform` en `:hover` también en táctil; `100vh` en vez de `dvh`; sin estilos de disabled/loading/skeleton/empty/toast/modal/tablas; sin `tabular-nums` para importes; las fuentes referenciadas no se cargan en este archivo (verificar `next/font`). |
| H-18 | Cumplimiento | No existe registro de facturación (huella encadenada, QR, registro de eventos), ni bloqueo de borrado, ni conservación ≥ 6 años, ni validación de NIF/CIF/NIE/IBAN, ni página de declaración responsable del productor. |
| H-19 | `store.ts` | Cláusula "Garantía … conforme a LOE" hardcodeada como texto por defecto: es un compromiso contractual que depende de cada empresa. Debe venir de ajustes de la organización. |
| H-20 | `store.ts` | Usa el alias `@/types` e imports relativos sin extensión: no es ejecutable bajo `node --test` nativo, así que la lógica de negocio más crítica (numeración, conversión, firma) no se puede testear. |
| H-21 | `globals.css`, `types/index.ts` | Todo el CSS está fijado a un único tema oscuro (colores literales en `.input`, `.glass`, scrollbars, hovers, sombras, degradado en `.btn-primary`); `DOC_STATUS_COLORS` guarda hex y clases Tailwind de modo oscuro (`text-slate-400`…) que serían ilegibles en modo claro. No existe selector de tema ni preferencia persistente. |

---

## 3. ARQUITECTURA OBJETIVO

```
presupuesto-express-v2/
├─ supabase/
│  ├─ migrations/0001_core.sql … 0010_*.sql      (esquema, RLS, funciones, triggers)
│  └─ config.toml
├─ docs/
│  ├─ CUMPLIMIENTO.md   (requisitos legales, fuentes oficiales, mapeo a código)
│  └─ DECISIONES.md
├─ scripts/
│  ├─ verify-scope.mjs
│  └─ check-clean.mjs
├─ .env.example         (solo nombres de variables, sin valores)
└─ src/
   ├─ types/index.ts                      (dominio unificado)
   ├─ lib/
   │  ├─ money.ts                         (formatCents, parse, conversiones; aritmética entera)
   │  ├─ calculations.ts                  (cálculo fiscal puro)
   │  ├─ validators/ (nif.ts, iban.ts, document.ts con zod)
   │  ├─ domain/
   │  │  ├─ state-machine.ts              (transiciones permitidas)
   │  │  ├─ documents.ts                  (crear, emitir, convertir, rectificar, versionar)
   │  │  ├─ numbering.ts                  (reglas de serie y formato)
   │  │  └─ payments.ts                   (hitos, cobros, vencimientos)
   │  ├─ compliance/
   │  │  ├─ config.ts                     (fechas y modos, configurables)
   │  │  ├─ hash.ts                       (SHA-256, canonicalización)
   │  │  ├─ billing-record.ts             (registro de facturación + encadenado)
   │  │  ├─ qr.ts
   │  │  └─ evidence.ts                   (paquete de evidencias de firma)
   │  ├─ repo/
   │  │  ├─ types.ts                      (interfaz Repository)
   │  │  ├─ supabase.ts                   (implementación servidor)
   │  │  ├─ local.ts                      (localStorage, solo desarrollo sin backend)
   │  │  └─ memory.ts                     (para tests)
   │  ├─ pdf/ (document-pdf.tsx, generate.ts)
   │  └─ store.ts                         (fachada fina sobre el repositorio, sin lógica)
   ├─ app/ (rutas, server actions, route handlers, /firmar/[token], /legal/…)
   └─ components/ …
```

Principios: lógica de negocio **pura** en `lib/domain` y `lib/compliance` (sin `window`, sin red, sin alias `@/`; imports relativos con extensión para que `node --test` los ejecute). Persistencia detrás de la interfaz `Repository`. La UI nunca calcula importes ni números de serie: los consume ya calculados por el dominio/servidor.

---

## 4. FASES

### FASE 0 — Red de seguridad y ejecutabilidad de tests

**Archivos:** `package.json`, `tsconfig.json`, `src/lib/__tests__/_smoke.test.ts`, `README.md`.

1. Detecta la versión de Node instalada (`node -v`) y deja documentado en `README.md` y `package.json › engines` la versión mínima necesaria para ejecutar TypeScript con `node --test` nativo (soporte de type-stripping; si la versión instalada no lo trae, usa la solución mínima y documentada, preferiblemente subir la versión de Node antes que añadir un transpilador).
2. Script `"test"` que ejecute todos los `*.test.ts` bajo `src/` y `tests/`, más `scripts/check-clean.mjs` y `scripts/verify-scope.mjs`.
3. En `lib/domain`, `lib/compliance`, `lib/calculations.ts`, `lib/money.ts`: **solo `import type` para tipos**, imports relativos con extensión `.ts`, sin alias `@/`.
4. Ejecuta el estado actual (`npm test`, `npm run build`) y anota la línea base en `docs/DECISIONES.md`. Si la compilación actual falla, corrígelo primero.

**Aceptación:** `npm test` ejecuta al menos una prueba real y pasa; `npm run build` pasa.

---

### FASE 1 — Núcleo monetario y cálculo fiscal

**Archivos:** `src/lib/money.ts` (nuevo), `src/lib/calculations.ts` (reescritura), `src/lib/__tests__/money.test.ts`, `src/lib/__tests__/calculations.test.ts`.

**1.1 `money.ts`**
- `formatCents(cents: number): string` con **aritmética entera** (sin `toFixed` ni división flotante): `const abs = Math.abs(cents); const euros = Math.trunc(abs / 100); const dec = abs % 100;` separador de miles `.`, decimal `,`, sufijo ` €`, signo `-` delante. Lanza `RangeError` si `!Number.isSafeInteger(cents)`.
- `eurosToCents(input: string | number): number`: acepta `"1.234,56"`, `"1234,56"`, `"1234.56"`; rechaza ambigüedades inválidas; usa redondeo half-up sobre cadena decimal (no `Math.round(x*100)` con floats).
- `centsToEuros`, `formatPercent(rate)`, `formatDocNumber(series, number)` (`FAC-0048`; ancho mínimo 4, sin truncar).
- `assertCents(n)` y `assertRate(n, {min,max})` reutilizables.

**1.2 `calculations.ts`**
Tipos exportados (reutilizados por todo el sistema):

```ts
export type VatRate = 0 | 4 | 10 | 21;
export const ALLOWED_VAT_RATES: readonly VatRate[] = [0, 4, 10, 21];
export const SURCHARGE_BY_VAT: Record<VatRate, number> = { 21: 5.2, 10: 1.4, 4: 0.5, 0: 0 };

export interface CalcLineInput {
  item_type: 'chapter' | 'line';
  is_optional: boolean;
  quantity: number;          // decimales permitidos (máx. 3)
  price_cents: number;       // entero
  cost_cents?: number;
  discount_pct: number;      // 0–100
  vat_rate: number;
  irpf_rate: number;         // 0–100
}

export interface VatBreakdownRow {
  vat_rate: number;
  base_cents: number;        // suma de subtotales ya redondeados de ese tipo
  vat_cents: number;         // round(base * rate / 100) UNA vez por tipo
  surcharge_rate: number;    // 0 si no aplica recargo
  surcharge_cents: number;
}

export interface DocumentTotals {
  subtotal_cents: number;    // suma de subtotales de línea (neto tras descuento de línea)
  discount_cents: number;    // suma de descuentos de línea
  vat_breakdown: VatBreakdownRow[];
  vat_cents: number;
  surcharge_cents: number;
  irpf_cents: number;
  total_cents: number;       // subtotal + IVA + recargo − IRPF
  cost_cents: number;
  margin_cents: number;      // subtotal − cost
  margin_pct: number | null; // null si subtotal = 0
  optional_total_cents: number; // partidas opcionales, informativo, NO suma al total
  chapters: Array<{ item_index: number; subtotal_cents: number }>;
}
```

Reglas (documéntalas en el JSDoc de cada función):
1. `gross = roundHalfUp(quantity * price_cents)`; `discount = roundHalfUp(gross * discount_pct / 100)`; `subtotal = gross − discount`. Un único punto de redondeo por línea para el bruto y uno para el descuento. Usa una función `roundHalfUp` determinista (no depender de `Math.round` con negativos: define el comportamiento para importes negativos, necesarios en rectificativas).
2. **El IVA se calcula por tipo impositivo sobre la suma de bases**, no por línea: `vat = roundHalfUp(base_del_tipo * rate / 100)`. Es lo que exige el desglose de la factura (RD 1619/2012). El IVA por línea, si se muestra, es informativo y se documenta como tal.
3. IRPF: `roundHalfUp(subtotal_total * irpf_rate / 100)` calculado **por tipo de retención** sobre la suma de bases de ese tipo (mismo criterio).
4. Recargo de equivalencia opcional por documento (`apply_surcharge: boolean`): se aplica por cada tipo según `SURCHARGE_BY_VAT`.
5. Opcionales y capítulos no suman al total contractual; `optional_total_cents` los informa aparte.
6. Un capítulo agrupa las líneas que le siguen hasta el siguiente capítulo; su subtotal se devuelve en `chapters`.
7. Validación: lanza `CalculationError` (clase propia, mensaje en español) si hay NaN/Infinity, `price_cents` no entero, `discount_pct` fuera de 0–100, `vat_rate` fuera de `ALLOWED_VAT_RATES`, `quantity` con más de 3 decimales.
8. Se elimina toda duplicación: `calcDocumentTotals` usa `calcLineBreakdown`, que es la única fuente de la aritmética de línea.

**Casos de prueba obligatorios (`calculations.test.ts`, `money.test.ts`):**
- `1,5 × 3.333` → bruto 4.999,5 → **5.000** (half-up); con 10 % de descuento → descuento 500, subtotal 4.500; IVA 21 % = 945; total 5.445.
- `3 × 1.999` al 21 %: subtotal 5.997, IVA 1.259, total 7.256.
- Redondeo por tipo vs. por línea: tres líneas de `1 × 12` céntimos al 21 %: **IVA por tipo = 8** (36 × 21 % = 7,56 → 8), mientras que sumar el IVA por línea daría 9. El test fija el comportamiento por tipo.
- Dos tipos mezclados (10 % y 21 %) producen dos filas en `vat_breakdown` y `vat_cents` = suma de filas.
- IRPF 15 % sobre base 100.000 → 15.000; recargo 5,2 % sobre base 100.000 al 21 % → 5.200.
- Opcionales excluidos del total e incluidos en `optional_total_cents`.
- Documento con importes negativos (rectificativa): totales negativos coherentes y `formatCents(-123456) === "-1.234,56 €"`.
- `formatCents`: `0 → "0,00 €"`, `5 → "0,05 €"`, `99 → "0,99 €"`, `100000 → "1.000,00 €"`, `123456789 → "1.234.567,89 €"`; lanza con `NaN`, `1.5`, `Number.MAX_SAFE_INTEGER + 1`.
- `eurosToCents("1.234,56") === 123456`, `("0,1") === 10`, `("12.5") === 1250`; rechaza `"1,2,3"`, `""`, `"abc"`.
- Propiedad: para 1.000 documentos aleatorios con semilla fija, `total_cents` === `subtotal + vat + surcharge − irpf` y todos los campos son enteros seguros.
- Margen: coste 95.000, venta 185.000 → margen 90.000, 48,65 % (redondeado a 2 decimales).

**Aceptación:** toda la aritmética vive en `calculations.ts`/`money.ts`; ningún otro archivo calcula importes; los tests anteriores pasan.

---

### FASE 2 — Modelo de dominio unificado

**Archivos:** `src/types/index.ts`, `src/lib/validators/*.ts`, `src/lib/__tests__/validators.test.ts`.

Reescribe `types/index.ts` eliminando duplicidades (**un solo** `document_id`, **un solo** `position`; elimina `doc_id` y `sort_order`) y añadiendo:

```ts
export type DocType = 'quote' | 'delivery_note' | 'proforma' | 'invoice' | 'credit_note'; // credit_note = factura rectificativa
export type DocStatus =
  | 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'invoiced'   // presupuesto/proforma/albarán
  | 'issued' | 'paid' | 'partially_paid' | 'void';                                    // factura/rectificativa
```
- Actualiza `DOC_TYPE_LABELS` y `DOC_STATUS_LABELS` con los nuevos valores (Rectificativa; Emitida; Cobrada; Cobro parcial; Anulada). `DOC_STATUS_COLORS`/`StatusStyle` **se eliminan** y se sustituyen por `DOC_STATUS_TONE` y `DOC_STATUS_ICON` independientes del tema (ver Fase 10.6).
- `Document` añade: `issue_date` (fecha de expedición, `YYYY-MM-DD`), `operation_date?`, `public_token_hash?`, `payment_terms?`, `payment_iban?`, `exemption_note?` (mención de exención / inversión del sujeto pasivo), `apply_surcharge: boolean`, `rectifies_document_id?`, `rectification_reason?`, `rectification_method?: 'differences' | 'substitution'`, `locked_at?` (inmutable desde esa marca), `currency: 'EUR'`. `number` y `series` son `null` mientras sea borrador. `vat_breakdown` se persiste como JSON validado.
- `DocumentSignature` (nueva entidad): `id, document_id, document_version, signer_name, signer_tax_id, signer_email, signature_image_path, document_pdf_hash, otp_verified, ip, user_agent, signed_at (servidor), evidence_hash`.
- `BillingRecord` (nuevo): `id, org_id, document_id, record_type: 'alta' | 'anulacion', series, number, issue_date, total_cents, vat_cents, previous_hash, hash, generated_at, software_version, qr_payload`.
- `AuditEvent` unificado (sustituye al de `store.ts`): `id, org_id, document_id?, actor_user_id?, actor_kind: 'user' | 'client' | 'system', type, description, ip?, user_agent?, previous_hash, hash, created_at`.
- `Payment` (único; elimina `PaymentRecord`): `id, org_id, document_id, label, percentage, amount_cents, due_date, paid_at?, method?, status: 'pending' | 'completed' | 'cancelled'`.
- `OrgSettings`: `default_validity_days`, `default_payment_terms`, `default_terms_text`, `default_vat_rate`, `default_irpf_rate`, `series: Record<DocType, { prefix: string; reset_yearly: boolean }>`, `iban`, `billing_mode: 'verifactu' | 'no_verifactu'`, `taxpayer_kind: 'sociedad' | 'autonomo' | 'otro'`.
- `Org.fiscal_data` se sustituye por campos tipados (`legal_name`, `tax_id`, domicilio completo). `Client` añade domicilio fiscal obligatorio para facturar (`address, city, postal_code, province, country`).
- `Repository<T>` y `Result<T, E>` en `lib/repo/types.ts`.

**Validadores (`lib/validators`):**
- `isValidSpanishTaxId(value)`: DNI (letra de control), NIE (X/Y/Z), CIF (letra/dígito de control según tipo de entidad). Devuelve `{ ok, kind: 'DNI'|'NIE'|'CIF' }`.
- `isValidIban(value)` (módulo 97, longitud por país).
- Esquemas `zod` para `Document`, `DocumentItem`, `Client`, `Org`, `Payment` usados tanto en cliente como en servidor.

**Pruebas:** NIF/CIF/NIE válidos e inválidos (incluidos casos límite: letras prohibidas, longitud, minúsculas, espacios y guiones); IBAN válido/ inválido; esquemas rechazan `vat_rate = 7`, `discount_pct = 120`, `quantity` con 4 decimales.

**Aceptación:** `grep -R "doc_id\|sort_order\|PaymentRecord" src` no devuelve nada; build correcto.

---

### FASE 3 — Capa de datos y esquema (sin datos de ejemplo)

**Archivos:** `supabase/migrations/*.sql`, `src/lib/repo/*.ts`, `src/lib/store.ts` (reducido), `.env.example`, `src/lib/supabase/{server,client,middleware}.ts`, `middleware.ts`.

**3.1 Esquema SQL** (migraciones numeradas, idempotentes): tablas `orgs, memberships, licenses, org_settings, clients, client_addresses, catalog_items, documents, document_items, payments, expenses, document_signatures, billing_records, audit_events, doc_counters, user_preferences, org_certificates`. Reglas:
- Todas con `org_id uuid not null references orgs(id)`; importes `bigint` en céntimos con `check (… = round(…))` donde aplique; `numeric(5,2)` para porcentajes; `uuid default gen_random_uuid()`.
- `documents`: `unique (org_id, doc_type, series, number)` (parcial donde `number is not null`); `check` de estado válido por tipo; `locked_at timestamptz`.
- **RLS activada en todas las tablas.** Política base: `org_id in (select org_id from memberships where user_id = auth.uid())`. Roles: `owner` (todo), `employee` (sin gestionar miembros, licencias ni ajustes fiscales; sin anular facturas).
- **Triggers de inmutabilidad:** si `documents.locked_at is not null`, `UPDATE` de campos económicos/identificativos y `DELETE` lanzan excepción; `DELETE` de documentos con número asignado prohibido siempre; `billing_records` y `audit_events` solo admiten `INSERT` (se revoca `UPDATE/DELETE` y se añade trigger que lo impide también al `service_role`).
- **Numeración atómica:**
  ```sql
  create function next_document_number(p_org uuid, p_doc_type text, p_series text, p_year int)
  returns int language plpgsql security definer as $$ … 
    insert into doc_counters(org_id, doc_type, series, fiscal_year, last_number)
    values (p_org, p_doc_type, p_series, p_year, 1)
    on conflict (org_id, doc_type, series, fiscal_year)
    do update set last_number = doc_counters.last_number + 1
    returning last_number …
  $$;
  ```
  Se invoca **dentro de la misma transacción** que marca el documento como emitido: si la emisión falla, el contador no avanza (sin huecos). Los borradores **no tienen número**.
- Función `issue_document(p_document_id uuid)` (transaccional): valida estado, calcula/valida totales en servidor, asigna número, fija `issue_date`, crea el `billing_record` encadenado y el `audit_event`, y fija `locked_at` (facturas) en una única transacción.
- Job de caducidad: función `expire_quotes()` (cron de Supabase `pg_cron` o ruta `/api/cron/expire` protegida por secreto) que pasa a `expired` los presupuestos `sent/viewed` con `valid_until < current_date` y registra el evento.
- Almacenamiento (Storage): buckets privados `signatures`, `pdfs`, `receipts`, `logos`, con políticas por `org_id`.

**3.2 Repositorios.** `Repository` async con métodos tipados por entidad (listar con filtros/paginación, obtener, crear, actualizar, emitir, convertir…). Implementaciones: `supabase.ts` (producción), `local.ts` (solo desarrollo sin variables de entorno; arranca **vacío**, usa `crypto.randomUUID()`, sin ninguna semilla), `memory.ts` (tests). `store.ts` queda como fachada de 1 línea por función delegando en el repositorio activo; **sin lógica de negocio**.

**3.3 Sincronización en cliente.** `@tanstack/react-query` para lecturas/mutaciones; en modo local, hooks con `useSyncExternalStore` que usan **instantáneas cacheadas** (el mismo objeto hasta que cambie realmente el contenido) y `getServerSnapshot` vacío para evitar desajustes de hidratación; escucha de los eventos `pe_store_updated` **y** `storage` para sincronizar pestañas.

**3.4 Migración de datos locales.** Utilidad "Importar datos locales" (solo si existen claves `pe_enterprise_*_v2`): normaliza `doc_id→document_id`, `sort_order→position`, valida con `zod`, descarta registros inválidos informando cuáles, y los inserta en el backend. No importa nada que venga de datos de demostración conocidos.

**3.5 `.env.example`** (solo nombres): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `RESEND_API_KEY`, `MAIL_FROM`, `CERT_ENCRYPTION_KEY` (clave de 32 bytes en base64, solo servidor, para cifrar los certificados electrónicos **por organización**; nunca expuesta al navegador). No existen variables globales de certificado de la AEAT.

**Pruebas:** contrato común de `Repository` ejecutado contra `memory.ts` y `local.ts` (con un `Storage` en memoria inyectado): CRUD, filtros, aislamiento por `org_id`, un usuario nuevo obtiene listas vacías, no existe ningún dato inicial. Tests SQL (`supabase/tests/*.sql` con pgTAP o script Node documentado) para: RLS entre dos organizaciones, bloqueo de `UPDATE/DELETE` en `billing_records`/`audit_events`, bloqueo de edición de documentos con `locked_at`, concurrencia de `next_document_number` (50 llamadas paralelas → 1…50 sin huecos ni repetidos).

**Aceptación:** sin variables de Supabase la app arranca en modo local vacío; con ellas usa el backend; `rg "mock-data|MOCK_" src` sin resultados.

---

### FASE 4 — Autenticación, multiempresa, roles y licencias

**Archivos:** `src/app/(auth)/{login,registro,recuperar}/page.tsx`, `src/app/(app)/ajustes/**`, `src/lib/auth/*.ts`, `src/app/api/stripe/{checkout,portal,webhook}/route.ts`, `src/lib/domain/permissions.ts`, `src/lib/domain/plans.ts`.

1. Registro por correo/contraseña; al registrarse se crea `org` + `membership(owner)` + `org_settings` por defecto (en una función SQL transaccional) y un asistente de alta (Fase 11).
2. Invitación de empleados por correo (rol `employee`); un `owner` puede cambiar rol o revocar. Siempre debe quedar ≥ 1 `owner`.
3. `permissions.ts`: matriz `can(role, action)` pura y testeada (acciones: `document.create/edit/issue/void`, `settings.edit`, `members.manage`, `billing.manage`, `expenses.manage`…). Se comprueba en servidor **y** se refleja en la UI.
4. `plans.ts`: límites por plan (`free`, `pro`, `business`: nº de documentos/mes, usuarios, firma electrónica, tesorería) como datos puros; `assertWithinPlan(license, usage, action)` con errores en español.
5. Stripe: checkout, portal de cliente y webhook (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) que actualiza `licenses`; verificación de firma del webhook; idempotencia por `event.id`.
6. `middleware.ts` protege `(app)`; las rutas públicas son `/login`, `/registro`, `/firmar/[token]`, `/legal/*`.

**Pruebas:** matriz de permisos completa; `assertWithinPlan` en los límites exactos; webhook rechaza firma inválida y es idempotente (mismo `event.id` dos veces → un solo efecto).

---

### FASE 5 — Ciclo de vida documental

**Archivos:** `src/lib/domain/state-machine.ts`, `src/lib/domain/documents.ts`, `src/lib/domain/numbering.ts`, server actions en `src/app/(app)/documentos/actions.ts`, tests.

**5.1 Máquina de estados** (`canTransition(docType, from, to)` pura):
- Presupuesto: `draft→sent`; `sent→viewed|accepted|rejected|expired`; `viewed→accepted|rejected|expired`; `accepted→invoiced`; `rejected|expired→` solo mediante **nueva versión** (nunca se reabre el mismo documento).
- Proforma/Albarán: `draft→sent→accepted|rejected`; `accepted→invoiced`.
- Factura: `draft→issued`; `issued→paid|partially_paid|void`; `partially_paid→paid|void`. `void` solo mediante registro de anulación y/o rectificativa; **nunca** borrado.
- Cualquier otra transición lanza `InvalidTransitionError`.

**5.2 Reglas de edición.** Solo `draft` es editable. Un documento con `status ≠ draft` es de solo lectura; para cambiarlo se crea **nueva versión** (`version + 1`, enlazada, el original queda `superseded` en el histórico y conserva su firma). Firmar un documento ya firmado o no enviado está prohibido.

**5.3 Creación.** `createDraft({ doc_type, client_id, title })`: cliente **obligatorio y existente** (si no, error; nunca se asigna uno por defecto); `valid_until = hoy + org_settings.default_validity_days`; `notes_public` y condiciones se toman de `org_settings.default_terms_text` (vacío si la empresa no lo ha definido); **sin partidas precargadas** (documento vacío con botón "Añadir capítulo/partida"); sin número ni serie.

**5.4 Emisión/envío.** `issue(document_id)` llama a la función SQL transaccional: valida (cliente con NIF y domicilio completos, ≥ 1 partida no opcional, totales > 0 salvo rectificativa, emisor con datos fiscales completos), asigna número, `issue_date = hoy (zona Europe/Madrid)`, genera registro de facturación (Fase 6) y evento. Los presupuestos/proformas/albaranes asignan número al enviarse.

**5.5 Conversión.** `convert(source_id, target_type)`:
- Permitidas: `quote→delivery_note|proforma|invoice`, `delivery_note→invoice`, `proforma→invoice`. El origen debe estar `accepted` (o `sent` para albarán si la empresa lo permite en ajustes).
- Las líneas se **clonan** con nuevos ids, `document_id` del destino y `position` recalculada; se rellena `converted_from`; el origen pasa a `invoiced` cuando se factura el 100 %; se admite **facturación parcial por hitos** (el importe facturado acumulado nunca supera el del origen; se valida en servidor).
- Se registra evento en origen y destino.

**5.6 Rectificativas.** `createCreditNote({ original_id, reason, method })`: solo sobre facturas `issued/paid/partially_paid`; serie propia (`REC` por defecto, configurable); referencia obligatoria a la factura original (serie+número+fecha) y causa; método por diferencias (importes negativos) o sustitución; la original pasa a `void` solo si la rectificativa es por sustitución total.

**5.7 Caducidad.** Cálculo de `expired` en servidor (job de la Fase 3) y también al abrir el documento (consistencia perezosa), nunca en el cliente.

**Pruebas (con `memory.ts`):**
- Dos creaciones concurrentes de factura (`Promise.all` de 50) → números 1…50 consecutivos sin duplicados.
- Un borrador no tiene número; al emitir se asigna; si la validación de emisión falla el contador **no** avanza.
- Todas las transiciones permitidas pasan y **todas las demás** lanzan error (tabla completa generada por el test).
- Editar un documento no `draft` falla; crear nueva versión incrementa `version` y mantiene la firma del original.
- Conversión: las líneas del destino tienen `document_id` del destino; `converted_from` correcto; facturación parcial 40 % + 60 % cierra el origen; un 3.er intento falla por exceder el total.
- Rectificativa sin referencia o sin causa falla; por diferencias genera importes negativos que anulan exactamente la factura original (suma = 0).
- Crear documento con `client_id` inexistente falla (no se asigna ningún cliente).
- Presupuesto con `valid_until` pasado pasa a `expired` en el job y no se puede aceptar.

---

### FASE 6 — Registro de facturación inalterable (Ley Antifraude / Verifactu)

**Archivos:** `src/lib/compliance/{config,hash,billing-record,qr,evidence}.ts`, `src/app/legal/declaracion-responsable/page.tsx`, `docs/CUMPLIMIENTO.md`, tests.

**Contexto normativo vigente (verifícalo en BOE/AEAT al implementar y documenta la fuente y la fecha de consulta en `CUMPLIMIENTO.md`):** el calendario de uso obligatorio del RD 1007/2023, tras el RDL 15/2025, es el 1 de enero de 2027 (contribuyentes del Impuesto sobre Sociedades) y el 1 de julio de 2027 (resto). A fecha de hoy existe un anuncio de Hacienda de prorrogar hasta octubre de 2028 que, según las fuentes consultadas, aún no estaba publicado en el BOE. **Las fechas no se escriben en la lógica**: viven en `compliance/config.ts` como datos configurables con fecha de revisión. Las obligaciones del **productor del software** (integridad, trazabilidad, inalterabilidad, huella, QR, registro de eventos, declaración responsable) no dependen de esas fechas y se implementan ya.

**6.1 `hash.ts`:** `sha256Hex(input: string | Uint8Array): Promise<string>` con `crypto.subtle` (funciona en Node ≥ 18 y navegador); `canonicalize(obj)` (JSON con claves ordenadas, sin espacios, enteros como enteros) para evidencias genéricas. Test vector: `sha256Hex("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"`.

**6.2 `billing-record.ts`:**
- `buildBillingRecord(doc, org, previous)` genera el registro de **alta** (y `buildCancellationRecord` el de **anulación**) con los campos que exige la especificación técnica oficial de la AEAT para el cálculo de la huella (emisor, serie+número, fecha de expedición, tipo de factura, cuota total, importe total, huella anterior, fecha-hora con huso, etc.). Implementa el formato **exactamente según el documento oficial "Detalle de las especificaciones técnicas para la generación de la huella o hash de los registros de facturación"**; el orden y formato de campos se encapsula en una sola función con tests de vectores tomados de ese documento oficial.
- Encadenado por organización: cada registro incluye `previous_hash` (el primero lleva el valor inicial que fije la especificación). `verifyChain(records)` recalcula todo y devuelve `{ ok: boolean; firstBrokenIndex?: number }`.
- Se inserta dentro de `issue_document` (misma transacción). Orden estricto por `generated_at, id`.

**6.3 `qr.ts`:** URL de cotejo con los parámetros y el formato que fija la Orden HAC/1177/2024 (NIF emisor, número de serie, fecha, importe) y leyenda "VERI*FACTU" cuando `billing_mode = 'verifactu'`; generación con `qrcode` como SVG/PNG para el PDF. Dimensiones y nivel de corrección de errores según la especificación.

**6.4 Modos y envío.** `billing_mode`:
- `no_verifactu`: se generan y conservan los registros + registro de eventos íntegros y exportables (`/api/billing-records/export`). Comprueba en la documentación técnica oficial de la AEAT si este modo exige además **firmar electrónicamente cada registro y cada evento**; si es así, impleméntalo con el certificado de la organización (mismo mecanismo que el envío) y documenta la fuente en `CUMPLIMIENTO.md`.
- `verifactu`: además se envía cada registro a la AEAT a través de la interfaz `AeatSubmissionPort` (implementación SOAP con certificado, cola con reintentos y backoff, estado `pending|accepted|rejected|error` por registro, subsanación). El certificado se guarda **por organización** en `org_certificates`, **cifrado** con `CERT_ENCRYPTION_KEY` (contraseña incluida), se sube desde Ajustes → Facturación, se valida (vigencia, titular/NIF coincidente con el de la organización) y nunca se expone al navegador. Cada envío se firma con el certificado (o la autorización) de la organización emisora. Si la organización no tiene certificado válido, el sistema **bloquea la activación del modo** con un mensaje claro en Ajustes (no simula envíos). Eventos de subida, caducidad próxima (aviso a 30 días) y revocación se registran en `audit_events`.

**6.5 Registro de eventos (`audit_events`).** Append-only con hash encadenado por organización: `hash = sha256(previous_hash + canonicalize(evento))`. Eventos mínimos: alta/ edición de borrador, emisión, envío, visualización por el cliente, firma, conversión, anulación, rectificación, cambio de estado, exportaciones, inicios de sesión, cambios de ajustes fiscales, cambios de serie/numeración, fallos de integridad. Vista de auditoría con verificación de cadena y botón "Verificar integridad".

**6.6 Conservación y borrado.** Prohibido borrar documentos con número, registros y eventos. Retención mínima configurada a **6 años** (Código de Comercio; la obligación tributaria es de 4) con exportación completa (JSON + PDFs + evidencias) por ejercicio.

**6.7 Declaración responsable.** Página pública `/legal/declaracion-responsable` y sección en Ajustes con los datos del productor (razón social, NIF, nombre y versión del sistema, fecha) tomados de variables de configuración del producto; nunca texto inventado: si faltan, la página muestra el aviso de configuración pendiente y la activación comercial queda bloqueada.

**Pruebas:** `sha256Hex` (vector anterior); encadenado de 100 registros → `verifyChain` ok; alterar un campo del registro 37 → `firstBrokenIndex = 37`; borrar uno intermedio → rotura detectada; `UPDATE/DELETE` sobre `billing_records`/`audit_events` rechazados; el QR codifica los parámetros esperados (decodificando el payload); vectores oficiales de huella; con `billing_mode='verifactu'` y sin certificado, la activación falla con mensaje; reintentos con backoff determinista (reloj inyectado).

---

### FASE 7 — Firma electrónica del cliente

**Archivos:** `src/app/firmar/[token]/page.tsx`, `src/app/api/sign/{start,verify-otp,submit}/route.ts`, `src/lib/compliance/evidence.ts`, `src/lib/domain/signing.ts`, componente de firma manuscrita (`<canvas>`), tests.

1. **Enlace público seguro:** al enviar, se genera un token aleatorio de ≥ 256 bits (`crypto.randomBytes`), se guarda **solo su hash** (`public_token_hash`), con caducidad y revocación. Rate limiting por IP y token (tabla `rate_limits` o servicio del proveedor).
2. **Visualización:** abrir el enlace registra `viewed` (una vez por sesión) con IP y user-agent; el estado pasa a `viewed` si estaba `sent`.
3. **Flujo de firma:** el cliente revisa el PDF, introduce nombre y NIF (validado), recibe un **código OTP por correo** (Resend), lo verifica y dibuja la firma. Se bloquea la firma si el documento no está `sent/viewed`, está caducado/revocado, o ya está firmado.
4. **Evidencias (servidor):** fecha/hora del **servidor** (nunca del cliente), IP, user-agent, `document_version`, hash SHA-256 del PDF mostrado, imagen de firma en Storage privado, resultado OTP. `evidence_hash = sha256(canonicalize(paquete))` y se registra evento encadenado. Se genera un **certificado de aceptación** en PDF (anexo) con esos datos.
5. **Texto legal honesto:** se describe como **firma electrónica simple** con evidencias de integridad y trazabilidad (Reglamento eIDAS). **Prohibido** afirmar "sello de tiempo cualificado" o "firma cualificada" salvo que se integre un prestador cualificado real (sellado RFC 3161) mediante una interfaz `TimestampAuthorityPort` configurable; mientras no esté configurada no aparece esa mención.
6. Tras firmar: `status = accepted`, `accepted_at`, documento bloqueado, correo de confirmación al cliente y al emisor con el certificado adjunto.
7. Verificación posterior: acción "Verificar evidencias" que recalcula el hash del PDF almacenado y el de la evidencia y confirma coincidencia.

**Pruebas:** token en claro nunca se persiste (solo hash); firma sobre documento `draft` rechazada; segunda firma rechazada; OTP incorrecto 5 veces bloquea; OTP caducado rechazado; `signed_at` procede del servidor aunque el cliente envíe otra fecha; cualquier cambio del PDF tras la firma invalida la verificación; `viewed` solo se registra una vez por sesión.

---

### FASE 8 — PDF oficial

**Archivos:** `src/lib/pdf/document-pdf.tsx`, `src/lib/pdf/generate.ts`, `src/app/api/documents/[id]/pdf/route.ts`, `src/app/(app)/documentos/[id]/imprimir/page.tsx`, `globals.css` (bloque de impresión).

1. PDF A4 con `@react-pdf/renderer` (servidor): cabecera con logotipo y datos fiscales del emisor, datos completos del cliente, serie-número, fechas de expedición y operación, tabla por capítulos y partidas, **desglose por tipo impositivo**, IRPF, recargo, total, forma de pago/IBAN, condiciones, mención de exención/ISP si procede, referencia a la factura rectificada (rectificativas), QR y huella (facturas), paginación "Página X de Y".
2. Contenido mínimo de factura conforme al RD 1619/2012 (número y serie, fecha de expedición, fecha de operación si difiere, nombre/razón social, NIF y domicilio de expedidor y destinatario, descripción de las operaciones, base imponible, tipo, cuota, menciones de exención). La emisión (Fase 5.4) **no se permite** si falta alguno de estos datos.
3. El PDF se genera **una sola vez al emitir/enviar**, se guarda en Storage (`pdfs`), se calcula `pdf_hash` y se guardan `pdf_url`/`pdf_hash` en el documento; las descargas posteriores sirven el archivo almacenado (no se regenera).
4. Vista de impresión HTML (`#official-print-document`) como alternativa; ver correcciones CSS de la Fase 10.

**Pruebas:** el PDF generado dos veces con los mismos datos produce el mismo contenido textual; `pdf_hash` coincide con el SHA-256 de los bytes almacenados; un documento sin datos fiscales del emisor no se puede emitir; el PDF de una factura contiene QR y huella; paginación correcta con 120 líneas (cabeceras de tabla repetidas, `break-inside: avoid` en filas).

---

### FASE 9 — Tesorería, gastos y rentabilidad

**Archivos:** `src/lib/domain/payments.ts`, `src/app/(app)/tesoreria/**`, `src/app/(app)/gastos/**`, `src/app/(app)/informes/**`, tests.

1. **Hitos de cobro:** se definen al crear/editar un borrador (porcentaje o importe fijo). `buildMilestones(total_cents, specs)` reparte con **método del resto** para que la suma sea exactamente `total_cents` (ej.: 3 hitos 33,33 % de 100,00 € → 3.333 + 3.333 + 3.334) y valida que sumen el 100 %.
2. **Cobros:** `registerPayment(payment_id, { paid_at, method, amount_cents })` admite cobros parciales; actualiza `status` del documento a `partially_paid` o `paid`; nunca permite cobrar más que el pendiente; registra evento.
3. **Vencimientos:** vista de vencidos/próximos 7/30 días, cálculo en servidor con zona `Europe/Madrid`.
4. **Gastos:** CRUD de `Expense` con categoría, justificante en Storage, asociación opcional a documento/proyecto.
5. **Rentabilidad:** por documento y por periodo: ventas netas, coste previsto (`cost_cents` de líneas), gastos imputados, margen € y %.
6. **Informes y exportación:** libro de facturas emitidas (CSV con separador `;` y codificación UTF-8 con BOM, importes en formato `1234,56`), resumen trimestral de bases/cuotas por tipo (apoyo a modelos 303/130/115 como **informe de ayuda**, sin presentar nada a la AEAT), exportación por ejercicio.
7. **Panel (dashboard):** KPIs calculados de datos reales (facturado, cobrado, pendiente, vencido, presupuestos abiertos, tasa de aceptación, margen), con estados vacíos cuando no hay datos.

**Pruebas:** reparto de hitos suma exacto en 1.000 combinaciones aleatorias con semilla fija; cobro parcial → `partially_paid`, resto → `paid`; sobrecobro rechazado; CSV con acentos, comas y saltos de línea correctamente escapados; KPIs vacíos devuelven 0 y no `NaN`.

---

### FASE 10 — Sistema de diseño profesional, temas (claro / oscuro / sistema) e interfaz

**Esta fase sustituye a cualquier instrucción anterior sobre estética.** El objetivo es una interfaz de ERP contable corporativo: sobria, densa en información, legible durante horas y consistente. El modo oscuro actual deja de ser "el" diseño y pasa a ser uno de los temas.

**Archivos:** `src/styles/{tokens.css,base.css,components.css,print.css}`, `src/app/globals.css` (solo `@import`s), `src/app/layout.tsx`, `src/lib/theme/{preferences.ts,contrast.ts,accent.ts}`, `src/components/ui/*`, `src/components/layout/{AppShell,Sidebar,Topbar,PageHeader,CommandPalette,ThemeSwitcher}.tsx`, `src/app/(app)/ajustes/apariencia/page.tsx`, `src/app/(app)/ajustes/apariencia/actions.ts`, `src/lib/__tests__/{theme,contrast,tokens}.test.ts`.

#### 10.1 Principios de diseño
1. **Tema por defecto: "Sistema"** (sigue al sistema operativo). Claro y oscuro son igual de cuidados.
2. **Sobriedad corporativa:** botón primario de **color sólido** (sin degradados), sin brillos/`glow`, sin elementos que parpadeen o se muevan por decoración. Bordes finos y jerarquía por tipografía y espacio. El efecto *glass* (desenfoque) queda reservado a capas flotantes (modales, menús, paleta de comandos); tarjetas y tablas usan superficies opacas.
3. **Densidad de información:** las pantallas de trabajo (listados, editor de documento, tesorería) priorizan datos legibles; los importes siempre alineados a la derecha, en cifras tabulares.
4. **Un único conjunto de iconos:** añade `lucide-react` (único conjunto, trazo 1,5–2 px, tamaños 16/20/24). Prohibidos emojis en la interfaz.
5. **Jerarquía tipográfica:** *Plus Jakarta Sans* (interfaz) y *JetBrains Mono* (números de documento, referencias, huellas). Escala definida en tokens (12, 13, 14, 16, 18, 20, 24, 30 px) con `line-height` asociado.
6. **El color nunca es el único portador de significado** (estados con texto + icono).

#### 10.2 Sistema de temas

**Preferencia de apariencia** (tipo y esquema `zod` en `lib/theme/preferences.ts`):
```ts
export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentId = 'indigo' | 'azul' | 'esmeralda' | 'grafito' | 'burdeos' | 'corporativo';
export interface UiPreferences {
  mode: ThemeMode;                       // por defecto 'system'
  accent: AccentId;                      // por defecto 'indigo'
  density: 'comfortable' | 'compact';    // por defecto 'comfortable'
  font_scale: 100 | 110 | 125;           // por defecto 100
  high_contrast: boolean;                // por defecto false
}
export const DEFAULT_UI_PREFERENCES: UiPreferences = { /* valores anteriores */ };
```
- `parseUiPreferences(raw: unknown): UiPreferences`: valida con `zod`; **ante cualquier dato inválido o ausente devuelve los valores por defecto** (nunca lanza).
- `serializeUiCookie(prefs)` / `parseUiCookie(header)`.
- `resolveMode(prefs, systemPrefersDark): 'light' | 'dark'` (función pura).

**Persistencia (sin `localStorage`, para respetar la regla de la Fase 12):**
1. Cookie `pe_ui` (JSON codificado, `SameSite=Lax`, `Secure` en producción, 1 año, no `HttpOnly` para permitir cambio inmediato en cliente).
2. Para usuarios autenticados, tabla `user_preferences (user_id uuid primary key, ui jsonb, updated_at)` con RLS (solo el propio usuario). Al iniciar sesión **gana la base de datos** y se reescribe la cookie; al cambiar la apariencia se actualizan ambas (server action `saveUiPreferences`).
3. Páginas públicas (`/firmar/[token]`, `/legal/*`, `/login`) leen solo la cookie; si no existe, "Sistema".

**Sin parpadeo al cargar (sin script en línea):** `layout.tsx` (servidor) lee la cookie y emite en `<html>`: `data-theme="light|dark"` solo si el modo es explícito, más `data-accent`, `data-density`, `data-contrast="high"` si procede y `style="--font-scale:1.1"`. Para el modo **Sistema** no se emite `data-theme` y el CSS resuelve el esquema con `prefers-color-scheme` (cero JavaScript y cero parpadeo). Incluye `<meta name="color-scheme" content="light dark">` y dos `<meta name="theme-color">` con `media="(prefers-color-scheme: …)"`.

**Tokens (`src/styles/tokens.css`).** Dos capas: primitivas (paletas) y **semánticas** (las únicas que usan los componentes). Estructura:
```css
:root { /* claro: valores por defecto */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* oscuro */ } }
:root[data-theme="dark"] { /* oscuro (idéntico al bloque anterior) */ }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }
```
`@theme inline` de Tailwind v4 mapea los tokens semánticos a utilidades (`bg-surface`, `text-muted`, `border-default`, `text-accent`…) para que las clases de Tailwind sigan el tema. Valores de partida (el test de contraste es la autoridad; ajusta ± lo necesario para cumplirlo):

| Token | Claro | Oscuro |
|---|---|---|
| `--bg-app` | `#F5F6F8` | `#0B0D12` |
| `--bg-surface` | `#FFFFFF` | `#12151D` |
| `--bg-surface-2` (cabeceras de tabla, filas alternas) | `#F0F2F5` | `#181C27` |
| `--bg-elevated` (menús, modales) | `#FFFFFF` | `#1D2230` |
| `--border-subtle` | `#E4E7EC` | `#232838` |
| `--border-default` | `#D0D5DD` | `#2E3447` |
| `--border-input` (≥ 3:1 sobre la superficie) | `#8A94A6` | `#6B7390` |
| `--text-primary` | `#101828` | `#E8EAF0` |
| `--text-secondary` | `#475467` | `#A3A9BC` |
| `--text-tertiary` | `#5B6577` | `#838BA3` |
| `--accent` (fondo de botón primario) | `#4F46E5` | `#4F46E5` |
| `--accent-hover` | `#4338CA` | `#6366F1` |
| `--accent-fg` (acento usado como texto/enlace) | `#4338CA` | `#A5B4FC` |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` |
| `--accent-subtle` | `#EEF0FF` | `#1B1E3A` |
| `--success-fg` / `--success-bg` | `#027A48` / `#ECFDF3` | `#6EE7B7` / `#0F2A1E` |
| `--warning-fg` / `--warning-bg` | `#B54708` / `#FFFAEB` | `#FCD34D` / `#2E2108` |
| `--danger-fg` / `--danger-bg` | `#B42318` / `#FEF3F2` | `#FCA5A5` / `#331415` |
| `--info-fg` / `--info-bg` | `#175CD3` / `#EFF8FF` | `#7DD3FC` / `#0E2536` |
| `--violet-fg` / `--violet-bg`, `--teal-fg` / `--teal-bg`, `--neutral-fg` / `--neutral-bg` | definir pares AA en ambos temas | definir pares AA en ambos temas |

Los tokens usados en comprobaciones de contraste son **hex opacos** (sin transparencia). Además: tokens de espaciado (4 px de base), radios (`6/8/12/16`), elevación (`--shadow-sm/md/lg`: sombras suaves en claro; en oscuro se prefiere borde a sombra), foco (`--focus-ring: 2px solid var(--accent-fg)` con `outline-offset: 2px`), animación (`--ease`, `--dur-fast: 120ms`, `--dur: 200ms`) y alturas (`--control-h`, `--row-h`).

**Acentos de marca:** `indigo #4F46E5`, `azul #2563EB`, `esmeralda #047857`, `grafito #334155`, `burdeos #9F1239`, definidos como `[data-accent="…"]` sobreescribiendo `--accent`, `--accent-hover`, `--accent-fg`, `--accent-subtle` y `--on-accent` **para ambos temas**. El acento `corporativo` toma `Org.primary_color` y lo procesa `deriveAccentTokens(hex, theme)` (en `lib/theme/accent.ts`, función pura): calcula el texto legible sobre el color (`pickReadableText`), y si el color no alcanza 4,5:1 como `--accent-fg` sobre la superficie o 4,5:1 contra `--on-accent` como fondo de botón, lo **oscurece (claro) o aclara (oscuro) por pasos** hasta cumplirlo, sin cambiar el tono. Los valores resultantes se inyectan como variables CSS en `<html style>` desde el servidor (validados por regex `^#[0-9a-fA-F]{6}$`).

**Densidad y tamaño:** `[data-density="compact"]` reduce `--control-h` (40 → 32 px), `--row-h` (44 → 36 px), tamaño base (14 → 13 px) y espaciados; `--font-scale` (1, 1.1, 1.25) escala `html { font-size: calc(100% * var(--font-scale)) }` y todo el sistema usa `rem`. `[data-contrast="high"]` fuerza bordes fuertes (`--border-default` pasa a `--border-input`), texto secundario = primario y foco de 3 px.

**Selector de apariencia (`ThemeSwitcher`):** botón en la barra superior (icono sol/luna/monitor según el modo) que abre un menú accesible con tres opciones **Claro / Oscuro / Sistema** (`role="menuitemradio"`, `aria-checked`, navegación con flechas, `Esc` cierra, foco devuelto al botón). El cambio es inmediato: se actualiza `document.documentElement.dataset` en cliente, se escribe la cookie y se guarda en servidor sin recargar. Una transición suave de color de 150 ms se aplica **solo en el momento del cambio** (clase temporal `theme-transition`) y se desactiva con `prefers-reduced-motion`. Atajo de teclado opcional documentado en la paleta de comandos.

**Página Ajustes → Apariencia:** selector de modo con tres tarjetas de vista previa, selector de acento (muestras + "Color corporativo"), densidad, tamaño de texto, contraste alto y un panel de **vista previa en vivo** (tabla pequeña, botones, insignias, formulario) que refleja los cambios antes de guardar; botón "Restablecer valores por defecto".

#### 10.3 Estructura CSS
Divide `globals.css` en `src/styles/` y dejándolo solo como `@import "tailwindcss"; @import "./../styles/tokens.css"; …`.
- **Prohibido cualquier literal de color** (`#…`, `rgb()`, `rgba()`, `hsl()`) fuera de `tokens.css`, `lib/theme/`, `lib/pdf/` y las plantillas de correo (el PDF y el correo necesitan colores literales). El resto usa `var(--token)`. El verificador de la Fase 12 lo comprueba.
- Migra a tokens **todo** lo que hoy está fijado a modo oscuro en `globals.css`: fondos de `.input`, `.glass*`, scrollbars (usar `color-mix` con `--text-primary`), hover de `.btn-ghost`, `.table-row:hover`, `.sidebar-link`, sombras y degradados. `.btn-primary` pasa a fondo `var(--accent)` sólido con `:hover` `var(--accent-hover)`; se elimina `--accent-gradient`.

#### 10.4 Estructura de la aplicación (shell)
- **Barra superior:** selector de organización, **búsqueda global y paleta de comandos** (`Ctrl/⌘ + K`: buscar documentos, clientes y acciones como "Nuevo presupuesto"), botón **"+ Nuevo"** con menú (presupuesto, albarán, proforma, factura, cliente, gasto), `ThemeSwitcher` y menú de usuario. La búsqueda consulta el servidor con RLS y paginación.
- **Barra lateral** agrupada por secciones: *Ventas* (Presupuestos, Albaranes, Proformas, Facturas), *Tesorería* (Cobros, Gastos), *Contactos* (Clientes), *Catálogo*, *Informes*, *Ajustes*. Estado colapsado (solo iconos con tooltip) y persistente en la cookie `pe_ui`. Indicador de página activa por barra de color + fondo sutil, sin brillo.
- **Cabecera de página** (`PageHeader`): migas de pan, título, estado, acciones primarias a la derecha, acciones secundarias en menú "Más".
- **Pie de la barra lateral:** estado del plan y uso, enlace a ayuda y versión del producto.

#### 10.5 Componentes y patrones (`src/components/ui`)
`Button` (primary, secondary, ghost, danger; tamaños; `loading`), `IconButton`, `Input`, `NumberInput` (alineado a la derecha, `inputmode="decimal"`, conversión con `eurosToCents`), `Select`, `Combobox`, `DatePicker` (teclado, formato `dd/mm/aaaa`), `Field` (etiqueta arriba, ayuda, error en línea, obligatorio), `Badge` (tonos + icono), `Card`, `Tabs`, `Modal`/`Drawer` (foco atrapado, `Esc`, `aria-modal`), `Menu`, `Tooltip`, `Toast`, `Skeleton`, `EmptyState`, `DataTable`, `Pagination`, `StatCard`, `Timeline`, `ConfirmDialog`.
- **`DataTable`:** cabecera fija, ordenación por columna, filtros en chips, búsqueda, selección múltiple con acciones en lote, columnas configurables, vistas guardadas (se guardan en BD por usuario), exportación CSV, paginación en servidor, densidad según preferencia, acciones por fila en menú, y en < 640 px conversión a tarjetas apiladas.
- **Editor de documento:** diseño de dos columnas — izquierda: datos del documento y rejilla de capítulos/partidas; derecha (sticky): **resumen de totales** (base por tipo, IVA, recargo, IRPF, total, margen) y estado; cabecera con acciones "Guardar borrador / Enviar / Emitir"; panel lateral de **historial y auditoría** (línea de tiempo).
- **Panel:** tarjetas de indicadores sobrias (sin degradados ni brillos), gráficos propios en SVG (barras, línea, anillo) **sin añadir librerías**, accesibles (`role="img"` + `aria-label` y tabla alternativa oculta visualmente), y estados vacíos con acción.
- Todas las pantallas implementan estados **cargando** (skeleton), **vacío** y **error** (mensaje en español y reintento).

#### 10.6 Estados de documento y tonos
Refactoriza `DOC_STATUS_COLORS` en `types/index.ts`: **elimina los hex y las clases Tailwind fijas** (`bg-slate-500/15 text-slate-400`…, ilegibles en modo claro) y sustitúyelos por `DOC_STATUS_TONE: Record<DocStatus, Tone>` con `Tone = 'neutral' | 'info' | 'violet' | 'success' | 'warning' | 'danger' | 'teal' | 'muted'` y por `DOC_STATUS_ICON: Record<DocStatus, IconName>`. El componente `Badge` pinta con `data-tone` y los tokens `--<tono>-fg/-bg`. Asignación: `draft`→neutral, `sent`→info, `viewed`→violet, `accepted`→success, `rejected`→danger, `expired`→muted, `invoiced`→teal, `issued`→info, `paid`→success, `partially_paid`→warning, `void`→danger. Cada insignia lleva texto + icono.

#### 10.7 Accesibilidad (WCAG 2.2 AA en claro, oscuro y contraste alto)
- Texto normal ≥ 4,5:1; texto grande y componentes de interfaz (bordes de campos, iconos, foco) ≥ 3:1, en **todos** los temas y **todos** los acentos.
- `:focus-visible` visible en cualquier elemento interactivo; orden de tabulación lógico; objetivos táctiles ≥ 44 px en móvil (mínimo 24 px en escritorio).
- `prefers-reduced-motion: reduce` anula animaciones y transiciones; `forced-colors: active` mantiene bordes explícitos; `prefers-contrast: more` activa el mismo efecto que `data-contrast="high"` si el usuario no ha elegido otro.
- Formularios con etiquetas asociadas, errores enlazados con `aria-describedby`, `aria-invalid`, resumen de errores al enviar; tablas con `scope`; modales con foco atrapado; avisos con `aria-live="polite"`.
- Idioma `lang="es"` en `<html>`; navegación completa con teclado, incluida la paleta de comandos.

#### 10.8 Impresión y PDF (independientes del tema)
- La impresión **siempre sale en claro**, sea cual sea el tema activo: en `@media print` se reasignan los tokens claros sobre `:root` (incluido `[data-theme="dark"]`) y se fuerza `color-scheme: light`.
- Corrige el defecto H-17: se **elimina** la ocultación global de `header, footer, nav, aside, .badge`. Se ocultan únicamente `.no-print, .sidebar, .top-header, [role="dialog"], .toast-region`; dentro de `#official-print-document` nunca se oculta nada por etiqueta (`header`, `footer`, `nav`, `.badge` con `display: revert`) y solo se ocultan `button` y `.btn`.
- Numeración de páginas (`@page` con `counter(page)` y degradación elegante), `thead { display: table-header-group }`, filas con `break-inside: avoid`.
- El PDF del servidor (`@react-pdf/renderer`) no depende del tema; usa `Org.primary_color` solo para detalles de marca y solo si cumple el contraste (reutiliza `deriveAccentTokens` en tema claro).
- Los correos transaccionales usan estilos en línea en claro.

#### 10.9 Responsive
- Debajo de 1024 px, la barra lateral pasa a panel deslizable (`[data-sidebar="open"]`) con capa de fondo, y `.main-content` sin margen; en escritorio, estado colapsado con `--sidebar-collapsed-width`.
- Tablas anchas en contenedor con `overflow-x: auto`; < 640 px → tarjetas apiladas. Sin scroll horizontal del `body` a 360, 768, 1024 y 1440 px.
- `min-height: 100dvh` (fallback `100vh`); efectos de `:hover` envueltos en `@media (hover: hover) and (pointer: fine)`; respaldo opaco con `@supports not (backdrop-filter: blur(1px))`.
- Fuentes cargadas con `next/font` (`display: swap`, variables CSS); elimina referencias a fuentes no cargadas.

#### 10.10 Pruebas y criterios de aceptación
**Pruebas automáticas (`node --test`):**
- `contrast.ts`: `wcagContrast('#000000','#FFFFFF') === 21`; `#767676` sobre blanco ≈ 4,54 (≥ 4,5) y `#777777` ≈ 4,48 (< 4,5); `pickReadableText` devuelve blanco o negro según el fondo.
- `tokens.test.ts`: analiza `tokens.css` y verifica que (a) **todos los tokens existen en claro y oscuro**, (b) los dos bloques oscuros (`@media` y `[data-theme="dark"]`) son idénticos, (c) cada par requerido cumple su ratio en claro y oscuro: `text-primary`/`text-secondary`/`text-tertiary` sobre `bg-app`, `bg-surface`, `bg-surface-2` y `bg-elevated` (≥ 4,5); `border-input` sobre `bg-surface` (≥ 3); cada `--<tono>-fg` sobre su `--<tono>-bg` (≥ 4,5); `on-accent` sobre `accent` y `accent-fg` sobre `bg-surface` (≥ 4,5), **para los cinco acentos fijos en ambos temas**, (d) existen los tonos usados por `DOC_STATUS_TONE`.
- `accent.test.ts`: `deriveAccentTokens` ajusta un color claro (p. ej. `#FFE066`) hasta cumplir 4,5:1 sin cambiar el tono más de 5°, y rechaza valores que no sean `#RRGGBB`.
- `theme.test.ts`: `parseUiPreferences` devuelve valores por defecto con `null`, `{}`, JSON roto, `mode: 'violeta'` o `font_scale: 300`; `resolveMode` cubre las 6 combinaciones; la cookie se serializa y se lee de forma idempotente.
- `check-clean` (Fase 12): sin literales de color fuera de las rutas permitidas; sin `localStorage` fuera de `lib/repo/local.ts`.

**QA manual (matriz):** temas {claro, oscuro, sistema} × densidad {cómoda, compacta} × ancho {360, 768, 1024, 1440} en: panel, listado de documentos, editor de documento, tesorería, ajustes, `/firmar/[token]` y vista de impresión. Comprobar: cambio de tema sin parpadeo al recargar, sin texto ilegible ni elementos "fijados" a un tema, cambio del tema del sistema en caliente con modo "Sistema", impresión en claro con el tema oscuro activo, navegación completa por teclado y lectura con zoom del 200 %.

**Aceptación:** el usuario puede cambiar entre claro, oscuro y sistema desde la barra superior y desde Ajustes; la elección persiste tras recargar y entre dispositivos; ningún componente usa colores literales; todas las pruebas anteriores pasan; `npm run build` sin errores.

---

### FASE 11 — Alta de empresa, ajustes, importación y exportación (sin datos de ejemplo)

**Archivos:** `src/app/(app)/inicio/**`, `src/app/(app)/ajustes/**`, `src/app/(app)/clientes/**`, `src/app/(app)/catalogo/**`, tests.

1. **Asistente de primer uso** (si la organización no tiene datos fiscales completos): datos fiscales (validados con `isValidSpanishTaxId`), logotipo, serie y formato de numeración, IVA/IRPF por defecto, validez por defecto, forma de pago/IBAN, condiciones por defecto (campo libre, **vacío por defecto**), modalidad de facturación. Hasta completarlo no se pueden emitir documentos (se muestra qué falta).
2. **Clientes y catálogo:** CRUD completo con búsqueda, validación de NIF, domicilios múltiples, importación CSV con previsualización y reporte de errores por fila, exportación CSV. El catálogo alimenta la inserción rápida de partidas (autocompletado).
3. **Plantillas de documento** definidas por el usuario (no incluidas de serie): guardar un documento como plantilla y crear desde plantilla.
4. **Estados vacíos** en todos los listados y en el panel con una acción principal ("Crear primer presupuesto", "Añadir cliente", etc.).
5. **Copia y portabilidad:** exportación completa de la organización (JSON + ficheros) y registro del evento.
6. Sin textos de relleno ni números inventados en ninguna pantalla.

**Pruebas:** un usuario recién registrado ve todas las listas vacías y cero KPIs; no se puede emitir sin datos fiscales completos (mensaje indica qué campo falta); importación CSV con 3 filas válidas y 2 inválidas inserta 3 e informa de las 2; el catálogo inserta una partida copiando precio, coste e IVA.

---

### FASE 12 — Calidad, seguridad y verificación final

**Archivos:** `scripts/verify-scope.mjs`, `scripts/check-clean.mjs`, `src/**/__tests__/*.test.ts`, `docs/*`, `README.md`.

1. `scripts/verify-scope.mjs`: ejecuta `git diff --name-only <base>` y `git status --porcelain` y falla si alguna ruta queda fuera de `presupuesto-express-v2/` o dentro de `bot ventas/`.
2. `scripts/check-clean.mjs`: escanea `src/`, `supabase/`, `public/`, `README.md` y falla si encuentra (sin distinguir mayúsculas): `mock-data`, `MOCK_`, `lorem`, `TODO`, `FIXME`, `demo`, `ejemplo`, `inteligencia artificial`, `copilot`, `chatgpt`, `openai`, `anthropic`, `claude`, `gemini`, `antigravity`, `prompt`, así como la palabra "IA" aislada, `org-001`, `Math.random` en `src/lib/`, cualquier `localStorage` fuera de `lib/repo/local.ts` y cualquier **literal de color** (`#RRGGBB`, `rgb(`, `rgba(`, `hsl(`) fuera de `src/styles/tokens.css`, `src/lib/theme/`, `src/lib/pdf/` y las plantillas de correo.
3. **Seguridad:** cabeceras (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` salvo rutas necesarias) en `next.config`; validación `zod` en **todas** las server actions y route handlers; ninguna clave `service_role` ni secreto en código cliente (comprobación por test que escanea el bundle de `.next/static` en busca de los nombres de variables secretas); sanitización de texto libre al renderizar; límites de tamaño de subida y tipos MIME permitidos; registro de errores sin datos personales.
4. **RGPD / LOPDGDD:** registro de tratamientos en `docs/CUMPLIMIENTO.md`, exportación de datos del cliente, supresión/anonimización de datos personales **sin** romper registros fiscales conservados (se anonimiza lo no obligatorio; se documenta la base legal de conservación).
5. **Rendimiento:** paginación y búsqueda en servidor en listados; índices SQL en `(org_id, doc_type, status)`, `(org_id, client_id)`, `(org_id, due_date)`; ningún `SELECT *` sin límite.
6. **Cobertura:** todos los módulos de `lib/domain`, `lib/compliance`, `lib/calculations.ts`, `lib/money.ts`, `lib/validators` con pruebas; objetivo ≥ 90 % de líneas en estos directorios (`node --test --experimental-test-coverage`).
7. **Documentación:** `README.md` (instalación, variables de entorno, migraciones, scripts), `docs/CUMPLIMIENTO.md` (requisito legal → archivo que lo implementa → test que lo verifica, con fuentes oficiales y fecha de consulta), `docs/DECISIONES.md`.

---

## 5. DEFINICIÓN DE TERMINADO (todo debe cumplirse)

- [ ] `npm test` en verde (incluye `check-clean` y `verify-scope`) y `npm run build` sin errores ni advertencias de tipos.
- [ ] `rg "mock-data|MOCK_|org-001|Math.random" src` sin coincidencias; `src/lib/mock-data.ts` eliminado.
- [ ] Un usuario nuevo ve la aplicación vacía y puede completar el flujo entero con sus propios datos: alta de empresa → cliente → presupuesto → envío → firma del cliente → factura → cobro → informe.
- [ ] 50 emisiones concurrentes de factura generan números 1…50 sin huecos ni duplicados.
- [ ] Un documento emitido o firmado no se puede editar ni borrar (comprobado en UI, servidor y base de datos).
- [ ] La cadena de registros de facturación y la de eventos se verifican desde la UI y detectan manipulaciones.
- [ ] El PDF incluye todos los datos exigidos, desglose por tipo, QR y huella (facturas), y su hash coincide con el almacenado.
- [ ] Ninguna cifra mostrada en pantalla se calcula fuera de `calculations.ts`/`money.ts`.
- [ ] Impresión desde navegador conserva cabecera y pie del documento y oculta la interfaz.
- [ ] Responsive correcto en 360/768/1024/1440 px; contraste AA; navegación completa por teclado.
- [ ] El usuario puede alternar entre modo claro, oscuro y sistema (barra superior y Ajustes → Apariencia); la preferencia persiste tras recargar y entre dispositivos, sin parpadeo al cargar.
- [ ] Ningún literal de color fuera de los archivos permitidos; todos los pares de tokens cumplen contraste AA en ambos temas y en los cinco acentos.
- [ ] La impresión sale siempre en claro aunque el tema activo sea oscuro.
- [ ] Cada organización gestiona su propio certificado (cifrado); no hay certificado global.
- [ ] Búsqueda de términos prohibidos (IA, prompt, copilot, etc.) sin resultados en todo el repositorio.
- [ ] Ningún archivo modificado fuera de `presupuesto-express-v2/`; `bot ventas` intacta.

## 6. ENTREGA

Al terminar, el agente devuelve: (1) listado de archivos creados/modificados/eliminados por fase, (2) salida de `npm test` y `npm run build`, (3) lista de configuraciones externas que el propietario debe aportar para activar cada capacidad (proyecto de Supabase, claves de Stripe, proveedor de correo, certificado electrónico, datos de la declaración responsable) indicando qué queda bloqueado hasta entonces y con qué mensaje, y (4) cualquier requisito legal que no haya podido verificar contra la fuente oficial, para revisión por un asesor fiscal.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-26T08:21:34+01:00.

The user's current state is as follows:
Active Document: c:\Users\pgonz\Desktop\app-presupuestos\presupuesto-express-v2\supabase\config.toml (LANGUAGE_TOML)
Cursor is on line: 1
Other open documents:
- c:\Users\pgonz\Desktop\app-presupuestos\presupuesto-express-v2\supabase\config.toml (LANGUAGE_TOML)
No browser pages are currently open.
</ADDITIONAL_METADATA>