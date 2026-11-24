import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AttachmentsComponent } from '../../core/files/attachments.component';
import { Api } from '../../core/api/api.service';
import { Sale, SaleLine, SaleReturn } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { formatMoney } from '../../core/format/format';
import { SettingsStore } from '../../core/format/settings.store';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import { ReceiptComponent } from '../pos/receipt.component';
import { TranslatePipe } from '../../core/i18n/t.pipe';

type Disposition = 'SHELF' | 'QUARANTINE' | 'DAMAGED';

@Component({
  selector: 'app-sale-detail',
  imports: [TranslatePipe, ...SHARED, ReceiptComponent, AttachmentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (sale.value(); as s) {
        <div class="page-head no-print">
          <div>
            <a class="muted row" routerLink="/sales"
              ><app-icon name="arrow-left" [size]="15" /> {{ 'sales.sales' | t }}</a
            >
            <h1 class="row" style="margin-top:6px">
              {{ s.number }} <app-status [value]="s.status" />
            </h1>
            <p class="sub">
              {{ s.createdAt | when }} · {{ s.branchName }} ·
              {{ 'ui.t.cashierLower' | t: { name: s.cashierName } }}
            </p>
          </div>
          <div class="actions">
            <button class="btn" type="button" (click)="printing.set(true)">
              <app-icon name="printer" [size]="16" /> {{ 'sales.receipt' | t }}
            </button>
            @if (session.can('sales.refund') && returnable().length) {
              <button class="btn primary" type="button" (click)="openReturn()">
                <app-icon name="undo" [size]="16" /> {{ 'sales.returnItems' | t }}
              </button>
            }
          </div>
        </div>
        <div class="grid kpis mb">
          <app-stat
            [label]="'sales.total' | t"
            [value]="s.total | compactMoney"
            [hint]="s.total | money"
            icon="receipt"
            tone="blue"
            [caption]="'sales.inclTax' | t"
          />
          <app-stat
            [label]="'sales.paid' | t"
            [value]="s.paidTotal | compactMoney"
            [hint]="s.paidTotal | money"
            icon="wallet"
            tone="green"
            [caption]="
              s.changeDue ? ('ui.l.changeSp' | t) + (s.changeDue | money) : ('ui.l.noChangeDue' | t)
            "
          />
          <app-stat
            [label]="'sales.discount' | t"
            [value]="s.discountTotal | compactMoney"
            [hint]="s.discountTotal | money"
            icon="percent"
            tone="orange"
            [caption]="s.discountPercent + '%'"
          />
          <app-stat
            [label]="'sales.tax' | t"
            [value]="s.taxTotal | compactMoney"
            [hint]="s.taxTotal | money"
            icon="file"
            tone="purple"
            [caption]="'sales.collected' | t"
          />
        </div>
        <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
          <div class="card">
            <div class="card-head">
              <h3>{{ 'sales.items' | t }}</h3>
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'sales.medicine' | t }}</th>
                    <th>{{ 'sales.batch' | t }}</th>
                    <th>{{ 'sales.expiry' | t }}</th>
                    <th class="right">{{ 'sales.qty' | t }}</th>
                    <th class="right">{{ 'sales.returned' | t }}</th>
                    <th class="right">{{ 'sales.price' | t }}</th>
                    <th class="right">{{ 'sales.discount' | t }}</th>
                    <th class="right">{{ 'sales.tax' | t }}</th>
                    <th class="right">{{ 'sales.total' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of s.lines; track l.uid) {
                    <tr>
                      <td class="strong">
                        {{ l.productName }}
                        @if (l.serialNumbers.length) {
                          <div class="serials">
                            @for (sn of l.serialNumbers; track sn) {
                              <span
                                class="badge mono"
                                [class]="
                                  l.returnedSerialNumbers.includes(sn)
                                    ? 'badge mono gray'
                                    : 'badge mono purple'
                                "
                                [title]="
                                  l.returnedSerialNumbers.includes(sn)
                                    ? ('ui.l.returned' | t)
                                    : ('ui.l.sold' | t)
                                "
                                >{{ sn }}</span
                              >
                            }
                          </div>
                        }
                        @if (l.warrantyEndsOn) {
                          <div class="faint small">
                            {{ 'ui.t.warrantyUntil' | t: { date: l.warrantyEndsOn | day } }}
                          </div>
                        }
                      </td>
                      <td class="mono">{{ l.batchNumber === '-' ? '—' : l.batchNumber }}</td>
                      <td class="muted">{{ l.expiryDate ? (l.expiryDate | day) : '—' }}</td>
                      <td class="right">{{ l.quantity }}</td>
                      <td class="right" [class.text-red]="l.returnedQuantity > 0">
                        {{ l.returnedQuantity }}
                      </td>
                      <td class="right">{{ l.unitPrice | money }}</td>
                      <td class="right">{{ l.discount | money }}</td>
                      <td class="right">{{ l.tax | money }}</td>
                      <td class="right strong">{{ l.lineTotal | money }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="8">{{ 'sales.total' | t }}</td>
                    <td class="right">{{ s.total | money }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div class="stack">
            <div class="card card-pad">
              <h3 class="mb">{{ 'sales.customerPayment' | t }}</h3>
              <dl class="dl" style="grid-template-columns:1fr">
                <div>
                  <dt>{{ 'sales.customer' | t }}</dt>
                  <dd>{{ s.customerName ?? ('ui.l.walkInCustomer' | t) }}</dd>
                </div>
                @for (p of s.payments; track $index) {
                  <div>
                    <dt>
                      {{
                        p.channel
                          ? ('till.channel.' + p.channel | t: null : p.channel)
                          : (p.method | label)
                      }}{{ p.reference ? ' · ' + p.reference : '' }}
                    </dt>
                    <dd>
                      {{ p.amount | money: p.currency ?? undefined }}
                      @if (p.currency && p.baseAmount !== undefined && p.amount !== p.baseAmount) {
                        <small class="muted block"
                          >@ {{ p.exchangeRate | num }} = {{ p.baseAmount | money }}</small
                        >
                      }
                    </dd>
                  </div>
                }
              </dl>
            </div>
            @if (s.prescription; as rx) {
              <div class="card card-pad">
                <h3 class="mb row">
                  <app-icon name="stethoscope" [size]="16" /> {{ 'sales.prescription' | t }}
                </h3>
                <dl class="dl" style="grid-template-columns:1fr 1fr">
                  <div>
                    <dt>{{ 'sales.prescriber' | t }}</dt>
                    <dd>{{ rx.prescriberName }}</dd>
                  </div>
                  <div>
                    <dt>{{ 'sales.registration' | t }}</dt>
                    <dd>{{ rx.prescriberRegistration }}</dd>
                  </div>
                  <div>
                    <dt>{{ 'sales.reference' | t }}</dt>
                    <dd>{{ rx.reference }}</dd>
                  </div>
                  <div>
                    <dt>{{ 'sales.patient' | t }}</dt>
                    <dd>{{ rx.patientName }}</dd>
                  </div>
                  <div>
                    <dt>{{ 'sales.prescriptionDate' | t }}</dt>
                    <dd data-testid="rx-date">
                      {{ rx.prescriptionDate ? (rx.prescriptionDate | day) : '—' }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ 'sales.dispensedBy' | t }}</dt>
                    <dd data-testid="dispensed-by">{{ s.dispensedBy ?? '—' }}</dd>
                  </div>
                </dl>
              </div>
            } @else if (s.prescriptionWithheld) {
              <div class="card card-pad" data-testid="rx-withheld">
                <h3 class="mb row">
                  <app-icon name="stethoscope" [size]="16" /> {{ 'sales.prescription' | t }}
                </h3>
                <p class="muted">
                  <app-icon name="lock" [size]="14" /> {{ 'sales.prescriptionWithheld' | t }}
                </p>
                @if (s.dispensedBy) {
                  <p class="muted">{{ 'sales.dispensedByName' | t: { name: s.dispensedBy } }}</p>
                }
              </div>
            }
          </div>
        </div>

        @if (s.fiscalDocuments?.length) {
          <div class="card mt" data-testid="fiscal-documents">
            <div class="card-head">
              <h3>{{ 'fiscal.documents' | t }}</h3>
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'fiscal.kind' | t }}</th>
                    <th>{{ 'fiscal.number' | t }}</th>
                    <th>{{ 'fiscal.status' | t }}</th>
                    <th class="right">{{ 'fiscal.total' | t }}</th>
                    <th class="right">{{ 'fiscal.vat' | t }}</th>
                    <th>{{ 'fiscal.issuedAt' | t }}</th>
                    <th class="right">{{ 'fiscal.attempts' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of s.fiscalDocuments; track d.uid) {
                    <tr>
                      <td>
                        {{ 'enum.' + d.kind | t }}
                        <div class="faint small">{{ d.sourceNumber }}</div>
                      </td>
                      <td>
                        <b>{{ d.receiptNumber ?? '—' }}</b>
                        @if (d.verificationCode) {
                          <div class="faint small">{{ d.verificationCode }}</div>
                        }
                      </td>
                      <td>
                        <app-status [value]="d.status" />
                        @if (d.lastError && d.status !== 'ISSUED') {
                          <div class="faint small" [attr.title]="d.lastError">
                            {{ 'fiscal.lastError' | t }}: {{ d.lastError }}
                          </div>
                        }
                      </td>
                      <td class="right">{{ d.total | money }}</td>
                      <td class="right">{{ d.taxTotal | money }}</td>
                      <td class="muted">{{ d.issuedAt ? (d.issuedAt | when) : '—' }}</td>
                      <td class="right">{{ d.attempts }}</td>
                      <td class="right">
                        @if (d.status !== 'ISSUED' && session.can('sales.sell')) {
                          <button
                            class="btn sm"
                            type="button"
                            [disabled]="busy()"
                            (click)="resend(d.uid)"
                            data-testid="fiscal-retry"
                          >
                            {{ 'fiscal.retry' | t }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <app-attachments
          class="block mt"
          ownerType="SALE"
          [ownerUid]="s.uid"
          purpose="PRESCRIPTION"
          [canManage]="session.can('sales.sell')"
        />

        <app-modal [open]="printing()" [title]="'sales.receipt' | t" (closed)="printing.set(false)">
          <app-receipt [sale]="s" />
          <ng-container footer
            ><button class="btn primary" type="button" (click)="print()">
              <app-icon name="printer" [size]="16" /> {{ 'sales.print' | t }}
            </button></ng-container
          >
        </app-modal>
      } @else {
        <app-empty [for]="sale" icon="receipt" [title]="'sales.saleNotFound' | t" />
      }
    </div>

    <app-modal
      [open]="returning()"
      [title]="'sales.returnItems' | t"
      [wide]="true"
      (closed)="returning.set(false)"
    >
      <div class="stack">
        <p class="muted">{{ 'restock.explain' | t }}</p>
        <div class="table-wrap" style="border:1px solid var(--border);border-radius:12px">
          <table class="table compact">
            <thead>
              <tr>
                <th>{{ 'sales.product' | t }}</th>
                <th>{{ 'sales.batch' | t }}</th>
                <th class="right">{{ 'sales.sold' | t }}</th>
                <th class="right">{{ 'sales.returnable' | t }}</th>
                <th class="right">{{ 'sales.return' | t }}</th>
                <th>{{ 'restock.goesTo' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (l of returnable(); track l.uid) {
                <tr>
                  <td>
                    {{ l.productName }}
                    @if (l.serialNumbers.length) {
                      <div class="serials">
                        @for (sn of returnableSerials(l); track sn) {
                          <label
                            class="serial-pick"
                            [class.on]="pickedSerials()[l.uid]?.includes(sn)"
                          >
                            <input
                              type="checkbox"
                              [checked]="
                                $safeNavigationMigration(pickedSerials()[l.uid]?.includes(sn))
                              "
                              (change)="toggleSerial(l, sn)"
                            />
                            <span class="mono">{{ sn }}</span>
                          </label>
                        }
                      </div>
                    }
                  </td>
                  <td class="mono">{{ l.batchNumber === '-' ? '—' : l.batchNumber }}</td>
                  <td class="right">{{ l.quantity }}</td>
                  <td class="right">{{ l.quantity - l.returnedQuantity }}</td>
                  <td class="right">
                    <input
                      class="input sm"
                      style="width:80px"
                      type="number"
                      min="0"
                      [max]="l.quantity - l.returnedQuantity"
                      [value]="quantities()[l.uid] ?? 0"
                      [readonly]="!!l.serialNumbers.length"
                      (input)="setQuantity(l, +$any($event.target).value)"
                    />
                  </td>
                  <td>
                    <select
                      class="select sm"
                      [attr.aria-label]="'restock.goesTo' | t"
                      [attr.data-testid]="'restock-' + l.uid"
                      [value]="dispositionOf(l)"
                      (change)="setDisposition(l, $any($event.target).value)"
                    >
                      <option value="SHELF" [disabled]="restricted(l)">
                        {{ 'restock.SHELF' | t }}
                      </option>
                      <option value="QUARANTINE">{{ 'restock.QUARANTINE' | t }}</option>
                      <option value="DAMAGED">{{ 'restock.DAMAGED' | t }}</option>
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="form-grid">
          <app-field [label]="'sales.reason' | t">
            <input
              class="input"
              [value]="reason()"
              (input)="reason.set($any($event.target).value)"
              [placeholder]="'sales.wrongItemAdverseReaction' | t"
            />
          </app-field>
          <app-field [label]="'sales.refundMethod' | t">
            <!-- The refund goes back the way the sale was paid (owner's rule, 23 Nov 2026): the
                 server splits it; the cashier does not choose. -->
            <p class="refund-ways" data-testid="refund-ways">
              {{ 'sales.refundGoesBack' | t }} <b>{{ paidWays() }}</b>
            </p>
          </app-field>
          @if (foreignTenders().length) {
            <app-field [label]="'sales.refundIn' | t">
              <select
                class="select"
                [value]="refundCurrency() ?? ''"
                [disabled]="!foreignRefundAllowed()"
                (change)="refundCurrency.set($any($event.target).value || null)"
              >
                <option value="">{{ settings.currency() }}</option>
                @for (tender of foreignTenders(); track tender.currency) {
                  <option [value]="tender.currency">{{ tender.currency }}</option>
                }
              </select>
            </app-field>
          }
        </div>
        @if (foreignTenders().length && !foreignRefundAllowed()) {
          <p class="muted small">{{ foreignRefundBlockedReason() | t }}</p>
        }
        @if (foreignEstimate(); as e) {
          <div class="notice tone-blue fx-estimate">
            {{
              'sales.foreignRefundEstimate' | t: { amount: e.amount, base: e.base, rate: e.rate }
            }}
          </div>
        }
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="returning.set(false)">
          {{ 'sales.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="submitReturn()">
          {{ 'sales.recordReturn' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .refund-ways {
      margin: 0;
      padding: 9px 0;
      color: var(--muted);
    }
    .fx-estimate {
      margin-top: 12px;
    }
    .serials {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .serial-pick {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .serial-pick.on {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, transparent);
    }
  `,
})
export default class SaleDetailPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  readonly uid = input.required<string>();
  protected readonly sale = loaded<Sale>(() => ({ path: `/sales/${this.uid()}` }));
  protected readonly printing = signal(false);
  protected readonly returning = signal(false);
  protected readonly busy = signal(false);
  protected readonly quantities = signal<Partial<Record<string, number>>>({});
  /** Where each returned line goes: back on the shelf, held aside, or written off as damaged. */
  protected readonly dispositions = signal<Partial<Record<string, Disposition>>>({});
  protected readonly reason = signal('');
  protected readonly refundCurrency = signal<string | null>(null);

  /** The ways the sale was paid, as the refund goes back: "Cash, Mobile money". */
  protected readonly paidWays = computed(() => {
    const methods = [...new Set((this.sale.value()?.payments ?? []).map((p) => p.method))];
    return methods.map((m) => this.translations.t('enum.' + m, undefined, m)).join(', ');
  });
  protected readonly settings = inject(SettingsStore);
  private readonly translations = inject(Translations);

  /** The foreign currencies the sale was tendered in, each with the rate locked at the sale. */
  protected readonly foreignTenders = computed(() => {
    const base = this.settings.currency();
    const seen = new Map<string, number>();
    for (const p of this.sale.value()?.payments ?? []) {
      if (p.currency && p.currency !== base && p.exchangeRate && !seen.has(p.currency)) {
        seen.set(p.currency, p.exchangeRate);
      }
    }
    return [...seen].map(([currency, rate]) => ({ currency, rate }));
  });

  /** Credit, insurance and account credit are kept in the base currency, as the API insists. */
  private readonly baseOnlyPayment = computed(() =>
    (this.sale.value()?.payments ?? []).some(
      (p) => !['CASH', 'CARD', 'MOBILE_MONEY'].includes(p.method),
    ),
  );

  /** A refund in a foreign currency goes back one way only, and never to an account. */
  protected readonly foreignRefundAllowed = computed(
    () =>
      !this.baseOnlyPayment() &&
      new Set((this.sale.value()?.payments ?? []).map((p) => p.method)).size === 1,
  );

  protected readonly foreignRefundBlockedReason = computed(() =>
    this.baseOnlyPayment() ? 'sales.foreignRefundSaleBlocked' : 'sales.foreignRefundSplitBlocked',
  );

  /** What the customer gets back in the chosen currency, at the sale's rate. */
  protected readonly foreignEstimate = computed(() => {
    const currency = this.foreignRefundAllowed() ? this.refundCurrency() : null;
    const tender = this.foreignTenders().find((t) => t.currency === currency);
    if (!tender) {
      return null;
    }
    const base = this.returnable().reduce(
      (sum, l) => sum + ((this.quantities()[l.uid] ?? 0) * l.lineTotal) / l.quantity,
      0,
    );
    if (base <= 0) {
      return null;
    }
    return {
      amount: formatMoney(base / tender.rate, tender.currency),
      base: formatMoney(base, this.settings.currency()),
      rate: tender.rate.toLocaleString('en-US', { maximumFractionDigits: 4 }),
    };
  });
  protected readonly returnable = computed(() =>
    (this.sale.value()?.lines ?? []).filter((l) => l.quantity > l.returnedQuantity),
  );

  /** The serials of a line picked to come back, by sale line uid. */
  protected readonly pickedSerials = signal<Partial<Record<string, string[]>>>({});

  /** Sends a fiscal document the tax authority refused (or has not answered) again. */
  protected async resend(documentUid: string): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post(`/fiscal/documents/${documentUid}/retry`, {});
      this.toasts.success(this.translations.t('fiscal.sent'));
      await this.sale.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected returnableSerials(line: SaleLine): string[] {
    return line.serialNumbers.filter((sn) => !line.returnedSerialNumbers.includes(sn));
  }

  /** Ticking a serial sets the line's return quantity to the number ticked. */
  protected toggleSerial(line: SaleLine, serial: string): void {
    const current = this.pickedSerials()[line.uid] ?? [];
    const next = current.includes(serial)
      ? current.filter((sn) => sn !== serial)
      : [...current, serial];
    this.pickedSerials.update((p) => ({ ...p, [line.uid]: next }));
    this.quantities.update((q) => ({ ...q, [line.uid]: next.length }));
  }

  /** A prescription or controlled medicine never goes back on the shelf (owner's rule). */
  protected restricted(line: SaleLine): boolean {
    return line.schedule === 'PRESCRIPTION' || line.schedule === 'CONTROLLED';
  }

  protected dispositionOf(line: SaleLine): Disposition {
    return this.dispositions()[line.uid] ?? (this.restricted(line) ? 'QUARANTINE' : 'SHELF');
  }

  protected setDisposition(line: SaleLine, disposition: Disposition): void {
    this.dispositions.update((d) => ({ ...d, [line.uid]: disposition }));
  }

  protected openReturn(): void {
    this.quantities.set({});
    this.dispositions.set({});
    this.pickedSerials.set({});
    this.reason.set('');
    this.refundCurrency.set(null);
    this.returning.set(true);
  }

  protected setQuantity(line: SaleLine, quantity: number): void {
    const max = line.quantity - line.returnedQuantity;
    this.quantities.update((q) => ({
      ...q,
      [line.uid]: Math.min(Math.max(Math.floor(quantity) || 0, 0), max),
    }));
  }

  protected async submitReturn(): Promise<void> {
    const lines = Object.entries(this.quantities())
      .filter((entry): entry is [string, number] => (entry[1] ?? 0) > 0)
      .map(([saleLineUid, quantity]) => ({
        saleLineUid,
        quantity,
        serialNumbers: this.pickedSerials()[saleLineUid] ?? null,
        disposition: this.dispositionOf(
          this.returnable().find((l) => l.uid === saleLineUid) as SaleLine,
        ),
      }));
    if (!lines.length) {
      this.toasts.error(this.translations.t('toast.returnNeedsQuantity'));
      return;
    }
    if (!this.reason().trim()) {
      this.toasts.error(this.translations.t('toast.returnNeedsReason'));
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.api.post<SaleReturn>(`/sales/${this.uid()}/returns`, {
        reason: this.reason(),
        refundCurrency: this.foreignRefundAllowed() ? this.refundCurrency() : null,
        lines,
      });
      this.toasts.success(this.returnRecorded(result));
      this.returning.set(false);
      await this.sale.reload();
    } finally {
      this.busy.set(false);
    }
  }

  /** "SRN-… recorded · refund TZS 10,000", plus the foreign amount and exchange gain or loss. */
  private returnRecorded(r: SaleReturn): string {
    if (!r.refundCurrency && (r.refunds?.length ?? 0) > 1) {
      // One return can go back several ways: "Cash TZS 4,000 · Mobile money TZS 6,000".
      return this.translations.t('toast.returnRecordedSplit', {
        number: r.number,
        refunds: (r.refunds ?? [])
          .map(
            (x) =>
              `${this.translations.t('enum.' + x.method, undefined, x.method)} ${formatMoney(x.amount, this.settings.currency())}`,
          )
          .join(' · '),
      });
    }
    if (!r.refundCurrency) {
      return this.translations.t('toast.returnRecorded', {
        number: r.number,
        amount: formatMoney(r.refundTotal, this.settings.currency()),
      });
    }
    const difference = r.fxDifference ?? 0;
    let key = 'toast.returnRecordedForeign';
    if (difference > 0) {
      key = 'toast.returnRecordedFxLoss';
    } else if (difference < 0) {
      key = 'toast.returnRecordedFxGain';
    }
    return this.translations.t(key, {
      number: r.number,
      amount: formatMoney(r.refundForeignAmount, r.refundCurrency),
      difference: formatMoney(Math.abs(difference), this.settings.currency()),
    });
  }

  protected print(): void {
    window.print();
  }
}
