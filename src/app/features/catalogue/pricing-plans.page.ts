import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import {
  BulkResult,
  Category,
  PlanSales,
  PriceChange,
  PricingGridRow,
  PricingPlan,
} from '../../core/api/models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

/**
 * Pricing plans: every medicine's Normal Sale price and its price in each plan, edited in place.
 * A plan with no price for a medicine shows its rule's price, or "Pending" when it has no rule (the
 * till refuses it). Also: Excel per plan, bulk update with a preview, price history, and the sales
 * of each plan against Normal Sale.
 */
@Component({
  selector: 'app-pricing-plans',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'plans.title' | t }}</h1>
          <p class="sub">{{ 'plans.sub' | t }}</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/catalogue/pricing">
            <app-icon name="gear" [size]="16" /> {{ 'plans.editPlans' | t }}
          </a>
          <button
            class="btn"
            type="button"
            data-testid="plans-report"
            (click)="showReport.set(!showReport())"
          >
            <app-icon name="chart" [size]="16" /> {{ 'plans.report' | t }}
          </button>
          @if (canEdit()) {
            <button class="btn primary" type="button" data-testid="bulk-open" (click)="openBulk()">
              <app-icon name="edit" [size]="16" /> {{ 'plans.bulk' | t }}
            </button>
          }
        </div>
      </div>

      @if (showReport()) {
        <div class="card card-pad mb" data-testid="plans-report-card">
          <div class="row wrap gap mb">
            <div class="field">
              <label>{{ 'plans.from' | t }}</label>
              <input
                class="input"
                type="date"
                [value]="from()"
                (change)="from.set($any($event.target).value)"
              />
            </div>
            <div class="field">
              <label>{{ 'plans.to' | t }}</label>
              <input
                class="input"
                type="date"
                [value]="to()"
                (change)="to.set($any($event.target).value)"
              />
            </div>
          </div>
          <div class="table-wrap">
            <table class="table compact">
              <thead>
                <tr>
                  <th>{{ 'pos.pricePlan' | t }}</th>
                  <th class="right">{{ 'plans.reportSales' | t }}</th>
                  <th class="right">{{ 'plans.reportTotal' | t }}</th>
                  <th class="right">{{ 'plans.reportNormal' | t }}</th>
                  <th class="right">{{ 'plans.reportBelow' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of report.value() ?? []; track r.plan) {
                  <tr>
                    <td>
                      <b>{{ r.plan === 'Normal Sale' ? ('plans.normal' | t) : r.plan }}</b>
                    </td>
                    <td class="right">{{ r.sales }}</td>
                    <td class="right">{{ r.total | money }}</td>
                    <td class="right">
                      {{ r.normalTotal === null ? '—' : (r.normalTotal | money) }}
                    </td>
                    <td class="right" [class.text-red]="(r.belowNormal ?? 0) > 0">
                      {{ r.belowNormal === null ? '—' : (r.belowNormal | money) }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5">
                      <app-empty
                        [loading]="report.loading()"
                        icon="chart"
                        [title]="'plans.reportNone' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <div class="card">
        <div class="toolbar row wrap gap">
          <input
            class="input grow"
            type="search"
            data-testid="plans-search"
            [placeholder]="'plans.search' | t"
            [value]="q()"
            (input)="q.set($any($event.target).value)"
          />
          <select
            class="select"
            [value]="category()"
            (change)="category.set($any($event.target).value)"
          >
            <option value="">{{ 'plans.allCategories' | t }}</option>
            @for (c of categories.value() ?? []; track c.uid) {
              <option [value]="c.uid">{{ c.name }}</option>
            }
          </select>
          <label class="check">
            <input
              type="checkbox"
              data-testid="plans-missing"
              [checked]="missing()"
              (change)="missing.set($any($event.target).checked)"
            />
            {{ 'plans.missingOnly' | t }}
          </label>
        </div>
        <div class="table-wrap">
          <table class="table compact" data-testid="pricing-grid">
            <thead>
              <tr>
                <th>{{ 'plans.medicine' | t }}</th>
                <th class="right">{{ 'plans.cost' | t }}</th>
                <th class="right">{{ 'plans.normal' | t }}</th>
                @for (p of others(); track p.uid) {
                  <th class="right">
                    <div class="plan-head">
                      <span>{{ p.name }}</span>
                      <small class="muted">
                        {{
                          p.rulePercent === null
                            ? ('pricing.blocks' | t)
                            : ('plans.rule' | t: { rule: signed(p.rulePercent) })
                        }}
                      </small>
                      @if (canEdit()) {
                        <app-import
                          [path]="'/price-lists/' + p.uid + '/import'"
                          permission="catalogue.manage"
                          [small]="true"
                          (imported)="grid.reload()"
                        />
                      }
                    </div>
                  </th>
                }
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.productUid) {
                <tr [attr.data-testid]="'grid-row-' + row.code">
                  <td>
                    <b>{{ row.name }}</b>
                    <small class="muted">
                      {{ row.code }}{{ row.barcode ? ' · ' + row.barcode : '' }}
                    </small>
                  </td>
                  <td class="right muted">
                    {{ row.costPrice === null ? '—' : (row.costPrice | money) }}
                  </td>
                  <td class="right">
                    <input
                      class="input price"
                      type="number"
                      min="0"
                      step="any"
                      data-testid="price-normal"
                      [disabled]="!canEdit()"
                      [class.below]="below(row, row.normalPrice)"
                      [value]="row.normalPrice"
                      (change)="save(row, null, $any($event.target).value)"
                    />
                  </td>
                  @for (p of others(); track p.uid) {
                    <td class="right">
                      <input
                        class="input price"
                        type="number"
                        min="0"
                        step="any"
                        [attr.data-testid]="'price-' + p.name"
                        [disabled]="!canEdit()"
                        [class.pending]="pending(row, p)"
                        [class.below]="below(row, row.prices[p.uid!])"
                        [value]="row.prices[p.uid!] ?? ''"
                        [placeholder]="placeholder(row, p)"
                        (change)="save(row, p, $any($event.target).value)"
                      />
                    </td>
                  }
                  <td class="right">
                    <button
                      class="btn ghost sm"
                      type="button"
                      [attr.aria-label]="'plans.history' | t"
                      (click)="openHistory(row)"
                    >
                      <app-icon name="clock" [size]="15" />
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="4 + others().length">
                    <app-empty [loading]="grid.loading()" icon="tag" [title]="'plans.noRows' | t" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="grid" />
      </div>
    </div>

    <app-drawer
      [open]="!!historyOf()"
      [title]="'plans.historyOf' | t: { name: historyOf()?.name ?? '' }"
      (closed)="historyOf.set(null)"
    >
      <div class="stack">
        @for (h of history(); track $index) {
          <div class="history-row">
            <div class="row between">
              <b>{{ h.planName === 'Normal Sale' ? ('plans.normal' | t) : h.planName }}</b>
              <span class="muted small">{{ h.changedAt | when }}</span>
            </div>
            <div>
              {{ h.oldPrice === null ? '—' : (h.oldPrice | money) }} →
              <b>{{ h.newPrice === null ? '—' : (h.newPrice | money) }}</b>
              @if (h.minQuantity > 1) {
                <small class="muted">(≥ {{ h.minQuantity }})</small>
              }
            </div>
            <small class="muted">{{ 'plans.source.' + h.source | t }} · {{ h.changedBy }}</small>
          </div>
        } @empty {
          <app-empty icon="clock" [title]="'plans.noHistory' | t" />
        }
      </div>
    </app-drawer>

    <app-modal
      [open]="bulkOpen()"
      [wide]="true"
      [title]="'plans.bulkTitle' | t: { plan: bulkPlanName() }"
      (closed)="bulkOpen.set(false)"
    >
      <div class="form-grid">
        <div class="field">
          <label>{{ 'pos.pricePlan' | t }}</label>
          <select
            class="select"
            data-testid="bulk-plan"
            [value]="bulkPlan()"
            (change)="bulkPlan.set($any($event.target).value); bulkResult.set(null)"
          >
            @for (p of plans.value() ?? []; track p.uid) {
              <option [value]="p.uid ?? 'normal'">
                {{ p.uid ? p.name : ('plans.normal' | t) }}
              </option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'plans.bulkPercent' | t }}</label>
          <input
            class="input"
            type="number"
            step="any"
            data-testid="bulk-percent"
            [value]="bulkPercent()"
            (input)="bulkPercent.set(+$any($event.target).value); bulkResult.set(null)"
          />
        </div>
        <div class="field">
          <label>{{ 'plans.bulkRoundTo' | t }}</label>
          <input
            class="input"
            type="number"
            min="0"
            [value]="bulkRoundTo()"
            (input)="bulkRoundTo.set(+$any($event.target).value); bulkResult.set(null)"
          />
        </div>
        <div class="field">
          <label>{{ 'plans.bulkRounding' | t }}</label>
          <select
            class="select"
            [value]="bulkRounding()"
            (change)="bulkRounding.set($any($event.target).value); bulkResult.set(null)"
          >
            @for (m of roundings; track m) {
              <option [value]="m">{{ 'plans.rounding.' + m | t }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'plans.allCategories' | t }}</label>
          <select
            class="select"
            [value]="bulkCategory()"
            (change)="bulkCategory.set($any($event.target).value); bulkResult.set(null)"
          >
            <option value="">{{ 'plans.allCategories' | t }}</option>
            @for (c of categories.value() ?? []; track c.uid) {
              <option [value]="c.uid">{{ c.name }}</option>
            }
          </select>
        </div>
        @if (bulkPlan() !== 'normal') {
          <label class="check full">
            <input
              type="checkbox"
              [checked]="bulkOnlyMissing()"
              (change)="bulkOnlyMissing.set($any($event.target).checked); bulkResult.set(null)"
            />
            {{ 'plans.bulkOnlyMissing' | t }}
          </label>
        }
      </div>
      @if (bulkResult(); as result) {
        @if (result.lines.length === 0) {
          <p class="muted mt">{{ 'plans.bulkNone' | t }}</p>
        } @else {
          <div class="table-wrap mt bulk-preview">
            <table class="table compact" data-testid="bulk-preview">
              <thead>
                <tr>
                  <th>{{ 'plans.medicine' | t }}</th>
                  <th class="right">{{ 'plans.old' | t }}</th>
                  <th class="right">{{ 'plans.new' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of result.lines.slice(0, 200); track l.productUid) {
                  <tr>
                    <td>
                      {{ l.name }} <small class="muted">{{ l.code }}</small>
                    </td>
                    <td class="right muted">
                      {{ l.oldPrice === null ? ('plans.pending' | t) : (l.oldPrice | money) }}
                    </td>
                    <td class="right">
                      <b>{{ l.newPrice | money }}</b>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      <ng-container footer>
        <button class="btn" type="button" (click)="bulkOpen.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn"
          type="button"
          data-testid="bulk-preview-btn"
          [disabled]="busy()"
          (click)="previewBulk()"
        >
          {{ 'plans.bulkPreview' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          data-testid="bulk-apply"
          [disabled]="busy() || !bulkResult()?.lines?.length"
          (click)="applyBulk()"
        >
          {{ 'plans.bulkApply' | t: { count: bulkResult()?.lines?.length ?? 0 } }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
      align-items: center;
    }
    .toolbar .select {
      width: auto;
      min-width: 180px;
    }
    .grow {
      flex: 1;
      min-width: 200px;
    }
    .plan-head {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    td b,
    td small {
      display: block;
    }
    .input.price {
      width: 110px;
      text-align: right;
      margin-left: auto;
    }
    .input.price.pending::placeholder {
      color: var(--red, #c0262d);
      font-weight: 600;
    }
    .input.price.below {
      border-color: var(--amber, #a15c07);
    }
    .history-row {
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    .bulk-preview {
      max-height: 340px;
      overflow: auto;
    }
    .text-red {
      color: var(--red, #c0262d);
    }
  `,
})
export default class PricingPlansPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly session = inject(SessionStore);

  protected readonly canEdit = computed(() => this.session.can('catalogue.manage'));
  protected readonly roundings = ['NEAREST', 'UP', 'DOWN'] as const;

  protected readonly q = signal('');
  private readonly qDebounced = debounced(this.q);
  protected readonly category = signal('');
  protected readonly missing = signal(false);

  protected readonly plans = loaded<PricingPlan[]>(() => ({
    path: '/pricing-plans',
    options: { noBranch: true },
  }));
  /** Every plan but Normal Sale (which is its own column). */
  protected readonly others = computed(() => (this.plans.value() ?? []).filter((p) => p.uid));
  protected readonly categories = loaded<Category[]>(() => ({
    path: '/categories',
    options: { noBranch: true, silent: true },
  }));
  protected readonly grid = pagedList<PricingGridRow>(
    () => ({
      path: '/pricing-plans/grid',
      query: {
        q: this.qDebounced() || undefined,
        categoryUid: this.category() || undefined,
        missing: this.missing() || undefined,
      },
      options: { noBranch: true },
    }),
    50,
  );
  /** Rows as saved since the page loaded, over the grid's. */
  private readonly edited = signal<Record<string, PricingGridRow>>({});
  protected readonly rows = computed(() =>
    this.grid.items().map((r) => this.edited()[r.productUid] ?? r),
  );

  protected readonly showReport = signal(false);
  protected readonly from = signal(isoDay(-30));
  protected readonly to = signal(isoDay());
  protected readonly report = loaded<PlanSales[]>(() =>
    this.showReport()
      ? {
          path: '/reports/pricing-plans',
          query: { from: this.from(), to: this.to() },
          options: { noBranch: true },
        }
      : null,
  );

  protected readonly historyOf = signal<PricingGridRow | null>(null);
  protected readonly history = signal<PriceChange[]>([]);

  protected readonly busy = signal(false);
  protected readonly bulkOpen = signal(false);
  protected readonly bulkPlan = signal('normal');
  protected readonly bulkPercent = signal(0);
  protected readonly bulkRoundTo = signal(50);
  protected readonly bulkRounding = signal<'NEAREST' | 'UP' | 'DOWN'>('NEAREST');
  protected readonly bulkCategory = signal('');
  protected readonly bulkOnlyMissing = signal(false);
  protected readonly bulkResult = signal<BulkResult | null>(null);
  protected readonly bulkPlanName = computed(() => {
    const plan = (this.plans.value() ?? []).find((p) => (p.uid ?? 'normal') === this.bulkPlan());
    return !plan || !plan.uid ? this.translations.t('plans.normal') : plan.name;
  });

  protected signed(percent: number): string {
    return `${percent > 0 ? '+' : percent < 0 ? '−' : '±'}${Math.abs(percent)}%`;
  }

  /** What the till charges where the plan has no price: its rule's price, or Pending. */
  protected placeholder(row: PricingGridRow, plan: PricingPlan): string {
    if (plan.rulePercent === null) {
      return this.translations.t('plans.pending');
    }
    return String(Math.round(row.normalPrice * (1 + plan.rulePercent / 100) * 100) / 100);
  }

  protected pending(row: PricingGridRow, plan: PricingPlan): boolean {
    return plan.rulePercent === null && row.prices[plan.uid!] === undefined;
  }

  protected below(row: PricingGridRow, price: number | undefined): boolean {
    return price !== undefined && row.costPrice !== null && price < row.costPrice;
  }

  protected async save(
    row: PricingGridRow,
    plan: PricingPlan | null,
    value: string,
  ): Promise<void> {
    const target = plan?.uid ?? 'normal';
    const path = `/pricing-plans/${target}/prices/${row.productUid}`;
    const empty = value.trim() === '';
    if (empty && !plan) {
      return;
    }
    const saved = empty
      ? await this.api.delete<PricingGridRow>(path, { noBranch: true })
      : await this.api.put<PricingGridRow>(path, { price: Number(value) }, { noBranch: true });
    this.edited.update((all) => ({ ...all, [row.productUid]: saved }));
    this.toasts.success(this.translations.t(empty ? 'plans.removed' : 'plans.saved'));
    if (this.below(saved, plan ? saved.prices[plan.uid!] : saved.normalPrice)) {
      this.toasts.error(this.translations.t('plans.belowCost'));
    }
  }

  protected async openHistory(row: PricingGridRow): Promise<void> {
    this.history.set([]);
    this.historyOf.set(row);
    this.history.set(
      await this.api.get<PriceChange[]>(`/products/${row.productUid}/price-history`, {
        noBranch: true,
      }),
    );
  }

  protected openBulk(): void {
    this.bulkResult.set(null);
    this.bulkOpen.set(true);
  }

  private bulkBody(): object {
    return {
      percent: this.bulkPercent(),
      roundTo: this.bulkRoundTo(),
      rounding: this.bulkRounding(),
      categoryUid: this.bulkCategory() || null,
      onlyMissing: this.bulkPlan() !== 'normal' && this.bulkOnlyMissing(),
    };
  }

  protected async previewBulk(): Promise<void> {
    this.busy.set(true);
    try {
      this.bulkResult.set(
        await this.api.post<BulkResult>(
          `/pricing-plans/${this.bulkPlan()}/bulk/preview`,
          this.bulkBody(),
          { noBranch: true },
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async applyBulk(): Promise<void> {
    this.busy.set(true);
    try {
      const done = await this.api.post<BulkResult>(
        `/pricing-plans/${this.bulkPlan()}/bulk`,
        this.bulkBody(),
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('plans.bulkDone', { count: done.lines.length }));
      this.bulkOpen.set(false);
      this.edited.set({});
      await this.grid.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
