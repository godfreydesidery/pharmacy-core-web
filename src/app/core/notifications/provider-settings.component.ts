import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Api } from '../api/api.service';
import { loaded } from '../data/data';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { SHARED } from '../shared';
import { ToastService } from '../ui/toast.service';

type ProviderChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

interface FieldView {
  key: string;
  secret: boolean;
  required: boolean;
}

interface ProviderOption {
  code: string;
  fields: FieldView[];
}

interface ProviderSettingView {
  channel: ProviderChannel;
  mode: 'PLATFORM' | 'OWN';
  provider: string;
  settings: Record<string, string>;
  secrets: Record<string, string>;
  configured: boolean;
  /** The saved secrets were sealed under another server key: they must be entered again. */
  secretsUnreadable: boolean;
  effectiveProvider: string;
  effectiveSource: 'OWN' | 'PLATFORM' | 'ENVIRONMENT';
  lastSentAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  options: ProviderOption[];
}

interface TestResult {
  ok: boolean;
  provider: string;
  source: string;
  error: string | null;
}

interface Draft {
  mode: 'PLATFORM' | 'OWN';
  provider: string;
  settings: Record<string, string>;
  secrets: Record<string, string>;
  to: string;
  result: TestResult | null;
}

/**
 * Which provider each channel sends through. On the platform: the default for every pharmacy. For a
 * pharmacy: the platform's, or its own account. Secrets are write-only: shown masked, kept when the
 * field is left empty.
 */
@Component({
  selector: 'app-provider-settings',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (scope() === 'tenant' && usage.value(); as u) {
      <div class="card card-pad mb usage">
        <b>{{ 'providers.usageThisMonth' | t }}</b>
        <span>{{ 'providers.channel.EMAIL' | t }}: {{ u['EMAIL'] ?? 0 }}</span>
        <span>{{ 'providers.channel.SMS' | t }}: {{ u['SMS'] ?? 0 }}</span>
        <span>{{ 'providers.channel.WHATSAPP' | t }}: {{ u['WHATSAPP'] ?? 0 }}</span>
      </div>
    }
    @if (views.error() && !views.value()) {
      <div class="card card-pad stack">
        <app-empty
          icon="alert"
          [title]="'providers.unavailable' | t"
          [text]="views.error()?.message ?? ''"
        />
        <div class="row" style="justify-content: center">
          <button class="btn" type="button" [disabled]="views.loading()" (click)="views.reload()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      </div>
    } @else if (views.loading() && !views.value()) {
      <app-empty [loading]="true" />
    }
    <div class="grid three-up">
      @for (p of views.value() ?? []; track p.channel) {
        @if (drafts()[p.channel]; as d) {
          <div class="card card-pad stack">
            <div class="row between">
              <h3>{{ 'providers.channel.' + p.channel | t }}</h3>
              <span class="badge" [class.green]="p.configured" [class.amber]="!p.configured">
                {{ (p.configured ? 'providers.configured' : 'providers.incomplete') | t }}
              </span>
            </div>
            <p class="muted small">
              {{
                'providers.now'
                  | t
                    : {
                        provider:
                          ('providers.provider.' + p.effectiveProvider
                          | t: null : p.effectiveProvider),
                        source: ('providers.source.' + p.effectiveSource | t),
                      }
              }}
            </p>
            @if (p.secretsUnreadable) {
              <p class="small text-red unreadable">{{ 'providers.secretsUnreadable' | t }}</p>
            }
            @if (scope() === 'tenant') {
              <label class="check">
                <input
                  type="radio"
                  [name]="'mode-' + p.channel"
                  [checked]="d.mode === 'PLATFORM'"
                  (change)="setMode(p.channel, 'PLATFORM')"
                />
                {{ 'providers.usePlatform' | t }}
              </label>
              <label class="check">
                <input
                  type="radio"
                  [name]="'mode-' + p.channel"
                  [checked]="d.mode === 'OWN'"
                  (change)="setMode(p.channel, 'OWN')"
                />
                {{ 'providers.useOwn' | t }}
              </label>
            }
            @if (scope() === 'platform' || d.mode === 'OWN') {
              <div class="field">
                <label>{{ 'providers.provider' | t }}</label>
                <select
                  class="select"
                  [value]="d.provider"
                  (change)="setProvider(p.channel, $any($event.target).value)"
                >
                  @for (o of p.options; track o.code) {
                    <option [value]="o.code" [selected]="o.code === d.provider">
                      {{ 'providers.provider.' + o.code | t: null : o.code }}
                    </option>
                  }
                </select>
              </div>
              @for (f of fieldsOf(p, d.provider); track f.key) {
                <div class="field">
                  <label>
                    {{ 'providers.field.' + f.key | t: null : f.key }}
                    @if (f.required) {
                      <span class="text-red">*</span>
                    }
                  </label>
                  @if (f.secret) {
                    <input
                      class="input mono"
                      type="password"
                      autocomplete="new-password"
                      [placeholder]="
                        d.provider === p.provider && p.secrets[f.key]
                          ? p.secrets[f.key] + ' · ' + ('providers.keep' | t)
                          : ''
                      "
                      [value]="d.secrets[f.key] ?? ''"
                      (input)="d.secrets[f.key] = $any($event.target).value"
                    />
                  } @else {
                    <input
                      class="input"
                      [value]="d.settings[f.key] ?? ''"
                      (input)="d.settings[f.key] = $any($event.target).value"
                    />
                  }
                </div>
              }
            }
            <div class="row" style="justify-content: flex-end">
              <button
                class="btn primary"
                type="button"
                [disabled]="busy()"
                (click)="save(p.channel)"
              >
                {{ 'providers.save' | t }}
              </button>
            </div>
            <div class="test">
              <label>{{ 'providers.testTo' | t }}</label>
              <div class="row" style="gap: 8px">
                <input
                  class="input"
                  [placeholder]="p.channel === 'EMAIL' ? 'name@example.com' : '+255712345678'"
                  [value]="d.to"
                  (input)="d.to = $any($event.target).value"
                />
                <button class="btn" type="button" [disabled]="busy()" (click)="test(p.channel)">
                  {{ 'providers.sendTest' | t }}
                </button>
              </div>
              @if (d.result; as r) {
                <p class="small" [class.text-green]="r.ok" [class.text-red]="!r.ok">
                  {{
                    r.ok
                      ? ('providers.testOk' | t: { provider: r.provider })
                      : ('providers.testFailed' | t: { error: r.error ?? '' })
                  }}
                </p>
              }
            </div>
            <div class="muted small">
              {{ 'providers.lastSent' | t }}: {{ p.lastSentAt ? (p.lastSentAt | when) : '—' }}
              @if (p.lastFailedAt) {
                <br />
                <span class="text-red"
                  >{{ 'providers.lastFailure' | t }}: {{ p.lastFailedAt | when }} —
                  {{ p.lastError }}</span
                >
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .three-up {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      align-items: start;
    }
    .usage {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }
    .test {
      border-top: 1px dashed var(--border);
      padding-top: 10px;
      display: grid;
      gap: 6px;
    }
    .text-green {
      color: var(--green);
    }
    .text-red {
      color: var(--red);
    }
    .unreadable {
      margin: 0;
    }
  `,
})
export class ProviderSettingsComponent {
  /** platform: the root administrator's defaults; tenant: the current pharmacy's choice. */
  readonly scope = input<'platform' | 'tenant'>('tenant');
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly busy = signal(false);
  private readonly path = computed(() =>
    this.scope() === 'platform' ? '/platform/notification-providers' : '/notification-providers',
  );
  protected readonly views = loaded<ProviderSettingView[]>(() => ({
    path: this.path(),
    options: { noBranch: true },
  }));
  protected readonly usage = loaded<Record<string, number>>(() =>
    this.scope() === 'tenant' ? { path: '/notification-usage', options: { noBranch: true } } : null,
  );
  private readonly edits = signal<Partial<Record<ProviderChannel, Draft>>>({});

  /** A draft per channel, from the loaded view unless the user has started editing it. */
  protected readonly drafts = computed(() => {
    const out: Partial<Record<ProviderChannel, Draft>> = {};
    for (const p of this.views.value() ?? []) {
      out[p.channel] = this.edits()[p.channel] ?? {
        mode: p.mode,
        provider: p.provider,
        settings: { ...p.settings },
        secrets: {},
        to: '',
        result: null,
      };
    }
    return out;
  });

  protected fieldsOf(p: ProviderSettingView, code: string): FieldView[] {
    return p.options.find((o) => o.code === code)?.fields ?? [];
  }

  private edit(channel: ProviderChannel, change: (d: Draft) => Draft): void {
    const current = this.drafts()[channel];
    if (current) {
      this.edits.update((e) => ({ ...e, [channel]: change({ ...current }) }));
    }
  }

  protected setMode(channel: ProviderChannel, mode: 'PLATFORM' | 'OWN'): void {
    this.edit(channel, (d) => ({ ...d, mode }));
  }

  protected setProvider(channel: ProviderChannel, provider: string): void {
    this.edit(channel, (d) => ({ ...d, provider, secrets: {} }));
  }

  protected async save(channel: ProviderChannel): Promise<void> {
    const d = this.drafts()[channel];
    if (!d) {
      return;
    }
    const secrets = Object.fromEntries(Object.entries(d.secrets).filter(([, v]) => v));
    this.busy.set(true);
    try {
      await this.api.put(
        `${this.path()}/${channel}`,
        {
          mode: this.scope() === 'platform' ? 'OWN' : d.mode,
          provider: d.provider,
          settings: d.settings,
          secrets,
        },
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('providers.saved'));
      this.edits.update((e) => ({ ...e, [channel]: undefined }));
      void this.views.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async test(channel: ProviderChannel): Promise<void> {
    const d = this.drafts()[channel];
    if (!d?.to.trim()) {
      this.toasts.error(this.translations.t('providers.testToNeeded'));
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.api.post<TestResult>(
        `${this.path()}/${channel}/test`,
        { to: d.to.trim() },
        { noBranch: true },
      );
      this.edit(channel, (x) => ({ ...x, result }));
      void this.views.reload();
      if (this.scope() === 'tenant') {
        void this.usage.reload();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
