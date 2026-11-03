import { CurrencyRateComponent } from '../../core/ui/currency-rate.component';
import { SettingsStore } from '../../core/format/settings.store';
import { convertHalfEven } from '../../core/format/format';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { Product, PurchaseOrder, Supplier } from '../../core/api/models';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

type LineGroup = FormGroup<{
  productUid: FormControl<string>;
  productName: FormControl<string>;
  quantity: FormControl<number>;
  unitCost: FormControl<number>;
}>;

@Component({
  selector: 'app-order-form',
  imports: [TranslatePipe, ...SHARED, LookupComponent, CurrencyRateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <a class="muted row" routerLink="/purchasing/orders"
            ><app-icon name="arrow-left" [size]="15" /> {{ 'purchasing.purchaseOrders' | t }}</a
          >
          <h1 style="margin-top:6px">{{ 'purchasing.newPurchaseOrder' | t }}</h1>
          <p class="sub">For {{ session.branch()?.name ?? '—' }}</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/purchasing/orders">{{ 'purchasing.cancel' | t }}</a>
          <button
            class="btn primary"
            type="button"
            [disabled]="busy() || !session.branch()"
            (click)="save()"
          >
            <app-icon name="check" [size]="16" /> {{ 'purchasing.placeOrder' | t }}
          </button>
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required what="Ordering" />
      } @else {
        <form [formGroup]="form" class="stack">
          <div class="card card-pad form-grid three">
            <div class="field">
              <label>{{ 'purchasing.supplier' | t }}</label>
              <app-lookup
                path="/suppliers"
                [placeholder]="'purchasing.searchSuppliers' | t"
                [display]="supplierName"
                [detail]="supplierDetail"
                (picked)="form.controls.supplierUid.setValue($event?.uid ?? '')"
              />
              @if (err('supplierUid'); as m) {
                <span class="error">{{ m }}</span>
              }
            </div>
            <div class="field">
              <label>{{ 'purchasing.expectedDelivery' | t }}</label
              ><input class="input" type="date" formControlName="expectedDate" />
            </div>
            <div class="field">
              <label>{{ 'purchasing.note' | t }}</label
              ><input class="input" formControlName="note" />
            </div>
            <div class="field full">
              <label>{{ 'purchasing.currency' | t }}</label>
              <app-currency-rate [(currency)]="currency" [(rate)]="rate" />
            </div>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'purchasing.lines' | t }}</h3>
              <div style="width:min(420px,60%)">
                <app-lookup
                  path="/products"
                  [placeholder]="'purchasing.addAProduct' | t"
                  [display]="productName"
                  [detail]="productDetail"
                  [keepText]="false"
                  (picked)="addLine($event)"
                />
              </div>
            </div>
            <div class="table-wrap">
              <table class="table" formArrayName="lines">
                <thead>
                  <tr>
                    <th>{{ 'purchasing.product' | t }}</th>
                    <th class="right">{{ 'purchasing.quantity' | t }}</th>
                    <th class="right">{{ 'purchasing.unitCost' | t }}</th>
                    <th class="right">{{ 'purchasing.lineTotal' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of lines.controls; track line; let i = $index) {
                    <tr [formGroupName]="i">
                      <td class="strong">{{ line.value.productName }}</td>
                      <td class="right">
                        <input
                          class="input sm"
                          style="width:100px"
                          type="number"
                          min="1"
                          formControlName="quantity"
                          (input)="touch()"
                        />
                      </td>
                      <td class="right">
                        <input
                          class="input sm"
                          style="width:120px"
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
                        <button class="icon-btn sm" type="button" (click)="removeLine(i)">
                          <app-icon name="trash" [size]="14" />
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5">
                        <app-empty
                          icon="bag"
                          [title]="'purchasing.noLinesYet' | t"
                          text="Search for a product above to add it."
                        />
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3">{{ 'purchasing.total' | t }}</td>
                    <td class="right">{{ total() | money: currency() }}</td>
                    <td></td>
                  </tr>
                  @if (currency() !== base()) {
                    <tr class="muted">
                      <td colspan="3">In {{ base() }} at {{ rate() | num }}</td>
                      <td class="right">{{ baseTotal() | money }}</td>
                      <td></td>
                    </tr>
                  }
                </tfoot>
              </table>
            </div>
          </div>
        </form>
      }
    </div>
  `,
})
export default class OrderFormPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly busy = signal(false);
  private readonly version = signal(0);
  protected readonly base = inject(SettingsStore).currency;
  /** The order's currency and its rate (base units per unit), locked when the order is placed. */
  protected readonly currency = signal(this.base());
  protected readonly rate = signal(1);

  protected readonly form = this.fb.group({
    supplierUid: ['', Validators.required],
    expectedDate: [''],
    note: [''],
    lines: this.fb.array<LineGroup>([]),
  });
  protected get lines(): FormArray<LineGroup> {
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

  protected readonly supplierName = (s: Supplier) => s.name;
  protected readonly supplierDetail = (s: Supplier) => [s.code, s.paymentTerms].join(' · ');
  protected readonly productName = (p: Product) => p.name;
  protected readonly productDetail = (p: Product) =>
    [p.genericName, p.sku].filter(Boolean).join(' · ');

  private line(product?: Product): LineGroup {
    return this.fb.group({
      productUid: [product?.uid ?? '', Validators.required],
      productName: [product?.name ?? ''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitCost: [product?.costPrice ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected touch(): void {
    this.version.update((v) => v + 1);
  }

  protected addLine(product: Product | null): void {
    if (!product || this.lines.controls.some((l) => l.value.productUid === product.uid)) {
      return;
    }
    this.lines.push(this.line(product));
    this.touch();
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.touch();
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      this.toasts.error(this.translations.t('toast.chooseSupplier'));
      return;
    }
    if (!this.lines.length) {
      this.toasts.error(this.translations.t('toast.addLine'));
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    try {
      const order = await this.api.post<PurchaseOrder>(
        '/purchase-orders',
        {
          supplierUid: value.supplierUid,
          expectedDate: value.expectedDate || null,
          note: value.note || null,
          lines: value.lines.map(({ productUid, quantity, unitCost }) => ({
            productUid,
            quantity,
            unitCost,
          })),
          currency: this.currency(),
          exchangeRate: this.currency() === this.base() ? null : this.rate(),
        },
        { silent: true },
      );
      this.toasts.success(this.translations.t('toast.orderPlaced', { number: order.number }));
      await this.router.navigate(['/purchasing/orders', order.uid]);
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
