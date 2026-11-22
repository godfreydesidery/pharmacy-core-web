import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountView, AgeingRow, ReceivableTotals } from '../../core/api/credit.models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';

/** Finance → Receivables: who owes what, how old it is, and who holds credit. */
@Component({
  selector: 'app-receivables',
  imports: [...SHARED, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'receivables.receivables' | t }}</h1>
          <p class="sub">
            {{ 'receivables.customerAccountsCreditSalesPayments' | t }}
          </p>
        </div>
        <div class="actions">
          <button
            class="btn"
            type="button"
            (click)="exportAgeing()"
            [disabled]="!ageing.value()?.length"
          >
            <app-icon name="download" [size]="16" /> {{ 'receivables.ageingCsv' | t }}
          </button>
        </div>
      </div>

      @if (totals.value(); as t) {
        <div class="grid kpis">
          <app-stat
            [label]="'receivables.outstanding' | t"
            [value]="t.outstanding | compactMoney"
            [hint]="t.outstanding | money"
            icon="wallet"
            tone="blue"
            [caption]="t.accountsWithBalance + ('ui.l.preAccountsOwing' | t)"
          />
          <app-stat
            [label]="'receivables.overdue' | t"
            [value]="t.overdue | compactMoney"
            [hint]="t.overdue | money"
            icon="clock"
            tone="red"
            [caption]="'receivables.pastThePaymentTerms' | t"
          />
          <app-stat
            [label]="'receivables.customerCredit' | t"
            [value]="t.unallocatedCredit | compactMoney"
            [hint]="t.unallocatedCredit | money"
            icon="cash"
            tone="green"
            [caption]="'receivables.depositsAndOverpaymentsHeld' | t"
          />
          <app-stat
            [label]="'receivables.currentShare' | t"
            [value]="currentShare() + '%'"
            icon="trend"
            tone="purple"
            [caption]="'receivables.ofOpenInvoicesUnder31' | t"
          />
        </div>
      }

      <div class="card">
        <div class="tabs">
          <button type="button" [class.active]="tab() === 'accounts'" (click)="tab.set('accounts')">
            {{ 'receivables.accounts' | t }}
          </button>
          <button type="button" [class.active]="tab() === 'ageing'" (click)="tab.set('ageing')">
            {{ 'receivables.ageing' | t }}
          </button>
        </div>

        @if (tab() === 'accounts') {
          <div class="toolbar">
            <label class="search"
              ><app-icon name="search" [size]="16" /><input
                [placeholder]="'receivables.customerName' | t"
                (input)="q.set($any($event.target).value)"
            /></label>
            <label class="check"
              ><input
                type="checkbox"
                [checked]="withBalance()"
                (change)="withBalance.set(!withBalance())"
              />
              {{ 'receivables.onlyWithABalance' | t }}</label
            >
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'receivables.customer' | t }}</th>
                  <th class="right">{{ 'receivables.creditLimit' | t }}</th>
                  <th class="right">{{ 'receivables.balance' | t }}</th>
                  <th class="right">{{ 'receivables.available' | t }}</th>
                  <th class="right">{{ 'receivables.overdue' | t }}</th>
                  <th>{{ 'receivables.oldestOpen' | t }}</th>
                  <th>{{ 'receivables.status' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (a of accounts.items(); track a.customerUid) {
                  <tr class="link-row" [routerLink]="['/receivables', a.customerUid]">
                    <td>
                      <div class="cell-main">
                        <span class="avatar">{{ initials(a.customerName) }}</span>
                        <div>
                          <b>{{ a.customerName }}</b
                          ><small>{{ a.termsDays }}{{ 'receivables.dayTerms' | t }}</small>
                        </div>
                      </div>
                    </td>
                    <td class="right">{{ a.creditLimit | money }}</td>
                    <td
                      class="right strong"
                      [class.owes]="a.balance > 0"
                      [class.holds]="a.balance < 0"
                    >
                      {{
                        a.balance < 0
                          ? (-a.balance | money) + ('ui.l.preCr' | t)
                          : (a.balance | money)
                      }}
                    </td>
                    <td class="right">{{ a.available | money }}</td>
                    <td class="right" [class.owes]="a.overdue > 0">{{ a.overdue | money }}</td>
                    <td>{{ a.oldestOpenDate ? (a.oldestOpenDate | day) : '—' }}</td>
                    <td>
                      @if (a.onHold) {
                        <span class="badge red dot">{{ 'receivables.onHold' | t }}</span>
                      } @else if (a.overdue > 0) {
                        <span class="badge amber dot">{{ 'receivables.overdue' | t }}</span>
                      } @else if (a.balance < 0) {
                        <span class="badge green dot">{{ 'receivables.inCredit' | t }}</span>
                      } @else {
                        <span class="badge gray dot">{{ 'receivables.current' | t }}</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <app-empty
                        [loading]="accounts.loading()"
                        icon="wallet"
                        [title]="'receivables.noCustomerAccountsYet' | t"
                        [text]="'ui.empty.receivables' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [list]="accounts" />
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'receivables.customer' | t }}</th>
                  <th class="right">{{ 'receivables.030Days' | t }}</th>
                  <th class="right">31–60</th>
                  <th class="right">61–90</th>
                  <th class="right">{{ 'receivables.over90' | t }}</th>
                  <th class="right">{{ 'receivables.total' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of ageing.value() ?? []; track r.customerUid) {
                  <tr class="link-row" [routerLink]="['/receivables', r.customerUid]">
                    <td>
                      <b>{{ r.customerName }}</b>
                    </td>
                    <td class="right">{{ r.current | money }}</td>
                    <td class="right">{{ r.d31to60 | money }}</td>
                    <td class="right" [class.warn]="r.d61to90 > 0">{{ r.d61to90 | money }}</td>
                    <td class="right" [class.owes]="r.over90 > 0">{{ r.over90 | money }}</td>
                    <td class="right strong">{{ r.total | money }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <app-empty
                        [loading]="ageing.loading()"
                        icon="clock"
                        [title]="'receivables.nothingOwed' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
              @if (ageingTotals(); as t) {
                <tfoot>
                  <tr>
                    <td>{{ 'receivables.total' | t }}</td>
                    <td class="right">{{ t.current | money }}</td>
                    <td class="right">{{ t.d31to60 | money }}</td>
                    <td class="right">{{ t.d61to90 | money }}</td>
                    <td class="right">{{ t.over90 | money }}</td>
                    <td class="right">{{ t.total | money }}</td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
          @if (ageingTotals(); as t) {
            <div class="ageing-bar" aria-hidden="true">
              <span class="b0" [style.flex]="t.current || 0"></span>
              <span class="b1" [style.flex]="t.d31to60 || 0"></span>
              <span class="b2" [style.flex]="t.d61to90 || 0"></span>
              <span class="b3" [style.flex]="t.over90 || 0"></span>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--teal));
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 650;
      font-size: 12px;
      flex-shrink: 0;
    }
    .link-row {
      cursor: pointer;
    }
    .owes {
      color: var(--red);
    }
    .holds {
      color: var(--green);
    }
    .warn {
      color: var(--amber);
    }
    .strong {
      font-weight: 650;
    }
    .ageing-bar {
      display: flex;
      height: 10px;
      margin: 0 18px 18px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--border);
    }
    .ageing-bar span {
      min-width: 0;
    }
    .b0 {
      background: var(--green);
    }
    .b1 {
      background: var(--amber);
    }
    .b2 {
      background: var(--orange, #f97316);
    }
    .b3 {
      background: var(--red);
    }
  `,
})
export default class ReceivablesAccountsPage {
  protected readonly session = inject(SessionStore);
  protected readonly tab = signal<'accounts' | 'ageing'>('accounts');
  protected readonly q = signal('');
  protected readonly withBalance = signal(true);
  private readonly query = debounced(this.q);

  protected readonly totals = loaded<ReceivableTotals>(() => ({
    path: '/receivables/totals',
    options: { noBranch: true },
  }));
  protected readonly accounts = pagedList<AccountView>(() => ({
    path: '/receivables/accounts',
    query: { q: this.query(), withBalance: this.withBalance() },
    options: { noBranch: true },
  }));
  protected readonly ageing = loaded<AgeingRow[]>(() =>
    this.tab() === 'ageing' ? { path: '/receivables/ageing', options: { noBranch: true } } : null,
  );

  protected readonly ageingTotals = computed(() => {
    const rows = this.ageing.value();
    if (!rows?.length) {
      return null;
    }
    const sum = (pick: (r: AgeingRow) => number) => rows.reduce((total, r) => total + pick(r), 0);
    return {
      current: sum((r) => r.current),
      d31to60: sum((r) => r.d31to60),
      d61to90: sum((r) => r.d61to90),
      over90: sum((r) => r.over90),
      total: sum((r) => r.total),
    };
  });

  protected readonly currentShare = computed(() => {
    const t = this.totals.value();
    if (!t || !t.outstanding) {
      return 100;
    }
    return Math.max(0, Math.round(((t.outstanding - t.overdue) / t.outstanding) * 100));
  });

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected exportAgeing(): void {
    const rows = this.ageing.value() ?? [];
    const lines = [
      'customer,0-30,31-60,61-90,over 90,total',
      ...rows.map((r) =>
        [JSON.stringify(r.customerName), r.current, r.d31to60, r.d61to90, r.over90, r.total].join(
          ',',
        ),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ageing-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
