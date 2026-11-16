import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { NavItem } from '../layout/nav';
import { SessionStore } from '../session/session.store';
import { featureForUrl, planGuard } from './plan-guard';
import { SubscriptionStore } from './subscription.store';

const nav: NavItem[] = [
  { id: 'reports', label: 'Reports', icon: 'chart', path: '/reports' },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'cash',
    children: [
      { label: 'Expenses', path: '/finance/expenses' },
      { label: 'Statements', path: '/finance/statements', feature: 'ADVANCED_REPORTS' },
    ],
  },
  {
    id: 'insurance',
    label: 'Insurance',
    icon: 'shield',
    feature: 'INSURANCE',
    children: [{ label: 'Claims', path: '/insurance/claims' }],
  },
];

describe('featureForUrl', () => {
  it('finds the module of a gated page, with query and sub-paths', () => {
    expect(featureForUrl('/finance/statements', nav)).toBe('ADVANCED_REPORTS');
    expect(featureForUrl('/finance/statements?tab=vat', nav)).toBe('ADVANCED_REPORTS');
    expect(featureForUrl('/insurance/claims/abc', nav)).toBe('INSURANCE');
  });

  it('leaves ungated pages and look-alike paths open', () => {
    expect(featureForUrl('/finance/expenses', nav)).toBeNull();
    expect(featureForUrl('/reports', nav)).toBeNull();
    expect(featureForUrl('/finance/statements-old', nav)).toBeNull();
  });
});

describe('planGuard', () => {
  const run = (allows: boolean, url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: { tenant: () => ({ uid: 't1' }), isRoot: () => false },
        },
        {
          provide: SubscriptionStore,
          // Resolves later, as the real load does, so the redirect is built after an await.
          useValue: { load: () => new Promise((r) => setTimeout(r)), allows: () => allows },
        },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      planGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  };

  it('redirects to the not-in-plan page when the plan lacks the module', async () => {
    const result = await run(false, '/insurance/claims');
    expect(result instanceof UrlTree).toBe(true);
    expect(String(result)).toContain('/not-in-plan');
    expect(String(result)).toContain('feature=INSURANCE');
  });

  it('lets the page open when the plan includes the module', async () => {
    expect(await run(true, '/insurance/claims')).toBe(true);
  });
});
