// ============================================================================
// Pruebas Unitarias — Matriz de Permisos RBAC
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, assertCan, AuthorizationError, type PermissionAction } from '../domain/permissions.ts';

describe('Matriz de Permisos RBAC (permissions.ts)', () => {
  const allActions: PermissionAction[] = [
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
  ];

  it('el rol "owner" debe tener acceso a todas y cada una de las acciones del sistema', () => {
    for (const action of allActions) {
      assert.strictEqual(can('owner', action), true, `Owner debe poder ejecutar ${action}`);
      assert.doesNotThrow(() => assertCan('owner', action));
    }
  });

  it('el rol "employee" solo tiene acceso a acciones operativas permitidas', () => {
    const allowedForEmployee: PermissionAction[] = [
      'document.create',
      'document.edit',
      'document.issue',
      'document.delete_draft',
      'expenses.manage',
      'reports.view',
    ];

    const forbiddenForEmployee: PermissionAction[] = [
      'document.void',
      'settings.edit',
      'settings.fiscal',
      'members.manage',
      'billing.manage',
      'audit.view',
    ];

    for (const action of allowedForEmployee) {
      assert.strictEqual(can('employee', action), true, `Employee debe poder ejecutar ${action}`);
      assert.doesNotThrow(() => assertCan('employee', action));
    }

    for (const action of forbiddenForEmployee) {
      assert.strictEqual(can('employee', action), false, `Employee NO debe poder ejecutar ${action}`);
      assert.throws(() => assertCan('employee', action), AuthorizationError);
    }
  });

  it('un rol anónimo o nulo no tiene ningún permiso y lanza AuthorizationError', () => {
    for (const action of allActions) {
      assert.strictEqual(can(null, action), false);
      assert.strictEqual(can(undefined, action), false);
      assert.throws(() => assertCan(null, action), AuthorizationError);
    }
  });
});
