import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { Account, AccountType } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';

const ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const TONES: Record<AccountType, string> = {
  ASSET: 'tone-blue',
  LIABILITY: 'tone-orange',
  EQUITY: 'tone-purple',
  REVENUE: 'tone-green',
  EXPENSE: 'tone-red',
};

@Component({
  selector: 'app-accounts',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'finance.chartOfAccounts' | t }}</h1>
          <p class="sub">{{ 'finance.balancesFromTheDoubleEntry' | t }}</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/finance/journal"
            ><app-icon name="book" [size]="16" /> {{ 'finance.journal' | t }}</a
          >
        </div>
      </div>
      <div class="grid kpis mb">
        @for (g of groups(); track g.type) {
          <div class="card stat">
            <div class="bubble" [class]="'bubble ' + tones[g.type]">
              <app-icon name="book" [size]="20" />
            </div>
            <div>
              <small>{{ g.type | label }}</small>
              <div class="value">{{ g.total | money }}</div>
              <div class="delta">
                <span>{{ g.accounts.length }} {{ 'finance.accounts' | t }}</span>
              </div>
            </div>
          </div>
        }
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'finance.code' | t }}</th>
                <th>{{ 'finance.account' | t }}</th>
                <th>{{ 'finance.type' | t }}</th>
                <th class="right">{{ 'finance.balance' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (g of groups(); track g.type) {
                @for (a of g.accounts; track a.code) {
                  <tr>
                    <td class="mono">{{ a.code }}</td>
                    <td class="strong">{{ a.name | account: a.code }}</td>
                    <td>
                      <span class="badge gray">{{ a.type | label }}</span>
                    </td>
                    <td class="right strong" [class.text-red]="a.balance < 0">
                      {{ a.balance | money }}
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="4">
                    <app-empty
                      [loading]="accounts.loading()"
                      icon="book"
                      [title]="'finance.noAccountsYet' | t"
                      [text]="'ui.empty.accounts' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export default class AccountsPage {
  protected readonly tones = TONES;
  protected readonly accounts = loaded<Account[]>(() => ({
    path: '/accounts',
    options: { noBranch: true },
  }));
  protected readonly groups = computed(() => {
    const all = this.accounts.value() ?? [];
    return ORDER.map((type) => {
      const accounts = all
        .filter((a) => a.type === type)
        .sort((a, b) => a.code.localeCompare(b.code));
      return { type, accounts, total: accounts.reduce((sum, a) => sum + a.balance, 0) };
    }).filter((g) => g.accounts.length);
  });
}
