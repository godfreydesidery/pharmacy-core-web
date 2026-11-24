import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import {
  Customer,
  DataSubjectRequest,
  DataSubjectRequestKind,
  DataSubjectRequestStatus,
} from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';

export const DSR_KINDS: readonly DataSubjectRequestKind[] = [
  'ACCESS',
  'CORRECTION',
  'ERASURE',
  'OBJECTION',
  'RESTRICTION',
];
export const DSR_STATUSES: readonly DataSubjectRequestStatus[] = ['OPEN', 'COMPLETED', 'REFUSED'];

/** The fields of the new-request form that show the API's refusal under them. */
const FIELDS_SHOWN = ['receivedOn', 'customerUid'];

/** What closing an open request records: its outcome, or why it was refused. */
type Closing = { request: DataSubjectRequest; action: 'complete' | 'refuse' };

/**
 * Administration → Data requests (STD-5): what customers asked about their personal data (a copy,
 * a correction, erasure, an objection, a restriction), each due 30 days after it was received.
 * Log one, then complete it with its outcome or refuse it with the reason. Exporting a customer's
 * data, correcting it or anonymising it from the Customers page records its request by itself.
 */
@Component({
  selector: 'app-privacy-requests',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'dsr.title' | t }}</h1>
          <p class="sub">{{ 'dsr.sub' | t }}</p>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" data-testid="dsr-new" (click)="openNew()">
            <app-icon name="plus" [size]="16" /> {{ 'dsr.new' | t }}
          </button>
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="field-inline"
            >{{ 'dsr.status' | t }}
            <select
              class="select"
              data-testid="dsr-status-filter"
              [value]="status()"
              (change)="status.set($any($event.target).value)"
            >
              <option value="">{{ 'dsr.all' | t }}</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ 'dsr.status.' + s | t }}</option>
              }
            </select></label
          >
          <label class="field-inline"
            >{{ 'dsr.kind' | t }}
            <select
              class="select"
              data-testid="dsr-kind-filter"
              [value]="kind()"
              (change)="kind.set($any($event.target).value)"
            >
              <option value="">{{ 'dsr.all' | t }}</option>
              @for (k of kinds; track k) {
                <option [value]="k">{{ 'dsr.kind.' + k | t }}</option>
              }
            </select></label
          >
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'dsr.number' | t }}</th>
                <th>{{ 'dsr.kind' | t }}</th>
                <th>{{ 'dsr.customer' | t }}</th>
                <th>{{ 'dsr.received' | t }}</th>
                <th>
                  {{ 'dsr.dueOn' | t }}
                  <small class="muted block">{{ 'dsr.dueHint' | t }}</small>
                </th>
                <th>{{ 'dsr.status' | t }}</th>
                <th>{{ 'dsr.outcome' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of list.items(); track r.uid) {
                <tr [class.overdue]="r.overdue" [attr.data-testid]="'dsr-row-' + r.number">
                  <td class="mono strong">{{ r.number }}</td>
                  <td>{{ 'dsr.kind.' + r.kind | t }}</td>
                  <td>
                    <b>{{ r.customerName ?? '—' }}</b>
                    <small class="muted block">{{ r.customerCode }}</small>
                  </td>
                  <td class="muted">{{ r.receivedAt | when }}</td>
                  <td>
                    {{ r.dueOn | day }}
                    @if (r.overdue) {
                      <span class="badge red" data-testid="overdue">{{ 'dsr.overdue' | t }}</span>
                    }
                  </td>
                  <td>
                    <span class="badge" [class]="'badge ' + tone(r.status)">{{
                      'dsr.status.' + r.status | t
                    }}</span>
                  </td>
                  <td>
                    {{ r.outcome ?? r.note ?? '—' }}
                    @if (r.completedAt) {
                      <small class="muted block"
                        >{{ r.completedBy ?? '' }} · {{ r.completedAt | when }}</small
                      >
                    }
                  </td>
                  <td class="right nowrap">
                    @if (r.status === 'OPEN') {
                      <button
                        class="btn sm"
                        type="button"
                        data-testid="dsr-complete"
                        (click)="startClosing(r, 'complete')"
                      >
                        {{ 'dsr.complete' | t }}
                      </button>
                      <button
                        class="btn sm"
                        type="button"
                        data-testid="dsr-refuse"
                        (click)="startClosing(r, 'refuse')"
                      >
                        {{ 'dsr.refuse' | t }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <app-empty [for]="list" icon="shield" [title]="'dsr.none' | t" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="list" />
      </div>
    </div>

    <app-modal [open]="creating()" [title]="'dsr.new' | t" (closed)="creating.set(false)">
      <div class="form-grid">
        <app-field [label]="'dsr.kind' | t" [required]="true">
          <select
            class="select"
            data-testid="dsr-kind"
            [value]="newKind()"
            (change)="newKind.set($any($event.target).value)"
          >
            @for (k of kinds; track k) {
              <option [value]="k">{{ 'dsr.kind.' + k | t }}</option>
            }
          </select>
        </app-field>
        <app-field
          [label]="'dsr.receivedOn' | t"
          [hint]="'dsr.receivedOnHint' | t"
          [error]="fieldError('receivedOn')"
        >
          <input
            class="input"
            type="date"
            data-testid="dsr-received-on"
            [max]="today()"
            [value]="receivedOn()"
            (input)="receivedOn.set($any($event.target).value)"
          />
        </app-field>
        <app-field
          class="full"
          [label]="'dsr.customer' | t"
          [required]="true"
          [error]="fieldError('customerUid')"
        >
          <app-lookup
            path="/customers"
            [placeholder]="'dsr.searchCustomer' | t"
            [display]="customerName"
            [detail]="customerDetail"
            (picked)="customer.set($event)"
          />
        </app-field>
        <app-field class="full" [label]="'dsr.note' | t">
          <textarea
            class="input"
            [value]="note()"
            (input)="note.set($any($event.target).value)"
          ></textarea>
        </app-field>
        @if (problem(); as p) {
          <div class="notice tone-red full" role="alert">{{ p }}</div>
        }
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="creating.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          data-testid="dsr-save"
          [disabled]="busy() || !customer()"
          (click)="create()"
        >
          {{ 'dsr.log' | t }}
        </button>
      </ng-container>
    </app-modal>

    <app-modal
      [open]="!!closing()"
      [title]="
        closing()
          ? ((closing()!.action === 'complete' ? 'dsr.completeTitle' : 'dsr.refuseTitle')
            | t: { number: closing()!.request.number })
          : ''
      "
      (closed)="closing.set(null)"
    >
      @if (closing(); as c) {
        <app-field
          [label]="(c.action === 'complete' ? 'dsr.outcome' : 'dsr.refuseReason') | t"
          [hint]="(c.action === 'complete' ? 'dsr.outcomeHint' : 'dsr.refuseHint') | t"
          [required]="true"
        >
          <textarea
            class="input"
            data-testid="dsr-closing-text"
            [value]="closingText()"
            (input)="closingText.set($any($event.target).value)"
          ></textarea>
        </app-field>
        @if (problem(); as p) {
          <div class="notice tone-red" role="alert">{{ p }}</div>
        }
      }
      <ng-container footer>
        <button class="btn" type="button" (click)="closing.set(null)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn"
          type="button"
          data-testid="dsr-closing-save"
          [class]="closing()?.action === 'refuse' ? 'btn danger' : 'btn primary'"
          [disabled]="busy() || !closingText().trim()"
          (click)="close()"
        >
          {{ (closing()?.action === 'refuse' ? 'dsr.refuse' : 'dsr.complete') | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .field-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    tr.overdue td:first-child {
      box-shadow: inset 3px 0 0 var(--red);
    }
    .nowrap {
      white-space: nowrap;
    }
    .nowrap .btn + .btn {
      margin-left: 6px;
    }
  `,
})
export default class PrivacyRequestsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly kinds = DSR_KINDS;
  protected readonly statuses = DSR_STATUSES;

  protected readonly status = signal('');
  protected readonly kind = signal('');
  protected readonly list = pagedList<DataSubjectRequest>(() => ({
    path: '/privacy/requests',
    query: { status: this.status(), kind: this.kind() },
    options: { noBranch: true },
  }));

  protected readonly busy = signal(false);
  protected readonly problem = signal<string | null>(null);
  private readonly failure = signal<ApiError | null>(null);

  protected readonly creating = signal(false);
  protected readonly newKind = signal<DataSubjectRequestKind>('ACCESS');
  protected readonly customer = signal<Customer | null>(null);
  protected readonly receivedOn = signal('');
  protected readonly note = signal('');
  protected readonly today = signal(isoDay());

  protected readonly closing = signal<Closing | null>(null);
  protected readonly closingText = signal('');

  protected readonly customerName = (c: Customer) => c.name;
  protected readonly customerDetail = (c: Customer) =>
    [c.code, c.phone].filter(Boolean).join(' · ');

  protected tone(status: DataSubjectRequestStatus): string {
    return status === 'OPEN' ? 'amber' : status === 'COMPLETED' ? 'green' : 'gray';
  }

  /** The refusal's words under the field the API named. */
  protected fieldError(field: string): string | null {
    const failure = this.failure();
    return failure?.field === field ? failure.message : null;
  }

  protected openNew(): void {
    this.today.set(isoDay());
    this.newKind.set('ACCESS');
    this.customer.set(null);
    this.receivedOn.set(this.today());
    this.note.set('');
    this.clearProblem();
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    const customer = this.customer();
    if (!customer) {
      return;
    }
    await this.run(async () => {
      const saved = await this.api.post<DataSubjectRequest>(
        '/privacy/requests',
        {
          kind: this.newKind(),
          customerUid: customer.uid,
          receivedOn: this.receivedOn() || null,
          note: this.note().trim() || null,
        },
        { silent: true, noBranch: true },
      );
      this.toasts.success(this.translations.t('dsr.logged', { number: saved.number }));
      this.creating.set(false);
    });
  }

  protected startClosing(request: DataSubjectRequest, action: Closing['action']): void {
    this.closingText.set('');
    this.clearProblem();
    this.closing.set({ request, action });
  }

  protected async close(): Promise<void> {
    const closing = this.closing();
    const text = this.closingText().trim();
    if (!closing || !text) {
      return;
    }
    await this.run(async () => {
      const body = closing.action === 'complete' ? { outcome: text } : { reason: text };
      await this.api.post(`/privacy/requests/${closing.request.uid}/${closing.action}`, body, {
        silent: true,
        noBranch: true,
      });
      this.toasts.success(
        this.translations.t(closing.action === 'complete' ? 'dsr.completed' : 'dsr.refused', {
          number: closing.request.number,
        }),
      );
      this.closing.set(null);
    });
  }

  /** Runs a change; a refusal stays in the dialog. The list is read again either way. */
  private async run(change: () => Promise<void>): Promise<void> {
    this.clearProblem();
    this.busy.set(true);
    try {
      await change();
    } catch (failure) {
      const error = ApiError.from(failure);
      this.failure.set(error);
      // A refusal of a field the form shows goes under it; any other in the dialog's notice.
      const shown = this.creating() && FIELDS_SHOWN.includes(error.field ?? '');
      this.problem.set(shown ? null : error.message);
    } finally {
      this.busy.set(false);
      await this.list.reload();
    }
  }

  private clearProblem(): void {
    this.failure.set(null);
    this.problem.set(null);
  }
}
