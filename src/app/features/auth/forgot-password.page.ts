import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { LogoComponent } from '../../core/layout/logo.component';
import { controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { AUTH_CARD_STYLES } from './auth-card';

/** Asks for a password reset link by email. The answer never tells whether the email is known. */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, LogoComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card-page">
      <form class="auth-card" [formGroup]="form" (ngSubmit)="send()" novalidate>
        <app-logo [size]="40" />
        <h1>{{ 'security.forgotTitle' | t }}</h1>
        @if (sentTo(); as email) {
          <div class="notice tone-green">
            <app-icon name="mail" /> {{ 'security.linkSent' | t: { email } }}
          </div>
        } @else {
          <p class="muted">{{ 'security.forgotHint' | t }}</p>
          @if (failure()) {
            <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
          }
          <div class="field">
            <label for="email">{{ 'auth.email' | t }}</label>
            <input
              id="email"
              class="input lg"
              type="email"
              formControlName="email"
              autocomplete="username"
              [class.invalid]="error()"
            />
            @if (error(); as message) {
              <span class="error">{{ message }}</span>
            }
          </div>
          <button class="btn primary lg block" type="submit" [disabled]="busy()">
            {{ (busy() ? 'security.sending' : 'security.sendLink') | t }}
          </button>
        }
        <a class="back" routerLink="/sign-in">{{ 'security.back' | t }}</a>
      </form>
    </div>
  `,
  styles: AUTH_CARD_STYLES,
})
export default class ForgotPasswordPage {
  private readonly api = inject(Api);

  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected error(): string | null {
    return controlError(this.form.controls.email);
  }

  protected async send(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post('/auth/password-reset', this.form.getRawValue(), { silent: true });
      this.sentTo.set(this.form.controls.email.value);
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
