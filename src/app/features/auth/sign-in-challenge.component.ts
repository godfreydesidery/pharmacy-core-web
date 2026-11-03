import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { Session } from '../../core/api/models';
import { PasskeyOptions, SignInChallenge } from '../../core/api/security.models';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { cancelled, getPasskey, passkeysSupported } from '../../core/security/webauthn';
import { IconComponent } from '../../core/ui/icon.component';

/**
 * The second step of a sign-in with two-factor on: a 6-digit code from the authenticator app, a
 * recovery code, or a passkey. Emits the session once the API accepts one.
 */
@Component({
  selector: 'app-sign-in-challenge',
  imports: [ReactiveFormsModule, IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="challenge" [formGroup]="form" (ngSubmit)="verify()" novalidate>
      <div class="badge-icon"><app-icon name="shield" [size]="26" /></div>
      <h1>{{ 'security.challengeTitle' | t }}</h1>
      <p class="muted">
        {{ (recovery() ? 'security.recoveryHint' : 'security.challengeHint') | t }}
      </p>
      @if (failure()) {
        <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
      }
      <div class="field">
        <label for="code">{{ (recovery() ? 'security.recoveryCode' : 'security.code') | t }}</label>
        <input
          #codeInput
          id="code"
          class="input lg code"
          [class.otp]="!recovery()"
          formControlName="code"
          [attr.inputmode]="recovery() ? 'text' : 'numeric'"
          [attr.maxlength]="recovery() ? 9 : 6"
          autocomplete="one-time-code"
          [placeholder]="recovery() ? 'xxxx-xxxx' : '••••••'"
          (input)="autoSubmit()"
        />
      </div>
      <button class="btn primary lg block" type="submit" [disabled]="busy()">
        {{ (busy() ? 'security.verifying' : 'security.verify') | t }}
      </button>
      <div class="alternatives">
        <button type="button" class="link-btn" (click)="toggleRecovery()">
          {{ (recovery() ? 'security.useApp' : 'security.useRecovery') | t }}
        </button>
        @if (hasPasskey()) {
          <button type="button" class="link-btn" (click)="passkey()">
            <app-icon name="key" [size]="14" /> {{ 'security.usePasskey' | t }}
          </button>
        }
        <button type="button" class="link-btn muted" (click)="cancel.emit()">
          {{ 'security.back' | t }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .challenge {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      max-width: 380px;
    }
    .badge-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: var(--primary-50, #eef4ff);
      color: var(--primary, #2463eb);
    }
    h1 {
      font-size: 24px;
      letter-spacing: -0.02em;
    }
    .code.otp {
      font-size: 26px;
      letter-spacing: 0.5em;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .alternatives {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .link-btn {
      background: none;
      border: 0;
      padding: 4px 0;
      color: var(--primary, #2463eb);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .link-btn.muted {
      color: var(--muted);
    }
  `,
})
export class SignInChallengeComponent {
  private readonly api = inject(Api);
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  readonly challenge = input.required<SignInChallenge>();
  readonly signedIn = output<Session>();
  readonly cancel = output<void>();

  protected readonly recovery = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly hasPasskey = computed(
    () => this.challenge().methods.includes('PASSKEY') && passkeysSupported(),
  );
  protected readonly form = inject(FormBuilder).nonNullable.group({
    code: ['', Validators.required],
  });

  constructor() {
    afterNextRender(() => this.codeInput()?.nativeElement.focus());
  }

  protected toggleRecovery(): void {
    this.recovery.update((value) => !value);
    this.form.reset();
    this.failure.set(null);
    queueMicrotask(() => this.codeInput()?.nativeElement.focus());
  }

  /** A full 6-digit code submits itself, as authenticator apps users expect. */
  protected autoSubmit(): void {
    const code = this.form.controls.code.value.replace(/\s/g, '');
    if (!this.recovery() && /^\d{6}$/.test(code) && !this.busy()) {
      void this.verify();
    }
  }

  protected async verify(): Promise<void> {
    const code = this.form.controls.code.value.trim();
    if (!code) {
      return;
    }
    this.busy.set(true);
    this.failure.set(null);
    try {
      const session = await this.api.post<Session>(
        '/auth/sign-in/verify',
        { challengeToken: this.challenge().challengeToken, code },
        { silent: true },
      );
      this.signedIn.emit(session);
    } catch (failure) {
      const error = ApiError.from(failure);
      this.failure.set(error.message);
      if (error.reason === 'challenge_expired') {
        setTimeout(() => this.cancel.emit(), 1500);
      }
      this.form.reset();
    } finally {
      this.busy.set(false);
    }
  }

  protected async passkey(): Promise<void> {
    this.failure.set(null);
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
      this.signedIn.emit(session);
    } catch (failure) {
      if (!cancelled(failure)) {
        this.failure.set(ApiError.from(failure).message);
      }
    }
  }
}
