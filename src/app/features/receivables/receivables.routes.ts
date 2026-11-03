import { Routes } from '@angular/router';

export default [
  { path: '', title: 'Receivables', loadComponent: () => import('./accounts.page') },
  {
    path: ':customerUid',
    title: 'Customer account',
    loadComponent: () => import('./account.page'),
  },
  {
    path: ':customerUid/statement',
    title: 'Statement',
    loadComponent: () => import('./statement-print.page'),
  },
] satisfies Routes;
