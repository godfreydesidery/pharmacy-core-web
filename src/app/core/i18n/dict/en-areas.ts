/**
 * The English per-area dictionaries, merged into EN. Each feature area keeps its keys in its own
 * pair of files, `<area>.en.ts` and `<area>.sw.ts`; register a new pair here and in
 * `sw-areas.ts`. English is in the first download (it is every key's fallback); Swahili is loaded
 * only when chosen, so the two lists live in separate modules.
 */
import { APPROVALS_EN } from './approvals.en';
import { A11Y_EN } from './a11y.en';
import { PLANNING_EN } from './planning.en';
import { PLANS_EN } from './plans.en';
import { PROVIDERS_EN } from './providers.en';
import { ADMIN_EN } from './admin.en';
import { ADMIN2_EN } from './admin2.en';
import { INSURANCE_EN } from './insurance.en';
import { NOTIFICATIONS_EN } from './notifications.en';
import { PLATFORM_EN } from './platform.en';
import { RECEIVABLES_EN } from './receivables.en';
import { REPORTS_EN } from './reports.en';
import { CATALOGUE_EN } from './catalogue.en';
import { CONTROLLED_EN } from './controlled.en';
import { COUNTS_EN } from './counts.en';
import { PAYABLES_EN } from './payables.en';
import { ACCOUNTS_EN } from './accounts.en';
import { LABELS_EN } from './labels.en';
import { TILL_EN } from './till.en';
import { STOCKOPS_EN } from './stockops.en';
import { SHIFTS_EN } from './shifts.en';
import { PAYMENTS_EN } from './payments.en';
import { REPACK_EN } from './repack.en';
import { PRICING_EN } from './pricing.en';
import { STATEMENTS_EN } from './statements.en';
import { ENUM_EN } from './enum.en';
import { ERRORS_EN } from './errors.en';
import { FINANCE_EN } from './finance.en';
import { INVENTORY_EN } from './inventory.en';
import { MESSAGES_EN } from './messages.en';
import { PARTNERS_EN } from './partners.en';
import { POS_EN } from './pos.en';
import { PURCHASING_EN } from './purchasing.en';
import { SALES_EN } from './sales.en';
import { IDLE_EN } from './idle.en';
import { ACCT_EN } from './acct.en';
import { LOGINS_EN } from './logins.en';
import { SECURITY2_EN } from './security2.en';
import { SHELL_EN } from './shell.en';
import { UI_EN } from './ui.en';

export const EN_AREAS: Readonly<Record<string, string>> = {
  ...A11Y_EN,
  ...SHELL_EN,
  ...PLANNING_EN,
  ...SECURITY2_EN,
  ...IDLE_EN,
  ...LOGINS_EN,
  ...ACCT_EN,
  ...FINANCE_EN,
  ...REPORTS_EN,
  ...RECEIVABLES_EN,
  ...INSURANCE_EN,
  ...NOTIFICATIONS_EN,
  ...PLATFORM_EN,
  ...ADMIN_EN,
  ...ADMIN2_EN,
  ...POS_EN,
  ...SALES_EN,
  ...INVENTORY_EN,
  ...PURCHASING_EN,
  ...CATALOGUE_EN,
  ...PROVIDERS_EN,
  ...PLANS_EN,
  ...CONTROLLED_EN,
  ...COUNTS_EN,
  ...PAYABLES_EN,
  ...ACCOUNTS_EN,
  ...LABELS_EN,
  ...TILL_EN,
  ...STOCKOPS_EN,
  ...SHIFTS_EN,
  ...PAYMENTS_EN,
  ...REPACK_EN,
  ...PRICING_EN,
  ...STATEMENTS_EN,
  ...PARTNERS_EN,
  ...ENUM_EN,
  ...ERRORS_EN,
  ...APPROVALS_EN,
  ...MESSAGES_EN,
  ...UI_EN,
};
