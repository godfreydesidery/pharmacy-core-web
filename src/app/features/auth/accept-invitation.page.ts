import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SINGLE_FACTOR_MIN_PASSWORD, passwordValidators } from '../../core/session/password-rule';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { Me, Session } from '../../core/api/models';
import { InvitationPreview, SignInChallenge, isChallenge } from '../../core/api/security.models';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { LogoComponent } from '../../core/layout/logo.component';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { ToastService } from '../../core/ui/toast.service';
import { AUTH_CARD_STYLES } from './auth-card';
import { SignInChallengeComponent } from './sign-in-challenge.component';

/**
 * The invitee's page (`/accept-invitation?token=`): who invited them where, then one of three
 * ways in. Someone new makes their account (name and password). Someone with an account signs in
 * here, second factor included, and joins with it, whatever email it uses: the pharmacy sees which.
 * Someone already signed in joins with one click.
 */
@Component({
  selector: 'app-accept-invitation',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IconComponent,
    LogoComponent,
    TranslatePipe,
    SignInChallengeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card-page">
      @if (challenge(); as pending) {
        <div class="auth-card">
          <app-sign-in-challenge
            [challenge]="pending"
            (signedIn)="signedIn($event)"
            (cancel)="challenge.set(null)"
          />
        </div>
      } @else {
        <div class="auth-card">
          <app-logo [size]="40" />
          @if (loading()) {
            <p class="muted">…</p>
          } @else if (!invitation()) {
            <div class="notice tone-red">
              <app-icon name="alert" /> {{ failure() ?? ('security.missingToken' | t) }}
            </div>
          } @else {
            @let invite = invitation()!;
            <h1>{{ 'security.inviteTitle' | t: { pharmacy: invite.tenantName ?? '—' } }}</h1>
            <p class="muted">
              {{ 'security.inviteHint' | t: { inviter: invite.invitedBy, role: invite.roleName } }}
            </p>
            <div class="who">
              <app-icon name="mail" [size]="16" /> <b>{{ invite.email }}</b>
            </div>
            @if (invite.status !== 'PENDING') {
              <div class="notice tone-amber">
                <app-icon name="clock" />
                {{ 'security.inviteClosed' | t: { status: invite.status.toLowerCase() } }}
              </div>
            } @else {
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              @if (session.signedIn()) {
                <p class="muted small">
                  {{ 'join.signedInAs' | t: { who: session.signInName() } }}
                </p>
                <button
                  class="btn primary lg block"
                  type="button"
                  [disabled]="busy()"
                  (click)="join()"
                >
                  <app-icon name="check" [size]="16" />
                  {{
                    (busy() ? 'security.accepting' : 'join.as') | t: { who: session.signInName() }
                  }}
                </button>
                <button class="back link" type="button" (click)="notMe()">
                  {{ 'join.notYou' | t }}
                </button>
              } @else if (mode() === 'existing') {
                <form [formGroup]="signInForm" (ngSubmit)="signInAndJoin()" novalidate>
                  <p class="muted small">{{ 'join.signInToJoin' | t }}</p>
                  <div class="field">
                    <label for="email">{{ 'auth.email' | t }}</label>
                    <input
                      id="email"
                      class="input lg"
                      type="email"
                      formControlName="email"
                      autocomplete="username"
                    />
                  </div>
                  <div class="field">
                    <label for="current">{{ 'auth.password' | t }}</label>
                    <input
                      id="current"
                      class="input lg"
                      type="password"
                      formControlName="password"
                      autocomplete="current-password"
                    />
                  </div>
                  <button class="btn primary lg block" type="submit" [disabled]="busy()">
                    <app-icon name="check" [size]="16" />
                    {{ (busy() ? 'security.accepting' : 'join.signInAndJoin') | t }}
                  </button>
                </form>
                @if (!invite.existingUser) {
                  <button class="back link" type="button" (click)="switchTo('new')">
                    {{ 'join.newHere' | t }}
                  </button>
                }
              } @else {
                <form [formGroup]="form" (ngSubmit)="accept()" novalidate>
                  <p class="muted small">{{ 'security.inviteNew' | t }}</p>
                  <div class="field">
                    <label for="name">{{ 'security.yourName' | t }}</label>
                    <input id="name" class="input lg" formControlName="name" autocomplete="name" />
                  </div>
                  <div class="field">
                    <label for="password">{{ 'security.newPassword' | t }}</label>
                    <input
                      id="password"
                      class="input lg"
                      type="password"
                      formControlName="password"
                      autocomplete="new-password"
                      [class.invalid]="error()"
                    />
                    <span class="hint">{{ 'password.minLength' | t: { min: newAccountMin } }}</span>
                    @if (error(); as message) {
                      <span class="error">{{ message }}</span>
                    }
                  </div>
                  <button class="btn primary lg block" type="submit" [disabled]="busy()">
                    <app-icon name="check" [size]="16" />
                    {{ (busy() ? 'security.accepting' : 'security.accept') | t }}
                  </button>
                </form>
                <button class="back link" type="button" (click)="switchTo('existing')">
                  {{ 'join.haveAccount' | t }}
                </button>
              }
            }
          }
          <a class="back" routerLink="/sign-in">{{ 'security.back' | t }}</a>
        </div>
      }
    </div>
  `,
  styles: [
    AUTH_CARD_STYLES,
    `
      .who {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--surface-2, var(--bg));
      }
      .small {
        font-size: 13px;
      }
      form {
        display: grid;
        gap: 14px;
      }
      .link {
        background: none;
        border: 0;
        cursor: pointer;
      }
    `,
  ],
})
export default class AcceptInvitationPage implements OnInit {
  protected readonly newAccountMin = SINGLE_FACTOR_MIN_PASSWORD;
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly session = inject(SessionStore);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected readonly invitation = signal<InvitationPreview | null>(null);
  protected readonly challenge = signal<SignInChallenge | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  /** Making a new account, or signing in with the one the person has. */
  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [''],
    password: ['', passwordValidators(SINGLE_FACTOR_MIN_PASSWORD)],
  });
  protected readonly signInForm = inject(FormBuilder).nonNullable.group({
    email: ['', Validators.required],
    password: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    if (!this.token) {
      this.loading.set(false);
      return;
    }
    try {
      const preview = await this.api.get<InvitationPreview>(
        `/auth/invitations/${encodeURIComponent(this.token)}`,
        undefined,
        { silent: true },
      );
      this.invitation.set(preview);
      this.form.controls.name.setValue(preview.name);
      this.signInForm.controls.email.setValue(preview.email);
      this.mode.set(preview.existingUser ? 'existing' : 'new');
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected error(): string | null {
    return controlError(this.form.controls.password);
  }

  protected switchTo(mode: 'new' | 'existing'): void {
    this.failure.set(null);
    this.mode.set(mode);
  }

  /** A new account with the invited email. */
  protected async accept(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      const session = await this.api.post<Session>(
        '/auth/invitations/accept',
        { token: this.token, ...this.form.getRawValue() },
        { silent: true },
      );
      this.session.signIn(session);
      await this.router.navigateByUrl('/workspace');
    } catch (failure) {
      const error = ApiError.from(failure);
      if (error.reason === 'account_exists') {
        // The email has an account after all: sign in with it to join.
        this.mode.set('existing');
      }
      if (!applyApiError(this.form, error)) {
        this.failure.set(error.message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Signs in with the person's own account (any email), then joins. */
  protected async signInAndJoin(): Promise<void> {
    if (!validate(this.signInForm)) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      const answer = await this.api.post<Session | SignInChallenge>(
        '/auth/sign-in',
        this.signInForm.getRawValue(),
        { silent: true },
      );
      if (isChallenge(answer)) {
        this.challenge.set(answer);
        return;
      }
      await this.signedIn(answer);
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async signedIn(session: Session): Promise<void> {
    this.challenge.set(null);
    this.session.signIn(session);
    await this.join();
  }

  /** The signed-in account joins the pharmacy. */
  protected async join(): Promise<void> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post(
        '/auth/invitations/join',
        { token: this.token },
        { silent: true, noBranch: true },
      );
      const me = await this.api.get<Me>('/auth/me', undefined, { silent: true, noBranch: true });
      this.session.refresh(me.user, me.memberships);
      this.toasts.success(
        this.translations.t('join.joined', { pharmacy: this.invitation()?.tenantName ?? '' }),
      );
      await this.router.navigateByUrl('/workspace');
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Someone else's session is open here: sign it out and choose again. */
  protected async notMe(): Promise<void> {
    try {
      await this.api.post('/auth/sign-out', {}, { silent: true, noBranch: true });
    } catch {
      // Signed out here whatever the server says.
    }
    this.session.signOut();
    this.failure.set(null);
  }
}
