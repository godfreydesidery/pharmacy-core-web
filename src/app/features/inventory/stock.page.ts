import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import {
  Batch,
  Category,
  Product,
  SerialStatus,
  SerialUnit,
  StockItem,
  StockSummary,
  TrackingMode,
} from '../../core/api/models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { downloadCsv, isoDay } from '../../core/format/format';
import { SHARED } from '../../core/shared';
import {
  PRODUCT_TYPES,
  defaultTracking,
  parseSerials,
  productTypeOf,
  tracksExpiry,
} from '../../core/ui/product-types';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-stock',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'inventory.stock' | t }}</h1>
          <p class="sub">
            {{ session.branch()?.name ?? ('ui.l.chooseABranch' | t) }} ·
            {{ 'ui.t.stockSub' | t }}
          </p>
        </div>
        <div class="actions">
          @if (session.can('inventory.adjust') && session.branch()) {
            <button class="btn" type="button" (click)="openOpening()">
              <app-icon name="plus" [size]="16" /> {{ 'inventory.openingStock' | t }}
            </button>
            <a class="btn" routerLink="/inventory/adjustments"
              ><app-icon name="clipboard" [size]="16" /> {{ 'inventory.adjust' | t }}</a
            >
          }
          @if (session.can('purchasing.receive') && session.branch()) {
            <a class="btn primary" routerLink="/purchasing/receipts/new"
              ><app-icon name="download" [size]="16" /> {{ 'inventory.receiveGoods' | t }}</a
            >
          }
        </div>
      </div>

      @if (!session.branch()) {
        <app-branch-required [what]="'ui.what.stock' | t" />
      } @else {
        @if (summary.value(); as s) {
          <div class="grid kpis mb">
            <app-stat
              [label]="'ui.stock.onHand' | t"
              [value]="s.inStock + s.lowStock"
              icon="box"
              tone="green"
              [caption]="'ui.stock.onHandHint' | t: { count: s.products }"
            />
            <app-stat
              [label]="'inventory.stockValueCost' | t"
              [value]="s.costValue | compactMoney"
              [hint]="s.costValue | money"
              icon="wallet"
              tone="blue"
              [caption]="('ui.l.retailSp' | t) + (s.retailValue | money)"
            />
            <app-stat
              [label]="'inventory.lowStock' | t"
              [value]="s.lowStock"
              icon="alert"
              tone="amber"
              [caption]="'inventory.atOrBelowReorderLevel' | t"
            />
            <app-stat
              [label]="'inventory.outOfStock' | t"
              [value]="s.outOfStock"
              icon="x"
              tone="red"
              [caption]="'inventory.noneOnHand' | t"
            />
            <app-stat
              [label]="'inventory.expiringSoon' | t"
              [value]="s.expiringSoon"
              icon="clock"
              tone="purple"
              [caption]="s.expired + ('ui.l.preExpired' | t)"
            />
          </div>
        }
        <div class="card">
          <div class="toolbar">
            <label class="search"
              ><app-icon name="search" [size]="16" /><input
                [placeholder]="'inventory.searchProductGenericOrSku' | t"
                (input)="q.set($any($event.target).value)"
            /></label>
            <select
              class="select"
              style="width:auto"
              (change)="status.set($any($event.target).value)"
            >
              <option value="">{{ 'inventory.allStatuses' | t }}</option>
              <option value="IN_STOCK">{{ 'inventory.inStock' | t }}</option>
              <option value="LOW_STOCK">{{ 'inventory.lowStock' | t }}</option>
              <option value="OUT_OF_STOCK">{{ 'inventory.outOfStock' | t }}</option>
            </select>
            <select
              class="select"
              style="width:auto"
              [attr.aria-label]="'inventory.productType' | t"
              (change)="productType.set($any($event.target).value)"
            >
              <option value="">{{ 'inventory.allTypes' | t }}</option>
              @for (t of types; track t.code) {
                <option [value]="t.code">{{ 'ui.ptype.' + t.code | t: null : t.label }}</option>
              }
            </select>
            @if (categories.value(); as cats) {
              <select
                class="select"
                style="width:auto"
                (change)="categoryUid.set($any($event.target).value)"
              >
                <option value="">{{ 'inventory.allCategories' | t }}</option>
                @for (c of cats; track c.uid) {
                  <option [value]="c.uid">{{ c.path }}</option>
                }
              </select>
            }
            <div class="spacer"></div>
            <button class="btn" type="button" (click)="export()">
              <app-icon name="download" [size]="16" /> {{ 'inventory.export' | t }}
            </button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'inventory.product' | t }}</th>
                  <th>{{ 'inventory.category' | t }}</th>
                  <th>{{ 'inventory.formUnit' | t }}</th>
                  <th class="right">{{ 'inventory.onHand' | t }}</th>
                  <th class="right">{{ 'inventory.reorder' | t }}</th>
                  <th>{{ 'inventory.nearestExpiry' | t }}</th>
                  <th class="right">{{ 'inventory.batches' | t }}</th>
                  <th class="right">{{ 'inventory.price' | t }}</th>
                  <th class="right">{{ 'inventory.costValue' | t }}</th>
                  <th>{{ 'inventory.status' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of list.items(); track item.productUid) {
                  <tr class="clickable" (click)="openBatches(item)">
                    <td>
                      <div class="cell-main">
                        <span
                          class="thumb tone-{{ typeOf(item).tone }}"
                          [title]="'ui.ptype.' + typeOf(item).code | t: null : typeOf(item).label"
                          ><app-icon [name]="typeOf(item).icon" [size]="16"
                        /></span>
                        <div>
                          <b>{{ item.productName }}</b
                          ><small
                            >{{ item.genericName ?? ''
                            }}{{ item.sku ? ' · ' + item.sku : '' }}</small
                          >
                        </div>
                        @if (item.trackingMode === 'SERIAL') {
                          <span class="badge purple" [title]="'inventory.trackedBySerialNumber' | t"
                            >S/N</span
                          >
                        }
                      </div>
                    </td>
                    <td>{{ item.categoryName ?? '—' }}</td>
                    <td class="muted">
                      @if (item.dosageForm) {
                        {{ item.dosageForm | label
                        }}{{ item.strength ? ' · ' + item.strength : '' }}
                      } @else {
                        per {{ item.unitOfMeasure | label }}
                      }
                    </td>
                    <td class="right strong">{{ item.quantity | num }}</td>
                    <td class="right muted">{{ item.reorderLevel | num }}</td>
                    <td>
                      {{
                        expires(item.trackingMode)
                          ? (item.nearestExpiry | day)
                          : ('ui.l.noExpiry' | t)
                      }}
                    </td>
                    <td class="right">{{ item.batchCount }}</td>
                    <td class="right">{{ item.sellingPrice | money }}</td>
                    <td class="right">{{ item.costValue | money }}</td>
                    <td><app-status [value]="item.status" /></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="10">
                      <app-empty
                        [loading]="list.loading()"
                        icon="box"
                        [title]="'inventory.noStock' | t"
                        [text]="'ui.empty.stock' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [list]="list" />
        </div>
      }
    </div>

    <app-drawer
      [open]="!!selected()"
      [title]="selected()?.productName ?? ''"
      [subtitle]="
        (selected()?.quantity ?? 0) + ('ui.l.preOnHandAtSp' | t) + (session.branch()?.name ?? '')
      "
      (closed)="selected.set(null)"
    >
      <div class="stack">
        @if (selected()?.trackingMode === 'SERIAL') {
          <div class="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              [class.active]="drawerTab() === 'serials'"
              (click)="drawerTab.set('serials')"
            >
              <app-icon name="barcode" [size]="15" /> {{ 'inventory.serials' | t }}
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="drawerTab() === 'batches'"
              (click)="drawerTab.set('batches')"
            >
              <app-icon name="layers" [size]="15" /> {{ 'inventory.batches' | t }}
            </button>
          </div>
        }
        @if (drawerTab() === 'serials' && selected()?.trackingMode === 'SERIAL') {
          <div class="chips">
            @for (f of serialFilters; track f.value) {
              <button
                type="button"
                class="chip"
                [class.active]="serialStatus() === f.value"
                (click)="filterSerials(f.value)"
              >
                {{ (f.value ? 'enum.' + f.value : 'ui.invites.all') | t: null : f.label }}
              </button>
            }
          </div>
          @for (u of serials(); track u.uid) {
            <div class="card card-pad row">
              <span class="thumb tone-purple serial-thumb"
                ><app-icon name="barcode" [size]="16"
              /></span>
              <div class="grow">
                <b class="mono">{{ u.serialNumber }}</b>
                <div class="muted" style="font-size:12px">
                  {{ 'ui.t.batch' | t: { batch: u.batchNumber } }}
                  @if (u.saleReference) {
                    · {{ 'ui.t.soldOn' | t: { reference: u.saleReference, date: u.soldAt | day } }}
                  }
                </div>
              </div>
              <app-status [value]="u.status" />
            </div>
          } @empty {
            <app-empty
              [loading]="batchesLoading()"
              icon="barcode"
              [title]="'inventory.noUnits' | t"
            />
          }
        } @else {
          @for (b of batches(); track b.uid) {
            <div class="card card-pad row">
              <span
                class="thumb"
                [class]="
                  b.expired
                    ? 'thumb tone-red'
                    : b.daysLeft !== null && b.daysLeft <= 90
                      ? 'thumb tone-amber'
                      : 'thumb tone-green'
                "
                style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center"
                ><app-icon name="layers" [size]="16"
              /></span>
              <div class="grow">
                <b class="mono">{{ b.batchNumber }}</b>
                <div class="muted" style="font-size:12px">
                  @if (b.expiryDate) {
                    {{ 'ui.t.expires' | t: { date: b.expiryDate | day } }} ·
                    {{ b.expired ? ('ui.t.expired' | t) : b.daysLeft + ('ui.l.preDaysLeft' | t) }} ·
                  } @else {
                    {{ 'ui.l.noExpiry' | t }} ·
                  }
                  cost {{ b.unitCost | money }}
                </div>
              </div>
              <b>{{ b.quantity | num }}</b>
            </div>
          } @empty {
            <app-empty
              [loading]="batchesLoading()"
              icon="layers"
              [title]="'inventory.noBatchesHere' | t"
            />
          }
        }
        @if (selected(); as item) {
          <a
            class="btn"
            routerLink="/inventory/movements"
            [queryParams]="{ productUid: item.productUid }"
            ><app-icon name="activity" [size]="16" /> {{ 'inventory.movements' | t }}</a
          >
        }
      </div>
    </app-drawer>

    <app-modal
      [open]="opening()"
      [title]="'inventory.openingStock' | t"
      (closed)="opening.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="saveOpening()">
        <div class="field full">
          <label>{{ 'inventory.product' | t }}</label>
          <app-lookup
            path="/products"
            [placeholder]="'inventory.searchProducts' | t"
            [display]="productName"
            [detail]="productDetail"
            (picked)="pickProduct($event)"
          />
          @if (err('productUid'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        @if (openingTracking() !== 'QUANTITY') {
          <div class="field">
            <label
              >{{ 'ui.t.batchNumber' | t
              }}{{ openingTracking() === 'SERIAL' ? ('ui.l.preOptional' | t) : '' }}</label
            ><input class="input" formControlName="batchNumber" />
            @if (err('batchNumber'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        @if (openingTracking() === 'BATCH_EXPIRY') {
          <div class="field">
            <label>{{ 'inventory.expiryDate' | t }}</label
            ><input class="input" type="date" formControlName="expiryDate" [min]="today" />
            @if (err('expiryDate'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        @if (openingTracking() === 'SERIAL') {
          <div class="field full">
            <label>{{ 'inventory.serialNumbersOnePerLineOr' | t }}</label
            ><textarea
              class="input mono"
              rows="4"
              formControlName="serials"
              placeholder="WCH-0001&#10;WCH-0002"
              (input)="syncSerialCount()"
            ></textarea>
            <span class="hint">{{ 'ui.t.serialUnits' | t: { count: serialCount() } }}</span>
            @if (err('serialNumbers'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        <div class="field">
          <label>{{ 'inventory.quantity' | t }}</label
          ><input
            class="input"
            type="number"
            min="1"
            formControlName="quantity"
            [readonly]="openingTracking() === 'SERIAL'"
          />
          @if (err('quantity'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'inventory.unitCost' | t }}</label
          ><input class="input" type="number" min="0" step="any" formControlName="unitCost" />
          @if (err('unitCost'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="opening.set(false)">
          {{ 'inventory.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="saveOpening()">
          {{ 'inventory.record' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .serial-thumb {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
    }
    .hint {
      color: var(--muted);
      font-size: 11.5px;
    }
  `,
})
export default class StockPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly today = isoDay();
  protected readonly q = signal('');
  protected readonly status = signal('');
  protected readonly categoryUid = signal('');
  protected readonly productType = signal('');
  protected readonly types = PRODUCT_TYPES;
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<StockItem>(() =>
    this.session.branch()
      ? {
          path: '/stock',
          query: {
            q: this.query(),
            status: this.status(),
            categoryUid: this.categoryUid(),
            productType: this.productType(),
          },
        }
      : null,
  );
  protected readonly summary = loaded<StockSummary>(() =>
    this.session.branch() ? { path: '/stock/summary' } : null,
  );
  protected readonly categories = loaded<Category[]>(() =>
    this.session.can('catalogue.view') ? { path: '/categories', options: { silent: true } } : null,
  );

  protected readonly selected = signal<StockItem | null>(null);
  protected readonly batches = signal<Batch[]>([]);
  protected readonly batchesLoading = signal(false);
  protected readonly serials = signal<SerialUnit[]>([]);
  protected readonly serialStatus = signal<SerialStatus | ''>('IN_STOCK');
  protected readonly serialFilters: { value: SerialStatus | ''; label: string }[] = [
    { value: 'IN_STOCK', label: 'In stock' },
    { value: 'SOLD', label: 'Sold' },
    { value: 'IN_TRANSIT', label: 'In transit' },
    { value: 'WRITTEN_OFF', label: 'Written off' },
    { value: '', label: 'All' },
  ];
  protected readonly drawerTab = signal<'batches' | 'serials'>('batches');
  protected readonly opening = signal(false);
  protected readonly openingTracking = signal<TrackingMode>('BATCH_EXPIRY');
  protected readonly serialCount = signal(0);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    productUid: ['', Validators.required],
    batchNumber: [''],
    expiryDate: [''],
    serials: [''],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitCost: [0, [Validators.required, Validators.min(0)]],
  });
  protected readonly productName = (p: Product) => p.name;
  protected readonly productDetail = (p: Product) =>
    [productTypeOf(p.productType).label, p.genericName ?? p.brand, p.sku, p.strength]
      .filter(Boolean)
      .join(' · ');

  protected typeOf(item: StockItem) {
    return productTypeOf(item.productType);
  }

  protected expires(mode: TrackingMode | null | undefined): boolean {
    return tracksExpiry(mode);
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected async openBatches(item: StockItem): Promise<void> {
    this.selected.set(item);
    this.batches.set([]);
    this.serials.set([]);
    this.drawerTab.set(item.trackingMode === 'SERIAL' ? 'serials' : 'batches');
    this.batchesLoading.set(true);
    try {
      const [batches] = await Promise.all([
        this.api.get<Batch[]>(`/stock/${item.productUid}/batches`),
        item.trackingMode === 'SERIAL' ? this.loadSerials(item) : Promise.resolve(),
      ]);
      this.batches.set(batches);
    } finally {
      this.batchesLoading.set(false);
    }
  }

  protected async filterSerials(status: SerialStatus | ''): Promise<void> {
    this.serialStatus.set(status);
    const item = this.selected();
    if (item) {
      await this.loadSerials(item);
    }
  }

  private async loadSerials(item: StockItem): Promise<void> {
    this.serials.set(
      await this.api.get<SerialUnit[]>(`/stock/${item.productUid}/serials`, {
        status: this.serialStatus(),
      }),
    );
  }

  protected syncSerialCount(): void {
    const count = parseSerials(this.form.controls.serials.value).length;
    this.serialCount.set(count);
    if (this.openingTracking() === 'SERIAL') {
      this.form.controls.quantity.setValue(Math.max(count, 1));
    }
  }

  protected openOpening(): void {
    this.form.reset();
    this.openingTracking.set('BATCH_EXPIRY');
    this.serialCount.set(0);
    this.opening.set(true);
  }

  protected pickProduct(product: Product | null): void {
    this.form.patchValue({ productUid: product?.uid ?? '', unitCost: product?.costPrice ?? 0 });
    this.openingTracking.set(
      product?.trackingMode ?? (product ? defaultTracking(product.productType) : 'BATCH_EXPIRY'),
    );
    this.syncSerialCount();
  }

  protected async saveOpening(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const tracking = this.openingTracking();
      await this.api.post(
        '/stock/opening',
        {
          productUid: v.productUid,
          batchNumber: tracking === 'QUANTITY' ? null : v.batchNumber.trim() || null,
          expiryDate: tracking === 'BATCH_EXPIRY' ? v.expiryDate || null : null,
          quantity: Number(v.quantity),
          unitCost: Number(v.unitCost),
          serialNumbers: tracking === 'SERIAL' ? parseSerials(v.serials) : null,
        },
        { silent: true },
      );
      this.toasts.success(this.translations.t('toast.openingStockRecorded'));
      this.opening.set(false);
      await Promise.all([this.list.reload(), this.summary.reload()]);
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected export(): void {
    downloadCsv(
      'stock.csv',
      [
        'Product',
        'Type',
        'Generic',
        'Code',
        'Category',
        'On hand',
        'Reorder',
        'Nearest expiry',
        'Price',
        'Cost value',
        'Status',
      ],
      this.list
        .items()
        .map((i) => [
          i.productName,
          i.productType,
          i.genericName,
          i.sku,
          i.categoryName,
          i.quantity,
          i.reorderLevel,
          i.nearestExpiry,
          i.sellingPrice,
          i.costValue,
          i.status,
        ]),
    );
  }
}
