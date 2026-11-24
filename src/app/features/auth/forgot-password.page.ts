import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TWO_FACTOR_MIN_PASSWORD, passwordValidators } from '../../core/session/password-rule';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { LogoComponent } from '../../core/layout/logo.component';
import { controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { ToastService } from '../../core/ui/toast.service';
import { AUTH_CARD_STYLES } from './auth-card';
import { staffLoginCode } from './staff-login';

/**
 * Resets a forgotten password: by a link to the email, or by a code sent by SMS to the account's
 * verified phone. Neither answer tells whether the email or number has an account. A pharmacy's
 * staff login (`juma@DAWA`) has neither: the page says to ask that pharmacy's manager, who resets
 * it under Administration → Users.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, LogoComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card-page">
      <div class="auth-card">
        <app-logo [size]="40" />
        <h1>{{ 'security.forgotTitle' | t }}</h1>
        <div class="switch" role="tablist">
          <button
            type="button"
            role="tab"
            [class.active]="mode() === 'email'"
            [attr.aria-selected]="mode() === 'email'"
            (click)="use('email')"
          >
            <app-icon name="mail" [size]="15" /> {{ 'acct.byEmail' | t }}
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="mode() === 'phone'"
            [attr.aria-selected]="mode() === 'phone'"
            (click)="use('phone')"
          >
            <app-icon name="phone" [size]="15" /> {{ 'acct.byPhone' | t }}
          </button>
        </div>
        @if (failure()) {
          <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
        }

        @if (mode() === 'email') {
          @if (sentTo(); as email) {
            <div class="notice tone-green">
              <app-icon name="mail" /> {{ 'security.linkSent' | t: { email } }}
            </div>
          } @else {
            <form class="stack" [formGroup]="emailForm" (ngSubmit)="sendLink()" novalidate>
              <p class="muted">{{ 'security.forgotHint' | t }}</p>
              <div class="field">
                <label for="email">{{ 'state.forgot.label' | t }}</label>
                <input
                  id="email"
                  class="input lg"
                  type="text"
                  inputmode="email"
                  autocapitalize="none"
                  spellcheck="false"
                  formControlName="email"
                  autocomplete="username"
                />
                @if (emailError(); as message) {
                  <span class="error">{{ message }}</span>
                }
              </div>
              @if (staffCode(); as code) {
                <div class="notice tone-blue" data-testid="staff-reset" role="status">
                  <app-icon name="users" />
                  <span>
                    <b>{{ 'state.forgot.staffTitle' | t: { login: typedLogin() } }}</b>
                    {{ 'state.forgot.staffBody' | t: { code } }}
                  </span>
                </div>
              } @else {
                <button class="btn primary lg block" type="submit" [disabled]="busy()">
                  {{ (busy() ? 'security.sending' : 'security.sendLink') | t }}
                </button>
              }
            </form>
          }
        } @else if (!codeSentTo()) {
          <form class="stack" [formGroup]="phoneForm" (ngSubmit)="sendCode()" novalidate>
            <p class="muted">{{ 'acct.phoneResetHint' | t }}</p>
            <div class="field">
              <label for="phone">{{ 'acct.phoneNumber' | t }}</label>
              <input
                id="phone"
                class="input lg"
                type="tel"
                formControlName="phone"
                autocomplete="tel"
              />
              <span class="hint">{{ 'acct.phoneExample' | t }}</span>
            </div>
            <button class="btn primary lg block" type="submit" [disabled]="busy()">
              {{ 'acct.sendCode' | t }}
            </button>
          </form>
        } @else {
          <form class="stack" [formGroup]="resetForm" (ngSubmit)="reset()" novalidate>
            <div class="notice tone-blue">
              <app-icon name="phone" /> {{ 'acct.phoneCodeSent' | t: { phone: codeSentTo() } }}
            </div>
            <div class="field">
              <label for="code">{{ 'acct.code' | t }}</label>
              <input
                id="code"
                class="input lg"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                formControlName="code"
              />
            </div>
            <div class="field">
              <label for="newPassword">{{ 'acct.newPassword' | t }}</label>
              <input
                id="newPassword"
                class="input lg"
                type="password"
                formControlName="newPassword"
                autocomplete="new-password"
              />
              <span class="hint">{{ 'password.resetHint' | t }}</span>
              @if (passwordError(); as message) {
                <span class="error">{{ message }}</span>
              }
            </div>
            <div class="field">
              <label for="confirm">{{ 'acct.confirmPassword' | t }}</label>
              <input
                id="confirm"
                class="input lg"
                type="password"
                formControlName="confirm"
                autocomplete="new-password"
              />
              @if (mismatch()) {
                <span class="error">{{ 'acct.passwordsDiffer' | t }}</span>
              }
            </div>
            <button class="btn primary lg block" type="submit" [disabled]="busy()">
              {{ 'acct.setPassword' | t }}
            </button>
          </form>
        }
        @if (!staffCode()) {
          <p class="muted small">{{ 'state.forgot.staffHint' | t }}</p>
        }
        <a class="back" routerLink="/sign-in">{{ 'security.back' | t }}</a>
      </div>
    </div>
  `,
  styles: [
    AUTH_CARD_STYLES,
    `
      .switch {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        padding: 4px;
        border-radius: 10px;
        background: var(--surface-2, var(--bg));
      }
      .switch button {
        border: 0;
        background: none;
        padding: 8px;
        border-radius: 8px;
        font: inherit;
        color: var(--muted);
        cursor: pointer;
        display: inline-flex;
        gap: 6px;
        align-items: center;
        justify-content: center;
      }
      .switch button.active {
        background: var(--surface, #fff);
        color: var(--text, inherit);
        font-weight: 600;
        box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
      }
      .stack {
        display: grid;
        gap: 12px;
      }
      .small {
        font-size: 12.5px;
        margin: 0;
      }
    `,
  ],
})
export default class ForgotPasswordPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly mode = signal<'email' | 'phone'>('email');
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly codeSentTo = signal<string | null>(null);
  protected readonly mismatch = signal(false);
  protected readonly emailForm = this.fb.group({
    // What the person typed on the sign-in page comes along (in the navigation, not the URL).
    email: [
      (this.router.getCurrentNavigation()?.extras.state?.['login'] as string | undefined) ?? '',
      [Validators.required, Validators.email],
    ],
  });
  protected readonly typedLogin = toSignal(this.emailForm.controls.email.valueChanges, {
    initialValue: this.emailForm.controls.email.value,
  });
  /** The pharmacy code when a staff login is typed: its pharmacy resets it, not an email. */
  protected readonly staffCode = computed(() => staffLoginCode(this.typedLogin()));
  protected readonly phoneForm = this.fb.group({ phone: ['', Validators.required] });
  protected readonly resetForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\s*\d{6}\s*$/)]],
    newPassword: ['', passwordValidators(TWO_FACTOR_MIN_PASSWORD)],
    confirm: ['', Validators.required],
  });

  protected use(mode: 'email' | 'phone'): void {
    this.failure.set(null);
    this.mode.set(mode);
  }

  protected emailError(): string | null {
    return controlError(this.emailForm.controls.email);
  }

  protected passwordError(): string | null {
    return controlError(this.resetForm.controls.newPassword);
  }

  protected async sendLink(): Promise<void> {
    if (this.staffCode() || !validate(this.emailForm)) {
      return;
    }
    if (
      await this.run(() =>
        this.api.post('/auth/password-reset', this.emailForm.getRawValue(), { silent: true }),
      )
    ) {
      this.sentTo.set(this.emailForm.controls.email.value);
    }
  }

  protected async sendCode(): Promise<void> {
    if (!validate(this.phoneForm)) {
      return;
    }
    const phone = this.phoneForm.controls.phone.value.trim();
    if (
      await this.run(() => this.api.post('/auth/password-reset/phone', { phone }, { silent: true }))
    ) {
      this.codeSentTo.set(phone);
    }
  }

  protected async reset(): Promise<void> {
    const { code, newPassword, confirm } = this.resetForm.getRawValue();
    this.mismatch.set(newPassword !== confirm);
    if (!validate(this.resetForm) || this.mismatch()) {
      return;
    }
    const done = await this.run(() =>
      this.api.post(
        '/auth/password-reset/phone/complete',
        { phone: this.codeSentTo(), code: code.trim(), newPassword },
        { silent: true },
      ),
    );
    if (done) {
      this.toasts.success(this.translations.t('acct.passwordSet'));
      await this.router.navigateByUrl('/sign-in');
    }
  }

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
