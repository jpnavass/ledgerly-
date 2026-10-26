// ============================================================================
// Dominio de Miembros y Organización — Presupuesto Express Enterprise
// ============================================================================

import type { Membership, UserRole } from '../../types/index.ts';

export class MembershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MembershipError';
  }
}

/**
 * Valida si un miembro puede ser revocado o eliminado de la organización.
 * Regla: Siempre debe quedar al menos un propietario (owner) activo.
 */
export function assertCanRemoveMember(members: readonly Membership[], memberIdToRemove: string): void {
  const target = members.find((m) => m.id === memberIdToRemove);
  if (!target) {
    throw new MembershipError('El miembro especificado no pertenece a la organización.');
  }

  if (target.role === 'owner') {
    const activeOwners = members.filter((m) => m.role === 'owner' && m.is_active && m.id !== memberIdToRemove);
    if (activeOwners.length === 0) {
      throw new MembershipError(
        'Operación denegada: La organización debe contar con al menos un propietario (owner) activo.'
      );
    }
  }
}

/**
 * Valida si se puede cambiar el rol de un miembro existente.
 * Regla: Si se degrada de owner a employee, debe quedar al menos otro owner activo.
 */
export function assertCanChangeMemberRole(
  members: readonly Membership[],
  memberId: string,
  newRole: UserRole
): void {
  const target = members.find((m) => m.id === memberId);
  if (!target) {
    throw new MembershipError('El miembro especificado no pertenece a la organización.');
  }

  if (target.role === 'owner' && newRole !== 'owner') {
    const remainingOwners = members.filter(
      (m) => m.role === 'owner' && m.is_active && m.id !== memberId
    );
    if (remainingOwners.length === 0) {
      throw new MembershipError(
        'Operación denegada: No es posible cambiar el rol del único propietario activo de la empresa.'
      );
    }
  }
}

/**
 * Valida un correo de invitación a la organización.
 */
export function validateMemberInvitation(email: string, role: UserRole): void {
  if (!email || !email.includes('@') || !email.includes('.')) {
    throw new MembershipError('La dirección de correo electrónico introducida no es válida.');
  }
  if (role !== 'owner' && role !== 'employee') {
    throw new MembershipError('El rol asignado debe ser propietario ("owner") o empleado ("employee").');
  }
}
