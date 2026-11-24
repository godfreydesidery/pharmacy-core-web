import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TWO_FACTOR_MIN_PASSWORD, passwordValidators } from '../../core/session/password-rule';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { LogoComponent } from '../../core/layout/logo.component';
import { SessionStore } from '../../core/session/session.store';
import { controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { AUTH_CARD_STYLES } from './auth-card';

/**
 * The link in the new mailbox (`?token=`): confirms an email change, or completes an account
 * recovery started by support, which also sets a new password. Nothing happens until the person
 * presses the button, so a mail scanner that opens links cannot use the token.
 */
@Component({
  selector: 'app-confirm-email',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, LogoComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card-page">
      <form class="auth-card" [formGroup]="form" (ngSubmit)="confirm()" novalidate>
        <app-logo [size]="40" />
        <h1>{{ (recovery ? 'acct.recoverTitle' : 'acct.confirmTitle') | t }}</h1>
        @if (!token) {
          <div class="notice tone-amber">
            <app-icon name="alert" /> {{ 'acct.missingToken' | t }}
          </div>
        } @else if (done()) {
          <div class="notice tone-green" data-testid="email-confirmed">
            <app-icon name="check" /> {{ 'acct.confirmed' | t }}
          </div>
        } @else {
          <p class="muted">{{ (recovery ? 'acct.recoverHint' : 'acct.confirmHint') | t }}</p>
          @if (failure()) {
            <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
          }
          @if (recovery) {
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
              @if (error(); as message) {
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
          }
          <button class="btn primary lg block" type="submit" [disabled]="busy()">
            <app-icon name="check" [size]="16" /> {{ 'acct.confirm' | t }}
          </button>
        }
        <a class="back" routerLink="/sign-in">{{ 'acct.toSignIn' | t }}</a>
      </form>
    </div>
  `,
  styles: AUTH_CARD_STYLES,
})
export default class ConfirmEmailPage {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  /** A recovery's token starts prc_ (an email change's pec_). */
  protected readonly recovery = !!this.token?.startsWith('prc_');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly mismatch = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    newPassword: ['', this.recovery ? passwordValidators(TWO_FACTOR_MIN_PASSWORD) : []],
    confirm: [''],
  });

  protected error(): string | null {
    return controlError(this.form.controls.newPassword);
  }

  protected async confirm(): Promise<void> {
    const { newPassword, confirm } = this.form.getRawValue();
    this.mismatch.set(this.recovery && newPassword !== confirm);
    if (!validate(this.form) || this.mismatch()) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post(
        '/auth/email-change/confirm',
        { token: this.token, newPassword: this.recovery ? newPassword : null },
        { silent: true },
      );
      if (this.recovery) {
        // Every session of the account ended with the recovery.
        this.session.signOut();
      }
      this.done.set(true);
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
