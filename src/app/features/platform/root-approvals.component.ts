import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Api } from '../../core/api/api.service';
import { ApiError } from '../../core/api/api-error';
import { RootApproval } from '../../core/api/models';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

/**
 * Root administrators' requests that a second root administrator must approve (FRD-18): lifting a
 * legal hold and erasing a pharmacy. The person who asked can cancel but never approve; the
 * approver types their own password (and two-factor code), and the action happens at once.
 */
@Component({
  selector: 'app-root-approvals',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown().length) {
      <div class="table-wrap">
        <table class="table" data-testid="root-approvals">
          <thead>
            <tr>
              <th scope="col">{{ 'rootApproval.reason' | t }}</th>
              @if (!tenantUid()) {
                <th scope="col">{{ 'platform.tenants' | t }}</th>
              }
              <th scope="col">{{ 'rootApproval.requestedBy' | t }}</th>
              <th scope="col">{{ 'rootApproval.expires' | t }}</th>
              <th scope="col">
                <span class="sr-only">{{ 'rootApproval.approve' | t }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (a of shown(); track a.uid) {
              <tr [attr.data-testid]="'root-approval-' + a.uid">
                <td>
                  <b>{{ 'rootApproval.action.' + a.action | t }}</b>
                  <br /><small class="muted">{{ a.reason }}</small>
                </td>
                @if (!tenantUid()) {
                  <td>
                    <a [routerLink]="['/platform/tenants', a.tenantUid]"
                      >{{ a.tenantName }} ({{ a.tenantCode }})</a
                    >
                  </td>
                }
                <td>
                  {{ a.requestedByName }}<br /><small class="muted">{{
                    a.requestedAt | when
                  }}</small>
                </td>
                <td>{{ a.expiresAt | when }}</td>
                <td class="actions-cell">
                  @if (mine(a)) {
                    <small class="muted">{{ 'rootApproval.yours' | t }}</small>
                  } @else {
                    <button
                      class="btn primary sm"
                      type="button"
                      data-testid="root-approve"
                      [disabled]="busy()"
                      (click)="open(a)"
                    >
                      {{ 'rootApproval.approve' | t }}
                    </button>
                  }
                  <button
                    class="btn ghost sm"
                    type="button"
                    data-testid="root-cancel"
                    [disabled]="busy()"
                    (click)="cancel(a)"
                  >
                    {{ 'rootApproval.cancel' | t }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (showEmpty()) {
      <p class="muted" data-testid="root-approvals-none">{{ 'rootApproval.none' | t }}</p>
    }

    <app-modal
      [open]="approving() !== null"
      [title]="
        'rootApproval.approveTitle'
          | t: { action: approving() ? ('rootApproval.action.' + approving()!.action | t) : '' }
      "
      (closed)="close()"
    >
      @if (approving(); as a) {
        <form class="stack" (ngSubmit)="approve(a)">
          <p>
            {{
              'rootApproval.approveText'
                | t
                  : {
                      action: 'rootApproval.action.' + a.action | t,
                      name: a.tenantName,
                      who: a.requestedByName,
                    }
            }}
          </p>
          <p class="muted">{{ a.reason }}</p>
          @if (failure()) {
            <div class="notice tone-red" data-testid="root-approve-error">{{ failure() }}</div>
          }
          <div class="field">
            <label for="root-approve-password">{{ 'rootApproval.password' | t }}</label>
            <input
              id="root-approve-password"
              class="input"
              type="password"
              name="password"
              autocomplete="current-password"
              data-testid="root-approve-password"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
            />
          </div>
          <div class="field">
            <label for="root-approve-code">{{ 'rootApproval.code' | t }}</label>
            <input
              id="root-approve-code"
              class="input otp"
              name="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="9"
              data-testid="root-approve-code"
              [value]="code()"
              (input)="code.set($any($event.target).value)"
            />
          </div>
        </form>
      }
      <ng-container footer>
        <button class="btn" type="button" (click)="close()">{{ 'common.cancel' | t }}</button>
        <button
          class="btn danger"
          type="button"
          data-testid="root-approve-confirm"
          [disabled]="busy() || !password()"
          (click)="approve(approving()!)"
        >
          {{ 'rootApproval.approve' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .actions-cell {
      white-space: nowrap;
      text-align: right;
    }
    .actions-cell .btn + .btn {
      margin-left: 6px;
    }
  `,
})
export class RootApprovalsComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly confirm = inject(ConfirmService);

  /** Only this pharmacy's requests (the tenant page); every pharmacy's when unset. */
  readonly tenantUid = input<string | null>(null);
  /** Say so when nothing waits (the approvals page); the tenant page shows nothing instead. */
  readonly showEmpty = input(true);
  /** A request was approved and done, or cancelled: the tenant may have changed. */
  readonly changed = output<RootApproval>();

  protected readonly approvals = signal<RootApproval[]>([]);
  protected readonly shown = computed(() => {
    const tenant = this.tenantUid();
    return this.approvals().filter((a) => !tenant || a.tenantUid === tenant);
  });
  protected readonly approving = signal<RootApproval | null>(null);
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  /** Reads the pending requests again, such as after one was sent from the tenant page. */
  async reload(): Promise<void> {
    this.approvals.set(
      await this.api
        .get<RootApproval[]>('/platform/approvals', { status: 'PENDING' }, { noBranch: true })
        .catch(() => []),
    );
  }

  protected mine(approval: RootApproval): boolean {
    return approval.requestedByUid === this.session.user()?.uid;
  }

  protected open(approval: RootApproval): void {
    this.password.set('');
    this.code.set('');
    this.failure.set(null);
    this.approving.set(approval);
  }

  protected close(): void {
    this.approving.set(null);
    this.password.set('');
    this.code.set('');
  }

  protected async approve(approval: RootApproval | null): Promise<void> {
    if (!approval || !this.password()) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      const done = await this.api.post<RootApproval>(
        `/platform/approvals/${approval.uid}/approve`,
        { password: this.password(), code: this.code().trim() || null },
        { silent: true, noBranch: true },
      );
      this.close();
      this.toasts.success(this.translations.t('rootApproval.approved'));
      this.changed.emit(done);
      await this.reload();
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(approval: RootApproval): Promise<void> {
    const sure = await this.confirm.ask({
      icon: 'warning',
      title: this.translations.t('rootApproval.cancelConfirm'),
      text: this.translations.t('rootApproval.action.' + approval.action),
      confirmText: this.translations.t('rootApproval.cancel'),
    });
    if (!sure) {
      return;
    }
    this.busy.set(true);
    try {
      const cancelled = await this.api.post<RootApproval>(
        `/platform/approvals/${approval.uid}/cancel`,
        {},
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('rootApproval.cancelled'));
      this.changed.emit(cancelled);
      await this.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
