// ============================================================================
// Pruebas Unitarias — Límites y Planes (plans.ts)
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertWithinPlan, PlanLimitError, getActivePlan } from '../domain/plans.ts';
import type { License } from '../../types/index.ts';

describe('Límites y Planes SaaS (plans.ts)', () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const freeLicense: License = {
    id: 'lic-free',
    org_id: 'org-test',
    plan: 'free',
    valid_until: futureDate,
    is_active: true,
  };

  const proLicense: License = {
    id: 'lic-pro',
    org_id: 'org-test',
    plan: 'pro',
    valid_until: futureDate,
    is_active: true,
  };

  const businessLicense: License = {
    id: 'lic-biz',
    org_id: 'org-test',
    plan: 'business',
    valid_until: futureDate,
    is_active: true,
  };

  it('Plan Free: valida el límite exacto de documentos al mes (máx 5)', () => {
    // 4 documentos -> OK
    assert.doesNotThrow(() =>
      assertWithinPlan(freeLicense, { documents_this_month: 4, active_users: 1 }, 'create_document')
    );

    // 5 documentos -> Límite alcanzado, debe lanzar
    assert.throws(
      () =>
        assertWithinPlan(freeLicense, { documents_this_month: 5, active_users: 1 }, 'create_document'),
      (err: Error) => {
        assert(err instanceof PlanLimitError);
        assert.strictEqual(err.code, 'LIMIT_DOCUMENTS_MONTHLY');
        assert(err.message.includes('límite de 5 documentos'));
        return true;
      }
    );
  });

  it('Plan Free: valida límite exacto de usuarios (máx 1)', () => {
    assert.doesNotThrow(() =>
      assertWithinPlan(freeLicense, { documents_this_month: 0, active_users: 0 }, 'invite_member')
    );

    assert.throws(
      () =>
        assertWithinPlan(freeLicense, { documents_this_month: 0, active_users: 1 }, 'invite_member'),
      (err: Error) => {
        assert(err instanceof PlanLimitError);
        assert.strictEqual(err.code, 'LIMIT_MAX_USERS');
        assert(err.message.includes('máximo de 1 usuario(s)'));
        return true;
      }
    );
  });

  it('Plan Free: bloquea características avanzadas (firma, tesorería, gastos)', () => {
    assert.throws(
      () =>
        assertWithinPlan(freeLicense, { documents_this_month: 0, active_users: 1 }, 'sign_document'),
      (err: Error) => err instanceof PlanLimitError && err.code === 'FEATURE_SIGNATURE_REQUIRED'
    );

    assert.throws(
      () =>
        assertWithinPlan(freeLicense, { documents_this_month: 0, active_users: 1 }, 'manage_treasury'),
      (err: Error) => err instanceof PlanLimitError && err.code === 'FEATURE_TREASURY_REQUIRED'
    );

    assert.throws(
      () =>
        assertWithinPlan(freeLicense, { documents_this_month: 0, active_users: 1 }, 'manage_expenses'),
      (err: Error) => err instanceof PlanLimitError && err.code === 'FEATURE_EXPENSES_REQUIRED'
    );
  });

  it('Plan Pro: permite hasta 100 documentos, 5 usuarios y características avanzadas', () => {
    // 99 documentos -> OK
    assert.doesNotThrow(() =>
      assertWithinPlan(proLicense, { documents_this_month: 99, active_users: 4 }, 'create_document')
    );

    // 100 documentos -> Límite alcanzado
    assert.throws(
      () =>
        assertWithinPlan(proLicense, { documents_this_month: 100, active_users: 4 }, 'create_document'),
      (err: Error) => err instanceof PlanLimitError && err.code === 'LIMIT_DOCUMENTS_MONTHLY'
    );

    // 4 usuarios -> invitar OK
    assert.doesNotThrow(() =>
      assertWithinPlan(proLicense, { documents_this_month: 10, active_users: 4 }, 'invite_member')
    );

    // 5 usuarios -> límite alcanzado
    assert.throws(
      () =>
        assertWithinPlan(proLicense, { documents_this_month: 10, active_users: 5 }, 'invite_member'),
      (err: Error) => err instanceof PlanLimitError && err.code === 'LIMIT_MAX_USERS'
    );

    // Características permitidas
    assert.doesNotThrow(() =>
      assertWithinPlan(proLicense, { documents_this_month: 10, active_users: 1 }, 'sign_document')
    );
    assert.doesNotThrow(() =>
      assertWithinPlan(proLicense, { documents_this_month: 10, active_users: 1 }, 'manage_treasury')
    );
    assert.doesNotThrow(() =>
      assertWithinPlan(proLicense, { documents_this_month: 10, active_users: 1 }, 'manage_expenses')
    );
  });

  it('Plan Business: documentos ilimitados y hasta 25 usuarios', () => {
    assert.doesNotThrow(() =>
      assertWithinPlan(businessLicense, { documents_this_month: 50000, active_users: 20 }, 'create_document')
    );
    assert.doesNotThrow(() =>
      assertWithinPlan(businessLicense, { documents_this_month: 50000, active_users: 24 }, 'invite_member')
    );
    assert.throws(
      () =>
        assertWithinPlan(businessLicense, { documents_this_month: 50000, active_users: 25 }, 'invite_member'),
      (err: Error) => err instanceof PlanLimitError && err.code === 'LIMIT_MAX_USERS'
    );
  });

  it('Licencia caducada o inactiva revierte a Plan Gratuito', () => {
    const expiredLicense: License = {
      ...proLicense,
      valid_until: pastDate,
    };
    const { plan } = getActivePlan(expiredLicense);
    assert.strictEqual(plan, 'free');

    // Debe bloquear firma al haber revertido a free
    assert.throws(
      () =>
        assertWithinPlan(expiredLicense, { documents_this_month: 0, active_users: 1 }, 'sign_document'),
      (err: Error) => err instanceof PlanLimitError
    );
  });
});
