import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';

interface Account {
  code: string;
  name: string;
  balance: number;
}

/** The ledger account money paid by a method leaves from (as the API posts it). */
const ACCOUNT_OF: Record<string, string> = {
  CASH: '1000',
  CARD: '1010',
  BANK: '1010',
  BANK_TRANSFER: '1010',
  CHEQUE: '1010',
  MOBILE_MONEY: '1020',
};

/**
 * Warns, without blocking, when paying {@code amount} (base currency) by {@code method} would take
 * the cash, bank or mobile-money account below zero.
 */
@Component({
  selector: 'app-overdraw-warning',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shortfall(); as s) {
      <div class="notice tone-amber full">
        <app-icon name="alert" />
        {{ 'admin2.overdraw' | t: { account: s.name, balance: (s.balance | money) } }}
      </div>
    }
  `,
})
export class OverdrawWarningComponent {
  readonly amount = input<number>(0);
  readonly method = input<string | null>(null);
  private readonly accounts = loaded<Account[]>(() => ({
    path: '/accounts',
    options: { noBranch: true, silent: true },
  }));

  protected readonly shortfall = computed(() => {
    const code = ACCOUNT_OF[(this.method() ?? '').toUpperCase()];
    const account = (this.accounts.value() ?? []).find((a) => a.code === code);
    const amount = Number(this.amount()) || 0;
    return account && amount > 0 && amount > account.balance ? account : null;
  });
}
