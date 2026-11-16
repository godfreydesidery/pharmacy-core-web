import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { AdjustmentReason, Batch, Movement, Product } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { parseSerials } from '../../core/ui/product-types';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

const REASONS: AdjustmentReason[] = [
  'DAMAGE',
  'THEFT_LOSS',
  'COUNT_CORRECTION',
  'EXPIRED_WRITE_OFF',
  'SAMPLE',
  'OTHER',
];

@Component({
  selector: 'app-adjustments',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'inventory.stockAdjustments' | t }}</h1>
          <p class="sub">{{ 'inventory.damageLossCountCorrectionsAndWrite' | t }}</p>
        </div>
        <div class="actions">
          @if (session.branch()) {
            <button class="btn primary" type="button" (click)="open()">
              <app-icon name="plus" [size]="16" /> {{ 'inventory.newAdjustment' | t }}
            </button>
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'ui.what.adjusting' | t" />
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'inventory.when' | t }}</th>
                  <th>{{ 'inventory.medicine' | t }}</th>
                  <th>{{ 'inventory.batch' | t }}</th>
                  <th>{{ 'inventory.reason' | t }}</th>
                  <th class="right">{{ 'inventory.change' | t }}</th>
                  <th class="right">{{ 'inventory.balance' | t }}</th>
                  <th>{{ 'inventory.note' | t }}</th>
                  <th>{{ 'inventory.by' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (m of list.items(); track m.uid) {
                  <tr>
                    <td class="muted">{{ m.createdAt | when }}</td>
                    <td class="strong">{{ m.productName }}</td>
                    <td class="mono">{{ m.batchNumber }}</td>
                    <td>{{ m.reasonCode | label }}</td>
                    <td
                      class="right strong"
                      [class.text-red]="m.quantityChange < 0"
                      [class.text-green]="m.quantityChange > 0"
                    >
                      {{ m.quantityChange > 0 ? '+' : '' }}{{ m.quantityChange }}
                    </td>
                    <td class="right">{{ m.balanceAfter | num }}</td>
                    <td class="muted">{{ m.note ?? '—' }}</td>
                    <td>{{ m.createdBy }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8">
                      <app-empty
                        [loading]="list.loading()"
                        icon="clipboard"
                        [title]="'inventory.noAdjustments' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager
            [count]="list.items().length"
            [total]="list.total()"
            [hasMore]="list.hasMore()"
            [loading]="list.loading()"
            (more)="list.more()"
          />
        </div>
      }
    </div>

    <app-modal
      [open]="editing()"
      [title]="'inventory.newStockAdjustment' | t"
      (closed)="editing.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'inventory.product' | t }}</label>
          <app-lookup
            path="/products"
            [placeholder]="'inventory.searchProducts' | t"
            [display]="productName"
            (picked)="pickProduct($event)"
          />
          @if (err('productUid'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field full">
          <label>{{ 'inventory.batch' | t }}</label>
          <select class="select" formControlName="batchUid">
            <option value="" disabled>
              {{ batches().length ? ('ui.l.chooseABatch' | t) : ('ui.l.pickAProductFirst' | t) }}
            </option>
            @for (b of batches(); track b.uid) {
              <option [value]="b.uid">
                {{ b.batchNumber
                }}{{ b.expiryDate ? ('ui.l.preExpSp' | t) + (b.expiryDate | day) : '' }} ·
                {{ b.quantity }} on hand
              </option>
            }
          </select>
          @if (err('batchUid'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'inventory.reason' | t }}</label>
          <select class="select" formControlName="reasonCode">
            @for (r of reasons; track r) {
              <option [value]="r">{{ r | label }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'inventory.quantityChange' | t }}</label
          ><input class="input" type="number" formControlName="quantityChange" />
          <span class="hint">{{ 'inventory.negativeRemovesStockPositiveAddsIt' | t }}</span>
          @if (err('quantityChange'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        @if (serialTracked()) {
          <div class="field full">
            <label>{{ 'inventory.serialNumbersOnePerLine' | t }}</label
            ><textarea
              class="input mono"
              rows="3"
              formControlName="serials"
              placeholder="WCH-0004"
            ></textarea>
            <span class="hint">{{ 'inventory.addingUnitsGiveEachNewUnit' | t }}</span>
            @if (err('serialNumbers'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        <div class="field full">
          <label>{{ 'inventory.note' | t }}</label
          ><textarea class="input" formControlName="note"></textarea>
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="editing.set(false)">
          {{ 'inventory.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'inventory.recordAdjustment' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class AdjustmentsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly reasons = REASONS;
  protected readonly list = pagedList<Movement>(() =>
    this.session.branch() ? { path: '/stock/movements', query: { type: 'ADJUSTMENT' } } : null,
  );
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly batches = signal<Batch[]>([]);
  protected readonly serialTracked = signal(false);
  protected readonly productName = (p: Product) => p.name;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    productUid: ['', Validators.required],
    batchUid: ['', Validators.required],
    reasonCode: ['DAMAGE' as AdjustmentReason, Validators.required],
    quantityChange: [-1, Validators.required],
    note: [''],
    serials: [''],
  });

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected open(): void {
    this.form.reset();
    this.batches.set([]);
    this.editing.set(true);
  }

  protected async pickProduct(product: Product | null): Promise<void> {
    this.form.patchValue({ productUid: product?.uid ?? '', batchUid: '', serials: '' });
    this.serialTracked.set(product?.trackingMode === 'SERIAL');
    this.batches.set(product ? await this.api.get<Batch[]>(`/stock/${product.uid}/batches`) : []);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    if (this.form.controls.quantityChange.value === 0) {
      this.form.controls.quantityChange.setErrors({ api: 'Must not be zero' });
      return;
    }
    this.busy.set(true);
    try {
      const { serials, ...value } = this.form.getRawValue();
      await this.api.post(
        '/stock/adjustments',
        { ...value, serialNumbers: this.serialTracked() ? parseSerials(serials) : null },
        { silent: true },
      );
      this.toasts.success(this.translations.t('toast.adjustmentRecorded'));
      this.editing.set(false);
      await this.list.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
