// ============================================================================
// Matriz de Permisos por Rol — Presupuesto Express Enterprise
// ============================================================================

import type { UserRole } from '../../types/index.ts';

export type PermissionAction =
  | 'document.create'
  | 'document.edit'
  | 'document.issue'
  | 'document.void'
  | 'document.delete_draft'
  | 'settings.edit'
  | 'settings.fiscal'
  | 'members.manage'
  | 'billing.manage'
  | 'expenses.manage'
  | 'audit.view'
  | 'reports.view';

const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionAction[]> = {
  owner: [
    'document.create',
    'document.edit',
    'document.issue',
    'document.void',
    'document.delete_draft',
    'settings.edit',
    'settings.fiscal',
    'members.manage',
    'billing.manage',
    'expenses.manage',
    'audit.view',
    'reports.view',
  ],
  employee: [
    'document.create',
    'document.edit',
    'document.issue',
    'document.delete_draft',
    'expenses.manage',
    'reports.view',
    // Los empleados NO pueden:
    // - document.void (anular facturas emitidas)
    // - settings.edit / settings.fiscal (ajustes fiscales de la empresa)
    // - members.manage (gestión de usuarios y roles)
    // - billing.manage (suscripción Stripe y licencias)
    // - audit.view (registro inalterable de auditoría)
  ],
};

/**
 * Evalúa de forma pura si un rol tiene autorización para ejecutar una acción concreta.
 *
 * @param role Rol del usuario dentro de la organización ('owner' | 'employee')
 * @param action Acción requerida
 * @returns true si tiene permiso, false en caso contrario
 */
export function can(role: UserRole | null | undefined, action: PermissionAction): boolean {
  if (!role) {
    return false;
  }
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) {
    return false;
  }
  return allowed.includes(action);
}

/**
 * Lanza un error explícito en español si el rol carece de la autorización solicitada.
 */
export class AuthorizationError extends Error {
  constructor(action: PermissionAction, role?: string) {
    super(`Acción no autorizada: el rol '${role ?? 'anónimo'}' no tiene permiso para '${action}'.`);
    this.name = 'AuthorizationError';
  }
}

export function assertCan(role: UserRole | null | undefined, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new AuthorizationError(action, role ?? undefined);
  }
}
