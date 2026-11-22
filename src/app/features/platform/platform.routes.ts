import { Routes } from '@angular/router';

export default [
  { path: '', title: 'Platform', loadComponent: () => import('./overview.page') },
  { path: 'tenants', title: 'Tenants', loadComponent: () => import('./tenants.page') },
  { path: 'tenants/:uid', title: 'Tenant', loadComponent: () => import('./tenant-detail.page') },
  {
    path: 'root-admins',
    title: 'Root administrators',
    loadComponent: () => import('./root-admins.page'),
  },
  {
    path: 'accounts',
    title: 'Account recovery',
    loadComponent: () => import('./account-recovery.page'),
  },
  { path: 'audit', title: 'Platform audit', loadComponent: () => import('./audit.page') },
  { path: 'plans', title: 'Plans', loadComponent: () => import('./plans.page') },
  {
    path: 'message-providers',
    title: 'Message providers',
    loadComponent: () => import('./providers.page'),
  },
  {
    path: 'payment-methods',
    title: 'Payment methods',
    loadComponent: () => import('./payment-methods.page'),
  },
] satisfies Routes;
