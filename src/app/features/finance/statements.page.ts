import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { loaded } from '../../core/data/data';
import { downloadCsv, isoDay } from '../../core/format/format';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ExpiryProvisionRun, VatApportionmentRun } from '../../core/api/models';

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
/** One VAT category's sales and returns, net of VAT and their VAT (STD-2). */
interface VatCategoryLine {
  category: 'STANDARD' | 'ZERO_RATED' | 'EXEMPT';
  salesNet: number;
  salesTax: number;
  returnsNet: number;
  returnsTax: number;
  net: number;
  tax: number;
  /** Debit notes to customers in this category (STD-2). */
  debitNotesNet?: number;
  debitNotesTax?: number;
}
interface Vat {
  from: string;
  to: string;
  outputVat: number;
  vatReversed: number;
  /** Output VAT less returns, input VAT on purchases and expenses (older APIs: absent). */
  netOutputVat?: number;
  inputVat?: number;
  /** Output less returns less input; below zero is a credit. */
  netPayable: number;
  categories?: VatCategoryLine[];
  /** Input VAT as booked, the part apportioned to expense, and what stays reclaimable (STD-2). */
  inputVatBeforeApportionment?: number;
  nonReclaimableInputVat?: number;
  reclaimableInputVat?: number;
  apportionments?: VatApportionmentRun[];
  debitNotes?: { salesNet: number; salesTax: number; purchasesNet: number; purchasesVat: number };
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

type Tab = 'balance' | 'trial' | 'vat' | 'stock' | 'writedown' | 'cashiers';

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
          @if (tab() === 'vat' || tab() === 'cashiers' || tab() === 'writedown') {
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
                        <td>{{ l.name | account: l.code }}</td>
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
                        <td>{{ l.name | account: l.code }}</td>
                        <td class="right">{{ l.balance | money }}</td>
                      </tr>
                    }
                    @for (l of b.equity.lines; track l.code) {
                      <tr>
                        <td class="mono">{{ l.code }}</td>
                        <td>{{ l.name | account: l.code }}</td>
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
                          <td>{{ l.name | account: l.code }}</td>
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
                [label]="'vat.inputVat' | t"
                [value]="v.inputVat ?? 0 | money"
                icon="truck"
                tone="purple"
              />
              <app-stat
                [label]="'statements.netPayable' | t"
                [value]="v.netPayable | money"
                icon="wallet"
                [tone]="v.netPayable < 0 ? 'amber' : 'green'"
                [caption]="'vat.netPayableHint' | t"
              />
            </div>
            @if (v.categories?.length) {
              <div class="card mt" data-testid="vat-categories">
                <div class="card-head">
                  <h3>{{ 'vat.byCategory' | t }}</h3>
                </div>
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>{{ 'vat.category' | t }}</th>
                        <th class="right">{{ 'vat.salesNet' | t }}</th>
                        <th class="right">{{ 'vat.salesTax' | t }}</th>
                        <th class="right">{{ 'vat.returnsNet' | t }}</th>
                        <th class="right">{{ 'vat.returnsTax' | t }}</th>
                        <th class="right">{{ 'vat.net' | t }}</th>
                        <th class="right">{{ 'vat.tax' | t }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of v.categories; track c.category) {
                        <tr>
                          <td>{{ 'enum.' + c.category | t }}</td>
                          <td class="right">{{ c.salesNet | money }}</td>
                          <td class="right">{{ c.salesTax | money }}</td>
                          <td class="right">{{ c.returnsNet | money }}</td>
                          <td class="right">{{ c.returnsTax | money }}</td>
                          <td class="right strong">{{ c.net | money }}</td>
                          <td class="right strong">{{ c.tax | money }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
            @if (v.nonReclaimableInputVat !== undefined) {
              <div class="grid kpis mt" data-testid="vat-apportionment">
                <app-stat
                  [label]="'vatReport.beforeApportionment' | t"
                  [value]="v.inputVatBeforeApportionment ?? 0 | money"
                  icon="truck"
                  tone="purple"
                />
                <app-stat
                  [label]="'vatReport.nonReclaimable' | t"
                  [value]="v.nonReclaimableInputVat | money"
                  icon="minus"
                  tone="amber"
                />
                <app-stat
                  [label]="'vatReport.reclaimable' | t"
                  [value]="v.reclaimableInputVat ?? v.inputVat ?? 0 | money"
                  icon="check"
                  tone="green"
                />
              </div>
            }
            @if (v.apportionments?.length) {
              <div class="card mt">
                <div class="card-head">
                  <h3>{{ 'vatReport.apportionment' | t }}</h3>
                </div>
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>{{ 'writedownReport.period' | t }}</th>
                        <th>{{ 'apportion.method' | t }}</th>
                        <th class="right">{{ 'vatReport.ratio' | t }}</th>
                        <th class="right">{{ 'vatReport.nonReclaimable' | t }}</th>
                        <th class="right">{{ 'writedownReport.adjustment' | t }}</th>
                        <th>{{ 'writedownReport.journal' | t }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (a of v.apportionments; track a.uid) {
                        <tr>
                          <td>{{ a.period }} · {{ 'vatReport.kind.' + a.kind | t }}</td>
                          <td>{{ 'vatReport.method.' + a.method | t }}</td>
                          <td class="right">{{ a.ratioPercent }}%</td>
                          <td class="right">{{ a.nonReclaimable | money }}</td>
                          <td class="right">{{ a.adjustment | money }}</td>
                          <td class="mono">{{ a.journalNumber ?? '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
            @if (v.debitNotes; as d) {
              <div class="card mt" data-testid="vat-debit-notes">
                <div class="card-head">
                  <h3>{{ 'vatReport.debitNotes' | t }}</h3>
                </div>
                <table class="table">
                  <thead>
                    <tr>
                      <th></th>
                      <th class="right">{{ 'vatReport.net' | t }}</th>
                      <th class="right">{{ 'vatReport.vat' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{{ 'vatReport.salesDebitNotes' | t }}</td>
                      <td class="right">{{ d.salesNet | money }}</td>
                      <td class="right">{{ d.salesTax | money }}</td>
                    </tr>
                    <tr>
                      <td>{{ 'vatReport.purchaseDebitNotes' | t }}</td>
                      <td class="right">{{ d.purchasesNet | money }}</td>
                      <td class="right">{{ d.purchasesVat | money }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            }
          }
        }
        @case ('writedown') {
          <p class="muted mb">{{ 'writedownReport.sub' | t }}</p>
          @for (run of writedown.value() ?? []; track run.uid) {
            <div class="card mb" [attr.data-testid]="'writedown-' + run.period">
              <div class="card-head row between wrap">
                <h3>{{ run.period }}</h3>
                <span class="muted mono">{{ run.journalNumber ?? '—' }}</span>
              </div>
              @if (!run.enabled) {
                <p class="muted card-pad">{{ 'writedownReport.off' | t }}</p>
              }
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{{ 'writedownReport.branch' | t }}</th>
                      <th>{{ 'writedown.days' | t }}</th>
                      <th class="right">{{ 'writedown.percent' | t }}</th>
                      <th class="right">{{ 'writedownReport.costAtRisk' | t }}</th>
                      <th class="right">{{ 'writedownReport.provision' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (b of run.branches; track b.branchUid) {
                      @for (band of b.bands; track band.daysToExpiry; let first = $first) {
                        <tr>
                          <td>{{ first ? branchName(b.branchUid) : '' }}</td>
                          <td>
                            {{
                              band.daysToExpiry === 0
                                ? ('writedown.expired' | t)
                                : ('writedown.within' | t: { days: band.daysToExpiry })
                            }}
                          </td>
                          <td class="right">{{ band.percent }}%</td>
                          <td class="right">{{ band.costAtRisk | money }}</td>
                          <td class="right">{{ band.provision | money }}</td>
                        </tr>
                      }
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3">
                        {{ 'writedownReport.stockAtCost' | t }}: {{ run.stockAtCost | money }}
                      </td>
                      <td class="right">
                        {{ 'writedownReport.previous' | t }}: {{ run.previousProvision | money }}
                      </td>
                      <td class="right strong">
                        {{ run.provision | money }}
                        <br /><small class="muted"
                          >{{ 'writedownReport.adjustment' | t }}:
                          {{ run.adjustment | money }}</small
                        >
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          } @empty {
            <div class="card card-pad muted" data-testid="writedown-none">
              {{ 'writedownReport.none' | t }}
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
  private readonly session = inject(SessionStore);
  protected readonly tabs: Tab[] = ['balance', 'trial', 'vat', 'stock', 'writedown', 'cashiers'];
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
  /** The monthly expiry write-down runs in the range (STD-3). */
  protected readonly writedown = loaded<ExpiryProvisionRun[]>(() =>
    this.tab() === 'writedown'
      ? { path: '/reports/expiry-provision', query: { from: this.from(), to: this.to() } }
      : null,
  );

  /** A branch's name from the workspace, or its uid when it is not one of them. */
  protected branchName(uid: string): string {
    return this.session.branches().find((b) => b.uid === uid)?.name ?? uid;
  }
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
            [
              t('vat.category'),
              t('vat.salesNet'),
              t('vat.salesTax'),
              t('vat.returnsNet'),
              t('vat.returnsTax'),
              t('statements.outputVat'),
              t('statements.vatReversed'),
              t('vat.inputVat'),
              t('statements.netPayable'),
            ],
            [
              ...(v.categories ?? []).map((c) => [
                t('enum.' + c.category),
                c.salesNet,
                c.salesTax,
                c.returnsNet,
                c.returnsTax,
                '',
                '',
                '',
                '',
              ]),
              ['', '', '', '', '', v.outputVat, v.vatReversed, v.inputVat ?? 0, v.netPayable],
            ],
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
      case 'writedown':
        downloadCsv(
          `expiry-write-down-${this.from()}-${this.to()}.csv`,
          [
            t('writedownReport.period'),
            t('writedownReport.branch'),
            t('writedown.days'),
            t('writedown.percent'),
            t('writedownReport.costAtRisk'),
            t('writedownReport.provision'),
          ],
          (this.writedown.value() ?? []).flatMap((run) =>
            run.branches.flatMap((b) =>
              b.bands.map((band) => [
                run.period,
                this.branchName(b.branchUid),
                band.daysToExpiry,
                band.percent,
                band.costAtRisk,
                band.provision,
              ]),
            ),
          ),
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
