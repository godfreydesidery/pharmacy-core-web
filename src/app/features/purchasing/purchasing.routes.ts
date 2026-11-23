import { Routes } from '@angular/router';
import { leaveGuard } from '../../core/session/leave-guard';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  { path: 'orders', title: 'Purchase orders', loadComponent: () => import('./orders.page') },
  {
    path: 'orders/new',
    title: 'New purchase order',
    data: { permission: 'purchasing.manage' },
    canDeactivate: [leaveGuard],
    loadComponent: () => import('./order-form.page'),
  },
  {
    path: 'orders/:uid',
    title: 'Purchase order',
    loadComponent: () => import('./order-detail.page'),
  },
  { path: 'reorder', title: 'Reorder suggestions', loadComponent: () => import('./reorder.page') },
  { path: 'receipts', title: 'Goods receipts', loadComponent: () => import('./receipts.page') },
  {
    path: 'receipts/new',
    title: 'Receive goods',
    data: { permission: 'purchasing.receive' },
    canDeactivate: [leaveGuard],
    loadComponent: () => import('./receipt-form.page'),
  },
  {
    path: 'supplier-balances',
    title: 'Supplier balances',
    loadComponent: () => import('./supplier-balances.page'),
  },
  {
    path: 'supplier-returns',
    title: 'Supplier returns',
    loadComponent: () => import('./supplier-returns.page'),
  },
  {
    path: 'receipts/:uid',
    title: 'Goods receipt',
    loadComponent: () => import('./receipt-detail.page'),
  },
] satisfies Routes;
