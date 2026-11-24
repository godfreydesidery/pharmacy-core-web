import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { AdjustmentReason, Batch, Movement, Product } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { guardUnsavedWork } from '../../core/session/leave-guard';
import { ConfirmService } from '../../core/ui/confirm';
import { humanize } from '../../core/format/format';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { parseSerials } from '../../core/ui/product-types';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

/** An adjustment being typed, as a draft keeps it. */
interface AdjustmentDraft {
  value: {
    productUid?: string;
    batchUid?: string;
    reasonCode?: AdjustmentReason;
    quantityChange?: number;
    note?: string;
    serials?: string;
  };
  product: Pick<Product, 'uid' | 'name' | 'trackingMode'> | null;
}

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
                        [for]="list"
                        icon="clipboard"
                        [title]="'inventory.noAdjustments' | t"
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

    <app-modal
      [open]="editing()"
      [title]="'inventory.newStockAdjustment' | t"
      [dirty]="changed()"
      (closed)="editing.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <app-field class="full" [label]="'inventory.product' | t" [error]="err('productUid')">
          <app-lookup
            path="/products"
            [placeholder]="'inventory.searchProducts' | t"
            #productLookup
            [display]="productName"
            (picked)="pickProduct($event)"
          />
        </app-field>
        <app-field class="full" [label]="'inventory.batch' | t" [error]="err('batchUid')">
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
        </app-field>
        <app-field [label]="'inventory.reason' | t">
          <select class="select" formControlName="reasonCode">
            @for (r of reasons; track r) {
              <option [value]="r">{{ r | label }}</option>
            }
          </select>
        </app-field>
        <app-field
          [label]="'inventory.quantityChange' | t"
          [hint]="'inventory.negativeRemovesStockPositiveAddsIt' | t"
          [error]="err('quantityChange')"
        >
          <input class="input" type="number" formControlName="quantityChange" />
        </app-field>
        @if (serialTracked()) {
          <app-field
            class="full"
            [label]="'inventory.serialNumbersOnePerLine' | t"
            [hint]="'inventory.addingUnitsGiveEachNewUnit' | t"
            [error]="err('serialNumbers')"
          >
            <textarea
              class="input mono"
              rows="3"
              formControlName="serials"
              placeholder="WCH-0004"
            ></textarea>
          </app-field>
        }
        <app-field class="full" [label]="'inventory.note' | t" [error]="err('note')">
          <textarea class="input" formControlName="note"></textarea>
        </app-field>
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
  private readonly confirm = inject(ConfirmService);
  protected readonly reasons = REASONS;
  /** The product picked, for the confirmation. */
  private readonly pickedName = signal<string | null>(null);
  protected readonly list = pagedList<Movement>(() =>
    this.session.branch() ? { path: '/stock/movements', query: { type: 'ADJUSTMENT' } } : null,
  );
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly batches = signal<Batch[]>([]);
  protected readonly serialTracked = signal(false);
  protected readonly productName = (p: Product) => p.name;
  /** An adjustment being typed: closing the dialog or leaving the page asks first (UX-4). */
  protected changed(): boolean {
    return this.editing() && (this.form.dirty || !!this.form.controls.productUid.value);
  }
  private readonly productLookup = viewChild<LookupComponent>('productLookup');
  /** The product picked, as a draft keeps it. */
  private pickedProduct: Pick<Product, 'uid' | 'name' | 'trackingMode'> | null = null;
  private readonly unsaved = guardUnsavedWork<AdjustmentDraft>(() => this.changed(), {
    id: () => 'inventory.adjustment',
    save: () => ({ value: this.form.getRawValue(), product: this.pickedProduct }),
    restore: async (draft) => {
      this.open();
      if (draft.product) {
        await this.pickProduct(draft.product as Product);
        this.productLookup()?.setText(draft.product.name);
      }
      this.form.patchValue(draft.value);
      this.form.markAsDirty();
    },
  });
  private readonly offerOnOpen = afterNextRender(() => void this.unsaved.offerDraft());
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
    this.pickedName.set(product?.name ?? null);
    this.pickedProduct = product
      ? { uid: product.uid, name: product.name, trackingMode: product.trackingMode }
      : null;
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
    if (this.form.controls.quantityChange.value < 0 && !this.form.controls.note.value.trim()) {
      // Stock taken off the books always says why (FRD-5).
      this.form.controls.note.setErrors({ api: this.translations.t('errors.note_required') });
      this.form.controls.note.markAsTouched();
      return;
    }
    // The stock changes at once: confirmed with its figures first (UX-12).
    const raw = this.form.getRawValue();
    const t = (key: string, params?: Record<string, string | number>) =>
      this.translations.t(key, params);
    const change = Number(raw.quantityChange);
    const batch = this.batches().find((b) => b.uid === raw.batchUid)?.batchNumber;
    const sure = await this.confirm.ask({
      title: t('ux.confirm.adjust.title'),
      text: t('ux.confirm.adjust.text'),
      icon: change < 0 ? 'warning' : 'question',
      confirmText: t('ux.confirm.adjust.ok'),
      details: [
        ...(this.pickedName()
          ? [{ label: t('ux.confirm.product'), value: this.pickedName()! }]
          : []),
        ...(batch ? [{ label: t('ux.confirm.batch'), value: batch }] : []),
        {
          label: t('ux.confirm.change'),
          value: t(change < 0 ? 'ux.confirm.unitsOff' : 'ux.confirm.unitsOn', {
            count: Math.abs(change),
          }),
        },
        {
          label: t('ux.confirm.reason'),
          value: this.translations.t('enum.' + raw.reasonCode, undefined, humanize(raw.reasonCode)),
        },
      ],
    });
    if (!sure || this.busy()) {
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
