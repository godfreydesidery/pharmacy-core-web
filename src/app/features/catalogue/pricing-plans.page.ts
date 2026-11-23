import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Api } from '../../core/api/api.service';
import {
  BulkResult,
  Category,
  Customer,
  CustomerType,
  PlanCard,
  PlanItemRow,
  PlanSales,
  PriceChange,
  PriceList,
  Product,
} from '../../core/api/models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ConfirmService } from '../../core/ui/confirm';
import { downloadFrom } from '../../core/ui/export.component';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';

const CUSTOMER_TYPES: CustomerType[] = [
  'RETAIL',
  'WHOLESALE',
  'INSURANCE',
  'CORPORATE',
  'STAFF',
  'NGO',
  'GOVERNMENT',
];

interface PlanDraft {
  uid: string | null;
  name: string;
  target: 'everyone' | 'type' | 'customer' | 'insurer';
  customerType: CustomerType | '';
  customerUid: string | null;
  customerName: string | null;
  payerUid: string | null;
  payerName: string | null;
  rule: boolean;
  adjustmentPercent: number;
  validFrom: string;
  validTo: string;
  active: boolean;
}

/**
 * Pricing plans, one at a time: a card per plan (Normal Sale first), and the chosen plan's own
 * page listing only the medicines it prices, with its own actions (add a medicine, edit the plan,
 * Excel, bulk update, its sales, switch it off). A plan that blocks shows how many medicines it
 * does not price, as a list to add from, not as rows.
 */
/** The plan buttons' filter, outliving the page while the app is open. */
const PLAN_FILTER = {
  query: signal(''),
  kind: signal<'all' | 'type' | 'customer' | 'insurer' | 'till'>('all'),
  inactive: signal(false),
};

@Component({
  selector: 'app-pricing-plans',
  imports: [...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (selected() === null) {
        <div class="page-head">
          <div>
            <h1>{{ 'plans.title' | t }}</h1>
            <p class="sub">{{ 'plans.choose' | t }}</p>
          </div>
        </div>

        <div class="plan-filter" role="search">
          <label class="search grow">
            <app-icon name="search" [size]="16" />
            <input
              type="search"
              data-testid="plan-search"
              [attr.aria-label]="'plans.findPlan' | t"
              [placeholder]="'plans.searchHint' | t"
              [value]="planQuery()"
              (input)="planQuery.set($any($event.target).value)"
            />
          </label>
          <select
            class="select kind"
            data-testid="plan-kind"
            [attr.aria-label]="'plans.whoFor' | t"
            [value]="planKind()"
            (change)="planKind.set($any($event.target).value)"
          >
            @for (k of planKinds; track k) {
              <option [value]="k">{{ 'plans.kind.' + k | t }}</option>
            }
          </select>
          <label class="check">
            <input
              type="checkbox"
              data-testid="plan-inactive"
              [checked]="showInactive()"
              (change)="showInactive.set($any($event.target).checked)"
            />
            {{ 'plans.showInactive' | t }}
          </label>
        </div>
        <p class="muted small" aria-live="polite" data-testid="plan-shown">
          {{
            'plans.shown' | t: { shown: shownCards().length, total: (cards.value() ?? []).length }
          }}
        </p>

        <nav class="plan-cards" data-testid="plan-cards" [attr.aria-label]="'plans.title' | t">
          @for (c of shownCards(); track c.uid) {
            <a
              class="plan-card"
              [class.off]="!c.active"
              [attr.data-testid]="'plan-card-' + c.name"
              [routerLink]="['/catalogue/pricing-plans', c.uid ?? 'normal']"
            >
              <b>{{ c.uid ? c.name : ('plans.normal' | t) }}</b>
              <small>{{ audience(c) }}</small>
              <small class="muted">
                {{
                  c.uid
                    ? c.rulePercent === null
                      ? ('pricing.blocks' | t)
                      : ('plans.rule' | t: { rule: signed(c.rulePercent) })
                    : ('plans.default' | t)
                }}
              </small>
              <span class="count">
                {{ 'plans.count' | t: { count: c.priced } }}
                @if (!c.active) {
                  · {{ 'plans.inactive' | t }}
                }
              </span>
            </a>
          }
          @if (canEdit()) {
            <button type="button" class="plan-card add" data-testid="plan-new" (click)="newPlan()">
              <app-icon name="plus" [size]="18" />
              <b>{{ 'plans.newPlan' | t }}</b>
            </button>
          }
        </nav>
        @if (cards.value() && shownCards().length === 0) {
          <p class="muted" data-testid="plan-none">{{ 'plans.noneMatch' | t }}</p>
        }
      } @else {
        <div class="page-head">
          <div>
            <a class="back" routerLink="/catalogue/pricing-plans" data-testid="plans-back">
              <app-icon name="arrow-left" [size]="16" />
              {{ 'plans.title' | t }}
            </a>
            <h1>{{ cardName() }}</h1>
          </div>
          <a class="btn" routerLink="/catalogue/pricing-plans" data-testid="plans-all">
            <app-icon name="grid" [size]="16" /> {{ 'plans.allPlans' | t }}
          </a>
        </div>
        @if (cards.value() && !card()) {
          <div class="card">
            <p class="muted">{{ 'plans.notFound' | t }}</p>
          </div>
        }
      }

      @if (card(); as c) {
        <div class="card">
          <div class="plan-head">
            <div>
              <p class="muted">
                {{ audience(c) }}
                @if (c.uid && c.rulePercent === null && notPricedCount() > 0) {
                  ·
                  <button
                    type="button"
                    class="link"
                    data-testid="plan-not-priced"
                    (click)="notPriced.set(!notPriced())"
                  >
                    {{
                      notPriced()
                        ? ('plans.showPriced' | t)
                        : ('plans.notPriced' | t: { count: notPricedCount() })
                    }}
                  </button>
                }
              </p>
            </div>
            @if (canEdit()) {
              <div class="actions wrap">
                @if (c.uid) {
                  <button
                    class="btn primary"
                    type="button"
                    data-testid="plan-add"
                    (click)="openAdd()"
                  >
                    <app-icon name="plus" [size]="16" /> {{ 'plans.addMedicine' | t }}
                  </button>
                  <button class="btn" type="button" data-testid="plan-edit" (click)="editPlan(c)">
                    <app-icon name="edit" [size]="16" /> {{ 'plans.editPlan' | t }}
                  </button>
                  <app-import
                    [path]="'/price-lists/' + c.uid + '/import'"
                    permission="catalogue.manage"
                    (imported)="refresh()"
                  />
                  <button class="btn" type="button" (click)="templateAll(c)">
                    <app-icon name="download" [size]="16" /> {{ 'plans.templateAll' | t }}
                  </button>
                }
                <button class="btn" type="button" data-testid="bulk-open" (click)="openBulk()">
                  <app-icon name="percent" [size]="16" /> {{ 'plans.bulk' | t }}
                </button>
                <button
                  class="btn"
                  type="button"
                  data-testid="plan-sales"
                  (click)="salesOpen.set(true)"
                >
                  <app-icon name="chart" [size]="16" /> {{ 'plans.sales' | t }}
                </button>
                @if (c.uid) {
                  <button
                    class="btn"
                    type="button"
                    data-testid="plan-toggle"
                    (click)="toggleActive(c)"
                  >
                    <app-icon [name]="c.active ? 'lock' : 'check'" [size]="16" />
                    {{ (c.active ? 'plans.deactivate' : 'plans.activate') | t }}
                  </button>
                }
              </div>
            }
          </div>
          <div class="toolbar">
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
              @for (cat of categories.value() ?? []; track cat.uid) {
                <option [value]="cat.uid">{{ cat.name }}</option>
              }
            </select>
          </div>
          <div class="table-wrap">
            <table class="table compact" data-testid="plan-items">
              <thead>
                <tr>
                  <th>{{ 'plans.medicine' | t }}</th>
                  @if (c.uid) {
                    <th class="right">{{ 'plans.fromQty' | t }}</th>
                    <th class="right">{{ 'plans.normal' | t }}</th>
                  }
                  <th class="right">{{ c.uid ? c.name : ('plans.price' | t) }}</th>
                  @if (c.uid) {
                    <th class="right">{{ 'plans.vsNormal' | t }}</th>
                  }
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of items.items(); track row.productUid + ':' + row.minQuantity) {
                  <tr [attr.data-testid]="'item-' + row.code">
                    <td>
                      <b>{{ row.name }}</b>
                      <small class="muted"
                        >{{ row.code }}{{ row.barcode ? ' · ' + row.barcode : '' }}</small
                      >
                    </td>
                    @if (c.uid) {
                      <td class="right">
                        {{ row.minQuantity > 1 ? '≥ ' + row.minQuantity : '1' }}
                      </td>
                      <td class="right muted">{{ row.normalPrice | money }}</td>
                    }
                    <td class="right">
                      <input
                        class="input price"
                        type="number"
                        min="0"
                        step="any"
                        data-testid="item-price"
                        [disabled]="!canEdit()"
                        [class.below]="below(row)"
                        [value]="priceOf(row) ?? ''"
                        [placeholder]="placeholder(c, row)"
                        (change)="save(c, row, $any($event.target).value)"
                      />
                      @if (below(row)) {
                        <small class="warn">{{ 'plans.belowCost' | t }}</small>
                      }
                    </td>
                    @if (c.uid) {
                      <td class="right" [class.down]="(diff(row) ?? 0) < 0">
                        {{
                          diff(row) === null ? '—' : (diff(row)! > 0 ? '+' : '') + diff(row) + '%'
                        }}
                      </td>
                    }
                    <td class="right nowrap">
                      <button
                        class="btn ghost sm"
                        type="button"
                        [attr.aria-label]="'plans.history' | t"
                        (click)="openHistory(row)"
                      >
                        <app-icon name="clock" [size]="15" />
                      </button>
                      @if (c.uid && canEdit() && priceOf(row) !== null && !notPriced()) {
                        <button
                          class="btn ghost sm"
                          type="button"
                          data-testid="item-remove"
                          [attr.aria-label]="'plans.remove' | t"
                          (click)="remove(c, row)"
                        >
                          <app-icon name="trash" [size]="15" />
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="c.uid ? 6 : 3">
                      <app-empty
                        [for]="items"
                        icon="tag"
                        [title]="
                          (c.uid && !notPriced() ? 'plans.nothingPriced' : 'plans.noRows') | t
                        "
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [list]="items" />
        </div>
      }
    </div>

    <!-- add a medicine to the plan -->
    <app-modal [open]="addOpen()" [title]="'plans.addMedicine' | t" (closed)="addOpen.set(false)">
      <div class="form-grid">
        <div class="field full">
          <label>{{ 'plans.medicine' | t }}</label>
          <app-lookup
            path="/products"
            data-testid="add-product"
            [placeholder]="'plans.search' | t"
            [display]="productName"
            (picked)="pickProduct($event)"
          />
        </div>
        <div class="field">
          <label>{{ 'plans.price' | t }}</label>
          <input
            class="input"
            type="number"
            min="0"
            step="any"
            data-testid="add-price"
            [value]="addPrice() ?? ''"
            (input)="addPrice.set(+$any($event.target).value)"
          />
          @if (addProduct(); as p) {
            <span class="hint">{{
              'plans.normalIs' | t: { price: (p.sellingPrice | money) }
            }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'plans.fromQty' | t }}</label>
          <input
            class="input"
            type="number"
            min="1"
            [value]="addMin()"
            (input)="addMin.set(+$any($event.target).value || 1)"
          />
          <span class="hint">{{ 'plans.fromQtyHint' | t }}</span>
        </div>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="addOpen.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          data-testid="add-save"
          [disabled]="busy() || !addProduct() || addPrice() === null"
          (click)="saveAdd()"
        >
          {{ 'plans.addMedicine' | t }}
        </button>
      </ng-container>
    </app-modal>

    <!-- the plan's settings -->
    <app-modal
      [open]="!!draft()"
      [wide]="true"
      [title]="(draft()?.uid ? 'plans.editPlan' : 'plans.newPlan') | t"
      (closed)="draft.set(null)"
    >
      @if (draft(); as d) {
        <div class="form-grid">
          <div class="field">
            <label>{{ 'pricing.name' | t }}</label>
            <input
              class="input"
              data-testid="plan-name"
              [value]="d.name"
              (input)="d.name = $any($event.target).value"
            />
          </div>
          <div class="field">
            <label>{{ 'pricing.appliesTo' | t }}</label>
            <select
              class="select"
              data-testid="plan-target"
              [value]="d.target"
              (change)="setTarget(d, $any($event.target).value)"
            >
              <option value="everyone">{{ 'plans.anyone' | t }}</option>
              <option value="type">{{ 'pricing.aCustomerType' | t }}</option>
              <option value="customer">{{ 'pricing.oneCustomer' | t }}</option>
              <option value="insurer">{{ 'pricing.anInsurer' | t }}</option>
            </select>
          </div>
          @switch (d.target) {
            @case ('type') {
              <div class="field">
                <label>{{ 'pricing.customerType' | t }}</label>
                <select
                  class="select"
                  [value]="d.customerType"
                  (change)="d.customerType = $any($event.target).value"
                >
                  @for (t of customerTypes; track t) {
                    <option [value]="t" [selected]="t === d.customerType">
                      {{ 'enum.' + t | t }}
                    </option>
                  }
                </select>
              </div>
            }
            @case ('customer') {
              <div class="field">
                <label>{{ 'pricing.customer' | t }}</label>
                <app-lookup
                  path="/customers"
                  [placeholder]="d.customerName ?? ('pricing.searchCustomer' | t)"
                  [display]="customerName"
                  (picked)="
                    d.customerUid = $event?.uid ?? null; d.customerName = $event?.name ?? null
                  "
                />
              </div>
            }
            @case ('insurer') {
              <div class="field">
                <label>{{ 'pricing.insurer' | t }}</label>
                <select
                  class="select"
                  data-testid="plan-insurer"
                  [value]="d.payerUid ?? ''"
                  (change)="pickPayer(d, $any($event.target).value)"
                >
                  <option value="">—</option>
                  @for (p of payers.value() ?? []; track p.uid) {
                    <option [value]="p.uid" [selected]="p.uid === d.payerUid">{{ p.name }}</option>
                  }
                </select>
                <span class="hint">{{ 'pricing.insurerHint' | t }}</span>
              </div>
            }
          }
          <div class="field">
            <label>{{ 'pricing.noPrice' | t }}</label>
            <select
              class="select"
              data-testid="plan-rule"
              [value]="d.rule ? 'rule' : 'block'"
              (change)="d.rule = $any($event.target).value === 'rule'; draft.set({ ...d })"
            >
              <option value="block" [selected]="!d.rule">{{ 'pricing.noPrice.block' | t }}</option>
              <option value="rule" [selected]="d.rule">{{ 'pricing.noPrice.rule' | t }}</option>
            </select>
            <span class="hint">{{ 'pricing.noPriceHint' | t }}</span>
          </div>
          @if (d.rule) {
            <div class="field">
              <label>{{ 'pricing.adjustment' | t }}</label>
              <input
                class="input"
                type="number"
                step="any"
                data-testid="plan-percent"
                [value]="d.adjustmentPercent"
                (input)="d.adjustmentPercent = +$any($event.target).value"
              />
              <span class="hint">{{ 'pricing.adjustmentHint' | t }}</span>
            </div>
          }
          <div class="field">
            <label>{{ 'pricing.validFrom' | t }}</label>
            <input
              class="input"
              type="date"
              [value]="d.validFrom"
              (change)="d.validFrom = $any($event.target).value"
            />
          </div>
          <div class="field">
            <label>{{ 'pricing.validTo' | t }}</label>
            <input
              class="input"
              type="date"
              [value]="d.validTo"
              (change)="d.validTo = $any($event.target).value"
            />
          </div>
          <label class="check full">
            <input
              type="checkbox"
              [checked]="d.active"
              (change)="d.active = $any($event.target).checked"
            />
            {{ 'pricing.active' | t }}
          </label>
        </div>
      }
      <ng-container footer>
        <button class="btn" type="button" (click)="draft.set(null)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          data-testid="plan-save"
          [disabled]="busy()"
          (click)="savePlan()"
        >
          {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>

    <!-- bulk update of the chosen plan -->
    <app-modal
      [open]="bulkOpen()"
      [wide]="true"
      [title]="'plans.bulkTitle' | t: { plan: cardName() }"
      (closed)="bulkOpen.set(false)"
    >
      <div class="form-grid">
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
            @for (cat of categories.value() ?? []; track cat.uid) {
              <option [value]="cat.uid">{{ cat.name }}</option>
            }
          </select>
        </div>
        @if (selected() !== 'normal') {
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

    <!-- the plan's sales against Normal Sale -->
    <app-modal
      [open]="salesOpen()"
      [title]="'plans.salesOf' | t: { plan: cardName() }"
      (closed)="salesOpen.set(false)"
    >
      <div class="form-grid">
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
      @if (planSales(); as s) {
        <dl class="dl mt" data-testid="plan-sales-figures">
          <div>
            <dt>{{ 'plans.reportSales' | t }}</dt>
            <dd>{{ s.sales }}</dd>
          </div>
          <div>
            <dt>{{ 'plans.reportTotal' | t }}</dt>
            <dd>{{ s.total | money }}</dd>
          </div>
          <div>
            <dt>{{ 'plans.reportNormal' | t }}</dt>
            <dd>{{ s.normalTotal === null ? '—' : (s.normalTotal | money) }}</dd>
          </div>
          <div>
            <dt>{{ 'plans.reportBelow' | t }}</dt>
            <dd>{{ s.belowNormal === null ? '—' : (s.belowNormal | money) }}</dd>
          </div>
        </dl>
      } @else {
        <p class="muted mt">{{ 'plans.reportNone' | t }}</p>
      }
    </app-modal>

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
  `,
  styles: `
    .plan-filter {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .plan-filter .grow {
      flex: 1 1 280px;
    }
    .plan-filter .kind {
      width: auto;
      min-width: 200px;
    }
    a.plan-card {
      color: inherit;
      text-decoration: none;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
      color: var(--muted);
      text-decoration: none;
    }
    .back:hover {
      color: var(--primary);
    }
    .plan-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .plan-card {
      display: grid;
      gap: 2px;
      text-align: left;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    .plan-card b {
      font-size: 0.98rem;
    }
    .plan-card small {
      font-size: 0.78rem;
    }
    .plan-card .count {
      margin-top: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--primary);
    }
    .plan-card:hover,
    .plan-card:focus-visible {
      border-color: var(--primary);
    }
    .plan-card.active {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent);
      background: color-mix(in srgb, var(--primary) 6%, var(--surface));
    }
    .plan-card.off {
      opacity: 0.6;
    }
    .plan-card.add {
      place-items: center;
      align-content: center;
      border-style: dashed;
      color: var(--primary);
    }
    .plan-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }
    .plan-head h2 {
      margin: 0;
    }
    .plan-head .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .link {
      background: none;
      border: 0;
      padding: 0;
      color: var(--red, #c0262d);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
    }
    .toolbar .grow {
      flex: 1;
      min-width: 200px;
    }
    .toolbar .select {
      width: auto;
      min-width: 180px;
    }
    td b,
    td small {
      display: block;
    }
    .input.price {
      width: 120px;
      text-align: right;
      margin-left: auto;
    }
    .input.price.below {
      border-color: var(--amber, #a15c07);
    }
    .warn {
      color: var(--amber, #a15c07);
    }
    .down {
      color: var(--red, #c0262d);
    }
    .nowrap {
      white-space: nowrap;
    }
    .history-row {
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    .bulk-preview {
      max-height: 340px;
      overflow: auto;
    }
  `,
})
export default class PricingPlansPage {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);
  private readonly session = inject(SessionStore);

  protected readonly canEdit = computed(() => this.session.can('catalogue.manage'));
  protected readonly roundings = ['NEAREST', 'UP', 'DOWN'] as const;
  protected readonly customerTypes = CUSTOMER_TYPES;
  protected readonly productName = (p: Product) => p.name;
  protected readonly customerName = (c: Customer) => c.name;

  protected readonly cards = loaded<PlanCard[]>(() => ({
    path: '/pricing-plans/cards',
    options: { noBranch: true },
  }));
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** The plan whose page this is ('normal' for Normal Sale); null on the page of buttons. */
  protected readonly selected = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('plan'))),
    { initialValue: null as string | null },
  );
  /** The page of buttons: filter by text, by who the plan is for, and inactive ones. */
  protected readonly planKinds = ['all', 'type', 'customer', 'insurer', 'till'] as const;
  // Kept while the app is open, so coming back from a plan shows the same filtered buttons.
  protected readonly planQuery = PLAN_FILTER.query;
  protected readonly planKind = PLAN_FILTER.kind;
  protected readonly showInactive = PLAN_FILTER.inactive;
  protected readonly shownCards = computed(() => {
    const words = this.planQuery().trim().toLowerCase().split(/\s+/).filter(Boolean);
    const kind = this.planKind();
    return (this.cards.value() ?? []).filter((c) => {
      if (!c.uid) {
        // Normal Sale stays first unless a search or a kind leaves it out.
        return kind === 'all' && words.every((w) => this.cardText(c).includes(w));
      }
      if (!c.active && !this.showInactive()) return false;
      if (kind !== 'all' && this.kindOf(c) !== kind) return false;
      const text = this.cardText(c);
      return words.every((w) => text.includes(w));
    });
  });
  protected readonly card = computed(
    () => (this.cards.value() ?? []).find((c) => (c.uid ?? 'normal') === this.selected()) ?? null,
  );
  protected readonly cardName = computed(() => {
    const c = this.card();
    return !c || !c.uid ? this.translations.t('plans.normal') : c.name;
  });
  /** Active medicines the chosen plan has no price for. */
  protected readonly notPricedCount = computed(() => {
    const all = this.cards.value()?.[0]?.priced ?? 0;
    return Math.max(0, all - (this.card()?.priced ?? 0));
  });
  protected readonly notPriced = signal(false);

  protected readonly q = signal('');
  private readonly qDebounced = debounced(this.q);
  protected readonly category = signal('');
  protected readonly categories = loaded<Category[]>(() => ({
    path: '/categories',
    options: { noBranch: true, silent: true },
  }));
  protected readonly items = pagedList<PlanItemRow>(
    () => ({
      path: `/pricing-plans/${this.selected() ?? 'normal'}/items`,
      query: {
        q: this.qDebounced() || undefined,
        categoryUid: this.category() || undefined,
        notPriced: this.notPriced() || undefined,
      },
      options: { noBranch: true },
    }),
    50,
  );
  /** Prices saved on this page since the list loaded, by product and quantity. */
  private readonly edited = signal<Record<string, number | null>>({});

  protected readonly payers = loaded<{ uid: string; name: string }[]>(() =>
    this.draft() ? { path: '/insurance/payers', options: { noBranch: true, silent: true } } : null,
  );

  protected readonly busy = signal(false);
  protected readonly addOpen = signal(false);
  protected readonly addProduct = signal<Product | null>(null);
  protected readonly addPrice = signal<number | null>(null);
  protected readonly addMin = signal(1);
  protected readonly draft = signal<PlanDraft | null>(null);

  protected readonly bulkOpen = signal(false);
  protected readonly bulkPercent = signal(0);
  protected readonly bulkRoundTo = signal(50);
  protected readonly bulkRounding = signal<'NEAREST' | 'UP' | 'DOWN'>('NEAREST');
  protected readonly bulkCategory = signal('');
  protected readonly bulkOnlyMissing = signal(false);
  protected readonly bulkResult = signal<BulkResult | null>(null);

  protected readonly salesOpen = signal(false);
  protected readonly from = signal(isoDay(-30));
  protected readonly to = signal(isoDay());
  private readonly report = loaded<PlanSales[]>(() =>
    this.salesOpen()
      ? {
          path: '/reports/pricing-plans',
          query: { from: this.from(), to: this.to() },
          options: { noBranch: true },
        }
      : null,
  );
  protected readonly planSales = computed(() => {
    const name = this.card()?.uid ? this.card()!.name : 'Normal Sale';
    return (this.report.value() ?? []).find((r) => r.plan === name) ?? null;
  });

  protected readonly historyOf = signal<PlanItemRow | null>(null);
  protected readonly history = signal<PriceChange[]>([]);

  protected choose(c: PlanCard): void {
    this.notPriced.set(false);
    this.edited.set({});
    void this.router.navigate(['/catalogue/pricing-plans', c.uid ?? 'normal']);
  }

  private kindOf(c: PlanCard): 'type' | 'customer' | 'insurer' | 'till' {
    if (c.payerName) return 'insurer';
    if (c.customerName) return 'customer';
    if (c.customerType) return 'type';
    return 'till';
  }

  /** What a search matches: the name, who it is for and its rule, in the language shown. */
  private cardText(c: PlanCard): string {
    const name = c.uid ? c.name : this.translations.t('plans.normal');
    return [name, this.audience(c), c.payerName, c.customerName, c.customerType]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  protected audience(c: PlanCard): string {
    const t = (k: string, p?: Record<string, string>) => this.translations.t(k, p);
    if (!c.uid) return t('plans.everyone');
    if (c.payerName) return t('plans.forInsurer', { name: c.payerName });
    if (c.customerName) return t('plans.forCustomer', { name: c.customerName });
    if (c.customerType) return t('plans.forType', { type: t('enum.' + c.customerType) });
    return t('plans.chosenAtTill');
  }

  protected signed(percent: number): string {
    return `${percent > 0 ? '+' : percent < 0 ? '−' : '±'}${Math.abs(percent)}%`;
  }

  private key(row: PlanItemRow): string {
    return `${row.productUid}:${row.minQuantity}`;
  }

  protected priceOf(row: PlanItemRow): number | null {
    const edited = this.edited();
    if (this.key(row) in edited) return edited[this.key(row)];
    return this.selected() === 'normal' ? row.normalPrice : row.price;
  }

  protected placeholder(c: PlanCard, row: PlanItemRow): string {
    if (!c.uid || c.rulePercent === null) return '';
    return String(Math.round(row.normalPrice * (1 + c.rulePercent / 100) * 100) / 100);
  }

  protected diff(row: PlanItemRow): number | null {
    const price = this.priceOf(row);
    if (price === null || !row.normalPrice) return null;
    return Math.round(((price - row.normalPrice) / row.normalPrice) * 1000) / 10;
  }

  protected below(row: PlanItemRow): boolean {
    const price = this.priceOf(row);
    return price !== null && row.costPrice !== null && price < row.costPrice;
  }

  private path(c: PlanCard, row: { productUid: string }, min = 1): string {
    return `/pricing-plans/${c.uid ?? 'normal'}/prices/${row.productUid}?minQuantity=${min}`;
  }

  protected async save(c: PlanCard, row: PlanItemRow, value: string): Promise<void> {
    if (value.trim() === '') {
      if (c.uid && !this.notPriced()) await this.remove(c, row);
      return;
    }
    await this.api.put(
      this.path(c, row, row.minQuantity),
      { price: Number(value) },
      { noBranch: true },
    );
    this.edited.update((all) => ({ ...all, [this.key(row)]: Number(value) }));
    this.toasts.success(this.translations.t('plans.saved'));
    if (this.notPriced()) void this.refresh();
  }

  protected async remove(c: PlanCard, row: PlanItemRow): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translations.t('plans.remove'),
      text: this.translations.t('plans.removeText', { name: row.name, plan: c.name }),
      icon: 'warning',
    });
    if (!ok) return;
    await this.api.delete(this.path(c, row, row.minQuantity), { noBranch: true });
    this.toasts.success(this.translations.t('plans.removed'));
    await this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.edited.set({});
    await Promise.all([this.items.reload(), this.cards.reload()]);
  }

  protected openAdd(): void {
    this.addProduct.set(null);
    this.addPrice.set(null);
    this.addMin.set(1);
    this.addOpen.set(true);
  }

  protected pickProduct(p: Product | null): void {
    this.addProduct.set(p);
    const c = this.card();
    if (p && c) {
      this.addPrice.set(
        c.rulePercent === null
          ? p.sellingPrice
          : Math.round(p.sellingPrice * (1 + c.rulePercent / 100) * 100) / 100,
      );
    }
  }

  protected async saveAdd(): Promise<void> {
    const c = this.card();
    const p = this.addProduct();
    if (!c || !p || this.addPrice() === null) return;
    this.busy.set(true);
    try {
      await this.api.put(
        this.path(c, { productUid: p.uid }, this.addMin()),
        { price: this.addPrice() },
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('plans.added', { name: p.name }));
      this.addOpen.set(false);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  protected async templateAll(c: PlanCard): Promise<void> {
    await downloadFrom(
      this.http,
      `/price-lists/${c.uid}/import/template?all=true&lang=${this.translations.lang()}`,
      this.toasts,
      this.translations.t('close.exportFailed'),
    );
  }

  // ---------------------------------------------------------------- plan settings

  protected newPlan(): void {
    this.draft.set({
      uid: null,
      name: '',
      target: 'everyone',
      customerType: '',
      customerUid: null,
      customerName: null,
      payerUid: null,
      payerName: null,
      rule: false,
      adjustmentPercent: 0,
      validFrom: '',
      validTo: '',
      active: true,
    });
  }

  protected editPlan(c: PlanCard): void {
    this.draft.set({
      uid: c.uid,
      name: c.name,
      target: c.payerUid
        ? 'insurer'
        : c.customerUid
          ? 'customer'
          : c.customerType
            ? 'type'
            : 'everyone',
      customerType: (c.customerType as CustomerType) ?? '',
      customerUid: c.customerUid,
      customerName: c.customerName,
      payerUid: c.payerUid,
      payerName: c.payerName,
      rule: c.rulePercent !== null,
      adjustmentPercent: c.rulePercent ?? 0,
      validFrom: c.validFrom ?? '',
      validTo: c.validTo ?? '',
      active: c.active,
    });
  }

  protected setTarget(d: PlanDraft, target: PlanDraft['target']): void {
    d.target = target;
    if (target !== 'customer') {
      d.customerUid = null;
      d.customerName = null;
    }
    if (target !== 'type') d.customerType = '';
    else if (!d.customerType) d.customerType = 'WHOLESALE';
    if (target !== 'insurer') {
      d.payerUid = null;
      d.payerName = null;
    }
    this.draft.set({ ...d });
  }

  protected pickPayer(d: PlanDraft, uid: string): void {
    const payer = (this.payers.value() ?? []).find((p) => p.uid === uid);
    d.payerUid = payer?.uid ?? null;
    d.payerName = payer?.name ?? null;
    this.draft.set({ ...d });
  }

  /** The plan's own fields; its prices are kept (a save without `items` keeps them, Batch 7). */
  private body(d: PlanDraft): object {
    return {
      name: d.name,
      customerType: d.target === 'type' ? d.customerType || null : null,
      customerUid: d.target === 'customer' ? d.customerUid : null,
      customerName: d.target === 'customer' ? d.customerName : null,
      payerUid: d.target === 'insurer' ? d.payerUid : null,
      payerName: d.target === 'insurer' ? d.payerName : null,
      adjustmentPercent: d.rule ? d.adjustmentPercent || 0 : null,
      validFrom: d.validFrom || null,
      validTo: d.validTo || null,
      active: d.active,
    };
  }

  protected async savePlan(): Promise<void> {
    const d = this.draft();
    if (!d) return;
    this.busy.set(true);
    try {
      if (d.uid) {
        await this.api.put(`/price-lists/${d.uid}`, this.body(d), { noBranch: true });
      } else {
        const made = await this.api.post<PriceList>('/price-lists', this.body(d), {
          noBranch: true,
        });
        void this.router.navigate(['/catalogue/pricing-plans', made.uid]);
      }
      this.toasts.success(this.translations.t('pricing.saved'));
      this.draft.set(null);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggleActive(c: PlanCard): Promise<void> {
    if (!c.uid) return;
    this.editPlan(c);
    const d = this.draft()!;
    d.active = !c.active;
    await this.api.put(`/price-lists/${c.uid}`, this.body(d), { noBranch: true });
    this.draft.set(null);
    this.toasts.success(this.translations.t(d.active ? 'plans.activated' : 'plans.deactivated'));
    await this.cards.reload();
  }

  // ---------------------------------------------------------------- history, bulk

  protected async openHistory(row: PlanItemRow): Promise<void> {
    this.history.set([]);
    this.historyOf.set(row);
    this.history.set(
      await this.api.get<PriceChange[]>(`/products/${row.productUid}/price-history`, undefined, {
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
      onlyMissing: this.selected() !== 'normal' && this.bulkOnlyMissing(),
    };
  }

  protected async previewBulk(): Promise<void> {
    this.busy.set(true);
    try {
      this.bulkResult.set(
        await this.api.post<BulkResult>(
          `/pricing-plans/${this.selected()}/bulk/preview`,
          this.bulkBody(),
          {
            noBranch: true,
          },
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
        `/pricing-plans/${this.selected()}/bulk`,
        this.bulkBody(),
        {
          noBranch: true,
        },
      );
      this.toasts.success(this.translations.t('plans.bulkDone', { count: done.lines.length }));
      this.bulkOpen.set(false);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }
}
