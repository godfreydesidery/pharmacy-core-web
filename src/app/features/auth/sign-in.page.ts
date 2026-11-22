import { ChangeDetectionStrategy, Component, inject, isDevMode, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PasskeyOptions, SignInChallenge, isChallenge } from '../../core/api/security.models';
import { cancelled, getPasskey, passkeysSupported } from '../../core/security/webauthn';
import { SignInChallengeComponent } from './sign-in-challenge.component';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { Session } from '../../core/api/models';
import { LogoComponent } from '../../core/layout/logo.component';
import { usableReturnUrl } from '../../core/session/guards';
import { SessionStore } from '../../core/session/session.store';
import { controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { LanguageSwitchComponent } from '../../core/i18n/language-switch.component';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { retryText } from './retry';

const DEV_ACCOUNTS = [
  { label: 'Root administrator', email: 'root@pharmacy.local', password: 'Root#2026' },
  { label: 'Afya · Administrator', email: 'admin@afya.co.tz', password: 'Afya#2026' },
  { label: 'Afya · Cashier', email: 'cashier@afya.co.tz', password: 'Cashier#2026' },
];

@Component({
  selector: 'app-sign-in',
  imports: [
    ReactiveFormsModule,
    IconComponent,
    LogoComponent,
    TranslatePipe,
    LanguageSwitchComponent,
    RouterLink,
    SignInChallengeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth">
      <section class="art">
        <div class="brand">
          <app-logo [size]="40" [light]="true" />
          <div>
            <b>Pharmacy</b><small>{{ 'ui.brand.subtitle' | t }}</small>
          </div>
        </div>
        <div>
          <h2>{{ 'auth.tagline' | t }}</h2>
          <p>{{ 'auth.taglineDetail' | t }}</p>
        </div>
        <div class="feats">
          <div><app-icon name="scan" /> {{ 'auth.feature.checkout' | t }}</div>
          <div><app-icon name="alert" /> {{ 'auth.feature.alerts' | t }}</div>
          <div><app-icon name="building" /> {{ 'auth.feature.branches' | t }}</div>
          <div><app-icon name="shield" /> {{ 'auth.feature.access' | t }}</div>
        </div>
      </section>
      <section class="form-side">
        @if (challenge(); as pending) {
          <app-sign-in-challenge
            [challenge]="pending"
            (signedIn)="enter($event)"
            (cancel)="challenge.set(null)"
          />
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-top">
              <app-logo [size]="44" />
              <app-language-switch [compact]="true" />
            </div>
            <h1>{{ 'auth.welcome' | t }}</h1>
            <p class="muted">{{ 'auth.subtitle' | t }}</p>
            @if (expired) {
              <div class="notice tone-amber">
                <app-icon name="clock" /> {{ 'auth.expired' | t }}
              </div>
            }
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
                [class.invalid]="error('email')"
              />
              @if (error('email'); as message) {
                <span class="error">{{ message }}</span>
              }
            </div>
            <div class="field">
              <label for="password">{{ 'auth.password' | t }}</label>
              <div class="pw">
                <input
                  id="password"
                  class="input lg"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="current-password"
                  [class.invalid]="error('password')"
                />
                <button
                  type="button"
                  class="icon-btn sm"
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="
                    (showPassword() ? 'auth.hidePassword' : 'auth.showPassword') | t
                  "
                >
                  <app-icon name="eye" [size]="16" />
                </button>
              </div>
              @if (error('password'); as message) {
                <span class="error">{{ message }}</span>
              }
            </div>
            <button class="btn primary lg block" type="submit" [disabled]="busy()">
              {{ (busy() ? 'auth.signingIn' : 'auth.signIn') | t }}
            </button>
            <a class="forgot" routerLink="/forgot-password">{{ 'security.forgot' | t }}</a>
            @if (passkeys) {
              <div class="divider">
                <span>{{ 'security.or' | t }}</span>
              </div>
              <button class="btn lg block" type="button" [disabled]="busy()" (click)="passkey()">
                <app-icon name="key" [size]="16" /> {{ 'security.passkeySignIn' | t }}
              </button>
            }
            @if (dev) {
              <div class="dev">
                <span class="faint">{{ 'auth.demoAccounts' | t }}</span>
                @for (account of accounts; track account.email) {
                  <button type="button" class="chip" (click)="use(account.email, account.password)">
                    {{ account.label }}
                  </button>
                }
              </div>
            }
            <p class="faint foot">{{ 'auth.footer' | t }}</p>
          </form>
        }
      </section>
    </div>
  `,
  styles: `
    .forgot {
      align-self: center;
      font-size: 13px;
      color: var(--primary);
    }
    .divider {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .form-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .auth {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      background: var(--surface);
    }
    .art {
      background:
        radial-gradient(1200px 600px at -10% -10%, #60a5fa55, transparent),
        linear-gradient(145deg, #1e3a8a, #2463eb 50%, #0ea5e9);
      color: #fff;
      padding: 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .brand b {
      display: block;
      font-size: 20px;
    }
    .brand small {
      opacity: 0.8;
    }
    h2 {
      font-size: 36px;
      line-height: 1.15;
      max-width: 460px;
      letter-spacing: -0.02em;
    }
    .art p {
      opacity: 0.85;
      max-width: 440px;
      margin-top: 12px;
      font-size: 15px;
    }
    .feats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      max-width: 480px;
    }
    .feats div {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      padding: 14px;
      font-size: 13px;
      display: flex;
      gap: 10px;
      align-items: center;
      backdrop-filter: blur(6px);
    }
    .form-side {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }
    form {
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    h1 {
      font-size: 26px;
      margin-top: 10px;
      letter-spacing: -0.02em;
    }
    .input.lg {
      height: 44px;
    }
    .pw {
      position: relative;
    }
    .pw .icon-btn {
      position: absolute;
      right: 6px;
      top: 7px;
    }
    .dev {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      border: 1px dashed var(--border-strong);
      border-radius: 12px;
      padding: 10px;
    }
    .dev span {
      width: 100%;
      font-size: 11.5px;
    }
    .foot {
      text-align: center;
      font-size: 12px;
      margin-top: 10px;
    }
    @media (max-width: 900px) {
      .auth {
        grid-template-columns: 1fr;
      }
      .art {
        display: none;
      }
    }
  `,
})
export default class SignInPage {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translations = inject(Translations);

  protected readonly dev = isDevMode();
  protected readonly accounts = DEV_ACCOUNTS;
  protected readonly year = new Date().getFullYear();
  protected readonly expired = this.route.snapshot.queryParamMap.has('expired');
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly challenge = signal<SignInChallenge | null>(null);
  protected readonly passkeys = passkeysSupported();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected error(name: 'email' | 'password'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected use(email: string, password: string): void {
    this.form.setValue({ email, password });
  }

  protected async submit(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      const answer = await this.api.post<Session | SignInChallenge>(
        '/auth/sign-in',
        this.form.getRawValue(),
        { silent: true },
      );
      if (isChallenge(answer)) {
        this.challenge.set(answer);
        return;
      }
      await this.enter(answer);
    } catch (failure) {
      this.failure.set(this.message(ApiError.from(failure)));
    } finally {
      this.busy.set(false);
    }
  }

  /** Usernameless: the authenticator names the account. */
  protected async passkey(): Promise<void> {
    this.failure.set(null);
    this.busy.set(true);
    try {
      const options = await this.api.post<PasskeyOptions>(
        '/auth/passkeys/sign-in/options',
        {},
        { silent: true },
      );
      const credential = await getPasskey(options.options.publicKey);
      const session = await this.api.post<Session>(
        '/auth/passkeys/sign-in',
        { ceremonyUid: options.ceremonyUid, credential },
        { silent: true },
      );
      await this.enter(session);
    } catch (failure) {
      if (!cancelled(failure)) {
        this.failure.set(this.message(ApiError.from(failure)));
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async enter(session: Session): Promise<void> {
    this.session.signIn(session);
    if (session.user.twoFactorSetupRequired) {
      await this.router.navigateByUrl('/account?setup=2fa');
      return;
    }
    const returnUrl = usableReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    await this.router.navigateByUrl(
      returnUrl ? `/workspace?returnUrl=${encodeURIComponent(returnUrl)}` : '/workspace',
    );
  }

  /** Adds the wait to a 423 or 429, such as "Try again in 14 minutes." */
  private message(error: ApiError): string {
    return error.retryAfterSeconds
      ? `${error.message} ${retryText(error.retryAfterSeconds, (k, p) => this.translations.t(k, p))}`
      : error.message;
  }
}
