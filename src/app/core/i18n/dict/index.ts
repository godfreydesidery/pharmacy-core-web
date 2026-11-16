/**
 * Per-area dictionaries, merged into EN and SW. Each feature area keeps its keys in its own pair of
 * files, `<area>.en.ts` and `<area>.sw.ts`, so areas can be translated independently. Register a
 * new pair here: import both and add them to the two spreads below.
 */
import { PLANNING_EN } from './planning.en';
import { PLANNING_SW } from './planning.sw';
import { PLANS_EN } from './plans.en';
import { PLANS_SW } from './plans.sw';
import { PROVIDERS_EN } from './providers.en';
import { PROVIDERS_SW } from './providers.sw';
import { ADMIN_EN } from './admin.en';
import { ADMIN_SW } from './admin.sw';
import { ADMIN2_EN } from './admin2.en';
import { ADMIN2_SW } from './admin2.sw';
import { INSURANCE_EN } from './insurance.en';
import { INSURANCE_SW } from './insurance.sw';
import { NOTIFICATIONS_EN } from './notifications.en';
import { NOTIFICATIONS_SW } from './notifications.sw';
import { PLATFORM_EN } from './platform.en';
import { PLATFORM_SW } from './platform.sw';
import { RECEIVABLES_EN } from './receivables.en';
import { RECEIVABLES_SW } from './receivables.sw';
import { REPORTS_EN } from './reports.en';
import { REPORTS_SW } from './reports.sw';
import { CATALOGUE_EN } from './catalogue.en';
import { CONTROLLED_EN } from './controlled.en';
import { COUNTS_EN } from './counts.en';
import { TILL_EN } from './till.en';
import { TILL_SW } from './till.sw';
import { STOCKOPS_EN } from './stockops.en';
import { STOCKOPS_SW } from './stockops.sw';
import { COUNTS_SW } from './counts.sw';
import { SHIFTS_EN } from './shifts.en';
import { SHIFTS_SW } from './shifts.sw';
import { PAYMENTS_EN } from './payments.en';
import { PAYMENTS_SW } from './payments.sw';
import { REPACK_EN } from './repack.en';
import { REPACK_SW } from './repack.sw';
import { PRICING_EN } from './pricing.en';
import { PRICING_SW } from './pricing.sw';
import { STATEMENTS_EN } from './statements.en';
import { STATEMENTS_SW } from './statements.sw';
import { CONTROLLED_SW } from './controlled.sw';
import { CATALOGUE_SW } from './catalogue.sw';
import { ENUM_EN } from './enum.en';
import { ERRORS_EN } from './errors.en';
import { ERRORS_SW } from './errors.sw';
import { ENUM_SW } from './enum.sw';
import { FINANCE_EN } from './finance.en';
import { FINANCE_SW } from './finance.sw';
import { INVENTORY_EN } from './inventory.en';
import { INVENTORY_SW } from './inventory.sw';
import { MESSAGES_EN } from './messages.en';
import { MESSAGES_SW } from './messages.sw';
import { PARTNERS_EN } from './partners.en';
import { PARTNERS_SW } from './partners.sw';
import { POS_EN } from './pos.en';
import { POS_SW } from './pos.sw';
import { PURCHASING_EN } from './purchasing.en';
import { PURCHASING_SW } from './purchasing.sw';
import { SALES_EN } from './sales.en';
import { SECURITY2_EN } from './security2.en';
import { SECURITY2_SW } from './security2.sw';
import { SALES_SW } from './sales.sw';
import { SHELL_EN } from './shell.en';
import { SHELL_SW } from './shell.sw';
import { UI_EN } from './ui.en';
import { UI_SW } from './ui.sw';

export const EN_AREAS: Readonly<Record<string, string>> = {
  ...SHELL_EN,
  ...PLANNING_EN,
  ...SECURITY2_EN,
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
  ...MESSAGES_EN,
  ...UI_EN,
};

export const SW_AREAS: Readonly<Record<string, string>> = {
  ...SHELL_SW,
  ...PLANNING_SW,
  ...SECURITY2_SW,
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
  ...MESSAGES_SW,
  ...UI_SW,
};
