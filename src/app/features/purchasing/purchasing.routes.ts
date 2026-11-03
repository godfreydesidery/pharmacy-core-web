import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  { path: 'orders', title: 'Purchase orders', loadComponent: () => import('./orders.page') },
  {
    path: 'orders/new',
    title: 'New purchase order',
    data: { permission: 'purchasing.manage' },
    loadComponent: () => import('./order-form.page'),
  },
  {
    path: 'orders/:uid',
    title: 'Purchase order',
    loadComponent: () => import('./order-detail.page'),
  },
  { path: 'receipts', title: 'Goods receipts', loadComponent: () => import('./receipts.page') },
  {
    path: 'receipts/new',
    title: 'Receive goods',
    data: { permission: 'purchasing.receive' },
    loadComponent: () => import('./receipt-form.page'),
  },
  {
    path: 'receipts/:uid',
    title: 'Goods receipt',
    loadComponent: () => import('./receipt-detail.page'),
  },
] satisfies Routes;
