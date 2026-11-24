import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { SecurityOverview } from '../../core/api/security.models';
import {
  SINGLE_FACTOR_MIN_PASSWORD,
  TWO_FACTOR_MIN_PASSWORD,
  minPasswordLength,
  passwordValidators,
} from '../../core/session/password-rule';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { LanguageSwitchComponent } from '../../core/i18n/language-switch.component';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { NotificationPreferencesComponent } from '../../core/notifications/notification-preferences.component';
import { AccountContactsComponent } from './account-contacts.component';
import { LinkLoginComponent } from './link-login.component';
import { MyPharmaciesComponent } from './my-pharmacies.component';
import { AccountSecurityComponent } from './account-security.component';
import { SecurityHistoryComponent } from './security-history.component';
import { ProfileSectionComponent } from './profile-section.component';
import { Translations } from '../../core/i18n/translations.store';

function matching(group: AbstractControl): ValidationErrors | null {
  return group.get('newPassword')?.value === group.get('confirm')?.value
    ? null
    : { mismatch: true };
}

@Component({
  selector: 'app-account',
  imports: [
    ProfileSectionComponent,
    ...SHARED,
    LanguageSwitchComponent,
    TranslatePipe,
    NotificationPreferencesComponent,
    AccountSecurityComponent,
    AccountContactsComponent,
    LinkLoginComponent,
    MyPharmaciesComponent,
    SecurityHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'ui.account.title' | t }}</h1>
          <p class="sub">{{ session.user()?.name }} · {{ session.signInName() }}</p>
        </div>
      </div>
      <app-profile-section />
      <app-account-contacts />
      <app-link-login />
      <app-my-pharmacies />
      <div class="card card-pad stack language-card" style="max-width:520px;margin-bottom:18px">
        <h3>{{ 'account.language' | t }}</h3>
        <p class="muted">{{ 'account.languageHint' | t }}</p>
        <app-language-switch />
      </div>
      <form
        class="card card-pad stack"
        style="max-width:520px"
        [formGroup]="form"
        (ngSubmit)="save()"
      >
        <h3>{{ 'ui.account.changePassword' | t }}</h3>
        <app-field [label]="'ui.account.currentPassword' | t" [error]="err('currentPassword')">
          <input
            class="input"
            type="password"
            formControlName="currentPassword"
            autocomplete="current-password"
          />
        </app-field>
        <app-field [label]="'ui.account.newPassword' | t" [error]="err('newPassword')">
          <input
            class="input"
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
          />
          <span class="hint" data-testid="password-min-hint">{{
            (minLength() === twoFactorMin ? 'password.minLengthTwoFactor' : 'password.minLength')
              | t: { min: minLength() }
          }}</span>
        </app-field>
        <div class="field">
          <label>{{ 'ui.account.confirmPassword' | t }}</label><input
            class="input"
            type="password"
            formControlName="confirm"
            autocomplete="new-password"
          />
          @if (form.errors?.['mismatch'] && form.controls.confirm.touched) {
            <span class="error">{{ 'ui.account.passwordsDiffer' | t }}</span>
          }
        </div>
        <div class="actions">
          <button class="btn primary" type="submit" [disabled]="busy()">
            <app-icon name="check" [size]="16" /> {{ 'ui.account.updatePassword' | t }}
          </button>
        </div>
      </form>
      <app-account-security />
      <app-security-history />
      <app-notification-preferences />
    </div>
  `,
})
export default class AccountPage implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', passwordValidators(SINGLE_FACTOR_MIN_PASSWORD)],
      confirm: ['', Validators.required],
    },
    { validators: matching },
  );
  /** 8 with two-factor, 15 without (STD-21); 15 until the account's security is read. */
  protected readonly minLength = signal(SINGLE_FACTOR_MIN_PASSWORD);
  protected readonly twoFactorMin = TWO_FACTOR_MIN_PASSWORD;

  async ngOnInit(): Promise<void> {
    const overview = await this.api
      .get<SecurityOverview>('/auth/security', undefined, { silent: true })
      .catch(() => null);
    const min = minPasswordLength(overview);
    this.minLength.set(min);
    this.form.controls.newPassword.setValidators(passwordValidators(min));
    this.form.controls.newPassword.updateValueAndValidity();
  }

  protected err(name: 'currentPassword' | 'newPassword'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    try {
      const { currentPassword, newPassword } = this.form.getRawValue();
      await this.api.post(
        '/auth/change-password',
        { currentPassword, newPassword },
        { silent: true },
      );
      this.toasts.success(this.translations.t('toast.passwordUpdated'));
      this.form.reset();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
