import { Routes } from '@angular/router';

export default [
  { path: '', title: 'Sales', loadComponent: () => import('./sales.page') },
  { path: 'returns', title: 'Sales returns', loadComponent: () => import('./returns.page') },
  { path: ':uid', title: 'Sale', loadComponent: () => import('./sale-detail.page') },
] satisfies Routes;
