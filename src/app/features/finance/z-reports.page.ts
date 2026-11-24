import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Branch, FiscalDocument } from '../../core/api/models';
import { loaded, pagedList } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

/**
 * Finance → Z reports (STD-1): each branch's day closed with the tax authority, newest first, with
 * the receipts and credit notes it closed. The scheduled job closes past days by itself; a manager
 * may close today by hand when the branch shuts.
 */
@Component({
  selector: 'app-z-reports',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'fiscal.zReports' | t }}</h1>
          <p class="sub">{{ 'fiscal.zReportsSub' | t }}</p>
        </div>
      </div>
      @if (session.can('finance.manage')) {
        <div class="card card-pad mb">
          <div class="row" style="gap: 8px; align-items: flex-end; flex-wrap: wrap">
            <div class="field">
              <label for="close-branch">{{ 'fiscal.branch' | t }}</label>
              <select
                id="close-branch"
                class="select"
                [value]="closeBranch()"
                (change)="chosenBranch.set($any($event.target).value)"
                data-testid="close-branch"
              >
                @for (b of branchList(); track b.uid) {
                  <option [value]="b.uid">{{ b.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="close-day">{{ 'fiscal.day' | t }}</label>
              <input
                id="close-day"
                class="input"
                type="date"
                [max]="today"
                [value]="closeDay()"
                (change)="closeDay.set($any($event.target).value)"
              />
            </div>
            <button
              class="btn primary"
              type="button"
              [disabled]="busy() || !closeBranch()"
              (click)="close()"
              data-testid="close-day"
            >
              <app-icon name="lock" [size]="16" /> {{ 'fiscal.closeDay' | t }}
            </button>
          </div>
          <p class="muted small mt">{{ 'fiscal.closeDayHint' | t }}</p>
        </div>
      }
      <div class="card">
        <div class="toolbar">
          <select
            class="select"
            style="width:auto"
            (change)="branch.set($any($event.target).value)"
            [attr.aria-label]="'fiscal.branch' | t"
          >
            <option value="">{{ 'common.allBranches' | t }}</option>
            @for (b of branchList(); track b.uid) {
              <option [value]="b.uid">{{ b.name }}</option>
            }
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'fiscal.day' | t }}</th>
                <th>{{ 'fiscal.branch' | t }}</th>
                <th>{{ 'fiscal.number' | t }}</th>
                <th>{{ 'fiscal.status' | t }}</th>
                <th class="right">{{ 'fiscal.receipts' | t }}</th>
                <th class="right">{{ 'fiscal.creditNotes' | t }}</th>
                <th class="right">{{ 'fiscal.total' | t }}</th>
                <th class="right">{{ 'fiscal.vat' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (z of list.items(); track z.uid) {
                <tr data-testid="z-report">
                  <td>{{ z.businessDate | day }}</td>
                  <td>{{ branchName(z.branchUid) }}</td>
                  <td>
                    <b>{{ z.receiptNumber ?? z.sourceNumber }}</b>
                    @if (z.globalCounter !== null) {
                      <div class="faint small">GC {{ z.globalCounter }}</div>
                    }
                  </td>
                  <td>
                    <app-status [value]="z.status" />
                    @if (z.lastError && z.status !== 'ISSUED') {
                      <div class="faint small">{{ z.lastError }}</div>
                    }
                  </td>
                  <td class="right">
                    {{ z.z?.receipts ?? 0 }}
                    <div class="faint small">{{ z.z?.receiptsTotal ?? 0 | money }}</div>
                  </td>
                  <td class="right">
                    {{ z.z?.creditNotes ?? 0 }}
                    <div class="faint small">{{ z.z?.creditNotesTotal ?? 0 | money }}</div>
                  </td>
                  <td class="right strong">{{ z.total | money }}</td>
                  <td class="right">{{ z.taxTotal | money }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <app-empty [for]="list" icon="receipt" [title]="'fiscal.noZReports' | t" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="list" />
      </div>
    </div>
  `,
})
export default class ZReportsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly today = isoDay();
  protected readonly branch = signal('');
  protected readonly closeDay = signal(isoDay());
  protected readonly chosenBranch = signal('');
  protected readonly busy = signal(false);
  protected readonly branches = loaded<Branch[]>(() => ({
    path: '/branches',
    options: { noBranch: true },
  }));
  protected readonly branchList = computed(() => this.branches.value() ?? []);
  /** The branch whose day closes: as chosen, else the current one, else the first. */
  protected readonly closeBranch = computed(
    () => this.chosenBranch() || this.session.branch()?.uid || this.branchList()[0]?.uid || '',
  );
  protected readonly list = pagedList<FiscalDocument>(() => ({
    path: '/fiscal/z-reports',
    query: { branchUid: this.branch() },
  }));

  protected branchName(uid: string): string {
    return this.branchList().find((b) => b.uid === uid)?.name ?? '—';
  }

  protected async close(): Promise<void> {
    this.busy.set(true);
    try {
      const report = await this.api.post<FiscalDocument>(
        '/fiscal/z-reports',
        { branchUid: this.closeBranch(), day: this.closeDay() || null },
        { noBranch: true },
      );
      this.toasts.success(
        this.translations.t('fiscal.dayClosed', {
          number: report.receiptNumber ?? report.sourceNumber,
        }),
      );
      await this.list.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
