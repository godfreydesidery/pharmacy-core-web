import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import {
  CLAIM_TONES,
  ClaimStatus,
  ClaimTotals,
  ClaimView,
  PayerView,
} from '../../core/api/credit.models';
import { loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

const STATUSES: ClaimStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'PAID',
  'VOIDED',
];

interface Decision {
  productUid: string | null;
  productName: string | null;
  amount: number;
  approved: number;
  reason: string;
}

/** Claims raised by insured sales: filter, inspect and record the payer's decision. */
@Component({
  selector: 'app-claims',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'insurance.insuranceClaims' | t }}</h1>
          <p class="sub">
            {{ 'insurance.eachInsuredSaleRaisesA' | t }}
          </p>
        </div>
      </div>

      @if (totals.value(); as t) {
        <div class="grid kpis">
          <app-stat
            [label]="'insurance.pendingClaims' | t"
            [value]="t.pendingClaims"
            icon="file"
            tone="blue"
            [caption]="'insurance.notYetPaid' | t"
          />
          <app-stat
            [label]="'insurance.pendingAmount' | t"
            [value]="t.pendingAmount | compactMoney"
            [hint]="t.pendingAmount | money"
            icon="wallet"
            tone="purple"
            [caption]="'insurance.claimedOrApprovedUnpaid' | t"
          />
          <app-stat
            [label]="'insurance.draftsToSubmit' | t"
            [value]="t.draftClaims"
            icon="clipboard"
            tone="amber"
            [caption]="'insurance.readyForTheNextBatch' | t"
          />
          <app-stat
            [label]="'insurance.approvedUnpaid' | t"
            [value]="t.approvedUnpaid | compactMoney"
            [hint]="t.approvedUnpaid | money"
            icon="check"
            tone="green"
            [caption]="'insurance.awaitingRemittance' | t"
          />
        </div>
      }

      <div class="card">
        <div class="toolbar">
          <select class="select" [value]="payer()" (change)="payer.set($any($event.target).value)">
            <option value="">{{ 'insurance.allPayers' | t }}</option>
            @for (p of payers.value() ?? []; track p.uid) {
              <option [value]="p.uid">{{ p.name }}</option>
            }
          </select>
          <div class="chips">
            <button type="button" class="chip" [class.active]="!status()" (click)="status.set('')">
              {{ 'insurance.all' | t }}
            </button>
            @for (s of statuses; track s) {
              <button
                type="button"
                class="chip"
                [class.active]="status() === s"
                (click)="status.set(s)"
              >
                {{ s | label }}
              </button>
            }
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'insurance.claim' | t }}</th>
                <th>{{ 'insurance.patient' | t }}</th>
                <th>{{ 'insurance.payer' | t }}</th>
                <th>{{ 'insurance.sale' | t }}</th>
                <th class="right">{{ 'insurance.claimed' | t }}</th>
                <th class="right">{{ 'insurance.approved' | t }}</th>
                <th class="right">{{ 'insurance.paid' | t }}</th>
                <th>{{ 'insurance.status' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of list.items(); track c.uid) {
                <tr class="link-row" (click)="show(c)">
                  <td>
                    <b class="mono">{{ c.number }}</b
                    ><small class="muted block"
                      >{{ c.createdAt | day
                      }}{{ c.batchNumber ? ' · ' + c.batchNumber : '' }}</small
                    >
                  </td>
                  <td>
                    {{ c.patientName }}<small class="muted block mono">{{ c.memberNumber }}</small>
                  </td>
                  <td>{{ c.payerName }}</td>
                  <td class="mono">{{ c.saleNumber }}</td>
                  <td class="right">{{ c.claimed | money }}</td>
                  <td class="right">{{ c.approved === null ? '—' : (c.approved | money) }}</td>
                  <td class="right">{{ c.paid | money }}</td>
                  <td>
                    <span class="badge dot" [class]="'badge dot ' + tones[c.status]">{{
                      c.status | label
                    }}</span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <app-empty
                      [loading]="list.loading()"
                      icon="file"
                      [title]="'insurance.noClaims' | t"
                      [text]="'ui.empty.claims' | t"
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
    </div>

    <app-drawer
      [open]="!!selected()"
      [title]="selected()?.number ?? ''"
      [subtitle]="selected()?.payerName + ' · ' + (selected()?.status | label)"
      (closed)="selected.set(null)"
    >
      @if (selected(); as c) {
        <dl class="facts">
          <div>
            <dt>{{ 'insurance.patient' | t }}</dt>
            <dd>
              {{ c.patientName }} <span class="mono muted">{{ c.memberNumber }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ 'insurance.sale' | t }}</dt>
            <dd class="mono">{{ c.saleNumber }}</dd>
          </div>
          <div>
            <dt>{{ 'insurance.preAuthorisation' | t }}</dt>
            <dd>{{ c.preauthNumber ?? '—' }}</dd>
          </div>
          <div>
            <dt>{{ 'insurance.diagnosisIcd10' | t }}</dt>
            <dd class="mono">{{ c.diagnosisCode ?? '—' }}</dd>
          </div>
        </dl>
        <table class="table compact">
          <thead>
            <tr>
              <th>{{ 'insurance.item' | t }}</th>
              <th class="right">{{ 'insurance.claimed' | t }}</th>
              <th class="right">{{ 'insurance.approved' | t }}</th>
              <th>{{ 'insurance.reason' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (d of decisions(); track $index; let i = $index) {
              <tr>
                <td>{{ d.productName }}</td>
                <td class="right">{{ d.amount | money }}</td>
                <td class="right">
                  @if (canDecide()) {
                    <input
                      class="input sm num"
                      type="number"
                      min="0"
                      step="any"
                      [value]="d.approved"
                      (input)="setApproved(i, +$any($event.target).value)"
                      [disabled]="d.amount <= 0"
                    />
                  } @else {
                    {{ d.approved | money }}
                  }
                </td>
                <td>
                  @if (canDecide() && d.approved < d.amount) {
                    <input
                      class="input sm"
                      [value]="d.reason"
                      (input)="setReason(i, $any($event.target).value)"
                      [placeholder]="'insurance.whyRejected' | t"
                    />
                  } @else {
                    <span class="muted">{{ d.reason }}</span>
                  }
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td>{{ 'insurance.total' | t }}</td>
              <td class="right">{{ c.claimed | money }}</td>
              <td class="right">{{ approvedTotal() | money }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        @if (canDecide()) {
          @if (rejected() > 0) {
            <div class="choice">
              <b>{{ rejected() | money }} {{ 'insurance.rejectedWhereDoesItGo' | t }}</b>
              <label class="check"
                ><input
                  type="radio"
                  name="rej"
                  [checked]="rejectedTo() === 'WRITE_OFF'"
                  (change)="rejectedTo.set('WRITE_OFF')"
                />
                {{ 'insurance.writeOffInsuranceRejections' | t }}</label
              >
              <label class="check"
                ><input
                  type="radio"
                  name="rej"
                  [checked]="rejectedTo() === 'PATIENT_ACCOUNT'"
                  (change)="rejectedTo.set('PATIENT_ACCOUNT')"
                  [disabled]="!c.customerUid"
                />
                {{ 'insurance.chargeThePatientSAccount' | t }}</label
              >
            </div>
          }
          <div class="field">
            <label>{{ 'insurance.note' | t }}</label
            ><input
              class="input"
              [value]="note()"
              (input)="note.set($any($event.target).value)"
              [placeholder]="'insurance.payerReferenceReviewNotes' | t"
            />
          </div>
        }
      }
      <ng-container footer>
        @if (canDecide()) {
          <button class="btn danger" type="button" [disabled]="busy()" (click)="adjudicate(true)">
            {{ 'insurance.rejectAll' | t }}
          </button>
          <button class="btn primary" type="button" [disabled]="busy()" (click)="adjudicate(false)">
            {{ 'insurance.recordDecision' | t }}
          </button>
        } @else {
          <button class="btn" type="button" (click)="selected.set(null)">
            {{ 'common.close' | t }}
          </button>
        }
      </ng-container>
    </app-drawer>
  `,
  styles: `
    .link-row {
      cursor: pointer;
    }
    .block {
      display: block;
    }
    .facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 0 0 16px;
    }
    .facts dt {
      font-size: 12px;
      color: var(--muted);
    }
    .facts dd {
      margin: 2px 0 0;
      font-weight: 550;
    }
    .num {
      width: 110px;
      text-align: right;
    }
    .choice {
      display: grid;
      gap: 6px;
      margin: 14px 0;
      padding: 12px;
      border-radius: 12px;
      background: var(--surface-2, var(--bg));
    }
  `,
})
export default class ClaimsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly statuses = STATUSES;
  protected readonly tones = CLAIM_TONES;
  protected readonly status = signal('');
  protected readonly payer = signal('');
  protected readonly selected = signal<ClaimView | null>(null);
  protected readonly decisions = signal<Decision[]>([]);
  protected readonly rejectedTo = signal<'WRITE_OFF' | 'PATIENT_ACCOUNT'>('WRITE_OFF');
  protected readonly note = signal('');
  protected readonly busy = signal(false);

  protected readonly totals = loaded<ClaimTotals>(() => ({
    path: '/insurance/claims/totals',
    options: { noBranch: true },
  }));
  protected readonly payers = loaded<PayerView[]>(() => ({
    path: '/insurance/payers',
    options: { noBranch: true },
  }));
  protected readonly list = pagedList<ClaimView>(() => ({
    path: '/insurance/claims',
    query: { status: this.status(), payerUid: this.payer() },
    options: { noBranch: true },
  }));

  protected readonly canDecide = computed(() => {
    const c = this.selected();
    return (
      !!c &&
      this.session.can('finance.manage') &&
      (c.status === 'DRAFT' ||
        c.status === 'SUBMITTED' ||
        c.status === 'APPROVED' ||
        c.status === 'PARTIALLY_APPROVED')
    );
  });
  protected readonly approvedTotal = computed(() =>
    this.decisions().reduce((sum, d) => sum + (d.amount > 0 ? d.approved : d.amount), 0),
  );
  protected readonly rejected = computed(() =>
    Math.max(0, Math.round(((this.selected()?.claimed ?? 0) - this.approvedTotal()) * 100) / 100),
  );

  protected show(c: ClaimView): void {
    this.selected.set(c);
    this.note.set(c.note ?? '');
    this.rejectedTo.set('WRITE_OFF');
    this.decisions.set(
      c.lines.map((l) => ({
        productUid: l.productUid,
        productName: l.productName,
        amount: l.amount,
        approved: l.approvedAmount ?? Math.max(0, l.amount),
        reason: l.rejectionReason ?? '',
      })),
    );
  }

  protected setApproved(i: number, value: number): void {
    this.decisions.update((all) =>
      all.map((d, j) =>
        j === i ? { ...d, approved: Math.max(0, Math.min(d.amount, value || 0)) } : d,
      ),
    );
  }

  protected setReason(i: number, reason: string): void {
    this.decisions.update((all) => all.map((d, j) => (j === i ? { ...d, reason } : d)));
  }

  protected async adjudicate(rejectAll: boolean): Promise<void> {
    const claim = this.selected();
    if (!claim) {
      return;
    }
    this.busy.set(true);
    try {
      const updated = await this.api.post<ClaimView>(
        `/insurance/claims/${claim.uid}/adjudicate`,
        {
          status: rejectAll ? 'REJECTED' : null,
          lines: this.decisions()
            .filter((d) => d.productUid)
            .map((d) => ({
              productUid: d.productUid,
              productName: d.productName,
              quantity: 0,
              amount: d.amount,
              approvedAmount: rejectAll ? 0 : d.approved,
              rejectionReason: d.reason || null,
            })),
          note: this.note() || null,
          rejectedTo: this.rejectedTo(),
        },
        { noBranch: true },
      );
      const status = this.translations.t(
        `enum.${updated.status}`,
        undefined,
        updated.status.replace('_', ' ').toLowerCase(),
      );
      this.toasts.success(
        this.translations.t('toast.claimUpdated', { number: updated.number, status }),
      );
      this.selected.set(null);
      await Promise.all([this.list.reload(), this.totals.reload()]);
    } finally {
      this.busy.set(false);
    }
  }
}
