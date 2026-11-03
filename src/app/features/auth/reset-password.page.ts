import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { LogoComponent } from '../../core/layout/logo.component';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { ToastService } from '../../core/ui/toast.service';
import { AUTH_CARD_STYLES } from './auth-card';
import { Translations } from '../../core/i18n/translations.store';

/** Chooses a new password from the link in the reset email (`?token=`). */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, LogoComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card-page">
      <form class="auth-card" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-logo [size]="40" />
        <h1>{{ 'security.resetTitle' | t }}</h1>
        @if (!token) {
          <div class="notice tone-amber">
            <app-icon name="alert" /> {{ 'security.missingToken' | t }}
          </div>
        } @else {
          <p class="muted">{{ 'security.resetHint' | t }}</p>
          @if (failure()) {
            <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
          }
          <div class="field">
            <label for="newPassword">{{ 'security.newPassword' | t }}</label>
            <input
              id="newPassword"
              class="input lg"
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
              [class.invalid]="error('newPassword')"
            />
            @if (error('newPassword'); as message) {
              <span class="error">{{ message }}</span>
            }
          </div>
          <div class="field">
            <label for="confirm">{{ 'security.confirmPassword' | t }}</label>
            <input
              id="confirm"
              class="input lg"
              type="password"
              formControlName="confirm"
              autocomplete="new-password"
              [class.invalid]="mismatch()"
            />
            @if (mismatch()) {
              <span class="error">{{ 'security.passwordsDiffer' | t }}</span>
            }
          </div>
          <button class="btn primary lg block" type="submit" [disabled]="busy()">
            <app-icon name="lock" [size]="16" /> {{ 'security.savePassword' | t }}
          </button>
        }
        <a class="back" routerLink="/forgot-password">{{ 'security.forgotTitle' | t }}</a>
      </form>
    </div>
  `,
  styles: AUTH_CARD_STYLES,
})
export default class ResetPasswordPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly session = inject(SessionStore);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly mismatch = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  protected error(name: 'newPassword'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected async save(): Promise<void> {
    const { newPassword, confirm } = this.form.getRawValue();
    this.mismatch.set(newPassword !== confirm);
    if (!validate(this.form) || this.mismatch()) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post(
        '/auth/password-reset/complete',
        { token: this.token, newPassword },
        { silent: true },
      );
      this.session.signOut();
      this.toasts.success(this.translations.t('security.passwordSaved'));
      await this.router.navigateByUrl('/sign-in');
    } catch (failure) {
      const error = ApiError.from(failure);
      if (!applyApiError(this.form, error)) {
        this.failure.set(error.message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
