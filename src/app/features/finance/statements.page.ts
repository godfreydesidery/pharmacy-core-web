import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { loaded } from '../../core/data/data';
import { downloadCsv, isoDay } from '../../core/format/format';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';

interface Line {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}
interface TrialBalance {
  asOf: string;
  lines: Line[];
  totalDebit: number;
  totalCredit: number;
}
interface Section {
  title: string;
  lines: Line[];
  total: number;
}
interface BalanceSheet {
  asOf: string;
  assets: Section;
  liabilities: Section;
  equity: Section;
  currentEarnings: number;
  liabilitiesAndEquity: number;
  balanced: boolean;
}
interface Vat {
  from: string;
  to: string;
  outputVat: number;
  vatReversed: number;
  netPayable: number;
}
interface BranchStock {
  branchUid: string;
  branchName: string;
  products: number;
  expired: number;
  costValue: number;
  retailValue: number;
}
interface Cashier {
  cashier: string;
  sales: number;
  total: number;
  tenders: Record<string, number>;
  returns: number;
  refunded: number;
  cashToHandOver: number;
}

type Tab = 'balance' | 'trial' | 'vat' | 'stock' | 'cashiers';

/**
 * Finance → Statements: balance sheet, trial balance and VAT from the ledger, stock valuation per
 * branch, and the cashier (till) report used to count cash at the end of a shift.
 */
@Component({
  selector: 'app-statements',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'statements.title' | t }}</h1>
          <p class="sub">{{ 'statements.sub' | t }}</p>
        </div>
        <div class="actions">
          @if (tab() === 'vat' || tab() === 'cashiers') {
            <input
              class="input"
              style="width:auto"
              type="date"
              [value]="from()"
              (change)="from.set($any($event.target).value)"
              [attr.aria-label]="'statements.from' | t"
            />
          }
          <input
            class="input"
            style="width:auto"
            type="date"
            [value]="to()"
            (change)="to.set($any($event.target).value)"
            [attr.aria-label]="'statements.to' | t"
          />
          <button class="btn" type="button" (click)="export()">
            <app-icon name="download" [size]="16" /> {{ 'statements.export' | t }}
          </button>
          <button class="btn" type="button" (click)="print()">
            <app-icon name="printer" [size]="16" /> {{ 'statements.print' | t }}
          </button>
        </div>
      </div>
      <div class="card mb no-print">
        <div class="tabs">
          @for (t of tabs; track t) {
            <button type="button" [class.active]="tab() === t" (click)="tab.set(t)">
              {{ 'statements.tab.' + t | t }}
            </button>
          }
        </div>
      </div>

      @switch (tab()) {
        @case ('balance') {
          @if (balance.value(); as b) {
            <div class="grid two">
              <div class="card">
                <div class="card-pad">
                  <h3>{{ 'statements.assets' | t }}</h3>
                </div>
                <table class="table">
                  <tbody>
                    @for (l of b.assets.lines; track l.code) {
                      <tr>
                        <td class="mono">{{ l.code }}</td>
                        <td>{{ l.name }}</td>
                        <td class="right">{{ l.balance | money }}</td>
                      </tr>
                    }
                    <tr class="strong">
                      <td></td>
                      <td>{{ 'statements.totalAssets' | t }}</td>
                      <td class="right">{{ b.assets.total | money }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="card">
                <div class="card-pad">
                  <h3>{{ 'statements.liabilitiesEquity' | t }}</h3>
                </div>
                <table class="table">
                  <tbody>
                    @for (l of b.liabilities.lines; track l.code) {
                      <tr>
                        <td class="mono">{{ l.code }}</td>
                        <td>{{ l.name }}</td>
                        <td class="right">{{ l.balance | money }}</td>
                      </tr>
                    }
                    @for (l of b.equity.lines; track l.code) {
                      <tr>
                        <td class="mono">{{ l.code }}</td>
                        <td>{{ l.name }}</td>
                        <td class="right">{{ l.balance | money }}</td>
                      </tr>
                    }
                    <tr>
                      <td></td>
                      <td>{{ 'statements.currentEarnings' | t }}</td>
                      <td class="right">{{ b.currentEarnings | money }}</td>
                    </tr>
                    <tr class="strong">
                      <td></td>
                      <td>{{ 'statements.totalLiabilitiesEquity' | t }}</td>
                      <td class="right">{{ b.liabilitiesAndEquity | money }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p class="mt" [class.text-red]="!b.balanced">
              {{ (b.balanced ? 'statements.balanced' : 'statements.notBalanced') | t }}
            </p>
          }
        }
        @case ('trial') {
          @if (trial.value(); as tb) {
            <div class="card">
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{{ 'statements.code' | t }}</th>
                      <th>{{ 'statements.account' | t }}</th>
                      <th class="right">{{ 'statements.debit' | t }}</th>
                      <th class="right">{{ 'statements.credit' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of tb.lines; track l.code) {
                      @if (l.debit || l.credit) {
                        <tr>
                          <td class="mono">{{ l.code }}</td>
                          <td>{{ l.name }}</td>
                          <td class="right">{{ l.debit | money }}</td>
                          <td class="right">{{ l.credit | money }}</td>
                        </tr>
                      }
                    }
                    <tr class="strong">
                      <td></td>
                      <td>{{ 'statements.total' | t }}</td>
                      <td class="right">{{ tb.totalDebit | money }}</td>
                      <td class="right">{{ tb.totalCredit | money }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }
        }
        @case ('vat') {
          @if (vat.value(); as v) {
            <div class="grid kpis">
              <app-stat
                [label]="'statements.outputVat' | t"
                [value]="v.outputVat | money"
                icon="receipt"
                tone="blue"
              />
              <app-stat
                [label]="'statements.vatReversed' | t"
                [value]="v.vatReversed | money"
                icon="undo"
                tone="amber"
              />
              <app-stat
                [label]="'statements.netPayable' | t"
                [value]="v.netPayable | money"
                icon="wallet"
                tone="green"
              />
            </div>
          }
        }
        @case ('stock') {
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'statements.branch' | t }}</th>
                  <th class="right">{{ 'statements.products' | t }}</th>
                  <th class="right">{{ 'statements.expired' | t }}</th>
                  <th class="right">{{ 'statements.costValue' | t }}</th>
                  <th class="right">{{ 'statements.retailValue' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of stock.value() ?? []; track s.branchUid) {
                  <tr>
                    <td>{{ s.branchName }}</td>
                    <td class="right">{{ s.products }}</td>
                    <td class="right">{{ s.expired }}</td>
                    <td class="right">{{ s.costValue | money }}</td>
                    <td class="right">{{ s.retailValue | money }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('cashiers') {
          <div class="card">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'statements.cashier' | t }}</th>
                    <th class="right">{{ 'statements.sales' | t }}</th>
                    <th class="right">{{ 'statements.total' | t }}</th>
                    <th class="right">{{ 'statements.refunded' | t }}</th>
                    <th class="right">{{ 'statements.cashToHandOver' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cashiers.value() ?? []; track c.cashier) {
                    <tr>
                      <td class="cashier">
                        <b>{{ c.cashier }}</b>
                        <!-- Tenders wrap under the name, so the hand-over column stays in view. -->
                        <div class="tenders" [attr.aria-label]="'statements.tenders' | t">
                          @for (t of tenderList(c); track t[0]) {
                            <span class="chip sm">{{ t[0] | label }}: {{ t[1] | money }}</span>
                          }
                        </div>
                      </td>
                      <td class="right">{{ c.sales }}</td>
                      <td class="right">{{ c.total | money }}</td>
                      <td class="right">{{ c.refunded | money }}</td>
                      <td class="right strong hand-over">{{ c.cashToHandOver | money }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="empty">{{ 'statements.noSales' | t }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    td.cashier {
      white-space: normal;
      min-width: 220px;
    }
    .tenders {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }
    td.hand-over {
      font-size: 15px;
    }
  `,
})
export default class StatementsPage {
  private readonly translations = inject(Translations);
  protected readonly tabs: Tab[] = ['balance', 'trial', 'vat', 'stock', 'cashiers'];
  protected readonly tab = signal<Tab>('balance');
  protected readonly from = signal(isoDay(-29));
  protected readonly to = signal(isoDay());

  protected readonly balance = loaded<BalanceSheet>(() =>
    this.tab() === 'balance'
      ? { path: '/reports/balance-sheet', query: { asOf: this.to() } }
      : null,
  );
  protected readonly trial = loaded<TrialBalance>(() =>
    this.tab() === 'trial' ? { path: '/reports/trial-balance', query: { asOf: this.to() } } : null,
  );
  protected readonly vat = loaded<Vat>(() =>
    this.tab() === 'vat'
      ? { path: '/reports/vat', query: { from: this.from(), to: this.to() } }
      : null,
  );
  protected readonly stock = loaded<BranchStock[]>(() =>
    this.tab() === 'stock' ? { path: '/reports/stock-valuation' } : null,
  );
  protected readonly cashiers = loaded<Cashier[]>(() =>
    this.tab() === 'cashiers'
      ? { path: '/reports/cashiers', query: { from: this.from(), to: this.to() } }
      : null,
  );

  protected tenderList(c: Cashier): [string, number][] {
    return Object.entries(c.tenders);
  }

  protected print(): void {
    window.print();
  }

  protected export(): void {
    const t = (k: string) => this.translations.t(k);
    switch (this.tab()) {
      case 'trial': {
        const tb = this.trial.value();
        if (tb)
          downloadCsv(
            `trial-balance-${tb.asOf}.csv`,
            [
              t('statements.code'),
              t('statements.account'),
              t('statements.debit'),
              t('statements.credit'),
            ],
            tb.lines.map((l) => [l.code, l.name, l.debit, l.credit]),
          );
        break;
      }
      case 'balance': {
        const b = this.balance.value();
        if (b)
          downloadCsv(
            `balance-sheet-${b.asOf}.csv`,
            [t('statements.code'), t('statements.account'), t('statements.balance')],
            [...b.assets.lines, ...b.liabilities.lines, ...b.equity.lines].map((l) => [
              l.code,
              l.name,
              l.balance,
            ]),
          );
        break;
      }
      case 'vat': {
        const v = this.vat.value();
        if (v)
          downloadCsv(
            `vat-${v.from}-${v.to}.csv`,
            [t('statements.outputVat'), t('statements.vatReversed'), t('statements.netPayable')],
            [[v.outputVat, v.vatReversed, v.netPayable]],
          );
        break;
      }
      case 'stock':
        downloadCsv(
          'stock-valuation.csv',
          [
            t('statements.branch'),
            t('statements.products'),
            t('statements.expired'),
            t('statements.costValue'),
            t('statements.retailValue'),
          ],
          (this.stock.value() ?? []).map((s) => [
            s.branchName,
            s.products,
            s.expired,
            s.costValue,
            s.retailValue,
          ]),
        );
        break;
      case 'cashiers':
        downloadCsv(
          `cashiers-${this.from()}-${this.to()}.csv`,
          [
            t('statements.cashier'),
            t('statements.sales'),
            t('statements.total'),
            t('statements.refunded'),
            t('statements.cashToHandOver'),
          ],
          (this.cashiers.value() ?? []).map((c) => [
            c.cashier,
            c.sales,
            c.total,
            c.refunded,
            c.cashToHandOver,
          ]),
        );
        break;
    }
  }
}
