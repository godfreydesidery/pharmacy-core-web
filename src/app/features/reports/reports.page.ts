import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PaymentReportRow, ProductReportRow, ProfitLoss, SalesReport } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { downloadCsv, formatDate, formatMoney, isoDay } from '../../core/format/format';
import { enumLabel } from '../../core/format/pipes';
import { SettingsStore } from '../../core/format/settings.store';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { BarSeries, DonutSegment } from '../../core/ui/charts';

type Tab = 'sales' | 'products' | 'profit-loss' | 'payments';
const TABS: { id: Tab; label: string }[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'products', label: 'Products' },
  { id: 'profit-loss', label: 'Profit & loss' },
  { id: 'payments', label: 'Payments' },
];
const COLORS = ['#2463eb', '#16a34a', '#f97316', '#7c3aed', '#0891b2', '#ef4444'];

@Component({
  selector: 'app-reports',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'reports.reports' | t }}</h1>
          <p class="sub">
            {{ session.branch()?.name ?? ('ui.l.allBranches' | t) }} · {{ from() | day }} –
            {{ to() | day }}
          </p>
        </div>
        <div class="actions">
          <input
            class="input"
            style="width:auto"
            type="date"
            [value]="from()"
            (change)="from.set($any($event.target).value)"
            [attr.aria-label]="'reports.from' | t"
          />
          <input
            class="input"
            style="width:auto"
            type="date"
            [value]="to()"
            (change)="to.set($any($event.target).value)"
            [attr.aria-label]="'reports.to' | t"
          />
          <div class="segmented">
            @for (p of presets; track p.days) {
              <button type="button" (click)="preset(p.days)">
                {{ 'ui.preset.' + p.label | t: null : p.label }}
              </button>
            }
          </div>
          <button class="btn" type="button" (click)="export()">
            <app-icon name="download" [size]="16" /> CSV
          </button>
        </div>
      </div>
      <div class="card mb">
        <div class="tabs">
          @for (t of tabs; track t.id) {
            <button type="button" [class.active]="tab() === t.id" (click)="tab.set(t.id)">
              {{ 'ui.reports.tab.' + t.id | t: null : t.label }}
            </button>
          }
        </div>
      </div>

      @switch (tab()) {
        @case ('sales') {
          @if (sales.value(); as r) {
            <div class="grid kpis mb">
              <app-stat
                [label]="'reports.netSales' | t"
                [value]="r.totals.net | compactMoney"
                [hint]="r.totals.net | money"
                icon="cart"
                tone="blue"
                [caption]="r.totals.invoices + ('ui.l.preInvoices' | t)"
              />
              <app-stat
                [label]="'reports.grossProfit' | t"
                [value]="r.totals.profit | compactMoney"
                [hint]="r.totals.profit | money"
                icon="trend"
                tone="green"
                [caption]="margin(r.totals.profit, r.totals.net) + ('ui.l.preMargin' | t)"
              />
              <app-stat
                [label]="'reports.discounts' | t"
                [value]="r.totals.discount | compactMoney"
                [hint]="r.totals.discount | money"
                icon="percent"
                tone="orange"
                [caption]="'reports.given' | t"
              />
              <app-stat
                [label]="'reports.tax' | t"
                [value]="r.totals.tax | compactMoney"
                [hint]="r.totals.tax | money"
                icon="file"
                tone="purple"
                [caption]="'reports.collected' | t"
              />
            </div>
            <div class="card mb">
              <div class="card-head">
                <h3>{{ 'reports.dailyNetSalesAndProfit' | t }}</h3>
              </div>
              <div style="padding:4px 14px 12px">
                @if (r.rows.length) {
                  <app-bar-chart [labels]="salesLabels()" [series]="salesSeries()" />
                } @else {
                  <app-empty icon="chart" [title]="'reports.noSalesInThisPeriod' | t" />
                }
              </div>
            </div>
            <div class="card">
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{{ 'reports.date' | t }}</th>
                      <th class="right">{{ 'reports.invoices' | t }}</th>
                      <th class="right">{{ 'reports.gross' | t }}</th>
                      <th class="right">{{ 'reports.discount' | t }}</th>
                      <th class="right">{{ 'reports.tax' | t }}</th>
                      <th class="right">{{ 'reports.net' | t }}</th>
                      <th class="right">{{ 'reports.cost' | t }}</th>
                      <th class="right">{{ 'reports.profit' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of r.rows; track row.date) {
                      <tr>
                        <td>{{ row.date | day }}</td>
                        <td class="right">{{ row.invoices }}</td>
                        <td class="right">{{ row.gross | money }}</td>
                        <td class="right">{{ row.discount | money }}</td>
                        <td class="right">{{ row.tax | money }}</td>
                        <td class="right strong">{{ row.net | money }}</td>
                        <td class="right">{{ row.cost | money }}</td>
                        <td class="right text-green">{{ row.profit | money }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{{ 'reports.total' | t }}</td>
                      <td class="right">{{ r.totals.invoices }}</td>
                      <td class="right">{{ r.totals.gross | money }}</td>
                      <td class="right">{{ r.totals.discount | money }}</td>
                      <td class="right">{{ r.totals.tax | money }}</td>
                      <td class="right">{{ r.totals.net | money }}</td>
                      <td class="right">{{ r.totals.cost | money }}</td>
                      <td class="right">{{ r.totals.profit | money }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          } @else {
            <app-empty [for]="sales" icon="chart" [title]="'reports.reportUnavailable' | t" />
          }
        }
        @case ('products') {
          <div class="card mb">
            <div class="card-head">
              <h3>{{ 'reports.bestSellersByNetSales' | t }}</h3>
            </div>
            <div style="padding:4px 14px 12px">
              @if ((products.value() ?? []).length) {
                <app-bar-chart [labels]="productLabels()" [series]="productSeries()" />
              } @else {
                <app-empty [for]="products" icon="pill" [title]="'reports.noProductSales' | t" />
              }
            </div>
          </div>
          <div class="card">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ 'reports.product' | t }}</th>
                    <th class="right">{{ 'reports.quantity' | t }}</th>
                    <th class="right">{{ 'reports.net' | t }}</th>
                    <th class="right">{{ 'reports.cost' | t }}</th>
                    <th class="right">{{ 'reports.profit' | t }}</th>
                    <th class="right">{{ 'reports.margin' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of products.value() ?? []; track p.productUid; let i = $index) {
                    <tr>
                      <td class="muted">{{ i + 1 }}</td>
                      <td class="strong">{{ p.productName }}</td>
                      <td class="right">{{ p.quantity | num }}</td>
                      <td class="right">{{ p.net | money }}</td>
                      <td class="right">{{ p.cost | money }}</td>
                      <td class="right text-green">{{ p.profit | money }}</td>
                      <td class="right">{{ margin(p.profit, p.net) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
        @case ('profit-loss') {
          @if (pl.value(); as p) {
            <div class="grid two">
              <div class="card">
                <div class="card-head">
                  <h3>{{ 'reports.profitAmpLossStatement' | t }}</h3>
                </div>
                <div class="pl">
                  <div class="r head">
                    <span>{{ 'reports.account' | t }}</span><span>{{ 'reports.amount' | t }}</span>
                  </div>
                  <div class="r">
                    <span>{{ 'reports.revenue' | t }}</span><span>{{ p.revenue | money }}</span>
                  </div>
                  <div class="r">
                    <span>{{ 'reports.lessCostOfSales' | t }}</span><span
                      >({{ p.costOfSales | money }})</span
                    >
                  </div>
                  <div class="r total">
                    <span>{{ 'reports.grossProfit' | t }}</span><span>{{
                      p.grossProfit | money
                    }}</span>
                  </div>
                  @for (e of p.expenses; track e.category) {
                    <div class="r sub">
                      <span>{{ e.category | label }}</span><span>{{ e.amount | money }}</span>
                    </div>
                  }
                  <div class="r">
                    <span>{{ 'reports.totalExpenses' | t }}</span><span
                      >({{ p.totalExpenses | money }})</span
                    >
                  </div>
                  <div class="r total" [class.loss]="p.netProfit < 0">
                    <span>{{ 'reports.netProfit' | t }}</span><span>{{ p.netProfit | money }}</span>
                  </div>
                </div>
              </div>
              <div class="card">
                <div class="card-head">
                  <h3>{{ 'reports.whereTheMoneyWent' | t }}</h3>
                </div>
                <div class="card-pad">
                  <app-donut
                    [segments]="plSegments()"
                    centerLabel="Revenue"
                    [centerValue]="compact(p.revenue)"
                  />
                </div>
              </div>
            </div>
          } @else {
            <app-empty [for]="pl" icon="chart" [title]="'reports.reportUnavailable' | t" />
          }
        }
        @case ('payments') {
          <div class="grid two">
            <div class="card">
              <div class="card-head">
                <h3>{{ 'reports.collectedByMethod' | t }}</h3>
              </div>
              <div class="card-pad">
                <app-donut
                  [segments]="paymentSegments()"
                  centerLabel="Collected"
                  [centerValue]="compact(paymentTotal())"
                />
              </div>
            </div>
            <div class="card">
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{{ 'reports.method' | t }}</th>
                      <th class="right">{{ 'reports.payments' | t }}</th>
                      <th class="right">{{ 'reports.amount' | t }}</th>
                      <th class="right">{{ 'reports.share' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of payments.value() ?? []; track p.method) {
                      <tr>
                        <td class="strong">{{ p.method | label }}</td>
                        <td class="right">{{ p.count }}</td>
                        <td class="right">{{ p.amount | money }}</td>
                        <td class="right">{{ share(p.amount) }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4">
                          <app-empty
                            [for]="payments"
                            icon="wallet"
                            [title]="'reports.noPayments' | t"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .pl .r {
      display: flex;
      justify-content: space-between;
      padding: 10px 18px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .pl .head {
      background: var(--surface-2);
      font-weight: 600;
      color: var(--muted);
      font-size: 12px;
    }
    .pl .total {
      font-weight: 700;
      background: var(--primary-soft);
      color: var(--primary);
    }
    .pl .total.loss {
      background: var(--red-soft);
      color: var(--red);
    }
    .pl .sub {
      padding-left: 34px;
      color: var(--muted);
    }
  `,
})
export default class ReportsPage {
  private readonly translations = inject(Translations);
  protected readonly session = inject(SessionStore);
  private readonly settings = inject(SettingsStore);
  protected readonly tabs = TABS;
  protected readonly presets = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: '1y', days: 365 },
  ];
  protected readonly tab = signal<Tab>('sales');
  protected readonly from = signal(isoDay(-29));
  protected readonly to = signal(isoDay());
  private readonly range = computed(() => ({ from: this.from(), to: this.to() }));

  protected readonly sales = loaded<SalesReport>(() =>
    this.tab() === 'sales' ? { path: '/reports/sales', query: this.range() } : null,
  );
  protected readonly products = loaded<ProductReportRow[]>(() =>
    this.tab() === 'products'
      ? { path: '/reports/products', query: { ...this.range(), limit: 20 } }
      : null,
  );
  protected readonly pl = loaded<ProfitLoss>(() =>
    this.tab() === 'profit-loss' ? { path: '/reports/profit-loss', query: this.range() } : null,
  );
  protected readonly payments = loaded<PaymentReportRow[]>(() =>
    this.tab() === 'payments' ? { path: '/reports/payments', query: this.range() } : null,
  );

  protected readonly salesLabels = computed(() =>
    (this.sales.value()?.rows ?? []).map((r) => formatDate(r.date).replace(/ \d{4}$/, '')),
  );
  protected readonly salesSeries = computed<BarSeries[]>(() => {
    const rows = this.sales.value()?.rows ?? [];
    return [
      { name: 'Net sales', color: '#2463eb', values: rows.map((r) => r.net) },
      { name: 'Profit', color: '#16a34a', values: rows.map((r) => r.profit) },
    ];
  });
  protected readonly productLabels = computed(() =>
    (this.products.value() ?? []).slice(0, 10).map((p) => p.productName.split(' ')[0]),
  );
  protected readonly productSeries = computed<BarSeries[]>(() => [
    {
      name: 'Net',
      color: '#2463eb',
      values: (this.products.value() ?? []).slice(0, 10).map((p) => p.net),
    },
    {
      name: 'Profit',
      color: '#16a34a',
      values: (this.products.value() ?? []).slice(0, 10).map((p) => p.profit),
    },
  ]);
  protected readonly plSegments = computed<DonutSegment[]>(() => {
    const p = this.pl.value();
    if (!p) {
      return [];
    }
    const money = (v: number) => formatMoney(v, this.settings.currency());
    return [
      {
        label: this.translations.t('ui.reports.costOfSales'),
        value: p.costOfSales,
        color: '#f97316',
        display: money(p.costOfSales),
      },
      {
        label: this.translations.t('ui.reports.expenses'),
        value: p.totalExpenses,
        color: '#ef4444',
        display: money(p.totalExpenses),
      },
      {
        label: this.translations.t('ui.reports.netProfit'),
        value: Math.max(p.netProfit, 0),
        color: '#16a34a',
        display: money(p.netProfit),
      },
    ];
  });
  protected readonly paymentTotal = computed(() =>
    (this.payments.value() ?? []).reduce((sum, p) => sum + p.amount, 0),
  );
  protected readonly paymentSegments = computed<DonutSegment[]>(() =>
    (this.payments.value() ?? []).map((p, i) => ({
      label: enumLabel(this.translations, p.method),
      value: p.amount,
      color: COLORS[i % COLORS.length],
      display: formatMoney(p.amount, this.settings.currency()),
    })),
  );

  protected preset(days: number): void {
    this.from.set(isoDay(-(days - 1)));
    this.to.set(isoDay());
  }

  protected margin(profit: number, net: number): string {
    return net > 0 ? `${((profit / net) * 100).toFixed(1)}%` : '—';
  }

  protected share(amount: number): string {
    const total = this.paymentTotal();
    return total > 0 ? `${((amount / total) * 100).toFixed(1)}%` : '—';
  }

  protected compact(value: number): string {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
      value,
    );
  }

  protected export(): void {
    const name = `${this.tab()}-${this.from()}-${this.to()}.csv`;
    switch (this.tab()) {
      case 'sales':
        downloadCsv(
          name,
          ['Date', 'Invoices', 'Gross', 'Discount', 'Tax', 'Net', 'Cost', 'Profit'],
          (this.sales.value()?.rows ?? []).map((r) => [
            r.date,
            r.invoices,
            r.gross,
            r.discount,
            r.tax,
            r.net,
            r.cost,
            r.profit,
          ]),
        );
        break;
      case 'products':
        downloadCsv(
          name,
          ['Product', 'Quantity', 'Net', 'Cost', 'Profit'],
          (this.products.value() ?? []).map((p) => [
            p.productName,
            p.quantity,
            p.net,
            p.cost,
            p.profit,
          ]),
        );
        break;
      case 'profit-loss': {
        const p = this.pl.value();
        if (p) {
          downloadCsv(
            name,
            ['Line', 'Amount'],
            [
              ['Revenue', p.revenue],
              ['Cost of sales', p.costOfSales],
              ['Gross profit', p.grossProfit],
              ...p.expenses.map((e) => [`Expense: ${e.category}`, e.amount] as [string, number]),
              ['Total expenses', p.totalExpenses],
              ['Net profit', p.netProfit],
            ],
          );
        }
        break;
      }
      case 'payments':
        downloadCsv(
          name,
          ['Method', 'Payments', 'Amount'],
          (this.payments.value() ?? []).map((p) => [p.method, p.count, p.amount]),
        );
        break;
    }
  }
}
