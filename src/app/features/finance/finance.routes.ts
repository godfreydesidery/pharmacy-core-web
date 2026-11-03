import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'expenses' },
  { path: 'expenses', title: 'Expenses', loadComponent: () => import('./expenses.page') },
  { path: 'accounts', title: 'Chart of accounts', loadComponent: () => import('./accounts.page') },
  { path: 'journal', title: 'Journal', loadComponent: () => import('./journal.page') },
  {
    path: 'exchange-rates',
    title: 'Exchange rates',
    loadComponent: () => import('./fx-rates.page'),
  },
  {
    path: 'supplier-payments',
    title: 'Supplier payments',
    loadComponent: () => import('./supplier-payments.page'),
  },
] satisfies Routes;
