import { Routes } from '@angular/router';
import { leaveGuard } from '../../core/session/leave-guard';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'products', title: 'Products', loadComponent: () => import('./products.page') },
  { path: 'pricing', title: 'Pricing', loadComponent: () => import('./pricing.page') },
  // The plans as buttons on one page; each plan's prices and actions on its own page.
  {
    path: 'pricing-plans',
    title: 'Pricing plans',
    loadComponent: () => import('./pricing-plans.page'),
  },
  {
    path: 'pricing-plans/:plan',
    title: 'Pricing plan',
    loadComponent: () => import('./pricing-plans.page'),
  },
  {
    path: 'products/new',
    title: 'New product',
    data: { permission: 'catalogue.manage' },
    canDeactivate: [leaveGuard],
    loadComponent: () => import('./product-form.page'),
  },
  {
    path: 'products/:uid',
    title: 'Product',
    canDeactivate: [leaveGuard],
    loadComponent: () => import('./product-form.page'),
  },
  { path: 'categories', title: 'Categories', loadComponent: () => import('./categories.page') },
  {
    path: 'manufacturers',
    title: 'Manufacturers',
    loadComponent: () => import('./manufacturers.page'),
  },
] satisfies Routes;
