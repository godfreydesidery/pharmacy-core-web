import { PlanFeature } from '../api/subscription.models';
import { TILL_SHIFTS_ENABLED } from '../features';

/** The sidebar: groups of links, each shown only to sessions holding its permission. */
export interface NavLink {
  label: string;
  path: string;
  permission?: string;
  /** The subscription plan module the page needs; hidden when the plan lacks it. */
  feature?: PlanFeature;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  permission?: string;
  children?: NavLink[];
  rootOnly?: boolean;
  /** The subscription plan module the whole group needs. */
  feature?: PlanFeature;
}

export const PLATFORM_NAV: NavItem[] = [
  {
    id: 'platform-overview',
    label: 'Platform overview',
    icon: 'globe',
    path: '/platform',
    rootOnly: true,
  },
  {
    id: 'platform-tenants',
    label: 'Tenants',
    icon: 'building',
    path: '/platform/tenants',
    rootOnly: true,
  },
  {
    id: 'platform-roots',
    label: 'Root administrators',
    icon: 'key',
    path: '/platform/root-admins',
    rootOnly: true,
  },
  {
    id: 'platform-providers',
    label: 'Message providers',
    icon: 'bell',
    path: '/platform/message-providers',
    rootOnly: true,
  },
  {
    id: 'platform-plans',
    label: 'Plans',
    icon: 'layers',
    path: '/platform/plans',
    rootOnly: true,
  },
  {
    id: 'platform-audit',
    label: 'Platform audit',
    icon: 'activity',
    path: '/platform/audit',
    rootOnly: true,
  },
  {
    id: 'platform-payments',
    label: 'Payment methods',
    icon: 'wallet',
    path: '/platform/payment-methods',
    rootOnly: true,
  },
];

export const TENANT_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'home',
    path: '/dashboard',
    permission: 'dashboard.view',
  },
  { id: 'pos', label: 'Point of Sale', icon: 'scan', path: '/pos', permission: 'sales.sell' },
  {
    id: 'sales',
    label: 'Sales',
    icon: 'cart',
    children: [
      { label: 'Sales history', path: '/sales', permission: 'sales.view' },
      { label: 'Returns', path: '/sales/returns', permission: 'sales.view' },
      { label: 'Vouchers', path: '/sales/vouchers', permission: 'sales.view' },
      ...(TILL_SHIFTS_ENABLED
        ? [{ label: 'Shifts', path: '/sales/shifts', permission: 'reports.view' }]
        : []),
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'box',
    children: [
      { label: 'Stock', path: '/inventory/stock', permission: 'inventory.view' },
      { label: 'Expiry', path: '/inventory/expiry', permission: 'inventory.view' },
      { label: 'Movements', path: '/inventory/movements', permission: 'inventory.view' },
      { label: 'Stock-takes', path: '/inventory/stock-counts', permission: 'inventory.view' },
      { label: 'Repack & compound', path: '/inventory/repack', permission: 'inventory.adjust' },
      { label: 'Controlled drugs', path: '/inventory/controlled', permission: 'inventory.view' },
      { label: 'Recalls', path: '/inventory/recalls', permission: 'inventory.view' },
      { label: 'Destructions', path: '/inventory/destructions', permission: 'inventory.view' },
      { label: 'Adjustments', path: '/inventory/adjustments', permission: 'inventory.adjust' },
      { label: 'Transfers', path: '/inventory/transfers', permission: 'inventory.transfer' },
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    icon: 'bag',
    children: [
      { label: 'Purchase orders', path: '/purchasing/orders', permission: 'purchasing.view' },
      { label: 'Goods receipts', path: '/purchasing/receipts', permission: 'purchasing.view' },
      {
        label: 'Supplier returns',
        path: '/purchasing/supplier-returns',
        permission: 'purchasing.view',
      },
      { label: 'Reorder suggestions', path: '/purchasing/reorder', permission: 'purchasing.view' },
      {
        label: 'Supplier balances',
        path: '/purchasing/supplier-balances',
        permission: 'purchasing.view',
      },
    ],
  },
  {
    id: 'catalogue',
    label: 'Catalogue',
    icon: 'pill',
    children: [
      { label: 'Products', path: '/catalogue/products', permission: 'catalogue.view' },
      { label: 'Pricing', path: '/catalogue/pricing', permission: 'catalogue.view' },
      { label: 'Categories', path: '/catalogue/categories', permission: 'catalogue.view' },
      { label: 'Manufacturers', path: '/catalogue/manufacturers', permission: 'catalogue.view' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: 'users',
    path: '/customers',
    permission: 'partners.view',
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    icon: 'truck',
    path: '/suppliers',
    permission: 'partners.view',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'wallet',
    children: [
      { label: 'Expenses', path: '/finance/expenses', permission: 'finance.view' },
      { label: 'Chart of accounts', path: '/finance/accounts', permission: 'finance.view' },
      { label: 'Journal', path: '/finance/journal', permission: 'finance.view' },
      {
        label: 'Statements',
        path: '/finance/statements',
        permission: 'finance.view',
        feature: 'ADVANCED_REPORTS',
      },
      {
        label: 'Supplier payments',
        path: '/finance/supplier-payments',
        permission: 'finance.view',
      },
      {
        label: 'Exchange rates',
        path: '/finance/exchange-rates',
        permission: 'finance.view',
        feature: 'MULTI_CURRENCY',
      },
      { label: 'Opening balances', path: '/finance/opening-balances', permission: 'finance.view' },
      { label: 'Period lock', path: '/finance/period-lock', permission: 'finance.view' },
      { label: 'Receivables', path: '/receivables', permission: 'finance.view' },
    ],
  },
  {
    id: 'insurance',
    label: 'Insurance',
    icon: 'stethoscope',
    feature: 'INSURANCE',
    children: [
      { label: 'Claims', path: '/insurance/claims', permission: 'finance.view' },
      { label: 'Claim batches', path: '/insurance/batches', permission: 'finance.view' },
      { label: 'Remittances', path: '/insurance/remittances', permission: 'finance.view' },
      { label: 'Members', path: '/insurance/members', permission: 'partners.view' },
      { label: 'Payers & schemes', path: '/insurance/payers', permission: 'partners.view' },
    ],
  },
  { id: 'reports', label: 'Reports', icon: 'chart', path: '/reports', permission: 'reports.view' },
  {
    id: 'admin',
    label: 'Administration',
    icon: 'shield',
    children: [
      { label: 'Users', path: '/admin/users', permission: 'users.manage' },
      { label: 'Roles & permissions', path: '/admin/roles', permission: 'users.manage' },
      { label: 'Branches', path: '/admin/branches', permission: 'branches.manage' },
      { label: 'Settings', path: '/admin/settings', permission: 'settings.manage' },
      { label: 'Subscription', path: '/admin/subscription', permission: 'settings.manage' },
      { label: 'Payment methods', path: '/admin/payment-methods', permission: 'settings.manage' },
      {
        label: 'Integrations',
        path: '/admin/webhooks',
        permission: 'integrations.manage',
        feature: 'INTEGRATIONS',
      },
      { label: 'Notifications', path: '/admin/notifications', permission: 'settings.manage' },
      { label: 'Audit log', path: '/admin/audit', permission: 'settings.manage' },
    ],
  },
];

/** The first tenant page the session may open, so a cashier lands on the POS. */
export function firstAllowedPath(can: (permission?: string) => boolean): string {
  for (const item of TENANT_NAV) {
    if (item.path && can(item.permission)) {
      return item.path;
    }
    const child = item.children?.find((link) => can(link.permission));
    if (child) {
      return child.path;
    }
  }
  return '/workspace';
}
