import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { firstAllowedPath } from './core/layout/nav';
import {
  authGuard,
  guestGuard,
  permissionGuard,
  rootGuard,
  workspaceGuard,
} from './core/session/guards';
import { leaveGuard } from './core/session/leave-guard';
import { SessionStore } from './core/session/session.store';
import { planGuard } from './core/subscription/plan-guard';

const page = (permission: string) => ({ data: { permission } });

export const routes: Routes = [
  {
    path: 'sign-in',
    canActivate: [guestGuard],
    title: 'Sign in · Pharmacy Core',
    loadComponent: () => import('./features/auth/sign-in.page'),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    title: 'Reset password · Pharmacy Core',
    loadComponent: () => import('./features/auth/forgot-password.page'),
  },
  {
    path: 'reset-password',
    title: 'Choose a new password · Pharmacy Core',
    loadComponent: () => import('./features/auth/reset-password.page'),
  },
  {
    path: 'accept-invitation',
    title: 'Accept invitation · Pharmacy Core',
    loadComponent: () => import('./features/auth/accept-invitation.page'),
  },
  {
    path: 'workspace',
    canActivate: [authGuard],
    title: 'Choose workspace · Pharmacy Core',
    loadComponent: () => import('./features/auth/workspace.page'),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'account',
        title: 'Account',
        loadComponent: () => import('./features/auth/account.page'),
      },
      {
        path: 'notifications',
        title: 'Notifications',
        loadComponent: () => import('./features/notifications/inbox.page'),
      },
      {
        path: 'platform',
        canActivate: [rootGuard],
        loadChildren: () => import('./features/platform/platform.routes'),
      },
      {
        path: '',
        canActivateChild: [workspaceGuard, permissionGuard, planGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: () => {
              const session = inject(SessionStore);
              if (!session.tenant()) {
                return session.isRoot() ? '/platform' : '/workspace';
              }
              return firstAllowedPath((permission) => session.can(permission));
            },
          },
          {
            path: 'dashboard',
            title: 'Dashboard',
            ...page('dashboard.view'),
            loadComponent: () => import('./features/dashboard/dashboard.page'),
          },
          {
            path: 'pos',
            title: 'Point of Sale',
            ...page('sales.sell'),
            canDeactivate: [leaveGuard],
            loadComponent: () => import('./features/pos/pos.page'),
          },
          {
            path: 'sales',
            ...page('sales.view'),
            loadChildren: () => import('./features/sales/sales.routes'),
          },
          {
            path: 'inventory',
            ...page('inventory.view'),
            loadChildren: () => import('./features/inventory/inventory.routes'),
          },
          {
            path: 'purchasing',
            ...page('purchasing.view'),
            loadChildren: () => import('./features/purchasing/purchasing.routes'),
          },
          {
            path: 'catalogue',
            ...page('catalogue.view'),
            loadChildren: () => import('./features/catalogue/catalogue.routes'),
          },
          {
            path: 'customers',
            title: 'Customers',
            ...page('partners.view'),
            loadComponent: () => import('./features/partners/customers.page'),
          },
          {
            path: 'suppliers',
            title: 'Suppliers',
            ...page('partners.view'),
            loadComponent: () => import('./features/partners/suppliers.page'),
          },
          {
            path: 'finance',
            ...page('finance.view'),
            loadChildren: () => import('./features/finance/finance.routes'),
          },
          {
            path: 'receivables',
            ...page('finance.view'),
            loadChildren: () => import('./features/receivables/receivables.routes'),
          },
          {
            path: 'insurance',
            loadChildren: () => import('./features/insurance/insurance.routes'),
          },
          {
            path: 'reports',
            title: 'Reports',
            ...page('reports.view'),
            loadComponent: () => import('./features/reports/reports.page'),
          },
          { path: 'admin', loadChildren: () => import('./features/admin/admin.routes') },
          {
            path: 'not-in-plan',
            title: 'Not in your plan',
            loadComponent: () => import('./features/misc/not-in-plan.page'),
          },
        ],
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./features/misc/not-found.page'),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
