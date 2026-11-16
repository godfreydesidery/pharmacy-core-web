import { Plan, PlanUsage } from '../api/subscription.models';
import { downgradeLoss, losesAnything } from './downgrade';

function plan(overrides: Partial<Plan>): Plan {
  return {
    uid: 'p',
    code: 'P',
    name: 'Plan',
    description: null,
    currency: 'TZS',
    priceMonthly: 0,
    priceYearly: 0,
    maxBranches: null,
    maxUsers: null,
    maxProducts: null,
    smsPerMonth: null,
    features: [],
    trialDays: 0,
    sortOrder: 0,
    active: true,
    ...overrides,
  };
}

const usage: PlanUsage[] = [
  { limit: 'BRANCHES', used: 2, allowed: null },
  { limit: 'USERS', used: 5, allowed: null },
  { limit: 'PRODUCTS', used: 120, allowed: null },
  { limit: 'SMS', used: 0, allowed: 5000 },
];

describe('downgradeLoss', () => {
  const pro = plan({ code: 'PRO', features: ['INSURANCE', 'ADVANCED_REPORTS', 'MULTI_CURRENCY'] });

  it('lists the limits current use exceeds and the modules the target lacks', () => {
    const starter = plan({ maxBranches: 1, maxUsers: 3, maxProducts: 500, smsPerMonth: 200 });
    const loss = downgradeLoss(usage, pro, starter);
    expect(loss.limits).toEqual([
      { limit: 'BRANCHES', used: 2, allowed: 1 },
      { limit: 'USERS', used: 5, allowed: 3 },
    ]);
    expect(loss.features).toEqual(['INSURANCE', 'ADVANCED_REPORTS', 'MULTI_CURRENCY']);
    expect(losesAnything(loss)).toBe(true);
  });

  it('finds nothing when moving up or sideways', () => {
    expect(losesAnything(downgradeLoss(usage, plan({}), pro))).toBe(false);
  });
});
