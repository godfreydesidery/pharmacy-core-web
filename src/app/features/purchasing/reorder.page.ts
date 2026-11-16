import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { Supplier } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

interface Suggestion {
  productUid: string;
  productName: string;
  unitsSold: number;
  dailyVelocity: number;
  onHand: number;
  onOrder: number;
  reorderLevel: number;
  orderMultiple: number;
  suggested: number;
  unitCost: number;
  lineTotal: number;
}

interface SupplierGroup {
  supplierUid: string | null;
  supplierName: string | null;
  leadTimeDays: number;
  total: number;
  lines: Suggestion[];
}

interface Plan {
  windowDays: number;
  coverDays: number;
  groups: SupplierGroup[];
}

/** The key of a group: its supplier, or "none" for products no supplier has delivered yet. */
const groupKey = (g: SupplierGroup): string => g.supplierUid ?? 'none';

/**
 * Purchasing → Reorder suggestions: what the branch should order from how fast products sell,
 * reviewed and turned into one purchase order per supplier.
 */
@Component({
  selector: 'app-reorder',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'reorder.title' | t }}</h1>
          <p class="sub">{{ 'reorder.sub' | t }}</p>
        </div>
        @if (session.can('purchasing.manage') && (plan.value()?.groups?.length ?? 0) > 0) {
          <div class="actions">
            <button class="btn primary" type="button" [disabled]="busy()" (click)="create()">
              <app-icon name="plus" [size]="16" /> {{ 'reorder.create' | t }}
            </button>
          </div>
        }
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'reorder.title' | t" />
      } @else {
        <div class="card card-pad row mb" style="gap: 16px; flex-wrap: wrap; align-items: flex-end">
          <div class="field">
            <label for="reorder-window">{{ 'reorder.window' | t }}</label>
            <input
              id="reorder-window"
              class="input"
              type="number"
              min="1"
              max="365"
              style="width: 120px"
              [value]="windowDays()"
              (change)="windowDays.set(days($any($event.target).value))"
            />
          </div>
          <div class="field">
            <label for="reorder-cover">{{ 'reorder.cover' | t }}</label>
            <input
              id="reorder-cover"
              class="input"
              type="number"
              min="1"
              max="365"
              style="width: 120px"
              [value]="coverDays()"
              (change)="coverDays.set(days($any($event.target).value))"
            />
          </div>
          <p class="muted small" style="flex: 1; min-width: 240px">{{ 'reorder.formula' | t }}</p>
        </div>

        @for (g of plan.value()?.groups ?? []; track key(g)) {
          <div class="card mb">
            <div class="card-pad row between" style="flex-wrap: wrap; gap: 8px">
              <div>
                @if (g.supplierUid) {
                  <h3>{{ g.supplierName }}</h3>
                  <span class="muted">{{ 'reorder.leadTime' | t: { days: g.leadTimeDays } }}</span>
                } @else {
                  <h3>{{ 'reorder.noSupplier' | t }}</h3>
                  <select
                    class="select"
                    [attr.aria-label]="'reorder.chooseSupplier' | t"
                    [value]="chosen()[key(g)] ?? ''"
                    (change)="choose(g, $any($event.target).value)"
                  >
                    <option value="">{{ 'reorder.chooseSupplier' | t }}</option>
                    @for (s of suppliers.value()?.items ?? []; track s.uid) {
                      <option [value]="s.uid">{{ s.name }}</option>
                    }
                  </select>
                }
              </div>
              <div class="right">
                <span class="muted">{{ 'reorder.total' | t }}</span>
                <h3>{{ groupTotal(g) | money }}</h3>
              </div>
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'reorder.product' | t }}</th>
                    <th class="right">{{ 'reorder.sold' | t }}</th>
                    <th class="right">{{ 'reorder.perDay' | t }}</th>
                    <th class="right">{{ 'reorder.onHand' | t }}</th>
                    <th class="right">{{ 'reorder.onOrder' | t }}</th>
                    <th class="right">{{ 'reorder.reorderLevel' | t }}</th>
                    <th class="right">{{ 'reorder.quantity' | t }}</th>
                    <th class="right">{{ 'reorder.unitCost' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of g.lines; track l.productUid) {
                    <tr>
                      <td>
                        {{ l.productName }}
                        @if (l.orderMultiple > 1) {
                          <small class="muted block">{{
                            'reorder.multiple' | t: { n: l.orderMultiple }
                          }}</small>
                        }
                      </td>
                      <td class="right">{{ l.unitsSold }}</td>
                      <td class="right">{{ l.dailyVelocity }}</td>
                      <td class="right">{{ l.onHand }}</td>
                      <td class="right">{{ l.onOrder }}</td>
                      <td class="right">{{ l.reorderLevel || '' }}</td>
                      <td class="right">
                        <input
                          class="input sm"
                          type="number"
                          min="0"
                          style="width: 90px"
                          [attr.aria-label]="'reorder.quantity' | t"
                          [value]="quantity(l)"
                          (input)="setQuantity(l.productUid, $any($event.target).value)"
                        />
                      </td>
                      <td class="right">{{ l.unitCost | money }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @empty {
          @if (!plan.loading()) {
            <div class="card card-pad empty">{{ 'reorder.none' | t }}</div>
          }
        }
      }
    </div>
  `,
})
export default class ReorderPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly windowDays = signal(30);
  protected readonly coverDays = signal(30);
  /** Quantities the user changed, by product. */
  protected readonly quantities = signal<Record<string, number>>({});
  /** Suppliers chosen for the products no supplier has delivered yet. */
  protected readonly chosen = signal<Record<string, string>>({});
  protected readonly plan = loaded<Plan>(() =>
    this.session.branch()
      ? {
          path: '/reorder-suggestions',
          query: { windowDays: this.windowDays(), coverDays: this.coverDays() },
        }
      : null,
  );
  protected readonly suppliers = loaded<{ items: Supplier[] }>(() =>
    this.session.branch()
      ? { path: '/suppliers', query: { limit: 100 }, options: { noBranch: true } }
      : null,
  );
  protected readonly key = groupKey;
  private readonly hasLines = computed(() => (this.plan.value()?.groups ?? []).length > 0);

  protected days(value: string): number {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(365, Math.max(1, n)) : 30;
  }

  protected quantity(l: Suggestion): number {
    return this.quantities()[l.productUid] ?? l.suggested;
  }

  protected setQuantity(productUid: string, value: string): void {
    const n = Math.max(0, Math.round(Number(value) || 0));
    this.quantities.update((q) => ({ ...q, [productUid]: n }));
  }

  protected choose(g: SupplierGroup, supplierUid: string): void {
    this.chosen.update((c) => ({ ...c, [groupKey(g)]: supplierUid }));
  }

  protected groupTotal(g: SupplierGroup): number {
    return g.lines.reduce((sum, l) => sum + this.quantity(l) * l.unitCost, 0);
  }

  protected async create(): Promise<void> {
    const groups = this.plan.value()?.groups ?? [];
    if (!this.hasLines()) {
      return;
    }
    // Products without a supplier join the chosen supplier's order, or wait until one is chosen.
    const bySupplier = new Map<
      string,
      { productUid: string; quantity: number; unitCost: number }[]
    >();
    for (const g of groups) {
      const supplier = g.supplierUid ?? this.chosen()[groupKey(g)];
      if (!supplier) {
        continue;
      }
      const lines = bySupplier.get(supplier) ?? [];
      for (const l of g.lines) {
        const quantity = this.quantity(l);
        if (quantity > 0 && !lines.some((x) => x.productUid === l.productUid)) {
          lines.push({ productUid: l.productUid, quantity, unitCost: l.unitCost });
        }
      }
      bySupplier.set(supplier, lines);
    }
    const orders = [...bySupplier.entries()]
      .filter(([, lines]) => lines.length > 0)
      .map(([supplierUid, lines]) => ({ supplierUid, lines }));
    if (orders.length === 0) {
      this.toasts.error(this.translations.t('reorder.nothing'));
      return;
    }
    this.busy.set(true);
    try {
      const created = await this.api.post<unknown[]>('/reorder-suggestions/orders', { orders });
      this.toasts.success(this.translations.t('reorder.created', { n: created.length }));
      await this.router.navigateByUrl('/purchasing/orders');
    } finally {
      this.busy.set(false);
    }
  }
}
