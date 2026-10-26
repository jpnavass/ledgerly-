// ============================================================================
// Pruebas Unitarias — Gestión de Miembros (members.test.ts)
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanRemoveMember,
  assertCanChangeMemberRole,
  validateMemberInvitation,
  MembershipError,
} from '../domain/members.ts';
import type { Membership } from '../../types/index.ts';

describe('Gestión de Miembros y Roles (members.ts)', () => {
  const owner1: Membership = {
    id: 'm-1',
    org_id: 'org-1',
    user_id: 'u-1',
    role: 'owner',
    is_active: true,
  };

  const owner2: Membership = {
    id: 'm-2',
    org_id: 'org-1',
    user_id: 'u-2',
    role: 'owner',
    is_active: true,
  };

  const employee1: Membership = {
    id: 'm-3',
    org_id: 'org-1',
    user_id: 'u-3',
    role: 'employee',
    is_active: true,
  };

  it('permite eliminar a un empleado sin restricciones de rol mínimo', () => {
    const list = [owner1, employee1];
    assert.doesNotThrow(() => assertCanRemoveMember(list, 'm-3'));
  });

  it('permite eliminar a un propietario si queda otro propietario activo', () => {
    const list = [owner1, owner2, employee1];
    assert.doesNotThrow(() => assertCanRemoveMember(list, 'm-1'));
  });

  it('bloquea la eliminación del único propietario activo', () => {
    const list = [owner1, employee1];
    assert.throws(
      () => assertCanRemoveMember(list, 'm-1'),
      (err: Error) => {
        assert(err instanceof MembershipError);
        assert(err.message.includes('al menos un propietario (owner) activo'));
        return true;
      }
    );
  });

  it('permite cambiar el rol de un empleado a propietario', () => {
    const list = [owner1, employee1];
    assert.doesNotThrow(() => assertCanChangeMemberRole(list, 'm-3', 'owner'));
  });

  it('permite degradar un propietario a empleado si queda otro propietario', () => {
    const list = [owner1, owner2, employee1];
    assert.doesNotThrow(() => assertCanChangeMemberRole(list, 'm-1', 'employee'));
  });

  it('bloquea la degradación del único propietario activo', () => {
    const list = [owner1, employee1];
    assert.throws(
      () => assertCanChangeMemberRole(list, 'm-1', 'employee'),
      (err: Error) => {
        assert(err instanceof MembershipError);
        assert(err.message.includes('único propietario'));
        return true;
      }
    );
  });

  it('valida formatos de correo y roles en invitaciones', () => {
    assert.doesNotThrow(() => validateMemberInvitation('empleado@empresa.com', 'employee'));
    assert.throws(() => validateMemberInvitation('correo-invalido', 'employee'), MembershipError);
    assert.throws(() => validateMemberInvitation('test@empresa.com', 'otro' as unknown as 'employee'), MembershipError);
  });
});
