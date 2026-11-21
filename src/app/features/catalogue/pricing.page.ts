import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import {
  BranchPrice,
  Category,
  Customer,
  CustomerType,
  PriceList,
  Product,
  Promotion,
} from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';

type Tab = 'lists' | 'branch' | 'promotions';

const CUSTOMER_TYPES: CustomerType[] = [
  'RETAIL',
  'WHOLESALE',
  'INSURANCE',
  'CORPORATE',
  'STAFF',
  'NGO',
  'GOVERNMENT',
];

interface ListDraft {
  uid: string | null;
  name: string;
  target: 'type' | 'customer';
  customerType: CustomerType | '';
  customerUid: string | null;
  customerName: string | null;
  adjustmentPercent: number;
  validFrom: string;
  validTo: string;
  active: boolean;
  items: { productUid: string; productName: string; minQuantity: number; price: number }[];
}

interface PromotionDraft {
  uid: string | null;
  name: string;
  percentOff: number;
  productUid: string | null;
  productName: string | null;
  categoryUid: string;
  branchUid: string;
  validFrom: string;
  /** Empty or null: runs until switched off. */
  validTo: string | null;
  active: boolean;
}

/**
 * Catalogue → Pricing: price lists (per customer type, or a customer's special prices, with
 * quantity breaks), branch prices and promotions. The till applies them in that order.
 */
@Component({
  selector: 'app-pricing',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'pricing.title' | t }}</h1>
          <p class="sub">{{ 'pricing.sub' | t }}</p>
        </div>
        @if (canEdit()) {
          <div class="actions">
            @switch (tab()) {
              @case ('lists') {
                <button class="btn primary" type="button" (click)="editList(null)">
                  <app-icon name="plus" [size]="16" /> {{ 'pricing.newList' | t }}
                </button>
              }
              @case ('promotions') {
                <button class="btn primary" type="button" (click)="editPromotion(null)">
                  <app-icon name="plus" [size]="16" /> {{ 'pricing.newPromotion' | t }}
                </button>
              }
            }
          </div>
        }
      </div>
      <div class="card mb">
        <div class="tabs">
          @for (t of tabs; track t) {
            <button type="button" [class.active]="tab() === t" (click)="tab.set(t)">
              {{ 'pricing.tab.' + t | t }}
            </button>
          }
        </div>
      </div>

      @switch (tab()) {
        @case ('lists') {
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'pricing.name' | t }}</th>
                  <th>{{ 'pricing.appliesTo' | t }}</th>
                  <th class="right">{{ 'pricing.adjustment' | t }}</th>
                  <th class="right">{{ 'pricing.items' | t }}</th>
                  <th>{{ 'pricing.valid' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (l of lists.value() ?? []; track l.uid) {
                  <tr>
                    <td>
                      <b>{{ l.name }}</b>
                      @if (!l.active) {
                        <span class="badge">{{ 'pricing.inactive' | t }}</span>
                      }
                    </td>
                    <td>
                      {{
                        l.customerName ??
                          (l.customerType ? ('enum.' + l.customerType | t) : ('pricing.nobody' | t))
                      }}
                    </td>
                    <td class="right">{{ l.adjustmentPercent }}%</td>
                    <td class="right">{{ l.items.length }}</td>
                    <td class="muted">{{ l.validFrom ?? '…' }} – {{ l.validTo ?? '…' }}</td>
                    <td class="right">
                      @if (canEdit()) {
                        <button class="btn sm" type="button" (click)="editList(l)">
                          {{ 'pricing.edit' | t }}
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty">{{ 'pricing.noLists' | t }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('branch') {
          <div class="card card-pad mb">
            @if (canEdit()) {
              <div class="row wrap" style="gap: 8px; align-items: end">
                <div class="field grow">
                  <label>{{ 'pricing.product' | t }}</label>
                  <app-lookup
                    #branchProduct
                    path="/products"
                    [placeholder]="'pricing.searchProduct' | t"
                    [display]="productName"
                    (picked)="branchDraft.productUid = $event?.uid ?? null"
                  />
                </div>
                <div class="field">
                  <label>{{ 'pricing.branch' | t }}</label>
                  <select class="select" #branchSel>
                    @for (b of session.branches(); track b.uid) {
                      <option [value]="b.uid">{{ b.name }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label>{{ 'pricing.price' | t }}</label>
                  <input class="input" type="number" min="0" step="any" #branchPriceInput />
                </div>
                <button
                  class="btn primary"
                  type="button"
                  (click)="saveBranchPrice(branchSel.value, branchPriceInput.value)"
                >
                  {{ 'pricing.save' | t }}
                </button>
              </div>
            }
          </div>
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'pricing.product' | t }}</th>
                  <th>{{ 'pricing.branch' | t }}</th>
                  <th class="right">{{ 'pricing.price' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (b of branchPrices.value() ?? []; track b.productUid + b.branchUid) {
                  <tr>
                    <td>{{ b.productName }}</td>
                    <td>{{ branchName(b.branchUid) }}</td>
                    <td class="right">{{ b.price | money }}</td>
                    <td class="right">
                      @if (canEdit()) {
                        <button class="btn sm ghost" type="button" (click)="removeBranchPrice(b)">
                          {{ 'pricing.remove' | t }}
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="empty">{{ 'pricing.noBranchPrices' | t }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('promotions') {
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'pricing.name' | t }}</th>
                  <th class="right">{{ 'pricing.percentOff' | t }}</th>
                  <th>{{ 'pricing.on' | t }}</th>
                  <th>{{ 'pricing.branch' | t }}</th>
                  <th>{{ 'pricing.valid' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (p of promotions.value() ?? []; track p.uid) {
                  <tr>
                    <td>
                      <b>{{ p.name }}</b>
                      @if (!p.active) {
                        <span class="badge">{{ 'pricing.inactive' | t }}</span>
                      }
                    </td>
                    <td class="right">{{ p.percentOff }}%</td>
                    <td>{{ p.productName ?? p.categoryName ?? ('pricing.everything' | t) }}</td>
                    <td>
                      {{ p.branchUid ? branchName(p.branchUid) : ('pricing.allBranches' | t) }}
                    </td>
                    <td class="muted">
                      {{ p.validFrom }} – {{ p.validTo || ('pricing.noEnd' | t) }}
                    </td>
                    <td class="right">
                      @if (canEdit()) {
                        <button class="btn sm" type="button" (click)="editPromotion(p)">
                          {{ 'pricing.edit' | t }}
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty">{{ 'pricing.noPromotions' | t }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>

    <app-modal
      [open]="!!list()"
      [title]="(list()?.uid ? 'pricing.editList' : 'pricing.newList') | t"
      [wide]="true"
      (closed)="list.set(null)"
    >
      @if (list(); as l) {
        <div class="form-grid">
          <div class="field">
            <label>{{ 'pricing.name' | t }}</label>
            <input class="input" [value]="l.name" (input)="l.name = $any($event.target).value" />
          </div>
          <div class="field">
            <label>{{ 'pricing.appliesTo' | t }}</label>
            <select
              class="select"
              [value]="l.target"
              (change)="setTarget(l, $any($event.target).value)"
            >
              <option value="type">{{ 'pricing.aCustomerType' | t }}</option>
              <option value="customer">{{ 'pricing.oneCustomer' | t }}</option>
            </select>
          </div>
          @if (l.target === 'type') {
            <div class="field">
              <label>{{ 'pricing.customerType' | t }}</label>
              <select
                class="select"
                [value]="l.customerType"
                (change)="l.customerType = $any($event.target).value"
              >
                <option value="">{{ 'pricing.nobody' | t }}</option>
                @for (c of customerTypes; track c) {
                  <option [value]="c" [selected]="c === l.customerType">
                    {{ 'enum.' + c | t }}
                  </option>
                }
              </select>
            </div>
          } @else {
            <div class="field">
              <label>{{ 'pricing.customer' | t }}</label>
              <app-lookup
                path="/customers"
                [placeholder]="l.customerName ?? ('pricing.searchCustomer' | t)"
                [display]="customerName"
                (picked)="
                  l.customerUid = $event?.uid ?? null; l.customerName = $event?.name ?? null
                "
              />
            </div>
          }
          <div class="field">
            <label>{{ 'pricing.adjustment' | t }}</label>
            <input
              class="input"
              type="number"
              step="any"
              [value]="l.adjustmentPercent"
              (input)="l.adjustmentPercent = +$any($event.target).value"
            />
            <span class="hint">{{ 'pricing.adjustmentHint' | t }}</span>
          </div>
          <div class="field">
            <label>{{ 'pricing.validFrom' | t }}</label>
            <input
              class="input"
              type="date"
              [value]="l.validFrom"
              (change)="l.validFrom = $any($event.target).value"
            />
          </div>
          <div class="field">
            <label>{{ 'pricing.validTo' | t }}</label>
            <input
              class="input"
              type="date"
              [value]="l.validTo"
              (change)="l.validTo = $any($event.target).value"
            />
          </div>
          <label class="check full">
            <input
              type="checkbox"
              [checked]="l.active"
              (change)="l.active = $any($event.target).checked"
            />
            {{ 'pricing.active' | t }}
          </label>
        </div>
        <h4 class="mt">{{ 'pricing.items' | t }}</h4>
        <p class="muted small">{{ 'pricing.itemsHint' | t }}</p>
        <app-lookup
          path="/products"
          [placeholder]="'pricing.addProduct' | t"
          [display]="productName"
          (picked)="addItem(l, $event)"
        />
        <table class="table mt">
          <thead>
            <tr>
              <th>{{ 'pricing.product' | t }}</th>
              <th class="right">{{ 'pricing.fromQuantity' | t }}</th>
              <th class="right">{{ 'pricing.price' | t }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of l.items; track $index; let i = $index) {
              <tr>
                <td>{{ item.productName }}</td>
                <td class="right">
                  <input
                    class="input sm"
                    style="width: 90px"
                    type="number"
                    min="1"
                    [value]="item.minQuantity"
                    (input)="item.minQuantity = +$any($event.target).value"
                  />
                </td>
                <td class="right">
                  <input
                    class="input sm"
                    style="width: 120px"
                    type="number"
                    min="0"
                    step="any"
                    [value]="item.price"
                    (input)="item.price = +$any($event.target).value"
                  />
                </td>
                <td class="right">
                  <button
                    class="icon-btn sm"
                    type="button"
                    (click)="l.items.splice(i, 1)"
                    [attr.aria-label]="'pricing.remove' | t"
                  >
                    <app-icon name="x" [size]="14" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
      <ng-container footer>
        @if (list()?.uid) {
          <button class="btn danger" type="button" (click)="deleteList()">
            {{ 'pricing.delete' | t }}
          </button>
        }
        <button class="btn" type="button" (click)="list.set(null)">
          {{ 'pricing.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="saveList()">
          {{ 'pricing.save' | t }}
        </button>
      </ng-container>
    </app-modal>

    <app-modal
      [open]="!!promotion()"
      [title]="(promotion()?.uid ? 'pricing.editPromotion' : 'pricing.newPromotion') | t"
      (closed)="promotion.set(null)"
    >
      @if (promotion(); as p) {
        <div class="form-grid">
          <div class="field">
            <label>{{ 'pricing.name' | t }}</label>
            <input class="input" [value]="p.name" (input)="p.name = $any($event.target).value" />
          </div>
          <div class="field">
            <label>{{ 'pricing.percentOff' | t }}</label>
            <input
              class="input"
              type="number"
              min="0"
              max="100"
              step="any"
              [value]="p.percentOff"
              (input)="p.percentOff = +$any($event.target).value"
            />
          </div>
          <div class="field full">
            <label>{{ 'pricing.product' | t }}</label>
            <app-lookup
              path="/products"
              [placeholder]="p.productName ?? ('pricing.anyProduct' | t)"
              [display]="productName"
              (picked)="p.productUid = $event?.uid ?? null; p.productName = $event?.name ?? null"
            />
          </div>
          <div class="field">
            <label>{{ 'pricing.category' | t }}</label>
            <select
              class="select"
              [value]="p.categoryUid"
              (change)="p.categoryUid = $any($event.target).value"
            >
              <option value="">{{ 'pricing.anyCategory' | t }}</option>
              @for (c of categories.value() ?? []; track c.uid) {
                <option [value]="c.uid" [selected]="c.uid === p.categoryUid">
                  {{ c.path ?? c.name }}
                </option>
              }
            </select>
          </div>
          <div class="field">
            <label>{{ 'pricing.branch' | t }}</label>
            <select
              class="select"
              [value]="p.branchUid"
              (change)="p.branchUid = $any($event.target).value"
            >
              <option value="">{{ 'pricing.allBranches' | t }}</option>
              @for (b of session.branches(); track b.uid) {
                <option [value]="b.uid" [selected]="b.uid === p.branchUid">{{ b.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>{{ 'pricing.validFrom' | t }}</label>
            <input
              class="input"
              type="date"
              [value]="p.validFrom"
              (change)="p.validFrom = $any($event.target).value"
            />
          </div>
          <div class="field">
            <label>{{ 'pricing.validTo' | t }}</label>
            <input
              class="input"
              type="date"
              [value]="p.validTo ?? ''"
              (change)="p.validTo = $any($event.target).value"
            />
            <small class="hint">{{ 'pricing.noEndHint' | t }}</small>
          </div>
          <label class="check full">
            <input
              type="checkbox"
              [checked]="p.active"
              (change)="p.active = $any($event.target).checked"
            />
            {{ 'pricing.active' | t }}
          </label>
        </div>
      }
      <ng-container footer>
        @if (promotion()?.uid) {
          <button class="btn danger" type="button" (click)="deletePromotion()">
            {{ 'pricing.delete' | t }}
          </button>
        }
        <button class="btn" type="button" (click)="promotion.set(null)">
          {{ 'pricing.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="savePromotion()">
          {{ 'pricing.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class PricingPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly confirm = inject(ConfirmService);
  protected readonly tabs: Tab[] = ['lists', 'branch', 'promotions'];
  protected readonly tab = signal<Tab>('lists');
  protected readonly busy = signal(false);
  protected readonly customerTypes = CUSTOMER_TYPES;
  protected readonly canEdit = () => this.session.can('catalogue.manage');

  protected readonly lists = loaded<PriceList[]>(() =>
    this.tab() === 'lists' ? { path: '/price-lists', options: { noBranch: true } } : null,
  );
  protected readonly branchPrices = loaded<BranchPrice[]>(() =>
    this.tab() === 'branch' ? { path: '/branch-prices', options: { noBranch: true } } : null,
  );
  protected readonly promotions = loaded<Promotion[]>(() =>
    this.tab() === 'promotions' ? { path: '/promotions', options: { noBranch: true } } : null,
  );
  protected readonly categories = loaded<Category[]>(() =>
    this.tab() === 'promotions' ? { path: '/categories', options: { noBranch: true } } : null,
  );

  protected readonly list = signal<ListDraft | null>(null);
  protected readonly promotion = signal<PromotionDraft | null>(null);
  protected readonly branchDraft: { productUid: string | null } = { productUid: null };

  protected readonly productName = (p: Product) => p.name;
  protected readonly customerName = (c: Customer) => c.name;

  protected branchName(uid: string): string {
    return this.session.branches().find((b) => b.uid === uid)?.name ?? '—';
  }

  protected editList(l: PriceList | null): void {
    this.list.set({
      uid: l?.uid ?? null,
      name: l?.name ?? '',
      target: l?.customerUid ? 'customer' : 'type',
      customerType: l?.customerType ?? '',
      customerUid: l?.customerUid ?? null,
      customerName: l?.customerName ?? null,
      adjustmentPercent: l?.adjustmentPercent ?? 0,
      validFrom: l?.validFrom ?? '',
      validTo: l?.validTo ?? '',
      active: l?.active ?? true,
      items: (l?.items ?? []).map((i) => ({
        productUid: i.productUid,
        productName: i.productName ?? '',
        minQuantity: i.minQuantity,
        price: i.price,
      })),
    });
  }

  protected setTarget(l: ListDraft, target: 'type' | 'customer'): void {
    l.target = target;
    if (target === 'type') {
      l.customerUid = null;
      l.customerName = null;
    } else {
      l.customerType = '';
    }
    this.list.set({ ...l });
  }

  protected addItem(l: ListDraft, product: Product | null): void {
    if (!product) {
      return;
    }
    l.items.push({
      productUid: product.uid,
      productName: product.name,
      minQuantity: 1,
      price: product.sellingPrice,
    });
    this.list.set({ ...l });
  }

  protected async saveList(): Promise<void> {
    const l = this.list();
    if (!l) {
      return;
    }
    this.busy.set(true);
    try {
      const body = {
        name: l.name,
        customerType: l.target === 'type' ? l.customerType || null : null,
        customerUid: l.target === 'customer' ? l.customerUid : null,
        customerName: l.target === 'customer' ? l.customerName : null,
        adjustmentPercent: l.adjustmentPercent || 0,
        validFrom: l.validFrom || null,
        validTo: l.validTo || null,
        active: l.active,
        items: l.items.map((i) => ({
          productUid: i.productUid,
          minQuantity: i.minQuantity || 1,
          price: i.price,
        })),
      };
      if (l.uid) {
        await this.api.put(`/price-lists/${l.uid}`, body, { noBranch: true });
      } else {
        await this.api.post('/price-lists', body, { noBranch: true });
      }
      this.toasts.success(this.translations.t('pricing.saved'));
      this.list.set(null);
      void this.lists.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async deleteList(): Promise<void> {
    const l = this.list();
    if (
      !l?.uid ||
      !(await this.confirm.ask({
        title: this.translations.t('common.areYouSure'),
        text: this.translations.t('pricing.confirmDelete', { name: l.name }),
        icon: 'danger',
      }))
    ) {
      return;
    }
    await this.api.delete(`/price-lists/${l.uid}`, { noBranch: true });
    this.list.set(null);
    void this.lists.reload();
  }

  protected async saveBranchPrice(branchUid: string, price: string): Promise<void> {
    if (!this.branchDraft.productUid || !branchUid || price === '') {
      this.toasts.error(this.translations.t('pricing.branchPriceIncomplete'));
      return;
    }
    await this.api.put(
      '/branch-prices',
      { productUid: this.branchDraft.productUid, branchUid, price: Number(price) },
      { noBranch: true },
    );
    this.toasts.success(this.translations.t('pricing.saved'));
    void this.branchPrices.reload();
  }

  protected async removeBranchPrice(b: BranchPrice): Promise<void> {
    await this.api.put(
      '/branch-prices',
      { productUid: b.productUid, branchUid: b.branchUid, price: null },
      { noBranch: true },
    );
    void this.branchPrices.reload();
  }

  protected editPromotion(p: Promotion | null): void {
    // The pharmacy's local day (not UTC); a new promotion runs until switched off.
    const today = isoDay();
    this.promotion.set({
      uid: p?.uid ?? null,
      name: p?.name ?? '',
      percentOff: p?.percentOff ?? 10,
      productUid: p?.productUid ?? null,
      productName: p?.productName ?? null,
      categoryUid: p?.categoryUid ?? '',
      branchUid: p?.branchUid ?? '',
      validFrom: p?.validFrom ?? today,
      validTo: p?.validTo ?? '',
      active: p?.active ?? true,
    });
  }

  protected async savePromotion(): Promise<void> {
    const p = this.promotion();
    if (!p) {
      return;
    }
    this.busy.set(true);
    try {
      const body = {
        name: p.name,
        percentOff: p.percentOff,
        productUid: p.productUid,
        categoryUid: p.categoryUid || null,
        branchUid: p.branchUid || null,
        validFrom: p.validFrom,
        validTo: p.validTo || null,
        active: p.active,
      };
      if (p.uid) {
        await this.api.put(`/promotions/${p.uid}`, body, { noBranch: true });
      } else {
        await this.api.post('/promotions', body, { noBranch: true });
      }
      this.toasts.success(this.translations.t('pricing.saved'));
      this.promotion.set(null);
      void this.promotions.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async deletePromotion(): Promise<void> {
    const p = this.promotion();
    if (
      !p?.uid ||
      !(await this.confirm.ask({
        title: this.translations.t('common.areYouSure'),
        text: this.translations.t('pricing.confirmDelete', { name: p.name }),
        icon: 'danger',
      }))
    ) {
      return;
    }
    await this.api.delete(`/promotions/${p.uid}`, { noBranch: true });
    this.promotion.set(null);
    void this.promotions.reload();
  }
}
