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
    path: 'approvals',
    title: 'Pending approvals',
    loadComponent: () => import('./approvals.page'),
  },
  {
    path: 'accounts',
    title: 'Account recovery',
    loadComponent: () => import('./account-recovery.page'),
  },
  { path: 'audit', title: 'Platform audit', loadComponent: () => import('./audit.page') },
  { path: 'plans', title: 'Plans', loadComponent: () => import('./plans.page') },
  { path: 'message-providers', pathMatch: 'full', redirectTo: 'message-providers/email' },
  {
    path: 'message-providers/email',
    title: 'Email providers',
    data: { channel: 'EMAIL' },
    loadComponent: () => import('./providers.page'),
  },
  {
    path: 'message-providers/sms',
    title: 'SMS providers',
    data: { channel: 'SMS' },
    loadComponent: () => import('./providers.page'),
  },
  {
    path: 'message-providers/whatsapp',
    title: 'WhatsApp providers',
    data: { channel: 'WHATSAPP' },
    loadComponent: () => import('./providers.page'),
  },
  {
    path: 'payment-methods',
    title: 'Payment methods',
    loadComponent: () => import('./payment-methods.page'),
  },
] satisfies Routes;
