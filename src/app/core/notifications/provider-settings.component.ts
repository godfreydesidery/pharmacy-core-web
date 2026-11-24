import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ApiError } from '../api/api-error';
import { Api } from '../api/api.service';
import { loaded } from '../data/data';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { SHARED } from '../shared';
import { ConfirmService } from '../ui/confirm';
import { ToastService } from '../ui/toast.service';

export type ProviderChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

interface FieldView {
  key: string;
  secret: boolean;
  required: boolean;
}

interface ProviderOption {
  code: string;
  fields: FieldView[];
}

interface ProviderView {
  uid: string;
  channel: ProviderChannel;
  name: string;
  provider: string;
  priority: number;
  active: boolean;
  settings: Record<string, string>;
  secrets: Record<string, string>;
  configured: boolean;
  /** The saved secrets were sealed under another server key: they must be entered again. */
  secretsUnreadable: boolean;
  /** Held back after repeated failures (tried after the others for a while). */
  tripped: boolean;
  lastSentAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
}

interface ChannelView {
  channel: ProviderChannel;
  mode: 'PLATFORM' | 'OWN';
  effectiveSource: 'OWN' | 'PLATFORM' | 'ENVIRONMENT';
  /** Provider labels in the order a message tries them. */
  chain: string[];
  providers: ProviderView[];
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

/** The provider being added (uid null) or changed. */
interface Editor {
  channel: ProviderChannel;
  uid: string | null;
  name: string;
  provider: string;
  settings: Record<string, string>;
  secrets: Record<string, string>;
  /** The masked secrets saved for this provider, kept when their field is left empty. */
  saved: Record<string, string>;
  /** The host and port as saved: changing either drops the saved password (INT-2). */
  savedHost?: string;
  savedPort?: string;
}

/** The mail ports the API accepts: 587 and 2525/2587 with STARTTLS, 465 with TLS, 25. */
const SMTP_PORTS = ['587', '465', '2525', '2587', '25'];

/**
 * The providers each channel sends through, several per channel: a message tries them in order and
 * the first that accepts it sends it (failover); one that keeps failing is held back for a while.
 * On the platform: the list every pharmacy uses. For a pharmacy: its own list, used instead while
 * any of it is on. Secrets are write-only: shown masked, kept when the field is left empty.
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
    <div class="channels">
      @for (c of shown(); track c.channel) {
        <section class="card" [attr.data-channel]="c.channel">
          <div class="card-pad stack head">
            <div class="row bar">
              @if (!channel()) {
                <h3>{{ 'providers.channel.' + c.channel | t }}</h3>
              } @else {
                <span></span>
              }
              <button
                class="btn primary sm"
                type="button"
                [disabled]="busy()"
                (click)="startAdd(c)"
              >
                <app-icon name="plus" [size]="14" /> {{ 'providers.add' | t }}
              </button>
            </div>
            <p class="muted small chain">
              {{ 'providers.order' | t }}:
              @for (label of c.chain; track $index; let last = $last) {
                <span class="mono">{{ label }}</span>
                @if (!last) {
                  <span class="arrow">→</span>
                }
              }
              ({{ 'providers.source.' + c.effectiveSource | t }})
            </p>
            @if (scope() === 'tenant' && c.mode === 'PLATFORM') {
              <div class="notice tone-blue small">{{ 'providers.usingPlatform' | t }}</div>
            }
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th class="num">#</th>
                  <th>{{ 'providers.name' | t }}</th>
                  <th>{{ 'providers.provider' | t }}</th>
                  <th>{{ 'providers.col.status' | t }}</th>
                  <th>{{ 'providers.lastSent' | t }}</th>
                  <th>{{ 'providers.lastFailure' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (p of c.providers; track p.uid; let i = $index, first = $first, last = $last) {
                  <tr [class.off]="!p.active" data-testid="provider-row">
                    <td class="num">
                      <span class="pos">{{ i + 1 }}</span>
                    </td>
                    <td>
                      <b>{{ p.name }}</b>
                      @if (p.secretsUnreadable) {
                        <div class="small text-red">{{ 'providers.secretsUnreadable' | t }}</div>
                      }
                    </td>
                    <td>{{ 'providers.provider.' + p.provider | t: null : p.provider }}</td>
                    <td>
                      <div class="badges">
                        <span
                          class="badge"
                          [class.green]="p.configured"
                          [class.amber]="!p.configured"
                        >
                          {{ (p.configured ? 'providers.configured' : 'providers.incomplete') | t }}
                        </span>
                        @if (!p.active) {
                          <span class="badge gray">{{ 'providers.off' | t }}</span>
                        }
                        @if (p.tripped) {
                          <span class="badge red" [title]="'providers.trippedHint' | t">
                            {{ 'providers.tripped' | t }}
                          </span>
                        }
                      </div>
                    </td>
                    <td class="muted nowrap">{{ p.lastSentAt ? (p.lastSentAt | when) : '—' }}</td>
                    <td class="small">
                      @if (p.lastFailedAt) {
                        <span class="text-red">{{ p.lastFailedAt | when }}</span>
                        <div class="muted error-text" [title]="p.lastError ?? ''">
                          {{ p.lastError }}
                        </div>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="right">
                      <div class="tools">
                        <button
                          class="icon-btn"
                          type="button"
                          [disabled]="busy() || first"
                          [attr.aria-label]="'providers.up' | t"
                          [title]="'providers.up' | t"
                          (click)="move(c, i, -1)"
                        >
                          <app-icon class="flip" name="chevron" [size]="16" />
                        </button>
                        <button
                          class="icon-btn"
                          type="button"
                          [disabled]="busy() || last"
                          [attr.aria-label]="'providers.down' | t"
                          [title]="'providers.down' | t"
                          (click)="move(c, i, 1)"
                        >
                          <app-icon name="chevron" [size]="16" />
                        </button>
                        <button
                          class="btn sm"
                          type="button"
                          [disabled]="busy()"
                          (click)="toggle(p)"
                        >
                          {{ (p.active ? 'providers.turnOff' : 'providers.turnOn') | t }}
                        </button>
                        <button
                          class="btn sm"
                          type="button"
                          [disabled]="busy()"
                          (click)="startEdit(p)"
                        >
                          {{ 'providers.edit' | t }}
                        </button>
                        <button
                          class="btn sm"
                          type="button"
                          [disabled]="busy()"
                          (click)="test(c, p)"
                        >
                          {{ 'providers.testOne' | t }}
                        </button>
                        <button
                          class="btn sm danger"
                          type="button"
                          [disabled]="busy()"
                          (click)="remove(p)"
                        >
                          {{ 'providers.remove' | t }}
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="muted small empty-row">
                      {{ (scope() === 'tenant' ? 'providers.noneOwn' : 'providers.none') | t }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="card-pad test">
            <label [for]="'provider-test-' + c.channel">{{ 'providers.testTo' | t }}</label>
            <div class="row" style="gap: 8px">
              <input
                [id]="'provider-test-' + c.channel"
                class="input"
                [placeholder]="c.channel === 'EMAIL' ? 'name@example.com' : '+255712345678'"
                [value]="to()[c.channel] ?? ''"
                (input)="setTo(c.channel, $any($event.target).value)"
              />
              <button class="btn" type="button" [disabled]="busy()" (click)="test(c, null)">
                {{ 'providers.sendTest' | t }}
              </button>
            </div>
            <span class="hint">{{ 'providers.testHint' | t }}</span>
            @if (results()[c.channel]; as r) {
              <p class="small" [class.text-green]="r.ok" [class.text-red]="!r.ok">
                {{
                  r.ok
                    ? ('providers.testOk' | t: { provider: r.provider })
                    : ('providers.testFailed' | t: { error: r.error ?? '' })
                }}
              </p>
            }
          </div>
        </section>
      }
    </div>

    <app-modal
      [open]="!!editor()"
      [title]="(editor()?.uid ? 'providers.editTitle' : 'providers.addTitle') | t"
      (closed)="editor.set(null)"
    >
      @if (editor(); as e) {
        <div class="stack" data-testid="provider-editor">
          <div class="field">
            <label>{{ 'providers.name' | t }}</label>
            <input
              class="input"
              [placeholder]="'providers.namePlaceholder' | t"
              [value]="e.name"
              (input)="patch({ name: $any($event.target).value })"
            />
          </div>
          <div class="field">
            <label>{{ 'providers.provider' | t }}</label>
            <select
              class="select"
              [value]="e.provider"
              (change)="patch({ provider: $any($event.target).value, secrets: {}, saved: {} })"
            >
              @for (o of optionsOf(e.channel); track o.code) {
                <option [value]="o.code" [selected]="o.code === e.provider">
                  {{ 'providers.provider.' + o.code | t: null : o.code }}
                </option>
              }
            </select>
          </div>
          @for (f of fieldsOf(e.channel, e.provider); track f.key) {
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
                    e.saved[f.key] && !serverMoved(e)
                      ? e.saved[f.key] + ' · ' + ('providers.keep' | t)
                      : ''
                  "
                  [value]="e.secrets[f.key] ?? ''"
                  (input)="e.secrets[f.key] = $any($event.target).value"
                />
                @if (serverMoved(e) && e.saved[f.key]) {
                  <span class="hint text-amber">{{ 'providers.reenterSecret' | t }}</span>
                }
              } @else if (e.channel === 'EMAIL' && f.key === 'port') {
                <select
                  class="select"
                  [value]="e.settings[f.key] ?? '587'"
                  (change)="e.settings[f.key] = $any($event.target).value; patch({})"
                >
                  @for (port of smtpPorts; track port) {
                    <option [value]="port" [selected]="(e.settings[f.key] ?? '587') === port">
                      {{ 'providers.port.' + port | t: null : port }}
                    </option>
                  }
                </select>
              } @else {
                <input
                  class="input"
                  [value]="e.settings[f.key] ?? ''"
                  (input)="e.settings[f.key] = $any($event.target).value; patch({})"
                />
              }
            </div>
          }
          @if (failure()) {
            <div class="notice tone-red small">{{ failure() }}</div>
          }
        </div>
      }
      <ng-container footer>
        <button class="btn" type="button" (click)="editor.set(null)">
          {{ 'providers.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'providers.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .channels {
      display: grid;
      gap: 16px;
    }
    .usage {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }
    .bar {
      justify-content: space-between;
    }
    .head {
      padding-bottom: 8px;
    }
    .chain {
      margin: 0;
    }
    .chain .mono {
      font-family: var(--mono);
      font-size: 12px;
    }
    .arrow {
      margin: 0 4px;
    }
    .flip {
      display: inline-flex;
      transform: rotate(180deg);
    }
    tr.off td b {
      color: var(--muted);
    }
    .num {
      width: 40px;
    }
    .pos {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: inline-grid;
      place-items: center;
      background: var(--surface-2, var(--bg));
      font-weight: 700;
      font-size: 12.5px;
    }
    .badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .nowrap {
      white-space: nowrap;
    }
    .error-text {
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tools {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      align-items: center;
    }
    .empty-row {
      text-align: center;
      padding: 20px;
    }
    .test {
      border-top: 1px dashed var(--border);
      display: grid;
      gap: 6px;
    }
    .text-green {
      color: var(--green);
    }
    .text-red {
      color: var(--red);
    }
  `,
})
export class ProviderSettingsComponent {
  /** platform: the list every pharmacy uses; tenant: the current pharmacy's own list. */
  readonly scope = input<'platform' | 'tenant'>('tenant');
  /** Show only this channel's providers (null: every channel, one table each). */
  readonly channel = input<ProviderChannel | null>(null);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly editor = signal<Editor | null>(null);
  protected readonly to = signal<Partial<Record<ProviderChannel, string>>>({});
  protected readonly results = signal<Partial<Record<ProviderChannel, TestResult>>>({});
  private readonly path = computed(() =>
    this.scope() === 'platform' ? '/platform/notification-providers' : '/notification-providers',
  );
  protected readonly views = loaded<ChannelView[]>(() => ({
    path: this.path(),
    options: { noBranch: true },
  }));
  protected readonly usage = loaded<Record<string, number>>(() =>
    this.scope() === 'tenant' ? { path: '/notification-usage', options: { noBranch: true } } : null,
  );

  /** The channels on show: the one given, or all of them. */
  protected readonly shown = computed(() => {
    const only = this.channel();
    const all = this.views.value() ?? [];
    return only ? all.filter((c) => c.channel === only) : all;
  });

  protected optionsOf(channel: ProviderChannel): ProviderOption[] {
    return this.views.value()?.find((c) => c.channel === channel)?.options ?? [];
  }

  protected fieldsOf(channel: ProviderChannel, code: string): FieldView[] {
    return this.optionsOf(channel).find((o) => o.code === code)?.fields ?? [];
  }

  protected setTo(channel: ProviderChannel, value: string): void {
    this.to.update((t) => ({ ...t, [channel]: value }));
  }

  protected startAdd(c: ChannelView): void {
    this.failure.set(null);
    this.editor.set({
      channel: c.channel,
      uid: null,
      name: '',
      provider: c.options[0]?.code ?? 'log',
      settings: {},
      secrets: {},
      saved: {},
    });
  }

  protected startEdit(p: ProviderView): void {
    this.failure.set(null);
    this.editor.set({
      channel: p.channel,
      uid: p.uid,
      name: p.name,
      provider: p.provider,
      settings: { ...p.settings },
      secrets: {},
      saved: { ...p.secrets },
      savedHost: p.settings['host'],
      savedPort: p.settings['port'],
    });
  }

  protected readonly smtpPorts = SMTP_PORTS;

  /** An email server moved to another host or port: its saved password is dropped on save. */
  protected serverMoved(e: Editor): boolean {
    return (
      !!e.uid &&
      e.channel === 'EMAIL' &&
      ((e.settings['host'] ?? '') !== (e.savedHost ?? '') ||
        (e.settings['port'] ?? '') !== (e.savedPort ?? ''))
    );
  }

  protected patch(change: Partial<Editor>): void {
    this.editor.update((e) => (e ? { ...e, ...change } : e));
  }

  protected async save(): Promise<void> {
    const e = this.editor();
    if (!e) {
      return;
    }
    const body = {
      name: e.name.trim() || null,
      provider: e.provider,
      settings: e.settings,
      secrets: Object.fromEntries(Object.entries(e.secrets).filter(([, v]) => v)),
    };
    const done = await this.run(() =>
      e.uid
        ? this.api.put(`${this.path()}/${e.channel}/${e.uid}`, body, {
            noBranch: true,
            silent: true,
          })
        : this.api.post(`${this.path()}/${e.channel}`, body, { noBranch: true, silent: true }),
    );
    if (done) {
      this.editor.set(null);
      this.toasts.success(this.translations.t('providers.saved'));
    }
  }

  protected async toggle(p: ProviderView): Promise<void> {
    await this.run(() =>
      this.api.put(
        `${this.path()}/${p.channel}/${p.uid}`,
        { name: p.name, provider: p.provider, settings: p.settings, active: !p.active },
        { noBranch: true },
      ),
    );
  }

  protected async remove(p: ProviderView): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translations.t('providers.removeTitle', { name: p.name }),
      text: this.translations.t('providers.removeText'),
      icon: 'danger',
      confirmText: this.translations.t('providers.remove'),
    });
    if (ok) {
      await this.run(() =>
        this.api.delete(`${this.path()}/${p.channel}/${p.uid}`, { noBranch: true }),
      );
    }
  }

  protected async move(c: ChannelView, index: number, step: -1 | 1): Promise<void> {
    const order = c.providers.map((p) => p.uid);
    const target = index + step;
    [order[index], order[target]] = [order[target], order[index]];
    await this.run(() =>
      this.api.put(`${this.path()}/${c.channel}/order`, { order }, { noBranch: true }),
    );
  }

  /** One provider ({@code p}), or the whole channel as messages go (null). */
  protected async test(c: ChannelView, p: ProviderView | null): Promise<void> {
    const to = (this.to()[c.channel] ?? '').trim();
    if (!to) {
      this.toasts.error(this.translations.t('providers.testToNeeded'));
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.api.post<TestResult>(
        `${this.path()}/${c.channel}/test`,
        { to, providerUid: p?.uid ?? null },
        { noBranch: true },
      );
      this.results.update((r) => ({ ...r, [c.channel]: result }));
      void this.views.reload();
      if (this.scope() === 'tenant') {
        void this.usage.reload();
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Runs a change, then reloads; a refusal shows in the editor (or as a toast). */
  private async run(call: () => Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await call();
      await this.views.reload();
      return true;
    } catch (failure) {
      const message = ApiError.from(failure).message;
      if (this.editor()) {
        this.failure.set(message);
      } else {
        this.toasts.error(message);
      }
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
