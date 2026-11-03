import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'members' },
  {
    path: 'claims',
    title: 'Insurance claims',
    data: { permission: 'finance.view' },
    loadComponent: () => import('./claims.page'),
  },
  {
    path: 'batches',
    title: 'Claim batches',
    data: { permission: 'finance.view' },
    loadComponent: () => import('./batches.page'),
  },
  {
    path: 'remittances',
    title: 'Remittances',
    data: { permission: 'finance.view' },
    loadComponent: () => import('./remittances.page'),
  },
  {
    path: 'payers',
    title: 'Payers & schemes',
    data: { permission: 'partners.view' },
    loadComponent: () => import('./payers.page'),
  },
  {
    path: 'members',
    title: 'Insured members',
    data: { permission: 'partners.view' },
    loadComponent: () => import('./members.page'),
  },
] satisfies Routes;
