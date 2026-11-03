import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import QRCode from 'qrcode';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import {
  Passkey,
  PasskeyOptions,
  RecoveryCodes,
  SecurityOverview,
  SessionInfo,
  TwoFactorSetup,
} from '../../core/api/security.models';
import { cancelled, createPasskey, passkeysSupported } from '../../core/security/webauthn';
import { IconComponent } from '../../core/ui/icon.component';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

/**
 * The account's sign-in security: two-step verification with an authenticator app (QR code,
 * confirmation, recovery codes shown once), passkeys, and the devices signed in.
 */
@Component({
  selector: 'app-account-security',
  imports: [FormsModule, IconComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="security">
      <div class="card card-pad stack">
        <div class="head">
          <div class="mark" [class.on]="overview()?.twoFactorEnabled">
            <app-icon name="shield" [size]="20" />
          </div>
          <div class="grow">
            <h3>Two-step verification</h3>
            <p class="muted">
              @if (overview()?.twoFactorEnabled) {
                On since {{ overview()!.twoFactorEnabledAt | date: 'mediumDate' }} ·
                {{ overview()!.recoveryCodesLeft }} recovery codes left
              } @else {
                A code from an authenticator app (Google Authenticator, Microsoft Authenticator,
                1Password…) after your password.
              }
            </p>
          </div>
          <span class="pill" [class.ok]="overview()?.twoFactorEnabled">
            {{ overview()?.twoFactorEnabled ? 'On' : 'Off' }}
          </span>
        </div>
        @if (overview()?.twoFactorRequired && !overview()?.twoFactorEnabled) {
          <div class="notice tone-amber">
            <app-icon name="alert" /> The platform requires two-step verification for root
            administrators. Set it up to continue.
          </div>
        }

        @if (codes().length) {
          <div class="codes-box">
            <b>Your recovery codes</b>
            <p class="muted">
              Each works once if you lose your phone. Store them somewhere safe: they are not shown
              again.
            </p>
            <div class="codes">
              @for (code of codes(); track code) {
                <code>{{ code }}</code>
              }
            </div>
            <div class="row">
              <button class="btn sm" type="button" (click)="copyCodes()">
                <app-icon name="copy" [size]="14" /> Copy
              </button>
              <button class="btn sm" type="button" (click)="downloadCodes()">
                <app-icon name="download" [size]="14" /> Download
              </button>
              <button class="btn sm primary" type="button" (click)="codes.set([])">
                I have saved them
              </button>
            </div>
          </div>
        } @else if (setup(); as pending) {
          <div class="setup">
            @if (qr()) {
              <img [src]="qr()" alt="QR code for your authenticator app" width="176" height="176" />
            }
            <div class="stack grow">
              <p>
                1. Scan the code with your authenticator app, or enter this key:
                <code class="secret">{{ group(pending.secret) }}</code>
              </p>
              <p>2. Enter the 6-digit code it shows.</p>
              <div class="row">
                <input
                  class="input otp"
                  inputmode="numeric"
                  maxlength="6"
                  autocomplete="one-time-code"
                  placeholder="123456"
                  [(ngModel)]="code"
                />
                <button class="btn primary" type="button" [disabled]="busy()" (click)="enable()">
                  <app-icon name="check" [size]="16" /> Turn on
                </button>
                <button class="btn" type="button" (click)="setup.set(null)">Cancel</button>
              </div>
            </div>
          </div>
        } @else if (overview()?.twoFactorEnabled) {
          <div class="row">
            <input
              class="input otp"
              maxlength="9"
              autocomplete="one-time-code"
              placeholder="Code or recovery code"
              [(ngModel)]="code"
            />
            <button class="btn" type="button" [disabled]="busy()" (click)="regenerate()">
              <app-icon name="refresh" [size]="15" /> New recovery codes
            </button>
            <button class="btn danger" type="button" [disabled]="busy()" (click)="disable()">
              Turn off
            </button>
          </div>
        } @else {
          <div class="row">
            <button class="btn primary" type="button" [disabled]="busy()" (click)="begin()">
              <app-icon name="shield" [size]="16" /> Set up two-step verification
            </button>
          </div>
        }
      </div>

      <div class="card card-pad stack">
        <div class="head">
          <div class="mark on"><app-icon name="key" [size]="20" /></div>
          <div class="grow">
            <h3>Passkeys</h3>
            <p class="muted">
              Sign in with your fingerprint, face or screen lock, without typing a password.
            </p>
          </div>
        </div>
        @if (!supported) {
          <p class="muted">This browser does not support passkeys.</p>
        } @else {
          @for (passkey of passkeys(); track passkey.uid) {
            <div class="item">
              <app-icon name="key" [size]="16" />
              <div class="grow">
                <b>{{ passkey.name }}</b>
                <small class="muted">
                  Added {{ passkey.createdAt | date: 'mediumDate' }}
                  @if (passkey.lastUsedAt) {
                    · last used {{ passkey.lastUsedAt | date: 'medium' }}
                  }
                </small>
              </div>
              <button
                class="icon-btn"
                type="button"
                aria-label="Remove passkey"
                (click)="removePasskey(passkey)"
              >
                <app-icon name="trash" [size]="16" />
              </button>
            </div>
          } @empty {
            <p class="muted">No passkeys yet.</p>
          }
          <div class="row">
            <input
              class="input"
              placeholder="Name, such as Work laptop"
              [(ngModel)]="passkeyName"
            />
            <button class="btn primary" type="button" [disabled]="busy()" (click)="addPasskey()">
              <app-icon name="plus" [size]="16" /> Add a passkey
            </button>
          </div>
        }
      </div>

      <div class="card card-pad stack">
        <div class="head">
          <div class="mark on"><app-icon name="activity" [size]="20" /></div>
          <div class="grow">
            <h3>Where you are signed in</h3>
            <p class="muted">Sign out of any device you do not recognise.</p>
          </div>
        </div>
        @for (item of sessions(); track item.uid) {
          <div class="item">
            <app-icon [name]="mobile(item.userAgent) ? 'phone' : 'grid'" [size]="16" />
            <div class="grow">
              <b>
                {{ device(item.userAgent) }}
                @if (item.current) {
                  <span class="pill ok">This device</span>
                }
              </b>
              <small class="muted">
                {{ item.ip ?? 'unknown address' }} · {{ method(item.method) }} · since
                {{ item.createdAt | date: 'medium' }}
                @if (item.lastSeenAt) {
                  · active {{ item.lastSeenAt | date: 'shortTime' }}
                }
              </small>
            </div>
            @if (!item.current) {
              <button class="btn sm" type="button" (click)="revoke(item)">Sign out</button>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .security {
      display: grid;
      gap: 18px;
      max-width: 720px;
      margin-top: 18px;
    }
    .head {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .grow {
      flex: 1;
      min-width: 0;
    }
    .mark {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--surface-2, var(--bg));
      color: var(--muted);
      flex-shrink: 0;
    }
    .mark.on {
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
    }
    .pill {
      font-size: 11.5px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--surface-2, var(--bg));
      color: var(--muted);
      margin-left: 6px;
    }
    .pill.ok {
      background: color-mix(in srgb, #16a34a 14%, transparent);
      color: #16a34a;
    }
    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .otp {
      width: 190px;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.15em;
    }
    .setup {
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }
    .setup img {
      border-radius: 12px;
      border: 1px solid var(--border);
      background: #fff;
      padding: 6px;
    }
    .secret {
      display: inline-block;
      margin-top: 6px;
      font-size: 13px;
      letter-spacing: 0.08em;
    }
    .codes-box {
      border: 1px dashed var(--border-strong, var(--border));
      border-radius: 14px;
      padding: 16px;
      display: grid;
      gap: 10px;
    }
    .codes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
    }
    .codes code {
      font-size: 14px;
      padding: 8px;
      border-radius: 8px;
      text-align: center;
      background: var(--surface-2, var(--bg));
    }
    .item {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid var(--border);
    }
    .item b {
      display: block;
      font-size: 13.5px;
    }
    .item small {
      font-size: 12px;
    }
  `,
})
export class AccountSecurityComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly route = inject(ActivatedRoute);

  protected readonly supported = passkeysSupported();
  protected readonly overview = signal<SecurityOverview | null>(null);
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly qr = signal<string | null>(null);
  protected readonly codes = signal<string[]>([]);
  protected readonly passkeys = signal<Passkey[]>([]);
  protected readonly sessions = signal<SessionInfo[]>([]);
  protected readonly busy = signal(false);
  protected code = '';
  protected passkeyName = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadOverview(), this.loadPasskeys(), this.loadSessions()]);
    if (
      this.route.snapshot.queryParamMap.get('setup') === '2fa' &&
      !this.overview()?.twoFactorEnabled
    ) {
      await this.begin();
    }
  }

  protected async begin(): Promise<void> {
    await this.run(async () => {
      const setup = await this.api.post<TwoFactorSetup>('/auth/2fa/setup', {}, { silent: true });
      this.setup.set(setup);
      this.qr.set(await QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 352 }));
      this.code = '';
    });
  }

  protected async enable(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.post<RecoveryCodes>(
        '/auth/2fa/enable',
        { code: this.code },
        { silent: true },
      );
      this.codes.set(result.recoveryCodes);
      this.setup.set(null);
      this.code = '';
      this.toasts.success(this.translations.t('toast.twoFactorOn'));
      await this.loadOverview();
    });
  }

  protected async disable(): Promise<void> {
    await this.run(async () => {
      await this.api.post('/auth/2fa/disable', { code: this.code }, { silent: true });
      this.code = '';
      this.toasts.success(this.translations.t('toast.twoFactorOff'));
      await this.loadOverview();
    });
  }

  protected async regenerate(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.post<RecoveryCodes>(
        '/auth/2fa/recovery-codes',
        { code: this.code },
        { silent: true },
      );
      this.codes.set(result.recoveryCodes);
      this.code = '';
      await this.loadOverview();
    });
  }

  protected async addPasskey(): Promise<void> {
    await this.run(async () => {
      const options = await this.api.post<PasskeyOptions>(
        '/auth/passkeys/register/options',
        {},
        { silent: true },
      );
      let credential;
      try {
        credential = await createPasskey(options.options.publicKey);
      } catch (failure) {
        if (cancelled(failure)) {
          return;
        }
        throw failure;
      }
      await this.api.post(
        '/auth/passkeys/register',
        { ceremonyUid: options.ceremonyUid, credential, name: this.passkeyName || null },
        { silent: true },
      );
      this.passkeyName = '';
      this.toasts.success(this.translations.t('toast.passkeyAdded'));
      await Promise.all([this.loadPasskeys(), this.loadOverview()]);
    });
  }

  protected async removePasskey(passkey: Passkey): Promise<void> {
    if (!confirm(this.translations.t('confirm.removePasskey', { name: passkey.name }))) {
      return;
    }
    await this.run(async () => {
      await this.api.delete(`/auth/passkeys/${passkey.uid}`, { silent: true });
      await Promise.all([this.loadPasskeys(), this.loadOverview()]);
    });
  }

  protected async revoke(session: SessionInfo): Promise<void> {
    await this.run(async () => {
      await this.api.delete(`/auth/sessions/${session.uid}`, { silent: true });
      this.toasts.success(this.translations.t('toast.deviceSignedOut'));
      await this.loadSessions();
    });
  }

  protected copyCodes(): void {
    void navigator.clipboard?.writeText(this.codes().join('\n'));
    this.toasts.success(this.translations.t('toast.recoveryCodesCopied'));
  }

  protected downloadCodes(): void {
    const blob = new Blob([`Pharmacy Core recovery codes\n\n${this.codes().join('\n')}\n`], {
      type: 'text/plain',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pharmacy-core-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  protected group(secret: string): string {
    return secret.replace(/(.{4})/g, '$1 ').trim();
  }

  protected mobile(agent: string | null): boolean {
    return !!agent && /android|iphone|ipad|mobile/i.test(agent);
  }

  protected device(agent: string | null): string {
    if (!agent) {
      return 'Unknown device';
    }
    const browser = /edg\//i.test(agent)
      ? 'Edge'
      : /chrome\//i.test(agent)
        ? 'Chrome'
        : /firefox\//i.test(agent)
          ? 'Firefox'
          : /safari\//i.test(agent)
            ? 'Safari'
            : 'Browser';
    const system = /windows/i.test(agent)
      ? 'Windows'
      : /android/i.test(agent)
        ? 'Android'
        : /iphone|ipad/i.test(agent)
          ? 'iOS'
          : /mac os/i.test(agent)
            ? 'macOS'
            : /linux/i.test(agent)
              ? 'Linux'
              : 'unknown system';
    return `${browser} on ${system}`;
  }

  protected method(method: string): string {
    return (
      {
        PASSWORD: 'password',
        TWO_FACTOR: 'password + code',
        PASSKEY: 'passkey',
        INVITATION: 'invitation',
      }[method] ?? method.toLowerCase()
    );
  }

  private async loadOverview(): Promise<void> {
    this.overview.set(
      await this.api.get<SecurityOverview>('/auth/security', undefined, { silent: true }),
    );
  }

  private async loadPasskeys(): Promise<void> {
    this.passkeys.set(await this.api.get<Passkey[]>('/auth/passkeys', undefined, { silent: true }));
  }

  private async loadSessions(): Promise<void> {
    this.sessions.set(
      await this.api.get<SessionInfo[]>('/auth/sessions', undefined, { silent: true }),
    );
  }

  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await work();
    } catch (failure) {
      this.toasts.error(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
