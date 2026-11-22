import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { SecurityOverview } from '../../core/api/security.models';
import { SHARED } from '../../core/shared';
import { validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

type Step = 'idle' | 'email' | 'emailSent' | 'phone' | 'code' | 'remove';

/**
 * The sign-in email and phone of a personal account. The email changes only from a link sent to
 * the new address, with the password (and the second-factor code when on). The phone is verified
 * with a code sent to it by SMS; a verified phone can reset the password. Staff logins see a note:
 * their pharmacy keeps these details.
 */
@Component({
  selector: 'app-account-contacts',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card card-pad stack contacts" data-testid="account-contacts">
      <h3>{{ 'acct.contactsTitle' | t }}</h3>
      @if (overview(); as o) {
        @if (o.managed) {
          <p class="muted">{{ 'acct.managedNote' | t }}</p>
        } @else {
          <p class="muted">{{ 'acct.contactsHint' | t }}</p>

          <div class="row-line">
            <div class="grow">
              <div class="label">{{ 'acct.email' | t }}</div>
              <div class="value">{{ o.email }}</div>
              @if (o.pendingEmail) {
                <div class="note">{{ 'acct.pending' | t: { email: o.pendingEmail } }}</div>
              }
            </div>
            @if (step() === 'idle') {
              <button class="btn sm" type="button" (click)="open('email')">
                {{ 'acct.changeEmail' | t }}
              </button>
            }
          </div>
          @if (step() === 'email') {
            <form class="stack inner" [formGroup]="emailForm" (ngSubmit)="sendLink()">
              <div class="field">
                <label for="new-email">{{ 'acct.newEmail' | t }}</label>
                <input id="new-email" class="input" type="email" formControlName="newEmail" />
              </div>
              <div class="field">
                <label for="email-password">{{ 'acct.password' | t }}</label>
                <input
                  id="email-password"
                  class="input"
                  type="password"
                  formControlName="password"
                  autocomplete="current-password"
                />
              </div>
              @if (o.twoFactorEnabled) {
                <div class="field">
                  <label for="email-code">{{ 'acct.code2fa' | t }}</label>
                  <input
                    id="email-code"
                    class="input"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    formControlName="code"
                  />
                </div>
              }
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              <div class="actions">
                <button class="btn" type="button" (click)="close()">{{ 'acct.cancel' | t }}</button>
                <button class="btn primary" type="submit" [disabled]="busy()">
                  {{ 'acct.sendLink' | t }}
                </button>
              </div>
            </form>
          }
          @if (step() === 'emailSent') {
            <div class="notice tone-green">
              <app-icon name="mail" /> {{ 'acct.linkSent' | t: { email: sentTo() } }}
            </div>
          }

          <div class="row-line">
            <div class="grow">
              <div class="label">{{ 'acct.phone' | t }}</div>
              <div class="value">
                @if (o.phone) {
                  {{ o.phone }}
                  <span class="pill" [class.ok]="o.phoneVerified">
                    {{ (o.phoneVerified ? 'acct.verified' : 'acct.notVerified') | t }}
                  </span>
                } @else {
                  <span class="muted">{{ 'acct.noPhone' | t }}</span>
                }
              </div>
            </div>
            @if (step() === 'idle' || step() === 'emailSent') {
              <button class="btn sm" type="button" (click)="open('phone')">
                {{ (o.phone ? 'acct.changePhone' : 'acct.addPhone') | t }}
              </button>
              @if (o.phone) {
                <button class="btn sm" type="button" (click)="open('remove')">
                  {{ 'acct.removePhone' | t }}
                </button>
              }
            }
          </div>
          @if (step() === 'phone') {
            <form class="stack inner" [formGroup]="phoneForm" (ngSubmit)="sendCode()">
              <div class="field">
                <label for="phone">{{ 'acct.phoneNumber' | t }}</label>
                <input id="phone" class="input" type="tel" formControlName="phone" />
                <span class="hint">{{ 'acct.phoneExample' | t }}</span>
              </div>
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              <div class="actions">
                <button class="btn" type="button" (click)="close()">{{ 'acct.cancel' | t }}</button>
                <button class="btn primary" type="submit" [disabled]="busy()">
                  {{ 'acct.sendCode' | t }}
                </button>
              </div>
            </form>
          }
          @if (step() === 'code') {
            <form class="stack inner" [formGroup]="codeForm" (ngSubmit)="verify()">
              <div class="notice tone-blue">
                <app-icon name="phone" />
                {{ 'acct.codeSent' | t: { phone: phoneForm.controls.phone.value } }}
              </div>
              <div class="field">
                <label for="sms-code">{{ 'acct.code' | t }}</label>
                <input
                  id="sms-code"
                  class="input"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  formControlName="code"
                />
              </div>
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              <div class="actions">
                <button class="btn" type="button" (click)="close()">{{ 'acct.cancel' | t }}</button>
                <button class="btn primary" type="submit" [disabled]="busy()">
                  {{ 'acct.verify' | t }}
                </button>
              </div>
            </form>
          }
          @if (step() === 'remove') {
            <form class="stack inner" [formGroup]="removeForm" (ngSubmit)="remove()">
              <p class="muted">{{ 'acct.removeConfirm' | t }}</p>
              <div class="field">
                <label for="remove-password">{{ 'acct.password' | t }}</label>
                <input
                  id="remove-password"
                  class="input"
                  type="password"
                  formControlName="password"
                  autocomplete="current-password"
                />
              </div>
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              <div class="actions">
                <button class="btn" type="button" (click)="close()">{{ 'acct.cancel' | t }}</button>
                <button class="btn danger" type="submit" [disabled]="busy()">
                  {{ 'acct.removePhone' | t }}
                </button>
              </div>
            </form>
          }
        }
      }
    </section>
  `,
  styles: `
    .contacts {
      max-width: 720px;
      margin-top: 18px;
    }
    .row-line {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid var(--border);
    }
    .grow {
      flex: 1;
      min-width: 0;
    }
    .label {
      font-size: 12px;
      color: var(--muted);
    }
    .value {
      font-weight: 600;
      word-break: break-all;
    }
    .note {
      font-size: 12.5px;
      color: var(--muted);
      margin-top: 2px;
    }
    .inner {
      padding: 4px 0 10px;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .pill {
      font-size: 11.5px;
      font-weight: 600;
      padding: 2px 9px;
      border-radius: 999px;
      margin-left: 6px;
      background: color-mix(in srgb, #d97706 14%, transparent);
      color: #b45309;
    }
    .pill.ok {
      background: color-mix(in srgb, #16a34a 14%, transparent);
      color: #15803d;
    }
  `,
})
export class AccountContactsComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly overview = signal<SecurityOverview | null>(null);
  protected readonly step = signal<Step>('idle');
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly sentTo = signal('');

  protected readonly emailForm = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    code: [''],
  });
  protected readonly phoneForm = this.fb.group({ phone: ['', Validators.required] });
  protected readonly codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\s*\d{6}\s*$/)]],
  });
  protected readonly removeForm = this.fb.group({ password: ['', Validators.required] });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected open(step: Step): void {
    this.failure.set(null);
    this.emailForm.reset();
    this.codeForm.reset();
    this.removeForm.reset();
    if (step === 'phone') {
      this.phoneForm.reset();
    }
    this.step.set(step);
  }

  protected close(): void {
    this.failure.set(null);
    this.step.set('idle');
  }

  protected async sendLink(): Promise<void> {
    if (!validate(this.emailForm)) {
      return;
    }
    const v = this.emailForm.getRawValue();
    if (
      await this.run(() =>
        this.api.post(
          '/auth/email-change',
          { newEmail: v.newEmail.trim(), password: v.password, code: v.code.trim() || null },
          { silent: true },
        ),
      )
    ) {
      this.sentTo.set(v.newEmail.trim());
      this.step.set('emailSent');
      await this.reload();
    }
  }

  protected async sendCode(): Promise<void> {
    if (!validate(this.phoneForm)) {
      return;
    }
    const phone = this.phoneForm.controls.phone.value.trim();
    if (await this.run(() => this.api.post('/auth/phone', { phone }, { silent: true }))) {
      this.step.set('code');
    }
  }

  protected async verify(): Promise<void> {
    if (!validate(this.codeForm)) {
      return;
    }
    const code = this.codeForm.controls.code.value.trim();
    if (await this.run(() => this.api.post('/auth/phone/verify', { code }, { silent: true }))) {
      this.toasts.success(this.translations.t('acct.phoneVerified'));
      this.step.set('idle');
      await this.reload();
    }
  }

  protected async remove(): Promise<void> {
    if (!validate(this.removeForm)) {
      return;
    }
    const password = this.removeForm.controls.password.value;
    if (await this.run(() => this.api.post('/auth/phone/remove', { password }, { silent: true }))) {
      this.toasts.success(this.translations.t('acct.phoneRemoved'));
      this.step.set('idle');
      await this.reload();
    }
  }

  private async reload(): Promise<void> {
    this.overview.set(
      await this.api.get<SecurityOverview>('/auth/security', undefined, {
        noBranch: true,
        silent: true,
      }),
    );
  }

  /** Runs a call; its refusal shows in the open form. */
  private async run(call: () => Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await call();
      return true;
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
