import { Routes } from '@angular/router';
import { leaveGuard } from '../../core/session/leave-guard';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  { path: 'stock', title: 'Stock', loadComponent: () => import('./stock.page') },
  { path: 'expiry', title: 'Expiry', loadComponent: () => import('./expiry.page') },
  { path: 'movements', title: 'Stock movements', loadComponent: () => import('./movements.page') },
  { path: 'recalls', title: 'Recalls', loadComponent: () => import('./recalls.page') },
  {
    path: 'destructions',
    title: 'Destructions',
    loadComponent: () => import('./destructions.page'),
  },
  {
    path: 'stock-counts',
    title: 'Stock-takes',
    loadComponent: () => import('./stock-counts.page'),
  },
  {
    path: 'repack',
    title: 'Repack & compound',
    data: { permission: 'inventory.adjust' },
    loadComponent: () => import('./repack.page'),
  },
  {
    path: 'controlled',
    title: 'Controlled drugs',
    loadComponent: () => import('./controlled.page'),
  },
  {
    path: 'adverse-reactions',
    title: 'Adverse reactions',
    data: { permission: 'health.view' },
    loadComponent: () => import('./adverse-reactions.page'),
  },
  {
    path: 'adjustments',
    title: 'Stock adjustments',
    data: { permission: 'inventory.adjust' },
    canDeactivate: [leaveGuard],
    loadComponent: () => import('./adjustments.page'),
  },
  {
    path: 'transfers',
    title: 'Transfers',
    data: { permission: 'inventory.transfer' },
    canDeactivate: [leaveGuard],
    loadComponent: () => import('./transfers.page'),
  },
] satisfies Routes;
