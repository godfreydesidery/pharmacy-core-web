import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { Session } from '../../core/api/models';
import { InvitationPreview, SignInChallenge, isChallenge } from '../../core/api/security.models';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { LogoComponent } from '../../core/layout/logo.component';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { AUTH_CARD_STYLES } from './auth-card';
import { SignInChallengeComponent } from './sign-in-challenge.component';

/**
 * The invitee's page (`/accept-invitation?token=`): who invited them where, then a name and a new
 * password, or, for an existing account, its current password. Accepting signs them in.
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
            (signedIn)="enter($event)"
            (cancel)="challenge.set(null)"
          />
        </div>
      } @else {
        <form class="auth-card" [formGroup]="form" (ngSubmit)="accept()" novalidate>
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
              <p class="muted small">
                {{ (invite.existingUser ? 'security.inviteExisting' : 'security.inviteNew') | t }}
              </p>
              @if (failure()) {
                <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
              }
              @if (!invite.existingUser) {
                <div class="field">
                  <label for="name">{{ 'security.yourName' | t }}</label>
                  <input id="name" class="input lg" formControlName="name" autocomplete="name" />
                </div>
              }
              <div class="field">
                <label for="password">{{
                  (invite.existingUser ? 'auth.password' : 'security.newPassword') | t
                }}</label>
                <input
                  id="password"
                  class="input lg"
                  type="password"
                  formControlName="password"
                  [attr.autocomplete]="invite.existingUser ? 'current-password' : 'new-password'"
                  [class.invalid]="error()"
                />
                @if (error(); as message) {
                  <span class="error">{{ message }}</span>
                }
              </div>
              <button class="btn primary lg block" type="submit" [disabled]="busy()">
                <app-icon name="check" [size]="16" />
                {{ (busy() ? 'security.accepting' : 'security.accept') | t }}
              </button>
            }
          }
          <a class="back" routerLink="/sign-in">{{ 'security.back' | t }}</a>
        </form>
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
    `,
  ],
})
export default class AcceptInvitationPage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected readonly invitation = signal<InvitationPreview | null>(null);
  protected readonly challenge = signal<SignInChallenge | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
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
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected error(): string | null {
    return controlError(this.form.controls.password);
  }

  protected async accept(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      const answer = await this.api.post<Session | SignInChallenge>(
        '/auth/invitations/accept',
        { token: this.token, ...this.form.getRawValue() },
        { silent: true },
      );
      if (isChallenge(answer)) {
        this.challenge.set(answer);
        return;
      }
      await this.enter(answer);
    } catch (failure) {
      const error = ApiError.from(failure);
      if (!applyApiError(this.form, error)) {
        this.failure.set(error.message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async enter(session: Session): Promise<void> {
    this.session.signIn(session);
    await this.router.navigateByUrl('/workspace');
  }
}
