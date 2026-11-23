/**
 * The local demo's sign-ins, offered as one-click buttons in a development build. A production
 * build replaces this file with dev-accounts.prod.ts (angular.json fileReplacements), so these
 * passwords never reach a server's JavaScript.
 */
export const DEV_ACCOUNTS: readonly { label: string; email: string; password: string }[] = [
  { label: 'Root administrator', email: 'root@pharmacy.local', password: 'Root#2026' },
  { label: 'Afya · Administrator', email: 'admin@afya.co.tz', password: 'Afya#2026' },
  { label: 'Afya · Cashier', email: 'cashier@afya.co.tz', password: 'Cashier#2026' },
];
