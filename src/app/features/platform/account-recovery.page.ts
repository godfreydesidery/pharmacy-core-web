import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { User } from '../../core/api/models';
import { SHARED } from '../../core/shared';
import { Translations } from '../../core/i18n/translations.store';
import { validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';

interface Recovery {
  uid: string;
  newEmail: string;
  usableFrom: string;
  expiresAt: string;
}

/**
 * Platform → Account recovery: for a person who lost their mailbox and has no verified phone.
 * Support finds the account by its email, checks who the person is, and moves it to a new
 * address. The link works after a 24-hour hold; the old email and phone are told and may cancel.
 */
@Component({
  selector: 'app-account-recovery',
  imports: [...SHARED, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'acct.recoveryTitle' | t }}</h1>
          <p class="sub">{{ 'acct.recoveryHint' | t }}</p>
        </div>
      </div>
      <form class="card card-pad row" [formGroup]="findForm" (ngSubmit)="find()">
        <div class="field grow">
          <label for="find-email">{{ 'acct.findEmail' | t }}</label>
          <input id="find-email" class="input" type="email" formControlName="email" />
        </div>
        <button class="btn primary" type="submit" [disabled]="busy()">
          <app-icon name="search" [size]="16" /> {{ 'acct.find' | t }}
        </button>
      </form>
      @if (failure()) {
        <div class="notice tone-red mt"><app-icon name="alert" /> {{ failure() }}</div>
      }
      @if (account(); as a) {
        <div class="card card-pad stack mt" data-testid="recovery-account">
          <div>
            <b>{{ a.name }}</b> · {{ a.email }}
            @if (a.managed) {
              <span class="badge">{{ 'acct.staffLogin' | t }}</span>
            }
          </div>
          <div class="muted small">
            {{ 'acct.phone' | t }}: {{ a.phone ?? '—' }}
            @if (a.phone) {
              ({{ (a.phoneVerified ? 'acct.verified' : 'acct.notVerified') | t }})
            }
          </div>
          @if (!a.managed) {
            @if (started(); as r) {
              <div class="notice tone-green">
                <app-icon name="check" />
                {{
                  'acct.recoveryStarted'
                    | t: { email: r.newEmail, time: (r.usableFrom | date: 'd MMM y, HH:mm') }
                }}
              </div>
            } @else {
              <form class="stack" [formGroup]="recoveryForm" (ngSubmit)="start(a)">
                <div class="field">
                  <label for="recovery-email">{{ 'acct.recoveryNewEmail' | t }}</label>
                  <input
                    id="recovery-email"
                    class="input"
                    type="email"
                    formControlName="newEmail"
                  />
                </div>
                <div class="field">
                  <label for="recovery-reason">{{ 'acct.reason' | t }}</label>
                  <textarea
                    id="recovery-reason"
                    class="input"
                    rows="2"
                    formControlName="reason"
                  ></textarea>
                </div>
                <label class="check">
                  <input type="checkbox" formControlName="resetTwoFactor" />
                  {{ 'acct.resetTwoFactor' | t }}
                </label>
                <div>
                  <button class="btn danger" type="submit" [disabled]="busy()">
                    {{ 'acct.startRecovery' | t }}
                  </button>
                </div>
              </form>
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    .row {
      display: flex;
      gap: 10px;
      align-items: flex-end;
      max-width: 720px;
    }
    .grow {
      flex: 1;
    }
    .mt {
      margin-top: 14px;
      max-width: 720px;
    }
    .small {
      font-size: 13px;
    }
    .check {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 14px;
    }
  `,
})
export default class AccountRecoveryPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly account = signal<User | null>(null);
  protected readonly started = signal<Recovery | null>(null);
  protected readonly findForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly recoveryForm = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email]],
    reason: ['', [Validators.required, Validators.maxLength(500)]],
    resetTwoFactor: [false],
  });

  protected async find(): Promise<void> {
    if (!validate(this.findForm)) {
      return;
    }
    this.account.set(null);
    this.started.set(null);
    this.recoveryForm.reset();
    await this.run(async () =>
      this.account.set(
        await this.api.get<User>(
          '/platform/accounts',
          { email: this.findForm.controls.email.value.trim() },
          { silent: true, noBranch: true },
        ),
      ),
    );
  }

  protected async start(account: User): Promise<void> {
    if (!validate(this.recoveryForm)) {
      return;
    }
    const v = this.recoveryForm.getRawValue();
    await this.run(async () => {
      const recovery = await this.api.post<Recovery>(
        `/platform/accounts/${account.uid}/recovery`,
        { newEmail: v.newEmail.trim(), reason: v.reason.trim(), resetTwoFactor: v.resetTwoFactor },
        { silent: true, noBranch: true },
      );
      this.started.set(recovery);
      this.toasts.success(this.translations.t('acct.startRecovery'));
    });
  }

  private async run(call: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await call();
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
