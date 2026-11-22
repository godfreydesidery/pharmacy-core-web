import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { User } from '../../core/api/models';
import { SHARED } from '../../core/shared';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

/**
 * The signed-in person's name, and a staff login's contact phone. A person's own phone is verified
 * by SMS in the sign-in email and phone card instead.
 */
@Component({
  selector: 'app-profile-section',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="card card-pad stack"
      style="max-width:520px;margin-bottom:18px"
      [formGroup]="form"
      (ngSubmit)="save()"
    >
      <h3>{{ 'admin2.profile' | t }}</h3>
      <div class="field">
        <label for="profile-name">{{ 'platform.name' | t }}</label
        ><input id="profile-name" class="input" formControlName="name" />
        @if (err('name'); as m) {
          <span class="error">{{ m }}</span>
        }
      </div>
      @if (managed()) {
        <div class="field">
          <label for="profile-phone">{{ 'admin2.phone' | t }}</label
          ><input
            id="profile-phone"
            class="input"
            type="tel"
            formControlName="phone"
            placeholder="+255754000111"
          />
          <span class="hint">{{ 'admin2.phoneHint' | t }}</span>
          @if (err('phone'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
      }
      <div>
        <button class="btn primary" type="submit" [disabled]="busy()">
          <app-icon name="check" [size]="16" /> {{ 'common.save' | t }}
        </button>
      </div>
    </form>
  `,
})
export class ProfileSectionComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly busy = signal(false);
  /** A staff login keeps a contact phone here; a person verifies theirs by SMS (below). */
  protected readonly managed = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', Validators.pattern(/^\s*(\+[\d\s-]{8,20})?\s*$/)],
  });

  async ngOnInit(): Promise<void> {
    const me = await this.api.get<User>('/auth/profile', undefined, {
      noBranch: true,
      silent: true,
    });
    this.managed.set(!!me.managed);
    this.form.reset({ name: me.name, phone: me.phone ?? '' });
  }

  protected err(name: 'name' | 'phone'): string | null {
    const control = this.form.controls[name];
    if (name === 'phone' && control.errors?.['pattern'] && control.touched) {
      return this.translations.t('admin2.phoneHint');
    }
    return controlError(control);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const me = await this.api.put<User>(
        '/auth/profile',
        this.managed()
          ? { name: v.name.trim(), phone: v.phone.trim() || null }
          : { name: v.name.trim() },
        { noBranch: true, silent: true },
      );
      this.form.reset({ name: me.name, phone: me.phone ?? '' });
      this.toasts.success(this.translations.t('admin2.profileSaved'));
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
