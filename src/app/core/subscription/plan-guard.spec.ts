import { NavItem } from '../layout/nav';
import { featureForUrl } from './plan-guard';

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
