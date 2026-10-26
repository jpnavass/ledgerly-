# Documentación de Cumplimiento Normativo y Legal

**Producto:** Presupuesto Express Enterprise  
**Fecha de consulta oficial y verificación:** 2026-10-26  
**Fuentes oficiales:** Boletín Oficial del Estado (BOE) y Agencia Estatal de Administración Tributaria (AEAT)

---

## 1. Mapeo de Requisitos Legales a Código y Pruebas

| Requisito Legal | Fuente Oficial | Archivo de Implementación | Archivo de Prueba |
|-----------------|----------------|---------------------------|-------------------|
| **Formato y contenido mínimo de facturas** (NIF, domicilio, series, tipos impositivos, cuota desglosada) | Real Decreto 1619/2012, Arts. 6 y 7 | `src/lib/calculations.ts`<br>`src/lib/domain/documents.ts` | `src/lib/__tests__/calculations.test.ts`<br>`src/lib/__tests__/documents.test.ts` |
| **Facturas rectificativas** (motivo, referencia expresa a factura original, método de rectificación) | Real Decreto 1619/2012, Art. 15 | `src/lib/domain/documents.ts` (`createCreditNoteDocument`) | `src/lib/__tests__/documents.test.ts` |
| **Numeración correlativa sin saltos ni duplicados** | Real Decreto 1619/2012, Art. 6.1.a | `src/lib/domain/numbering.ts`<br>`supabase/migrations/0003_functions.sql` | `src/lib/__tests__/documents.test.ts` |
| **Integridad e inalterabilidad de registros de facturación** | Ley 11/2021 (Art. 29.2.j LGT) y RD 1007/2023 | `src/lib/compliance/billing-record.ts`<br>`src/lib/compliance/hash.ts` | `src/lib/__tests__/compliance.test.ts` |
| **Huella digital SHA-256 encadenada** | Especificación técnica AEAT (Orden HAC/1177/2024) | `src/lib/compliance/billing-record.ts` | `src/lib/__tests__/compliance.test.ts` |
| **Código QR de cotejo en facturas** | Parámetros según especificación AEAT, no verificados | `src/lib/compliance/qr.ts` | `src/lib/__tests__/compliance.test.ts`<br>`src/lib/__tests__/pdf.test.ts` |
| **Registro de eventos inalterable (Audit Log append-only)** | RD 1007/2023, Art. 8 | `src/lib/compliance/audit.ts` | `src/lib/__tests__/compliance.test.ts` |
| **Conservación mínima de 6 años** | Código de Comercio, Art. 30 | `src/lib/compliance/config.ts` | `src/lib/__tests__/compliance.test.ts` |
| **Declaración responsable del productor del software** | RD 1007/2023, Art. 13 | `src/app/legal/declaracion-responsable/page.tsx` | Verificación en build y escaneo de configuración |
| **Firma electrónica simple con evidencias de trazabilidad** | Reglamento (UE) Nº 910/2014 (eIDAS) | `src/lib/compliance/evidence.ts` | `src/lib/__tests__/compliance.test.ts` |

> [!NOTE]
> **Estado de verificación del código QR:** Los parámetros codificados en la URL (`nif`, `numserie`, `fecha`, `importe`) son parámetros según especificación AEAT, no verificados de forma directa contra el texto definitivo publicado en el BOE. Los parámetros `num`, `total`, `hash` y `csv` han sido explícitamente excluidos al no constar en dicha especificación. El vector de huella de alta en pruebas figura como vector no contrastado con documento oficial.

---

## 2. Calendario de Entrada en Vigor y Régimen Transitorio

Conforme al Real Decreto-ley 15/2025 y las disposiciones del Real Decreto 1007/2023:
1. **1 de enero de 2027:** Contribuyentes del Impuesto sobre Sociedades.
2. **1 de julio de 2027:** Resto de obligados tributarios (autónomos y entidades en régimen de atribución de rentas).
3. **Prorrogas anunciadas:** A fecha de 26 de octubre de 2026, el Ministerio de Hacienda ha anunciado una propuesta de prórroga técnica hasta octubre de 2028, pendiente de publicación efectiva en el BOE. Las fechas normativas se encuentran aisladas en `src/lib/compliance/config.ts` para su actualización inmediata sin alterar la lógica de negocio.

---

## 3. Registro de Tratamientos de Datos Personales (RGPD / LOPDGDD)

- **Responsable del tratamiento:** Cada organización usuaria respecto a sus clientes y proveedores.
- **Encargado del tratamiento:** Presupuesto Express Enterprise respecto al almacenamiento y cómputo de facturación.
- **Finalidad:** Emisión, envío, custodia legal y gestión del ciclo de vida de documentos contractuales y contables.
- **Base jurídica:** Cumplimiento de obligaciones legales (Art. 6.1.c RGPD) y ejecución de relación contractual (Art. 6.1.b RGPD).
- **Plazo de supresión:** Los datos fiscales no se destruyen durante el periodo legal obligatorio de conservación contable (6 años). Una vez transcurrido dicho periodo o ante el ejercicio de derechos de supresión, se procede al bloqueo y anonimización de datos no fiscales preservando las huellas de verificación criptográfica.
