import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dashboard } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { formatDate, formatMoney, formatMoneyCompact, humanize } from '../../core/format/format';
import { SettingsStore } from '../../core/format/settings.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ChartPoint, DonutSegment } from '../../core/ui/charts';

const METHOD_COLORS: Record<string, string> = {
  CASH: '#16a34a',
  MOBILE_MONEY: '#2463eb',
  CARD: '#f97316',
  INSURANCE: '#7c3aed',
  CREDIT: '#0891b2',
};

@Component({
  selector: 'app-dashboard',
  imports: [...SHARED, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'dashboard.title' | t }}</h1>
          <p class="sub">
            {{ session.tenant()?.name }} ·
            {{ session.branch()?.name ?? ('common.allBranches' | t) }} ·
            {{ 'dashboard.lastDays' | t: { days: days() } }}
          </p>
        </div>
        <div class="actions">
          <div class="segmented" role="tablist">
            @for (option of [7, 30, 90]; track option) {
              <button type="button" [class.active]="days() === option" (click)="days.set(option)">
                {{ option }}d
              </button>
            }
          </div>
          @if (session.can('sales.sell') && session.branch()) {
            <a class="btn primary" routerLink="/pos"
              ><app-icon name="plus" [size]="16" /> {{ 'dashboard.newSale' | t }}</a
            >
          }
        </div>
      </div>

      @if (data.value(); as d) {
        <div class="grid kpis mb">
          <app-stat
            [label]="'dashboard.sales' | t"
            [caption]="'dashboard.vsPrevious' | t"
            [value]="compact(d.sales.value)"
            [hint]="money(d.sales.value)"
            icon="cart"
            tone="blue"
            [change]="d.sales.changePercent"
          />
          <app-stat
            [label]="'dashboard.purchases' | t"
            [caption]="'dashboard.vsPrevious' | t"
            [value]="compact(d.purchases.value)"
            [hint]="money(d.purchases.value)"
            icon="bag"
            tone="green"
            [change]="d.purchases.changePercent"
          />
          <app-stat
            [label]="'dashboard.grossProfit' | t"
            [caption]="'dashboard.vsPrevious' | t"
            [value]="compact(d.grossProfit.value)"
            [hint]="money(d.grossProfit.value)"
            icon="trend"
            tone="purple"
            [change]="d.grossProfit.changePercent"
          />
          <app-stat
            [label]="'dashboard.transactions' | t"
            [caption]="'dashboard.vsPrevious' | t"
            [value]="d.transactions.value"
            icon="receipt"
            tone="orange"
            [change]="d.transactions.changePercent"
          />
          <app-stat
            [label]="'dashboard.lowStockItems' | t"
            [value]="d.stock.lowStock"
            icon="alert"
            tone="red"
            [caption]="'dashboard.outOfStock' | t: { count: d.stock.outOfStock }"
          />
        </div>

        @if (d.credit; as c) {
          <div class="grid kpis mb credit-kpis">
            <app-stat
              [label]="'dashboard.receivables' | t"
              [value]="c.receivables | compactMoney"
              [hint]="c.receivables | money"
              icon="wallet"
              tone="blue"
              [caption]="c.accountsWithBalance + ' ' + ('dashboard.accountsOwing' | t)"
            />
            <app-stat
              [label]="'dashboard.overdue' | t"
              [value]="c.overdue | compactMoney"
              [hint]="c.overdue | money"
              icon="clock"
              [tone]="c.overdue > 0 ? 'red' : 'green'"
              [caption]="'dashboard.pastTerms' | t"
            />
            <app-stat
              [label]="'dashboard.pendingClaims' | t"
              [value]="c.pendingClaimsAmount | compactMoney"
              [hint]="c.pendingClaimsAmount | money"
              icon="stethoscope"
              tone="purple"
              [caption]="c.pendingClaims + ' ' + ('dashboard.claimsUnpaid' | t)"
            />
            <app-stat
              [label]="'dashboard.customerCredit' | t"
              [value]="c.customerCredit | compactMoney"
              [hint]="c.customerCredit | money"
              icon="cash"
              tone="teal"
              [caption]="'dashboard.depositsHeld' | t"
            />
          </div>
        }

        <div class="grid dash mb">
          <div class="card span-all">
            <div class="card-head">
              <h3>{{ 'dashboard.salesOverview' | t }}</h3>
              <span class="muted" style="font-size:12px">{{
                'dashboard.inDays' | t: { amount: money(d.sales.value), days: d.periodDays }
              }}</span>
            </div>
            <div style="padding:4px 14px 12px">
              @if (trend().length > 1) {
                <app-line-chart [points]="trend()" [format]="moneyFormat" ariaLabel="Daily sales" />
              } @else {
                <app-empty
                  icon="chart"
                  [title]="'dashboard.noSales' | t"
                  [text]="'dashboard.noSalesHint' | t"
                />
              }
            </div>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'dashboard.topSelling' | t }}</h3>
              @if (session.can('reports.view')) {
                <a class="link" routerLink="/reports">{{ 'dashboard.reports' | t }}</a>
              }
            </div>
            <div class="table-wrap">
              <table class="table compact fit">
                <thead>
                  <tr>
                    <th>{{ 'dashboard.medicine' | t }}</th>
                    <th class="right">{{ 'dashboard.qty' | t }}</th>
                    <th class="right">{{ 'dashboard.sales' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of d.topProducts; track p.productUid; let i = $index) {
                    <tr>
                      <td style="white-space:normal">
                        <div class="cell-main">
                          <span class="thumb" [class]="'thumb ' + tones[i % tones.length]"
                            ><app-icon name="pill" [size]="15" /></span
                          ><b style="font-weight:550">{{ p.productName }}</b>
                        </div>
                      </td>
                      <td class="right muted">{{ p.quantity | num }}</td>
                      <td class="right strong" [title]="p.net | money">
                        {{ short(p.net) }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3">
                        <app-empty icon="pill" [title]="'dashboard.noSalesPeriod' | t" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'dashboard.stockSummary' | t }}</h3>
              @if (session.can('inventory.view')) {
                <a class="link" routerLink="/inventory/stock">{{ 'common.details' | t }}</a>
              }
            </div>
            <div class="card-pad">
              <app-donut
                [segments]="stockSegments()"
                [centerLabel]="'dashboard.products' | t"
                [centerValue]="'' + stockTotal()"
              />
            </div>
          </div>
        </div>

        <div class="grid dash">
          <div class="card">
            <div class="card-head">
              <h3>{{ 'dashboard.expiryAlerts' | t }}</h3>
              @if (session.can('inventory.view')) {
                <a class="link" routerLink="/inventory/expiry">{{ 'common.viewAll' | t }}</a>
              }
            </div>
            <div class="mini-list" style="padding:0 18px 12px">
              @for (b of d.expiringBatches; track b.batchUid) {
                <div class="item">
                  <app-icon
                    name="alert"
                    [size]="16"
                    [class]="b.daysLeft <= 30 ? 'text-red' : 'text-amber'"
                  />
                  <span class="grow strong" style="font-weight:550">{{ b.productName }}</span>
                  <span class="faint mono">{{ b.batchNumber }}</span>
                  <span class="muted" style="width:86px">{{ b.expiryDate | day }}</span>
                  <b
                    [class]="
                      b.daysLeft < 0 ? 'text-red' : b.daysLeft <= 30 ? 'text-red' : 'text-amber'
                    "
                    style="width:58px;text-align:right"
                    >{{
                      b.daysLeft < 0
                        ? ('dashboard.expired' | t)
                        : ('dashboard.daysShort' | t: { days: b.daysLeft })
                    }}</b
                  >
                </div>
              } @empty {
                <app-empty icon="check" [title]="'dashboard.noExpiring' | t" />
              }
            </div>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'dashboard.recentSales' | t }}</h3>
              @if (session.can('sales.view')) {
                <a class="link" routerLink="/sales">{{ 'common.viewAll' | t }}</a>
              }
            </div>
            <div class="mini-list" style="padding:0 18px 12px">
              @for (s of d.recentSales; track s.uid) {
                <a class="item" [routerLink]="['/sales', s.uid]">
                  <span
                    class="thumb tone-blue"
                    style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center"
                    ><app-icon name="receipt" [size]="14"
                  /></span>
                  <span class="grow"
                    ><b style="font-weight:550">{{ s.number }}</b>
                    <span class="muted"
                      >· {{ s.customerName ?? ('dashboard.walkIn' | t) }}</span
                    ></span
                  >
                  <b>{{ s.total | money }}</b>
                  <span class="faint" style="width:96px;text-align:right">{{
                    s.createdAt | when
                  }}</span>
                </a>
              } @empty {
                <app-empty icon="receipt" [title]="'dashboard.noSales' | t" />
              }
            </div>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'dashboard.paymentMix' | t }}</h3>
            </div>
            <div class="card-pad">
              <app-donut
                [segments]="paymentSegments()"
                [centerLabel]="'dashboard.collected' | t"
                [centerValue]="compactTotal()"
              />
            </div>
          </div>
        </div>
      } @else {
        <div class="grid kpis mb">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <div class="card card-pad"><div class="skeleton" style="height:56px"></div></div>
          }
        </div>
        <app-empty
          [loading]="data.loading()"
          icon="chart"
          [title]="'dashboard.unavailable' | t"
          [text]="data.error()?.message ?? ''"
        />
      }
    </div>
  `,
})
export default class DashboardPage {
  protected readonly session = inject(SessionStore);
  private readonly settings = inject(SettingsStore);
  private readonly translations = inject(Translations);
  protected readonly days = signal(30);
  protected readonly tones = ['tone-blue', 'tone-green', 'tone-purple', 'tone-orange', 'tone-teal'];
  protected readonly data = loaded<Dashboard>(() => ({
    path: '/dashboard',
    query: { days: this.days() },
  }));

  protected readonly moneyFormat = (value: number) => formatMoney(value, this.settings.currency());
  /** Always compact, for narrow cards: TZS 7.5K. */
  protected short(value: number): string {
    return formatMoneyCompact(value, this.settings.currency(), 'en-US', 1_000);
  }

  protected compact(value: number): string {
    return formatMoneyCompact(value, this.settings.currency());
  }

  private t(key: string): string {
    return this.translations.t(key);
  }

  protected money(value: number): string {
    return formatMoney(value, this.settings.currency());
  }

  protected readonly trend = computed<ChartPoint[]>(() =>
    (this.data.value()?.salesTrend ?? []).map((p) => ({
      label: formatDate(p.date).replace(/ \d{4}$/, ''),
      value: p.total,
    })),
  );
  protected readonly stockTotal = computed(() => {
    const s = this.data.value()?.stock;
    return s ? s.inStock + s.lowStock + s.outOfStock : 0;
  });
  protected readonly stockSegments = computed<DonutSegment[]>(() => {
    const s = this.data.value()?.stock;
    return s
      ? [
          { label: this.t('dashboard.inStock'), value: s.inStock, color: '#16a34a' },
          { label: this.t('dashboard.lowStock'), value: s.lowStock, color: '#f59e0b' },
          { label: this.t('dashboard.outOfStockLabel'), value: s.outOfStock, color: '#ef4444' },
          { label: this.t('dashboard.expiringSoon'), value: s.expiringSoon, color: '#7c3aed' },
        ]
      : [];
  });
  protected readonly paymentSegments = computed<DonutSegment[]>(() =>
    (this.data.value()?.paymentMix ?? []).map((p) => ({
      label: this.translations.t('payment.' + p.method, undefined, humanize(p.method)),
      value: p.amount,
      color: METHOD_COLORS[p.method] ?? '#64748b',
      display: this.money(p.amount),
    })),
  );
  protected readonly compactTotal = computed(() => {
    const total = (this.data.value()?.paymentMix ?? []).reduce((sum, p) => sum + p.amount, 0);
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
      total,
    );
  });
}
