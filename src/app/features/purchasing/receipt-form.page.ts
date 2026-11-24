import { CurrencyRateComponent } from '../../core/ui/currency-rate.component';
import { SettingsStore } from '../../core/format/settings.store';
import { convertHalfEven } from '../../core/format/format';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Api } from '../../core/api/api.service';
import {
  GoodsReceipt,
  Product,
  PurchaseOrder,
  Supplier,
  TrackingMode,
} from '../../core/api/models';
import { isoDay } from '../../core/format/format';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { guardUnsavedWork } from '../../core/session/leave-guard';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { TRACKING_MODES, defaultTracking, parseSerials } from '../../core/ui/product-types';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

type ReceiptLine = FormGroup<{
  productUid: FormControl<string>;
  productName: FormControl<string>;
  /** The product's tracking: what the line must carry (batch, expiry, serial numbers). */
  tracking: FormControl<TrackingMode>;
  batchNumber: FormControl<string>;
  expiryDate: FormControl<string>;
  /** SERIAL products: the units' serial numbers, one per line (pasted or scanned). */
  serials: FormControl<string>;
  quantity: FormControl<number>;
  unitCost: FormControl<number>;
}>;

@Component({
  selector: 'app-receipt-form',
  imports: [TranslatePipe, ...SHARED, LookupComponent, CurrencyRateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <a class="muted row" routerLink="/purchasing/receipts"
            ><app-icon name="arrow-left" [size]="15" /> {{ 'purchasing.goodsReceipts' | t }}</a
          >
          <h1 style="margin-top:6px">{{ 'purchasing.receiveGoods' | t }}</h1>
          <p class="sub">
            {{ order() ? ('ui.l.againstSp' | t) + order()!.number + ' · ' : '' }}
            {{ 'ui.t.receiveInto' | t: { branch: session.branch()?.name ?? '—' } }}
          </p>
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'ui.what.receiving' | t" />
      } @else {
        <form [formGroup]="form" class="stack">
          <div class="card card-pad form-grid three">
            <app-field [label]="'purchasing.supplier' | t" [error]="err('supplierUid')">
              @if (order(); as o) {
                <input class="input" [value]="o.supplierName" disabled />
              } @else {
                <app-lookup
                  #supplierLookup
                  path="/suppliers"
                  [placeholder]="'purchasing.searchSuppliers' | t"
                  [display]="supplierName"
                  (picked)="form.controls.supplierUid.setValue($event?.uid ?? '')"
                />
              }
            </app-field>
            <app-field
              [label]="'purchasing.supplierInvoiceNo' | t"
              [error]="err('supplierInvoiceNumber')"
            >
              <input class="input" formControlName="supplierInvoiceNumber" />
            </app-field>
            <app-field [label]="'purchasing.note' | t">
              <input class="input" formControlName="note" />
            </app-field>
            @if (vatRegistered()) {
              <app-field [label]="'vat.onTheInvoice' | t" [error]="err('vatAmount')">
                <input
                  class="input"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="vatAmount"
                  data-testid="receipt-vat"
                />
                <span class="hint">{{ 'vat.onTheInvoiceHint' | t }}</span>
              </app-field>
            }
            <app-field class="full" [label]="'purchasing.currency' | t">
              <app-currency-rate
                [(currency)]="currency"
                [(rate)]="rate"
                [lockCurrency]="!!order()"
              />
              @if (order(); as o) {
                @if (o.currency !== base()) {
                  <span class="hint muted">{{
                    'ui.t.orderLocked'
                      | t: { rate: o.exchangeRate | num, base: base(), currency: o.currency }
                  }}</span>
                }
              }
            </app-field>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'purchasing.itemsReceived' | t }}</h3>
              @if (!order()) {
                <div style="width:min(420px,60%)">
                  <app-lookup
                    path="/products"
                    [placeholder]="'purchasing.addAProduct' | t"
                    [display]="productName"
                    [keepText]="false"
                    (picked)="addProduct($event)"
                  />
                </div>
              }
            </div>
            <div class="table-wrap">
              <table class="table" formArrayName="lines">
                <thead>
                  <tr>
                    <th>{{ 'purchasing.product' | t }}</th>
                    <th>{{ 'purchasing.batchNumber' | t }}</th>
                    <th>{{ 'purchasing.expiry' | t }}</th>
                    <th class="right">{{ 'purchasing.quantity' | t }}</th>
                    <th class="right">{{ 'purchasing.unitCost' | t }}</th>
                    <th class="right">{{ 'purchasing.lineTotal' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of lines.controls; track line; let i = $index) {
                    <tr [formGroupName]="i">
                      <td class="strong">
                        {{ line.value.productName }}
                        <div class="faint small">{{ trackingLabel(line.value.tracking) }}</div>
                      </td>
                      <td>
                        @if (line.value.tracking === 'QUANTITY') {
                          <span class="faint">—</span>
                        } @else {
                          <input
                            class="input sm"
                            style="width:130px"
                            formControlName="batchNumber"
                            [placeholder]="line.value.tracking === 'SERIAL' ? 'optional' : ''"
                            [class.invalid]="
                              line.controls.batchNumber.touched && line.controls.batchNumber.invalid
                            "
                          />
                        }
                      </td>
                      <td>
                        @if (line.value.tracking === 'BATCH_EXPIRY') {
                          <input
                            class="input sm"
                            style="width:150px"
                            type="date"
                            [min]="today"
                            formControlName="expiryDate"
                            [class.invalid]="
                              line.controls.expiryDate.touched && line.controls.expiryDate.invalid
                            "
                          />
                        } @else {
                          <span class="faint">{{ 'purchasing.noExpiry' | t }}</span>
                        }
                      </td>
                      <td class="right">
                        <input
                          class="input sm"
                          style="width:90px"
                          type="number"
                          min="1"
                          formControlName="quantity"
                          [readonly]="line.value.tracking === 'SERIAL'"
                          (input)="touch()"
                        />
                      </td>
                      <td class="right">
                        <input
                          class="input sm"
                          style="width:110px"
                          type="number"
                          min="0"
                          step="any"
                          formControlName="unitCost"
                          (input)="touch()"
                        />
                      </td>
                      <td class="right">
                        {{
                          (line.value.quantity ?? 0) * (line.value.unitCost ?? 0)
                            | money: currency()
                        }}
                      </td>
                      <td class="right">
                        <button
                          class="icon-btn sm"
                          type="button"
                          (click)="removeLine(i)"
                          [attr.aria-label]="'common.remove' | t"
                        >
                          <app-icon name="trash" [size]="14" />
                        </button>
                      </td>
                    </tr>
                    @if (line.value.tracking === 'SERIAL') {
                      <tr class="serial-row" [formGroupName]="i">
                        <td colspan="7">
                          <div class="serial-entry">
                            <app-icon name="barcode" [size]="16" />
                            <textarea
                              class="input mono"
                              rows="2"
                              formControlName="serials"
                              [placeholder]="'purchasing.serialNumbersOnePerLineScan' | t"
                              (input)="syncSerials(line)"
                              [class.invalid]="
                                line.controls.serials.touched && line.controls.serials.invalid
                              "
                            ></textarea>
                            <span class="badge purple">{{
                              'ui.t.units' | t: { count: serialCount(line) }
                            }}</span>
                          </div>
                        </td>
                      </tr>
                    }
                  } @empty {
                    <tr>
                      <td colspan="7">
                        <app-empty
                          icon="download"
                          [title]="'purchasing.noItems' | t"
                          [text]="'ui.empty.receiptLines' | t"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="5">{{ 'purchasing.total' | t }}</td>
                    <td class="right">{{ total() | money: currency() }}</td>
                    <td></td>
                  </tr>
                  @if (vat() > 0) {
                    <tr class="muted" data-testid="receipt-owed">
                      <td colspan="5">{{ 'vat.owed' | t }}</td>
                      <td class="right">{{ total() + vat() | money: currency() }}</td>
                      <td></td>
                    </tr>
                  }
                  @if (currency() !== base()) {
                    <tr class="muted">
                      <td colspan="5">
                        {{ 'ui.t.stockCostAt' | t: { base: base(), rate: rate() | num } }}
                      </td>
                      <td class="right">{{ baseTotal() | money }}</td>
                      <td></td>
                    </tr>
                  }
                </tfoot>
              </table>
            </div>
          </div>
          <div class="sticky-actions">
            <a class="btn" routerLink="/purchasing/receipts">{{ 'purchasing.cancel' | t }}</a>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
              <app-icon name="check" [size]="16" /> {{ 'purchasing.recordReceipt' | t }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .serial-row td {
      padding-top: 0;
      border-top: 0;
    }
    .serial-entry {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
    }
    .serial-entry textarea {
      flex: 1;
      min-height: 42px;
    }
  `,
})
export default class ReceiptFormPage implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly po = input<string | undefined>();
  protected readonly order = signal<PurchaseOrder | null>(null);
  protected readonly busy = signal(false);
  protected readonly today = isoDay();
  private readonly version = signal(0);
  protected readonly base = inject(SettingsStore).currency;
  /** The receipt's currency (the order's, when against one) and its rate in base units. */
  protected readonly currency = signal('');
  protected readonly rate = signal(1);
  /** Settles on the base currency once the settings have loaded (never before). */
  private readonly defaultCurrency = effect(() => {
    const base = this.base();
    if (base && !untracked(this.currency)) {
      this.currency.set(base);
    }
  });
  private readonly supplierLookup = viewChild<LookupComponent>('supplierLookup');

  protected readonly form = this.fb.group({
    purchaseOrderUid: [''],
    supplierUid: ['', Validators.required],
    supplierInvoiceNumber: [''],
    note: [''],
    /** The invoice's input VAT, on top of the lines (VAT-registered pharmacies only). */
    vatAmount: [0, Validators.min(0)],
    lines: this.fb.array<ReceiptLine>([]),
  });
  private readonly settingsStore = inject(SettingsStore);
  protected readonly vatRegistered = computed(
    () => this.settingsStore.settings()?.vatRegistered ?? false,
  );
  private readonly vatValue = toSignal(this.form.controls.vatAmount.valueChanges, {
    initialValue: 0,
  });
  protected readonly vat = computed(() =>
    this.vatRegistered() ? Number(this.vatValue()) || 0 : 0,
  );
  protected get lines(): FormArray<ReceiptLine> {
    return this.form.controls.lines;
  }
  protected readonly total = computed(() => {
    this.version();
    return this.lines.controls.reduce(
      (sum, l) => sum + (l.value.quantity ?? 0) * (l.value.unitCost ?? 0),
      0,
    );
  });
  protected readonly baseTotal = computed(() =>
    convertHalfEven(this.total(), this.rate(), this.base()),
  );
  /** Leaving with a receipt half typed asks first (UX-4). */
  private readonly unsaved = guardUnsavedWork(
    () =>
      this.form.dirty ||
      (!this.order() && (this.lines.length > 0 || !!this.form.controls.supplierUid.value)),
  );
  protected readonly supplierName = (s: Supplier) => s.name;
  protected readonly productName = (p: Product) => p.name;

  async ngOnInit(): Promise<void> {
    const uid = this.po();
    if (!uid) {
      return;
    }
    const order = await this.api.get<PurchaseOrder>(`/purchase-orders/${uid}`);
    this.order.set(order);
    this.currency.set(order.currency ?? this.base());
    this.rate.set(order.exchangeRate ?? 1);
    this.form.patchValue({ purchaseOrderUid: order.uid, supplierUid: order.supplierUid });
    const outstanding = order.lines.filter((line) => line.quantity > line.receivedQuantity);
    const products = await Promise.all(
      outstanding.map((line) =>
        this.api
          .get<Product>(`/products/${line.productUid}`, undefined, { noBranch: true, silent: true })
          .catch(() => null),
      ),
    );
    outstanding.forEach((line, i) =>
      this.lines.push(
        this.line(
          line.productUid,
          line.productName,
          line.quantity - line.receivedQuantity,
          line.unitCost,
          products[i]?.trackingMode ?? defaultTracking(products[i]?.productType),
        ),
      ),
    );
    this.touch();
  }

  private line(
    productUid: string,
    productName: string,
    quantity: number,
    unitCost: number,
    tracking: TrackingMode = 'BATCH_EXPIRY',
  ): ReceiptLine {
    const batched = tracking === 'BATCH_EXPIRY' || tracking === 'BATCH';
    return this.fb.group({
      productUid: [productUid, Validators.required],
      productName: [productName],
      tracking: [tracking],
      batchNumber: ['', batched ? Validators.required : []],
      expiryDate: ['', tracking === 'BATCH_EXPIRY' ? Validators.required : []],
      serials: ['', tracking === 'SERIAL' ? Validators.required : []],
      quantity: [quantity, [Validators.required, Validators.min(1)]],
      unitCost: [unitCost, [Validators.required, Validators.min(0)]],
    });
  }

  protected trackingLabel(mode: TrackingMode | undefined): string {
    return TRACKING_MODES.find((m) => m.code === mode)?.label ?? mode ?? '';
  }

  protected serialCount(line: ReceiptLine): number {
    return parseSerials(line.controls.serials.value).length;
  }

  /** The quantity of a SERIAL line is the number of serial numbers entered. */
  protected syncSerials(line: ReceiptLine): void {
    line.controls.quantity.setValue(Math.max(this.serialCount(line), 1));
    this.touch();
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected touch(): void {
    this.version.update((v) => v + 1);
  }

  protected addProduct(product: Product | null): void {
    if (product) {
      this.lines.push(
        this.line(
          product.uid,
          product.name,
          1,
          product.costPrice,
          product.trackingMode ?? defaultTracking(product.productType),
        ),
      );
      this.touch();
    }
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.touch();
  }

  protected async save(): Promise<void> {
    if (!this.base() || !this.currency()) {
      this.toasts.error(this.translations.t('toast.settingsLoading'));
      return;
    }
    if (this.currency() !== this.base() && !(this.rate() > 0)) {
      this.toasts.error(this.translations.t('toast.rateNeeded', { currency: this.currency() }));
      return;
    }
    if (!validate(this.form)) {
      this.toasts.error(this.translations.t('toast.completeLines'));
      return;
    }
    if (!this.lines.length) {
      this.toasts.error(this.translations.t('toast.addItem'));
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    try {
      const receipt = await this.api.post<GoodsReceipt>(
        '/goods-receipts',
        {
          purchaseOrderUid: value.purchaseOrderUid || null,
          supplierUid: value.supplierUid,
          supplierInvoiceNumber: value.supplierInvoiceNumber || null,
          note: value.note || null,
          lines: value.lines.map(
            ({ productUid, tracking, batchNumber, expiryDate, serials, quantity, unitCost }) => ({
              productUid,
              batchNumber: tracking === 'QUANTITY' ? null : batchNumber.trim() || null,
              expiryDate: tracking === 'BATCH_EXPIRY' ? expiryDate || null : null,
              quantity,
              unitCost,
              serialNumbers: tracking === 'SERIAL' ? parseSerials(serials) : null,
            }),
          ),
          currency: this.currency() || this.base(),
          exchangeRate: this.currency() === this.base() ? null : this.rate(),
          vatAmount: this.vat() > 0 ? this.vat() : null,
        },
        { silent: true },
      );
      this.toasts.success(this.translations.t('toast.receiptRecorded', { number: receipt.number }));
      this.unsaved.done();
      await this.router.navigate(['/purchasing/receipts', receipt.uid]);
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
    void this.supplierLookup;
  }
}
