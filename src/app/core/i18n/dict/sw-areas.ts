/**
 * The Swahili per-area dictionaries, merged into SW. Loaded on demand (a separate chunk): register
 * each new `<area>.sw.ts` here and its English pair in `en-areas.ts`.
 */
import { APPROVALS_SW } from './approvals.sw';
import { PLANNING_SW } from './planning.sw';
import { PLANS_SW } from './plans.sw';
import { PROVIDERS_SW } from './providers.sw';
import { ADMIN_SW } from './admin.sw';
import { ADMIN2_SW } from './admin2.sw';
import { INSURANCE_SW } from './insurance.sw';
import { NOTIFICATIONS_SW } from './notifications.sw';
import { PLATFORM_SW } from './platform.sw';
import { RECEIVABLES_SW } from './receivables.sw';
import { REPORTS_SW } from './reports.sw';
import { PAYABLES_SW } from './payables.sw';
import { ACCOUNTS_SW } from './accounts.sw';
import { LABELS_SW } from './labels.sw';
import { TILL_SW } from './till.sw';
import { STOCKOPS_SW } from './stockops.sw';
import { COUNTS_SW } from './counts.sw';
import { SHIFTS_SW } from './shifts.sw';
import { PAYMENTS_SW } from './payments.sw';
import { REPACK_SW } from './repack.sw';
import { PRICING_SW } from './pricing.sw';
import { STATEMENTS_SW } from './statements.sw';
import { CONTROLLED_SW } from './controlled.sw';
import { CATALOGUE_SW } from './catalogue.sw';
import { ERRORS_SW } from './errors.sw';
import { ENUM_SW } from './enum.sw';
import { FINANCE_SW } from './finance.sw';
import { INVENTORY_SW } from './inventory.sw';
import { MESSAGES_SW } from './messages.sw';
import { PARTNERS_SW } from './partners.sw';
import { POS_SW } from './pos.sw';
import { PURCHASING_SW } from './purchasing.sw';
import { IDLE_SW } from './idle.sw';
import { ACCT_SW } from './acct.sw';
import { LOGINS_SW } from './logins.sw';
import { SECURITY2_SW } from './security2.sw';
import { SALES_SW } from './sales.sw';
import { SHELL_SW } from './shell.sw';
import { UI_SW } from './ui.sw';
import { STATE_SW } from './state.sw';

export const SW_AREAS: Readonly<Record<string, string>> = {
  ...SHELL_SW,
  ...PLANNING_SW,
  ...SECURITY2_SW,
  ...IDLE_SW,
  ...LOGINS_SW,
  ...ACCT_SW,
  ...FINANCE_SW,
  ...REPORTS_SW,
  ...RECEIVABLES_SW,
  ...INSURANCE_SW,
  ...NOTIFICATIONS_SW,
  ...PLATFORM_SW,
  ...ADMIN_SW,
  ...ADMIN2_SW,
  ...POS_SW,
  ...SALES_SW,
  ...INVENTORY_SW,
  ...PURCHASING_SW,
  ...CATALOGUE_SW,
  ...PROVIDERS_SW,
  ...PLANS_SW,
  ...CONTROLLED_SW,
  ...COUNTS_SW,
  ...PAYABLES_SW,
  ...ACCOUNTS_SW,
  ...LABELS_SW,
  ...TILL_SW,
  ...STOCKOPS_SW,
  ...SHIFTS_SW,
  ...PAYMENTS_SW,
  ...REPACK_SW,
  ...PRICING_SW,
  ...STATEMENTS_SW,
  ...PARTNERS_SW,
  ...ENUM_SW,
  ...ERRORS_SW,
  ...APPROVALS_SW,
  ...MESSAGES_SW,
  ...UI_SW,
  ...STATE_SW,
};
