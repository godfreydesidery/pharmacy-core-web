import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, apiUrl } from '../../core/api/api.service';
import { ClaimBatchView, PayerView } from '../../core/api/credit.models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

/** Claim batches: gather a payer's draft claims for a period, submit, and export CSV or FHIR R4. */
@Component({
  selector: 'app-claim-batches',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'insurance.claimBatches' | t }}</h1>
          <p class="sub">
            {{ 'insurance.submitAPeriodSClaims' | t }}
          </p>
        </div>
        <div class="actions">
          @if (session.can('finance.manage')) {
            <button class="btn primary" type="button" (click)="openNew()">
              <app-icon name="layers" [size]="16" /> {{ 'insurance.newBatch' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'insurance.batch' | t }}</th>
                <th>{{ 'insurance.payer' | t }}</th>
                <th>{{ 'insurance.period' | t }}</th>
                <th class="right">{{ 'insurance.claims' | t }}</th>
                <th class="right">{{ 'insurance.claimed' | t }}</th>
                <th class="right">{{ 'insurance.approved' | t }}</th>
                <th class="right">{{ 'insurance.paid' | t }}</th>
                <th>{{ 'insurance.status' | t }}</th>
                <th class="right">{{ 'insurance.export' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (b of batches.value() ?? []; track b.uid) {
                <tr>
                  <td>
                    <b class="mono">{{ b.number }}</b
                    ><small class="muted block"
                      >{{ 'insurance.submitted' | t }} {{ b.submittedAt | when }}</small
                    >
                  </td>
                  <td>{{ b.payerName }}</td>
                  <td>{{ b.periodFrom | day }} – {{ b.periodTo | day }}</td>
                  <td class="right">{{ b.claimCount }}</td>
                  <td class="right">{{ b.claimed | money }}</td>
                  <td class="right">{{ b.approved | money }}</td>
                  <td class="right">{{ b.paid | money }}</td>
                  <td>
                    <span
                      class="badge dot"
                      [class]="
                        'badge dot ' +
                        (b.status === 'SETTLED'
                          ? 'green'
                          : b.status === 'ADJUDICATING'
                            ? 'amber'
                            : 'blue')
                      "
                      >{{ b.status | label }}</span
                    >
                  </td>
                  <td class="right nowrap">
                    <button class="btn sm" type="button" (click)="download(b, 'CSV')">
                      <app-icon name="download" [size]="14" /> CSV
                    </button>
                    <button class="btn sm" type="button" (click)="download(b, 'JSON')">
                      <app-icon name="activity" [size]="14" /> FHIR
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9">
                    <app-empty
                      [loading]="batches.loading()"
                      icon="layers"
                      [title]="'insurance.noBatchesYet' | t"
                      [text]="'ui.empty.batches' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <app-modal [open]="open()" [title]="'insurance.newClaimBatch' | t" (closed)="open.set(false)">
      <div class="form-grid">
        <div class="field full">
          <label>{{ 'insurance.payer' | t }}</label>
          <select
            class="select"
            [value]="payerUid()"
            (change)="payerUid.set($any($event.target).value)"
          >
            @for (p of payers.value() ?? []; track p.uid) {
              <option [value]="p.uid">{{ p.name }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'insurance.from' | t }}</label
          ><input
            class="input"
            type="date"
            [value]="from()"
            (change)="from.set($any($event.target).value)"
          />
        </div>
        <div class="field">
          <label>{{ 'insurance.to' | t }}</label
          ><input
            class="input"
            type="date"
            [value]="to()"
            (change)="to.set($any($event.target).value)"
          />
        </div>
        <p class="muted full">
          {{ 'insurance.allOfThePayerS' | t }}
        </p>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          [disabled]="busy() || !payerUid()"
          (click)="create()"
        >
          {{ 'insurance.createAmpSubmit' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .block {
      display: block;
    }
    .nowrap {
      white-space: nowrap;
    }
    .nowrap .btn + .btn {
      margin-left: 6px;
    }
  `,
})
export default class BatchesPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly batches = loaded<ClaimBatchView[]>(() => ({
    path: '/insurance/batches',
    options: { noBranch: true },
  }));
  protected readonly payers = loaded<PayerView[]>(() => ({
    path: '/insurance/payers',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly payerUid = signal('');
  protected readonly from = signal(firstOfMonth());
  protected readonly to = signal(new Date().toISOString().slice(0, 10));

  protected openNew(): void {
    this.payerUid.set(this.payers.value()?.[0]?.uid ?? '');
    this.open.set(true);
  }

  protected async create(): Promise<void> {
    this.busy.set(true);
    try {
      const batch = await this.api.post<ClaimBatchView>(
        '/insurance/batches',
        { payerUid: this.payerUid(), from: this.from(), to: this.to() },
        { noBranch: true },
      );
      this.toasts.success(
        this.translations.t('toast.batchSubmitted', {
          number: batch.number,
          count: batch.claimCount,
        }),
      );
      this.open.set(false);
      await this.batches.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async download(batch: ClaimBatchView, format: 'CSV' | 'JSON'): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(apiUrl(`/insurance/batches/${batch.uid}/export`), {
        params: { format },
        responseType: 'blob',
      }),
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${batch.number}${format === 'JSON' ? '.fhir.json' : '.csv'}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
