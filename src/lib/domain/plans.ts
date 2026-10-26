// ============================================================================
// Límites y Validación de Licencias / Planes — Presupuesto Express Enterprise
// ============================================================================

import type { License, PlanType } from '../../types/index.ts';

export interface PlanFeatures {
  digital_signature: boolean;
  treasury: boolean;
  expenses: boolean;
  export_audit: boolean;
  verifactu_mode: boolean;
}

export interface PlanDefinition {
  name: string;
  max_docs_per_month: number; // -1 para ilimitado
  max_users: number;
  features: PlanFeatures;
}

export const PLAN_DEFINITIONS: Record<PlanType, PlanDefinition> = {
  free: {
    name: 'Plan Gratuito',
    max_docs_per_month: 5,
    max_users: 1,
    features: {
      digital_signature: false,
      treasury: false,
      expenses: false,
      export_audit: false,
      verifactu_mode: false,
    },
  },
  pro: {
    name: 'Plan Profesional',
    max_docs_per_month: 100,
    max_users: 5,
    features: {
      digital_signature: true,
      treasury: true,
      expenses: true,
      export_audit: true,
      verifactu_mode: true,
    },
  },
  business: {
    name: 'Plan Empresa',
    max_docs_per_month: -1, // Ilimitado
    max_users: 25,
    features: {
      digital_signature: true,
      treasury: true,
      expenses: true,
      export_audit: true,
      verifactu_mode: true,
    },
  },
};

export type PlanAction =
  | 'create_document'
  | 'invite_member'
  | 'sign_document'
  | 'manage_treasury'
  | 'manage_expenses'
  | 'verifactu_integration';

export interface UsageMetrics {
  documents_this_month: number;
  active_users: number;
}

export class PlanLimitError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'PLAN_LIMIT_EXCEEDED') {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
  }
}

/**
 * Obtiene la definición del plan a partir de la licencia. Si la licencia es nula o está inactiva/caducada,
 * se aplica el Plan Gratuito (o se rechaza según la regla requerida).
 */
export function getActivePlan(license?: License | null): { plan: PlanType; def: PlanDefinition } {
  if (!license || !license.is_active) {
    return { plan: 'free', def: PLAN_DEFINITIONS.free };
  }

  // Comprobar caducidad si tiene fecha
  if (license.valid_until) {
    const validUntilDate = new Date(license.valid_until);
    if (validUntilDate.getTime() < Date.now()) {
      return { plan: 'free', def: PLAN_DEFINITIONS.free };
    }
  }

  const def = PLAN_DEFINITIONS[license.plan] || PLAN_DEFINITIONS.free;
  return { plan: license.plan, def };
}

/**
 * Verifica de forma pura si una acción solicitada está dentro de los límites del plan actual.
 * Lanza PlanLimitError con explicaciones claras en español si se superan los límites.
 */
export function assertWithinPlan(
  license: License | null | undefined,
  usage: UsageMetrics,
  action: PlanAction
): void {
  const { plan, def } = getActivePlan(license);

  switch (action) {
    case 'create_document': {
      if (def.max_docs_per_month !== -1 && usage.documents_this_month >= def.max_docs_per_month) {
        throw new PlanLimitError(
          `Ha alcanzado el límite de ${def.max_docs_per_month} documentos este mes para su ${def.name}. Actualice a un plan superior para continuar emitiendo.`,
          'LIMIT_DOCUMENTS_MONTHLY'
        );
      }
      break;
    }

    case 'invite_member': {
      if (usage.active_users >= def.max_users) {
        throw new PlanLimitError(
          `Su ${def.name} permite un máximo de ${def.max_users} usuario(s) simultáneo(s). Actualice su plan para invitar más miembros.`,
          'LIMIT_MAX_USERS'
        );
      }
      break;
    }

    case 'sign_document': {
      if (!def.features.digital_signature) {
        throw new PlanLimitError(
          `La firma electrónica certificada del cliente requiere el Plan Profesional o Plan Empresa.`,
          'FEATURE_SIGNATURE_REQUIRED'
        );
      }
      break;
    }

    case 'manage_treasury': {
      if (!def.features.treasury) {
        throw new PlanLimitError(
          `El módulo de tesorería y control de cobros requiere el Plan Profesional o Plan Empresa.`,
          'FEATURE_TREASURY_REQUIRED'
        );
      }
      break;
    }

    case 'manage_expenses': {
      if (!def.features.expenses) {
        throw new PlanLimitError(
          `El registro y cálculo de rentabilidad de gastos requiere el Plan Profesional o Plan Empresa.`,
          'FEATURE_EXPENSES_REQUIRED'
        );
      }
      break;
    }

    case 'verifactu_integration': {
      if (!def.features.verifactu_mode) {
        throw new PlanLimitError(
          `El registro telemático directo Veri*Factu requiere el Plan Profesional o Empresa.`,
          'FEATURE_VERIFACTU_REQUIRED'
        );
      }
      break;
    }
  }
}
