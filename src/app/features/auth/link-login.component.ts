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
 * Links a pharmacy's staff login (juma@DAWA) to the signed-in personal account, so the person
 * signs in everywhere with one account. Only the person can: they give the login and its password
 * and their own password (and 2FA code). The pharmacy's membership moves to this account; the
 * staff login stops working. Shown to personal accounts only.
 */
@Component({
  selector: 'app-link-login',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (overview(); as o) {
      @if (!o.managed) {
        <section class="card card-pad stack link" data-testid="link-login">
          <h3>{{ 'link.title' | t }}</h3>
          <p class="muted">{{ 'link.hint' | t }}</p>
          @if (!open()) {
            <div>
              <button class="btn" type="button" (click)="open.set(true)">
                <app-icon name="link" [size]="16" /> {{ 'link.start' | t }}
              </button>
            </div>
          } @else {
            <form class="stack" [formGroup]="form" (ngSubmit)="link()">
              <div class="field">
                <label for="link-signin">{{ 'link.signIn' | t }}</label>
                <input
                  id="link-signin"
                  class="input"
                  formControlName="signIn"
                  placeholder="juma@DAWA"
                  autocomplete="off"
                />
              </div>
              <div class="field">
                <label for="link-login-password">{{ 'link.loginPassword' | t }}</label>
                <input
                  id="link-login-password"
                  class="input"
                  type="password"
                  formControlName="loginPassword"
                  autocomplete="off"
                />
              </div>
              <div class="field">
                <label for="link-password">{{ 'link.password' | t }}</label>
                <input
                  id="link-password"
                  class="input"
                  type="password"
                  formControlName="password"
                  autocomplete="current-password"
                />
              </div>
              @if (o.twoFactorEnabled) {
                <div class="field">
                  <label for="link-code">{{ 'acct.code2fa' | t }}</label>
                  <input
                    id="link-code"
                    class="input"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    formControlName="code"
                  />
                </div>
              }
              <div class="notice tone-amber small">{{ 'link.warning' | t }}</div>
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              <div class="actions">
                <button class="btn" type="button" (click)="close()">{{ 'acct.cancel' | t }}</button>
                <button class="btn primary" type="submit" [disabled]="busy()">
                  {{ 'link.submit' | t }}
                </button>
              </div>
            </form>
          }
        </section>
      }
    }
  `,
  styles: `
    .link {
      max-width: 720px;
      margin-top: 18px;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `,
})
export class LinkLoginComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);

  protected readonly overview = signal<SecurityOverview | null>(null);
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    signIn: ['', [Validators.required, Validators.pattern(/^\s*[^@\s]+@[A-Za-z0-9]+\s*$/)]],
    loginPassword: ['', Validators.required],
    password: ['', Validators.required],
    code: [''],
  });

  async ngOnInit(): Promise<void> {
    this.overview.set(
      await this.api.get<SecurityOverview>('/auth/security', undefined, {
        noBranch: true,
        silent: true,
      }),
    );
  }

  protected close(): void {
    this.form.reset();
    this.failure.set(null);
    this.open.set(false);
  }

  protected async link(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post(
        '/auth/link-login',
        {
          signIn: v.signIn.trim(),
          loginPassword: v.loginPassword,
          password: v.password,
          code: v.code.trim() || null,
        },
        { silent: true, noBranch: true },
      );
      // The pharmacy is now among this account's own.
      const me = await this.api.get<Me>('/auth/me', undefined, { silent: true, noBranch: true });
      this.session.refresh(me.user, me.memberships);
      this.toasts.success(this.translations.t('link.done'));
      this.close();
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
