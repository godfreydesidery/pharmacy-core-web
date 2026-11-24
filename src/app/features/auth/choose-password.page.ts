import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { Me } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { LogoComponent } from '../../core/layout/logo.component';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { ToastService } from '../../core/ui/toast.service';
import { AUTH_CARD_STYLES } from './auth-card';
import { TemporaryPasswordHandoff } from './temporary-password';

/**
 * A staff login the pharmacy created signs in on a temporary password and must choose its own
 * before anything else. The temporary one, just typed at sign-in, comes along in the navigation so
 * the person is not asked for it again; after a reload they type it.
 */
@Component({
  selector: 'app-choose-password',
  imports: [ReactiveFormsModule, IconComponent, LogoComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card-page">
      <form class="auth-card" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-logo [size]="40" />
        <h1>{{ 'logins.chooseTitle' | t }}</h1>
        <p class="muted">{{ 'logins.chooseText' | t }}</p>
        @if (failure()) {
          <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
        }
        @if (!given) {
          <div class="field">
            <label for="currentPassword">{{ 'logins.temporary' | t }}</label>
            <input
              id="currentPassword"
              class="input lg"
              type="password"
              formControlName="currentPassword"
              autocomplete="current-password"
              [class.invalid]="error('currentPassword')"
            />
            @if (error('currentPassword'); as message) {
              <span class="error">{{ message }}</span>
            }
          </div>
        }
        <div class="field">
          <label for="newPassword">{{ 'logins.newPassword' | t }}</label>
          <input
            id="newPassword"
            class="input lg"
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
            [class.invalid]="error('newPassword')"
          />
          <span class="hint">{{ 'logins.newPasswordHint' | t }}</span>
          @if (error('newPassword'); as message) {
            <span class="error">{{ message }}</span>
          }
        </div>
        <div class="field">
          <label for="confirm">{{ 'logins.confirmPassword' | t }}</label>
          <input
            id="confirm"
            class="input lg"
            type="password"
            formControlName="confirm"
            autocomplete="new-password"
            [class.invalid]="mismatch()"
          />
          @if (mismatch()) {
            <span class="error">{{ 'logins.mismatch' | t }}</span>
          }
        </div>
        <button class="btn primary lg block" type="submit" [disabled]="busy()">
          <app-icon name="lock" [size]="16" /> {{ 'logins.save' | t }}
        </button>
        <button class="back link" type="button" (click)="signOut()">
          {{ 'shell.signOut' | t }}
        </button>
      </form>
    </div>
  `,
  styles: [
    AUTH_CARD_STYLES,
    `
      .link {
        background: none;
        border: 0;
        cursor: pointer;
      }
    `,
  ],
})
export default class ChoosePasswordPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly session = inject(SessionStore);

  /** The temporary password typed at sign-in, handed over in memory (WEB-16), once. */
  protected readonly given: string | null = inject(TemporaryPasswordHandoff).take();
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly mismatch = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    currentPassword: [this.given ?? '', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  protected error(name: 'currentPassword' | 'newPassword'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected async save(): Promise<void> {
    const { currentPassword, newPassword, confirm } = this.form.getRawValue();
    this.mismatch.set(newPassword !== confirm);
    if (!validate(this.form) || this.mismatch()) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post(
        '/auth/change-password',
        { currentPassword, newPassword },
        { silent: true, noBranch: true },
      );
      const me = await this.api.get<Me>('/auth/me', undefined, { silent: true, noBranch: true });
      this.session.refresh(me.user, me.memberships);
      this.toasts.success(this.translations.t('logins.chosen'));
      await this.router.navigateByUrl('/workspace');
    } catch (failure) {
      const error = ApiError.from(failure);
      if (!applyApiError(this.form, error)) {
        this.failure.set(error.message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    try {
      await this.api.post('/auth/sign-out', {}, { silent: true, noBranch: true });
    } catch {
      // Signed out locally whatever the server says.
    }
    this.session.signOut();
    await this.router.navigateByUrl('/sign-in');
  }
}
