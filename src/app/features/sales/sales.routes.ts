import { Routes } from '@angular/router';
import { TILL_SHIFTS_ENABLED } from '../../core/features';

export default [
  { path: '', title: 'Sales', loadComponent: () => import('./sales.page') },
  { path: 'returns', title: 'Sales returns', loadComponent: () => import('./returns.page') },
  { path: 'vouchers', title: 'Vouchers', loadComponent: () => import('./vouchers.page') },
  // Without till shifts the old address goes to Sales history (not to a sale called "shifts").
  TILL_SHIFTS_ENABLED
    ? { path: 'shifts', title: 'Shifts', loadComponent: () => import('./shifts.page') }
    : { path: 'shifts', redirectTo: '' },
  { path: ':uid', title: 'Sale', loadComponent: () => import('./sale-detail.page') },
] satisfies Routes;
