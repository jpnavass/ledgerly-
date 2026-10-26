// ============================================================================
// Parámetros y Configuración Normativa — Presupuesto Express Enterprise
// ============================================================================

export interface ComplianceConfig {
  rd_1007_2023: {
    corporate_taxpayers_mandatory_date: string;
    other_taxpayers_mandatory_date: string;
    announced_extension_date: string;
    last_boe_check_date: string;
    official_reference: string;
  };
  producer: {
    name: string;
    tax_id: string;
    software_name: string;
    software_version: string;
    declaration_date: string;
  };
  retention: {
    minimum_years_commercial: number;
    minimum_years_tax: number;
  };
}

export const COMPLIANCE_CONFIG: ComplianceConfig = {
  rd_1007_2023: {
    corporate_taxpayers_mandatory_date: '2027-01-01',
    other_taxpayers_mandatory_date: '2027-07-01',
    announced_extension_date: '2028-10-01', // Anuncio del Ministerio pendiente de publicación en BOE
    last_boe_check_date: '2026-10-26',
    official_reference: 'Real Decreto 1007/2023 y Orden HAC/1177/2024',
  },
  producer: {
    name: process.env.SOFTWARE_PRODUCER_NAME || 'Presupuesto Express Enterprise S.L.',
    tax_id: process.env.SOFTWARE_PRODUCER_TAX_ID || 'B88549126',
    software_name: 'Presupuesto Express Enterprise',
    software_version: '2.0.0',
    declaration_date: '2027-01-01',
  },
  retention: {
    minimum_years_commercial: 6, // Código de Comercio Art. 30
    minimum_years_tax: 4, // Ley General Tributaria Art. 66
  },
};
