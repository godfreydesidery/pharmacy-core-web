import { Pipe, PipeTransform, inject } from '@angular/core';
import { Translations } from '../i18n/translations.store';

/**
 * The default chart every pharmacy starts with (the API's ChartOfAccounts), by code. An account
 * still carrying its seeded English name is shown in the current language; one the pharmacy
 * renamed keeps its own name.
 */
export const DEFAULT_ACCOUNT_NAMES: Readonly<Record<string, string>> = {
  '1000': 'Cash',
  '1010': 'Bank',
  '1020': 'Mobile Money',
  '1100': 'Accounts Receivable',
  '1110': 'Insurance Receivable',
  '1200': 'Inventory',
  '2000': 'Accounts Payable',
  '2100': 'Tax Payable',
  '2300': 'Vouchers Outstanding',
  '3000': "Owner's Equity",
  '4000': 'Sales Revenue',
  '4100': 'Sales Returns',
  '5000': 'Cost of Goods Sold',
  '5100': 'Stock Losses & Adjustments',
  '6000': 'Rent',
  '6010': 'Utilities',
  '6020': 'Salaries',
  '6030': 'Transport',
  '6040': 'Maintenance',
  '6050': 'Marketing',
  '6060': 'Supplies',
  '6070': 'Licences',
  '6090': 'Other Expenses',
  '6095': 'Insurance Rejections',
  '6096': 'Bad Debts',
  '7000': 'FX Gains/Losses',
};

/** An account's name in the current language when it is a default one left unchanged. */
export function accountName(
  translations: Pick<Translations, 't'>,
  name: string | null | undefined,
  code: string | null | undefined,
): string {
  const text = name ?? '';
  if (!code || DEFAULT_ACCOUNT_NAMES[code] !== text) {
    return text;
  }
  return translations.t(`account.${code}`, undefined, text);
}

/** `{{ line.name | account: line.code }}`. Impure, so it follows the language. */
@Pipe({ name: 'account', pure: false })
export class AccountNamePipe implements PipeTransform {
  private readonly translations = inject(Translations);

  transform(name: string | null | undefined, code: string | null | undefined): string {
    return accountName(this.translations, name, code);
  }
}
