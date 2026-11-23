import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { ClaimView, PayerView, RemittanceView } from '../../core/api/credit.models';
import { loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

/** Payments from insurers, spread over approved claims oldest first or as chosen. */
@Component({
  selector: 'app-remittances',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'insurance.remittances' | t }}</h1>
          <p class="sub">{{ 'insurance.moneyReceivedFromInsurersAgainst' | t }}</p>
        </div>
        <div class="actions">
          @if (session.can('finance.manage')) {
            <button class="btn primary" type="button" (click)="openNew()">
              <app-icon name="cash" [size]="16" /> {{ 'insurance.recordRemittance' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'insurance.remittance' | t }}</th>
                <th>{{ 'insurance.payer' | t }}</th>
                <th>{{ 'insurance.date' | t }}</th>
                <th>{{ 'insurance.reference' | t }}</th>
                <th>{{ 'insurance.claimsSettled' | t }}</th>
                <th class="right">{{ 'insurance.amount' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of remittances.items(); track r.uid) {
                <tr>
                  <td class="mono">
                    <b>{{ r.number }}</b>
                  </td>
                  <td>{{ r.payerName }}</td>
                  <td>{{ r.date | day }}</td>
                  <td class="mono">{{ r.reference ?? '—' }}</td>
                  <td class="muted">
                    @for (a of entries(r); track a[0]; let last = $last) {
                      <span class="mono">{{ a[0] }}</span> {{ a[1] | money }}{{ last ? '' : ' · ' }}
                    }
                  </td>
                  <td class="right">
                    <b>{{ r.amount | money }}</b>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <app-empty
                      [for]="remittances"
                      icon="cash"
                      [title]="'insurance.noRemittancesYet' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="remittances" />
      </div>
    </div>

    <app-modal
      [open]="open()"
      [title]="'insurance.recordRemittance' | t"
      [wide]="true"
      (closed)="open.set(false)"
    >
      <div class="form-grid">
        <div class="field">
          <label>{{ 'insurance.payer' | t }}</label>
          <select
            class="select"
            [value]="payerUid()"
            (change)="pickPayer($any($event.target).value)"
          >
            @for (p of payers.value() ?? []; track p.uid) {
              <option [value]="p.uid">{{ p.name }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'insurance.amount' | t }}</label
          ><input
            class="input"
            type="number"
            min="0"
            step="any"
            [value]="amount()"
            (input)="amount.set(+$any($event.target).value)"
          />
        </div>
        <div class="field">
          <label>{{ 'insurance.reference' | t }}</label
          ><input
            class="input"
            [value]="reference()"
            (input)="reference.set($any($event.target).value)"
            [placeholder]="'insurance.eftChequeNumber' | t"
          />
        </div>
        <div class="field">
          <label>{{ 'insurance.date' | t }}</label
          ><input
            class="input"
            type="date"
            [value]="date()"
            (change)="date.set($any($event.target).value)"
          />
        </div>
      </div>
      <div class="payable">
        <div class="head">
          <b>{{ 'insurance.approvedClaimsAwaitingPayment' | t }}</b>
          <label class="check"
            ><input type="checkbox" [checked]="manual()" (change)="manual.set(!manual())" />
            {{ 'insurance.allocateByHand' | t }}</label
          >
        </div>
        <table class="table compact">
          <thead>
            <tr>
              <th>{{ 'insurance.claim' | t }}</th>
              <th>{{ 'insurance.patient' | t }}</th>
              <th class="right">{{ 'insurance.due' | t }}</th>
              @if (manual()) {
                <th class="right">{{ 'insurance.pay' | t }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (c of payable(); track c.uid) {
              <tr>
                <td class="mono">{{ c.number }}</td>
                <td>{{ c.patientName }}</td>
                <td class="right">{{ due(c) | money }}</td>
                @if (manual()) {
                  <td class="right">
                    <input
                      class="input sm num"
                      type="number"
                      min="0"
                      step="any"
                      [value]="split()[c.uid] || 0"
                      (input)="setSplit(c.uid, +$any($event.target).value)"
                    />
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="muted">
                  {{ 'insurance.nothingApprovedIsAwaitingPayment' | t }}
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">{{ 'insurance.dueInTotal' | t }}</td>
              <td class="right">{{ totalDue() | money }}</td>
              @if (manual()) {
                <td class="right" [class.bad]="splitTotal() !== amount()">
                  {{ splitTotal() | money }}
                </td>
              }
            </tr>
          </tfoot>
        </table>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          [disabled]="busy() || amount() <= 0"
          (click)="save()"
        >
          {{ 'insurance.record' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .payable {
      margin-top: 16px;
    }
    .payable .head {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .num {
      width: 120px;
      text-align: right;
    }
    .bad {
      color: var(--red);
    }
  `,
})
export default class RemittancesPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly remittances = pagedList<RemittanceView>(() => ({
    path: '/insurance/remittances',
    options: { noBranch: true },
  }));
  protected readonly payers = loaded<PayerView[]>(() => ({
    path: '/insurance/payers',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly manual = signal(false);
  protected readonly payerUid = signal('');
  protected readonly amount = signal(0);
  protected readonly reference = signal('');
  protected readonly date = signal(new Date().toISOString().slice(0, 10));
  protected readonly split = signal<Record<string, number>>({});
  private readonly approved = loaded<{ items: ClaimView[] }>(() =>
    this.open() && this.payerUid()
      ? {
          path: '/insurance/claims',
          query: { payerUid: this.payerUid(), limit: 100 },
          options: { noBranch: true },
        }
      : null,
  );
  protected readonly payable = computed(() =>
    (this.approved.value()?.items ?? []).filter(
      (c) => (c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED') && this.due(c) > 0,
    ),
  );
  protected readonly totalDue = computed(() => this.payable().reduce((s, c) => s + this.due(c), 0));
  protected readonly splitTotal = computed(
    () => Math.round(Object.values(this.split()).reduce((s, v) => s + (v || 0), 0) * 100) / 100,
  );

  protected entries(r: RemittanceView): [string, number][] {
    return Object.entries(r.allocations ?? {});
  }

  protected due(c: ClaimView): number {
    return Math.round(((c.approved ?? 0) - c.paid) * 100) / 100;
  }

  protected openNew(): void {
    this.pickPayer(this.payers.value()?.[0]?.uid ?? '');
    this.reference.set('');
    this.manual.set(false);
    this.open.set(true);
  }

  protected pickPayer(uid: string): void {
    this.payerUid.set(uid);
    this.split.set({});
    this.amount.set(0);
  }

  protected setSplit(uid: string, value: number): void {
    this.split.update((s) => ({ ...s, [uid]: value }));
  }

  protected async save(): Promise<void> {
    const perClaim = this.manual()
      ? Object.fromEntries(Object.entries(this.split()).filter(([, v]) => v > 0))
      : {};
    this.busy.set(true);
    try {
      const settled = await this.api.post<ClaimView[]>(
        '/insurance/remittances',
        {
          payerUid: this.payerUid(),
          amount: this.amount(),
          reference: this.reference() || null,
          date: this.date(),
          perClaim,
        },
        { noBranch: true },
      );
      this.toasts.success(
        this.translations.t('toast.remittanceRecorded', { count: settled.length }),
      );
      this.open.set(false);
      await this.remittances.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
