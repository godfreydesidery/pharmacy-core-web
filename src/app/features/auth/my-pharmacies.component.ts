import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { Me } from '../../core/api/models';
import { SecurityOverview } from '../../core/api/security.models';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { Translations } from '../../core/i18n/translations.store';
import { validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';

/**
 * The pharmacies a person works in, and leaving one themselves (G14) with their password. The
 * pharmacy keeps them as they were when they left. A staff login has only its own pharmacy, which
 * switches it off instead, so the card is for personal accounts.
 */
@Component({
  selector: 'app-my-pharmacies',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (personal() && memberships().length) {
      <section class="card card-pad stack mine" data-testid="my-pharmacies">
        <h3>{{ 'staff.myPharmacies' | t }}</h3>
        <p class="muted">{{ 'staff.myPharmaciesHint' | t }}</p>
        @for (m of memberships(); track m.tenantUid) {
          <div class="row-line">
            <div class="grow">
              <b>{{ m.tenantName }}</b>
              <span class="muted small"> · {{ m.roleName }}</span>
            </div>
            @if (leaving() !== m.tenantUid) {
              <button class="btn sm" type="button" (click)="start(m.tenantUid)">
                {{ 'staff.leave' | t }}
              </button>
            }
          </div>
          @if (leaving() === m.tenantUid) {
            <form class="stack inner" [formGroup]="form" (ngSubmit)="leave(m.tenantUid)">
              <div class="notice tone-amber small">
                {{ 'staff.leaveWarning' | t: { pharmacy: m.tenantName } }}
              </div>
              <div class="field">
                <label for="leave-password">{{ 'acct.password' | t }}</label>
                <input
                  id="leave-password"
                  class="input"
                  type="password"
                  formControlName="password"
                  autocomplete="current-password"
                />
              </div>
              <div class="field">
                <label for="leave-code">{{ 'staff.codeIfOn' | t }}</label>
                <input
                  id="leave-code"
                  class="input"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  formControlName="code"
                />
              </div>
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              <div class="actions">
                <button class="btn" type="button" (click)="leaving.set(null)">
                  {{ 'acct.cancel' | t }}
                </button>
                <button class="btn danger" type="submit" [disabled]="busy()">
                  {{ 'staff.leaveConfirm' | t }}
                </button>
              </div>
            </form>
          }
        }
      </section>
    }
  `,
  styles: `
    .mine {
      max-width: 720px;
      margin-top: 18px;
    }
    .row-line {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 8px 0;
      border-top: 1px solid var(--border);
    }
    .grow {
      flex: 1;
    }
    .small {
      font-size: 13px;
    }
    .inner {
      padding-bottom: 8px;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `,
})
export class MyPharmaciesComponent implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);

  /** A personal account (a staff login's pharmacy switches it off instead). */
  protected readonly personal = signal(false);
  protected readonly leaving = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', Validators.required],
    code: [''],
  });

  async ngOnInit(): Promise<void> {
    const overview = await this.api.get<SecurityOverview>('/auth/security', undefined, {
      noBranch: true,
      silent: true,
    });
    this.personal.set(!overview.managed);
  }

  protected memberships() {
    return this.session.memberships();
  }

  protected start(tenantUid: string): void {
    this.form.reset();
    this.failure.set(null);
    this.leaving.set(tenantUid);
  }

  protected async leave(tenantUid: string): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post(
        `/auth/pharmacies/${tenantUid}/leave`,
        { password: v.password, code: v.code.trim() || null },
        { silent: true, noBranch: true },
      );
      const me = await this.api.get<Me>('/auth/me', undefined, { silent: true, noBranch: true });
      this.session.refresh(me.user, me.memberships);
      this.leaving.set(null);
      this.toasts.success(this.translations.t('staff.left'));
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
