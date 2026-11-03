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
  { path: 'audit', title: 'Platform audit', loadComponent: () => import('./audit.page') },
] satisfies Routes;
