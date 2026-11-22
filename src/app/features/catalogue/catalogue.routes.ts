import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'products', title: 'Products', loadComponent: () => import('./products.page') },
  { path: 'pricing', title: 'Pricing', loadComponent: () => import('./pricing.page') },
  {
    path: 'pricing-plans',
    title: 'Pricing plans',
    loadComponent: () => import('./pricing-plans.page'),
  },
  {
    path: 'products/new',
    title: 'New product',
    data: { permission: 'catalogue.manage' },
    loadComponent: () => import('./product-form.page'),
  },
  {
    path: 'products/:uid',
    title: 'Product',
    loadComponent: () => import('./product-form.page'),
  },
  { path: 'categories', title: 'Categories', loadComponent: () => import('./categories.page') },
  {
    path: 'manufacturers',
    title: 'Manufacturers',
    loadComponent: () => import('./manufacturers.page'),
  },
] satisfies Routes;
