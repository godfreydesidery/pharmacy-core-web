import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { GoodsReceipt, LatestRate, Supplier, SupplierPayment } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { convertHalfEven, isoDay } from '../../core/format/format';
import { SettingsStore } from '../../core/format/settings.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';
import { OverdrawWarningComponent } from './overdraw-warning.component';

const METHODS = ['BANK_TRANSFER', 'CASH', 'MOBILE_MONEY', 'CARD', 'CHEQUE'];

/**
 * Payments to suppliers. A payment in a foreign currency settles receipts booked at their own
 * rates; the difference at today's rate is a realised exchange gain or loss.
 */
@Component({
  selector: 'app-supplier-payments',
  imports: [...SHARED, LookupComponent, OverdrawWarningComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'finance.supplierPayments' | t }}</h1>
          <p class="sub">
            {{ 'finance.settleWhatYouOweSuppliers' | t }}
          </p>
        </div>
        <div class="actions">
          @if (session.can('finance.manage')) {
            <button class="btn primary" type="button" (click)="openForm()">
              <app-icon name="plus" [size]="16" /> {{ 'finance.recordPayment' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'finance.number' | t }}</th>
                <th>{{ 'finance.paidOn' | t }}</th>
                <th>{{ 'finance.supplier' | t }}</th>
                <th class="right">{{ 'finance.amount' | t }}</th>
                <th class="right">{{ 'finance.in' | t }} {{ base() }}</th>
                <th class="right">{{ 'finance.fxDifference' | t }}</th>
                <th>{{ 'finance.method' | t }}</th>
                <th>{{ 'finance.reference' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of list.items(); track p.uid) {
                <tr>
                  <td class="mono strong">{{ p.number }}</td>
                  <td class="muted">{{ p.paidOn | day }}</td>
                  <td>{{ p.supplierName }}</td>
                  <td class="right">{{ p.amount | money: p.currency }}</td>
                  <td class="right strong">{{ p.baseAmount | money }}</td>
                  <td class="right">
                    @if (p.fxDifference === 0) {
                      <span class="muted">—</span>
                    } @else {
                      <span
                        [class.text-red]="p.fxDifference > 0"
                        [class.text-green]="p.fxDifference < 0"
                      >
                        {{ p.fxDifference > 0 ? ('ui.l.loss' | t) : ('ui.l.gain' | t) }}
                        {{ abs(p.fxDifference) | money }}
                      </span>
                    }
                  </td>
                  <td>{{ p.paymentMethod | label }}</td>
                  <td class="mono">{{ p.reference ?? '—' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <app-empty
                      [loading]="list.loading()"
                      icon="wallet"
                      [title]="'finance.noSupplierPaymentsYet' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="list" />
      </div>
    </div>

    <app-modal
      [open]="open()"
      [title]="'finance.recordSupplierPayment' | t"
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'finance.supplier' | t }}</label>
          <app-lookup
            path="/suppliers"
            [placeholder]="'finance.searchSuppliers' | t"
            [display]="supplierName"
            (picked)="pickSupplier($event)"
          />
          @if (err('supplierUid'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'finance.currency' | t }}</label>
          <select class="select" formControlName="currency" (change)="loadRate()">
            @for (c of accepted(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'finance.amount2' | t }}{{ form.controls.currency.value }})</label>
          <input class="input" type="number" min="0" step="any" formControlName="amount" />
          @if (err('amount'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        @if (foreign()) {
          <div class="field">
            <label
              >{{ 'finance.rate2' | t }} {{ base() }} {{ 'finance.per1' | t }}
              {{ form.controls.currency.value }}</label
            >
            <input class="input mono" type="number" min="0" step="any" formControlName="rate" />
            @if (stale()) {
              <span class="error">{{ 'finance.theLatestRateIsOver' | t }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'finance.costsIn' | t }} {{ base() }}</label>
            <div class="input readonly strong">{{ settled() | money }}</div>
          </div>
        }
        <div class="field">
          <label>{{ 'finance.paidBy' | t }}</label>
          <select class="select" formControlName="paymentMethod">
            @for (m of methods; track m) {
              <option [value]="m">{{ m | label }}</option>
            }
          </select>
        </div>
        <app-overdraw-warning
          class="full"
          [amount]="settled()"
          [method]="form.controls.paymentMethod.value"
        />
        <div class="field">
          <label>{{ 'finance.paidOn' | t }}</label>
          <input class="input" type="date" formControlName="paidOn" [max]="today" />
        </div>
        <div class="field full">
          <label>{{ 'finance.reference' | t }}</label>
          <input
            class="input"
            formControlName="reference"
            [placeholder]="'finance.bankOrTransferReference' | t"
          />
        </div>
        @if (receipts().length) {
          <div class="field full">
            <label>{{ 'finance.settlesReceipts' | t }}{{ form.controls.currency.value }})</label>
            <div class="checks">
              @for (r of receipts(); track r.uid) {
                <label class="check">
                  <input type="checkbox" [checked]="chosen().has(r.uid)" (change)="toggle(r.uid)" />
                  <span class="mono">{{ r.number }}</span>
                  <span class="muted">{{ r.createdAt | day }}</span>
                  <span class="grow"></span>
                  <span>{{ r.total | money: r.currency }}</span>
                  @if (foreign()) {
                    <span class="muted">@ {{ r.exchangeRate | num }}</span>
                  }
                </label>
              }
            </div>
          </div>
        }
      </form>
      <div footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ busy() ? ('ui.l.saving' | t) : ('ui.l.recordPayment' | t) }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .checks {
        display: grid;
        gap: 6px;
        max-height: 220px;
        overflow: auto;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 10px;
        cursor: pointer;
      }
      .readonly {
        display: flex;
        align-items: center;
        background: var(--surface-2);
      }
    `,
  ],
})
export default class SupplierPaymentsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly settings = inject(SettingsStore);
  protected readonly methods = METHODS;
  protected readonly today = isoDay();
  protected readonly base = this.settings.currency;
  protected readonly accepted = computed(
    () => this.settings.settings()?.acceptedCurrencies ?? [this.base()],
  );
  protected readonly list = pagedList<SupplierPayment>(() => ({
    path: '/finance/supplier-payments',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly stale = signal(false);
  protected readonly receipts = signal<GoodsReceipt[]>([]);
  protected readonly chosen = signal<Set<string>>(new Set());
  protected readonly form = inject(FormBuilder).nonNullable.group({
    supplierUid: ['', Validators.required],
    currency: [''],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    rate: [1],
    paymentMethod: ['BANK_TRANSFER'],
    paidOn: [isoDay()],
    reference: [''],
  });
  private readonly values = signal(this.form.getRawValue());
  protected readonly foreign = computed(() => this.values().currency !== this.base());
  protected readonly settled = computed(() => {
    const v = this.values();
    return convertHalfEven(Number(v.amount) || 0, Number(v.rate) || 0, this.base());
  });
  protected readonly supplierName = (s: Supplier) => s.name;
  protected readonly abs = Math.abs;

  constructor() {
    this.form.valueChanges.subscribe(() => this.values.set(this.form.getRawValue()));
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected openForm(): void {
    this.form.reset({
      supplierUid: '',
      currency: this.base(),
      amount: 0,
      rate: 1,
      paymentMethod: 'BANK_TRANSFER',
      paidOn: isoDay(),
      reference: '',
    });
    this.receipts.set([]);
    this.chosen.set(new Set());
    this.stale.set(false);
    this.open.set(true);
  }

  protected async pickSupplier(supplier: Supplier | null): Promise<void> {
    this.form.controls.supplierUid.setValue(supplier?.uid ?? '');
    await this.loadReceipts();
  }

  protected toggle(uid: string): void {
    const next = new Set(this.chosen());
    if (next.has(uid)) {
      next.delete(uid);
    } else {
      next.add(uid);
    }
    this.chosen.set(next);
  }

  protected async loadRate(): Promise<void> {
    const currency = this.form.controls.currency.value;
    this.chosen.set(new Set());
    await this.loadReceipts();
    if (currency === this.base()) {
      this.form.controls.rate.setValue(1);
      this.stale.set(false);
      return;
    }
    try {
      const latest = await this.api.get<LatestRate>(
        '/fx/rates/latest',
        { base: currency, quote: this.base() },
        { silent: true, noBranch: true },
      );
      this.form.controls.rate.setValue(latest.rate);
      this.stale.set(latest.stale);
    } catch {
      this.toasts.error(this.translations.t('toast.noRate', { currency }));
    }
  }

  private async loadReceipts(): Promise<void> {
    const supplierUid = this.form.controls.supplierUid.value;
    if (!supplierUid || !this.session.branch()) {
      this.receipts.set([]);
      return;
    }
    try {
      const page = await this.api.get<{ items: GoodsReceipt[] }>(
        '/goods-receipts',
        { supplierUid, limit: 50 },
        { silent: true },
      );
      const currency = this.form.controls.currency.value;
      this.receipts.set(page.items.filter((r) => r.currency === currency));
    } catch {
      this.receipts.set([]);
    }
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      await this.api.post(
        '/finance/supplier-payments',
        {
          supplierUid: v.supplierUid,
          amount: Number(v.amount),
          currency: v.currency,
          rate: v.currency === this.base() ? null : Number(v.rate),
          paymentMethod: v.paymentMethod,
          reference: v.reference || null,
          goodsReceiptUids: [...this.chosen()],
          paidOn: v.paidOn,
        },
        { silent: true },
      );
      this.toasts.success(this.translations.t('toast.supplierPaymentRecorded'));
      this.open.set(false);
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
