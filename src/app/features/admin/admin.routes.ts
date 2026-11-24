import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'users',
    title: 'Users',
    data: { permission: 'users.manage' },
    loadComponent: () => import('./users.page'),
  },
  {
    path: 'roles',
    title: 'Roles',
    data: { permission: 'users.manage' },
    loadComponent: () => import('./roles.page'),
  },
  {
    path: 'branches',
    title: 'Branches',
    data: { permission: 'branches.manage' },
    loadComponent: () => import('./branches.page'),
  },
  {
    path: 'settings',
    title: 'Settings',
    data: { permission: 'settings.manage' },
    loadComponent: () => import('./settings.page'),
  },
  {
    path: 'subscription',
    title: 'Subscription',
    data: { permission: 'settings.manage' },
    loadComponent: () => import('./subscription.page'),
  },
  {
    path: 'webhooks',
    title: 'Integrations',
    data: { permission: 'integrations.manage' },
    loadComponent: () => import('./webhooks.page'),
  },
  {
    path: 'notifications',
    title: 'Notifications',
    data: { permission: 'settings.manage' },
    loadComponent: () => import('./notifications.page'),
  },
  {
    path: 'audit',
    title: 'Audit log',
    data: { permission: 'settings.manage' },
    loadComponent: () => import('./audit.page'),
  },
  {
    path: 'privacy-requests',
    title: 'Data requests',
    data: { permission: 'data.export' },
    loadComponent: () => import('./privacy-requests.page'),
  },
  {
    path: 'payment-methods',
    title: 'Payment methods',
    data: { permission: 'settings.manage' },
    loadComponent: () => import('./payment-methods.page'),
  },
] satisfies Routes;
