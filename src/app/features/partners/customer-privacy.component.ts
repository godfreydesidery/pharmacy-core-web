import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import {
  ConsentPurpose,
  ConsentState,
  Customer,
  CustomerConsents,
  DataSubjectRequest,
} from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ConfirmService } from '../../core/ui/confirm';
import { downloadFrom } from '../../core/ui/export.component';
import { ToastService } from '../../core/ui/toast.service';

/** The purposes a customer may agree to, in the order shown. */
export const CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  'SMS_RECEIPTS',
  'MARKETING',
  'INSURER_SHARING',
];

/**
 * One customer's privacy (STD-5), shown in a drawer of the Customers page: what they agreed to and
 * its history, the download of everything held about them, and their anonymisation. Refusals
 * (a balance still owed, a legal hold, already anonymised) show in the drawer, in the user's
 * language.
 */
@Component({
  selector: 'app-customer-privacy',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = customer();
    @if (c.anonymisedAt) {
      <div class="notice tone-gray mb" data-testid="anonymised-notice">
        <app-icon name="lock" [size]="16" />
        {{ 'privacy.anonymisedOn' | t: { date: (c.anonymisedAt | when) } }}
      </div>
    }
    @if (problem(); as p) {
      <div class="notice tone-red mb" role="alert" data-testid="privacy-problem">{{ p }}</div>
    }

    <section class="stack">
      <h3>{{ 'privacy.consents' | t }}</h3>
      <p class="muted small">{{ 'privacy.consentsHint' | t }}</p>
      <div class="table-wrap">
        <table class="table" data-testid="consents-current">
          <thead>
            <tr>
              <th>{{ 'privacy.purpose' | t }}</th>
              <th>{{ 'privacy.status' | t }}</th>
              <th>{{ 'privacy.since' | t }}</th>
              @if (canChange()) {
                <th></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (s of current(); track s.purpose) {
              <tr>
                <td>
                  <b>{{ 'privacy.purpose.' + s.purpose | t }}</b>
                  <small class="muted block">{{
                    (s.effective ? 'privacy.inEffect' : 'privacy.notInEffect') | t
                  }}</small>
                </td>
                <td>
                  <span class="badge" [class]="'badge ' + statusTone(s)">{{
                    'privacy.consent.' + s.status | t
                  }}</span>
                </td>
                <td class="muted">{{ s.since ? (s.since | when) : '—' }}</td>
                @if (canChange()) {
                  <td class="right nowrap">
                    <button
                      class="btn sm"
                      type="button"
                      [disabled]="busy() || s.status === 'GIVEN'"
                      (click)="record(s.purpose, true)"
                    >
                      {{ 'privacy.recordGiven' | t }}
                    </button>
                    <button
                      class="btn sm"
                      type="button"
                      [disabled]="busy() || s.status === 'WITHDRAWN'"
                      (click)="record(s.purpose, false)"
                    >
                      {{ 'privacy.recordWithdrawn' | t }}
                    </button>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="canChange() ? 4 : 3">
                  <app-empty [for]="consents" icon="shield" [title]="'privacy.noConsents' | t" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (canChange()) {
        <app-field [label]="'privacy.consentNote' | t">
          <input
            class="input"
            [value]="consentNote()"
            (input)="consentNote.set($any($event.target).value)"
            [placeholder]="'privacy.consentNoteHint' | t"
          />
        </app-field>
      }
      @if (history().length) {
        <details>
          <summary>{{ 'privacy.history' | t }}</summary>
          <ul class="history" data-testid="consents-history">
            @for (h of history(); track h.uid) {
              <li>
                <b>{{ 'privacy.purpose.' + h.purpose | t }}</b>
                @if (h.givenAt) {
                  · {{ 'privacy.givenBy' | t: { when: (h.givenAt | when), by: h.givenBy ?? '—' } }}
                }
                @if (h.withdrawnAt) {
                  ·
                  {{
                    'privacy.withdrawnBy'
                      | t: { when: (h.withdrawnAt | when), by: h.withdrawnBy ?? '—' }
                  }}
                }
                @if (h.inForce) {
                  <span class="badge green">{{ 'privacy.inForce' | t }}</span>
                }
                @if (h.note) {
                  <small class="muted block">{{ h.note }}</small>
                }
              </li>
            }
          </ul>
        </details>
      }
    </section>

    @if (canExport() || (canAnonymise() && !c.anonymisedAt)) {
      <section class="stack mt">
        <h3>{{ 'privacy.personalData' | t }}</h3>
        @if (canExport()) {
          <div>
            <button
              class="btn"
              type="button"
              data-testid="export-personal-data"
              [disabled]="busy()"
              (click)="exportData()"
            >
              <app-icon name="download" [size]="16" /> {{ 'privacy.export' | t }}
            </button>
            <p class="hint">{{ 'privacy.exportHint' | t }}</p>
          </div>
        }
        @if (canAnonymise() && !c.anonymisedAt) {
          <div class="stack">
            <app-field [label]="'privacy.anonymiseNote' | t">
              <input
                class="input"
                [value]="anonymiseNote()"
                (input)="anonymiseNote.set($any($event.target).value)"
              />
            </app-field>
            <div>
              <button
                class="btn danger"
                type="button"
                data-testid="anonymise"
                [disabled]="busy()"
                (click)="anonymise()"
              >
                <app-icon name="trash" [size]="16" /> {{ 'privacy.anonymise' | t }}
              </button>
              <p class="hint">{{ 'privacy.anonymiseHint' | t }}</p>
            </div>
          </div>
        }
      </section>
    }
  `,
  styles: `
    .small {
      font-size: 12.5px;
    }
    .nowrap {
      white-space: nowrap;
    }
    .nowrap .btn + .btn {
      margin-left: 6px;
    }
    .history {
      margin: 8px 0 0;
      padding-left: 18px;
      font-size: 13px;
    }
    .history li {
      margin-bottom: 6px;
    }
    .hint {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 12.5px;
    }
  `,
})
export class CustomerPrivacyComponent {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);
  protected readonly session = inject(SessionStore);

  readonly customer = input.required<Customer>();
  /** The customer was anonymised: the list reads it again. */
  readonly changed = output<void>();

  protected readonly busy = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly consentNote = signal('');
  protected readonly anonymiseNote = signal('');

  protected readonly consents = loaded<CustomerConsents>(() => ({
    path: `/customers/${this.customer().uid}/consents`,
    options: { noBranch: true },
  }));
  protected readonly current = computed(() => {
    const states = this.consents.value()?.current ?? [];
    return CONSENT_PURPOSES.map((p) => states.find((s) => s.purpose === p)).filter(
      (s): s is ConsentState => !!s,
    );
  });
  protected readonly history = computed(() => this.consents.value()?.history ?? []);

  /** Export needs the customer, bulk export and health details (prescriptions are in it). */
  protected readonly canExport = computed(
    () =>
      this.session.can('partners.view') &&
      this.session.can('data.export') &&
      this.session.can('health.view'),
  );
  protected readonly canAnonymise = computed(
    () => this.session.can('partners.manage') && this.session.can('data.export'),
  );
  protected readonly canChange = computed(
    () => this.session.can('partners.manage') && !this.customer().anonymisedAt,
  );

  protected statusTone(state: ConsentState): string {
    return state.status === 'GIVEN' ? 'green' : state.status === 'WITHDRAWN' ? 'red' : 'gray';
  }

  protected async record(purpose: ConsentPurpose, given: boolean): Promise<void> {
    this.problem.set(null);
    this.busy.set(true);
    try {
      const answer = await this.api.post<CustomerConsents>(
        `/customers/${this.customer().uid}/consents`,
        { purpose, given, note: this.consentNote().trim() || null },
        { silent: true, noBranch: true },
      );
      this.consents.set(answer);
      this.consentNote.set('');
      this.toasts.success(this.translations.t('privacy.consentRecorded'));
    } catch (failure) {
      this.problem.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async exportData(): Promise<void> {
    this.problem.set(null);
    this.busy.set(true);
    try {
      await downloadFrom(
        this.http,
        `/customers/${this.customer().uid}/data-export`,
        this.toasts,
        this.translations.t('privacy.exportFailed'),
        { method: 'POST' },
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async anonymise(): Promise<void> {
    const customer = this.customer();
    this.problem.set(null);
    const ok = await this.confirm.ask({
      title: this.translations.t('privacy.anonymiseTitle', { name: customer.name }),
      text: this.translations.t('privacy.anonymiseText'),
      icon: 'danger',
      confirmText: this.translations.t('privacy.anonymiseConfirm'),
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    try {
      const request = await this.api.post<DataSubjectRequest>(
        `/customers/${customer.uid}/anonymise`,
        { note: this.anonymiseNote().trim() || null },
        { silent: true, noBranch: true },
      );
      this.toasts.success(
        this.translations.t('privacy.anonymised', { number: request?.number ?? '' }),
      );
      this.changed.emit();
    } catch (failure) {
      this.problem.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
