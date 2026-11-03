import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  { path: 'stock', title: 'Stock', loadComponent: () => import('./stock.page') },
  { path: 'expiry', title: 'Expiry', loadComponent: () => import('./expiry.page') },
  { path: 'movements', title: 'Stock movements', loadComponent: () => import('./movements.page') },
  {
    path: 'adjustments',
    title: 'Stock adjustments',
    data: { permission: 'inventory.adjust' },
    loadComponent: () => import('./adjustments.page'),
  },
  {
    path: 'transfers',
    title: 'Transfers',
    data: { permission: 'inventory.transfer' },
    loadComponent: () => import('./transfers.page'),
  },
] satisfies Routes;
