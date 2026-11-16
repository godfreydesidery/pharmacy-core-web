import { ProviderSettingsComponent } from '../../core/notifications/provider-settings.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Api } from '../../core/api/api.service';
import { loaded, pagedList } from '../../core/data/data';
import {
  CHANNELS,
  CHANNEL_ICONS,
  CHANNEL_LABELS,
  Channel,
  NotificationDelivery,
  NotificationTemplate,
  RenderedPreview,
  TEMPLATE_LABELS,
} from '../../core/notifications/notification.models';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';
import { DeliveryDetailComponent } from './delivery-detail.component';

type Tab = 'templates' | 'deliveries' | 'providers';

/**
 * Administration → Notifications: the wording of every message per channel and language, with a
 * live preview, and the log of every message sent.
 */
@Component({
  selector: 'app-notifications-admin',
  imports: [...SHARED, DeliveryDetailComponent, ProviderSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'admin.notifications' | t }}</h1>
          <p class="sub">
            {{ 'providers.pageSub' | t }}
          </p>
        </div>
      </div>

      <div class="tabs mb">
        <button type="button" [class.active]="tab() === 'templates'" (click)="tab.set('templates')">
          <app-icon name="file" [size]="15" /> {{ 'admin.templates' | t }}
        </button>
        <button
          type="button"
          [class.active]="tab() === 'deliveries'"
          (click)="tab.set('deliveries')"
        >
          <app-icon name="activity" [size]="15" /> {{ 'admin.deliveryLog' | t }}
        </button>
        <button type="button" [class.active]="tab() === 'providers'" (click)="tab.set('providers')">
          <app-icon name="gear" [size]="15" /> {{ 'providers.tab' | t }}
        </button>
      </div>

      @if (tab() === 'providers') {
        <app-provider-settings scope="tenant" />
      }

      @if (tab() === 'templates') {
        <div class="editor-grid">
          <div class="card keys">
            @for (key of keys(); track key) {
              <button
                type="button"
                class="key"
                [class.active]="key === selectedKey()"
                (click)="selectKey(key)"
              >
                <span>{{ label(key) }}</span>
                <small class="mono">{{ key }}</small>
                @if (customised(key)) {
                  <span class="badge purple">{{ 'admin.custom' | t }}</span>
                }
              </button>
            }
          </div>

          <div class="card card-pad stack">
            <div class="row wrap gap">
              <div class="segmented">
                @for (channel of channels; track channel) {
                  <button
                    type="button"
                    [class.active]="channel === selectedChannel()"
                    (click)="selectedChannel.set(channel)"
                  >
                    <app-icon [name]="icons[channel]" [size]="14" />
                    {{ 'ui.channel.' + channel | t: null : channelLabels[channel] }}
                  </button>
                }
              </div>
              <div class="segmented">
                <button type="button" [class.active]="locale() === 'en'" (click)="locale.set('en')">
                  {{ 'admin.english' | t }}
                </button>
                <button type="button" [class.active]="locale() === 'sw'" (click)="locale.set('sw')">
                  {{ 'admin.kiswahili' | t }}
                </button>
              </div>
              <span class="grow"></span>
              @if (current()?.custom) {
                <span class="badge purple">{{ 'admin.yourWording' | t }}</span>
              } @else {
                <span class="badge gray">{{ 'admin.default' | t }}</span>
              }
            </div>

            @if (hasSubject()) {
              <div class="field">
                <label>{{
                  (selectedChannel() === 'IN_APP' ? 'ui.tpl.title' : 'ui.tpl.subject') | t
                }}</label>
                <input
                  class="input"
                  [value]="subject()"
                  (input)="subject.set($any($event.target).value)"
                />
              </div>
            }
            <div class="field">
              <label>{{ 'admin.message' | t }}</label>
              <textarea
                class="input"
                rows="7"
                [value]="body()"
                (input)="body.set($any($event.target).value)"
              ></textarea>
              <span class="hint">
                {{ 'admin.placeholders' | t }}
                @for (param of params(); track param) {
                  <button type="button" class="chip mono" (click)="insert(param)">
                    {{ '{{' + param + '}}' }}
                  </button>
                }
              </span>
              @if (unknownParams().length) {
                <span class="error">{{
                  'ui.tpl.unknownPlaceholders' | t: { names: unknownParams().join(', ') }
                }}</span>
              }
              @if (smsLength(); as n) {
                <span class="hint"
                  >{{ n }} {{ 'admin.characters' | t }} {{ segments() }}
                  {{ 'admin.smsSegmentS' | t }}</span
                >
              }
            </div>
            <div class="actions">
              <button
                class="btn"
                type="button"
                [disabled]="!current()?.custom || busy()"
                (click)="reset()"
              >
                <app-icon name="undo" [size]="15" /> {{ 'admin.resetToDefault' | t }}
              </button>
              <span class="grow"></span>
              <button
                class="btn primary"
                type="button"
                [disabled]="!dirty() || busy()"
                (click)="save()"
              >
                <app-icon name="check" [size]="15" /> {{ 'admin.saveWording' | t }}
              </button>
            </div>
          </div>

          <div class="card card-pad stack preview">
            <h3><app-icon name="eye" [size]="16" /> {{ 'admin.preview' | t }}</h3>
            @if (preview(); as p) {
              @if (p.html) {
                <div class="mail-head">
                  <small class="muted">{{ 'admin.subject' | t }}</small
                  ><b>{{ p.subject }}</b>
                </div>
                <iframe
                  class="mail"
                  sandbox=""
                  [srcdoc]="html(p.html)"
                  [title]="'admin.emailPreview' | t"
                ></iframe>
              } @else if (selectedChannel() === 'IN_APP') {
                <div class="inapp">
                  <span class="sev"><app-icon name="bell" [size]="15" /></span>
                  <span
                    ><b>{{ p.subject }}</b
                    ><span class="muted">{{ p.text }}</span></span
                  >
                </div>
              } @else {
                <div class="bubble" [class.wa]="selectedChannel() === 'WHATSAPP'">{{ p.text }}</div>
              }
              <small class="muted">{{ 'admin.renderedWithSampleValues' | t }}</small>
            } @else {
              <app-empty
                icon="eye"
                [title]="'admin.preview' | t"
                [text]="'ui.empty.chooseTemplate' | t"
              />
            }
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="toolbar">
            <select
              class="select"
              style="width:auto"
              (change)="channelFilter.set($any($event.target).value)"
            >
              <option value="">{{ 'admin.allChannels' | t }}</option>
              @for (channel of channels; track channel) {
                <option [value]="channel">
                  {{ 'ui.channel.' + channel | t: null : channelLabels[channel] }}
                </option>
              }
            </select>
            <select
              class="select"
              style="width:auto"
              (change)="statusFilter.set($any($event.target).value)"
            >
              <option value="">{{ 'admin.allStatuses' | t }}</option>
              <option value="SENT">{{ 'admin.sent' | t }}</option>
              <option value="QUEUED">{{ 'admin.queued' | t }}</option>
              <option value="SENDING">{{ 'admin.sending' | t }}</option>
              <option value="FAILED">{{ 'admin.failed' | t }}</option>
            </select>
            <span class="grow"></span>
            <button class="btn" type="button" (click)="deliveries.reload()">
              <app-icon name="refresh" [size]="15" /> {{ 'admin.refresh' | t }}
            </button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'admin.message' | t }}</th>
                  <th>{{ 'admin.channel' | t }}</th>
                  <th>{{ 'admin.to' | t }}</th>
                  <th>{{ 'admin.status' | t }}</th>
                  <th>{{ 'admin.provider' | t }}</th>
                  <th class="right">{{ 'admin.attempts' | t }}</th>
                  <th>{{ 'admin.created' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (d of deliveries.items(); track d.uid) {
                  <tr class="clickable" (click)="selectedDelivery.set(d.uid)">
                    <td>
                      <b>{{ label(d.templateKey) }}</b>
                      @if (d.lastError) {
                        <small class="text-red block" [title]="d.lastError">{{
                          d.lastError
                        }}</small>
                      }
                    </td>
                    <td>
                      <app-icon [name]="icons[d.channel]" [size]="14" />
                      {{ 'ui.channel.' + d.channel | t: null : channelLabels[d.channel] }}
                    </td>
                    <td class="mono">{{ d.channel === 'IN_APP' ? ('ui.inbox' | t) : d.to }}</td>
                    <td><app-status [value]="d.status" /></td>
                    <td class="muted">{{ d.provider ?? '—' }}</td>
                    <td class="right">{{ d.attempts }}</td>
                    <td class="muted">{{ d.createdAt | when }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <app-empty
                        [loading]="deliveries.loading()"
                        icon="activity"
                        [title]="'admin.noMessagesYet' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (deliveries.hasMore()) {
            <div class="more">
              <button class="btn" type="button" (click)="deliveries.more()">
                {{ 'admin.loadMore' | t }}
              </button>
            </div>
          }
        </div>
      }
    </div>
    <app-delivery-detail
      [uid]="selectedDelivery()"
      (closed)="selectedDelivery.set(null)"
      (resent)="deliveries.reload()"
    />
  `,
  styles: `
    .editor-grid {
      display: grid;
      grid-template-columns: 230px minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 1180px) {
      .editor-grid {
        grid-template-columns: 1fr;
      }
    }
    .keys {
      display: flex;
      flex-direction: column;
      padding: 6px;
    }
    .key {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 10px 12px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }
    .key small {
      font-weight: 400;
      color: var(--faint, #94a3b8);
    }
    .key:hover {
      background: var(--surface-2, #f6f8fc);
    }
    .key.active {
      background: color-mix(in srgb, var(--primary, #2463eb) 12%, transparent);
      color: var(--primary, #2463eb);
    }
    .row {
      display: flex;
      align-items: center;
    }
    .wrap {
      flex-wrap: wrap;
    }
    .gap {
      gap: 10px;
    }
    .grow {
      flex: 1;
    }
    .block {
      display: block;
      max-width: 340px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .segmented {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border: 1px solid var(--border, #e8ecf3);
      border-radius: 10px;
    }
    .segmented button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 0;
      background: none;
      padding: 6px 10px;
      border-radius: 7px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--muted, #64748b);
      cursor: pointer;
    }
    .segmented button.active {
      background: var(--surface-2, #f1f5f9);
      color: var(--text, #1e293b);
    }
    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--border, #e8ecf3);
    }
    .tabs button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      border: 0;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--muted, #64748b);
      font-weight: 600;
      cursor: pointer;
    }
    .tabs button.active {
      color: var(--primary, #2463eb);
      border-color: var(--primary, #2463eb);
    }
    .chip {
      margin: 2px 4px 0 0;
      font-size: 11.5px;
    }
    .preview h3 {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mail-head {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .mail {
      width: 100%;
      height: 420px;
      border: 1px solid var(--border, #e8ecf3);
      border-radius: 12px;
      background: #f5f7fb;
    }
    .bubble {
      align-self: flex-start;
      max-width: 92%;
      padding: 10px 14px;
      border-radius: 16px 16px 16px 4px;
      background: var(--surface-2, #eef2f7);
      white-space: pre-line;
      font-size: 13.5px;
    }
    .bubble.wa {
      background: #dcf8c6;
      color: #111b21;
    }
    .inapp {
      display: flex;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--border, #e8ecf3);
      border-radius: 12px;
      font-size: 13px;
    }
    .inapp > span:last-child {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sev {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 9px;
      background: color-mix(in srgb, var(--primary, #2463eb) 12%, transparent);
      color: var(--primary, #2463eb);
    }
    .more {
      display: flex;
      justify-content: center;
      padding: 14px;
    }
  `,
})
export default class NotificationsAdminPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly channels = CHANNELS;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly icons = CHANNEL_ICONS;
  protected readonly tab = signal<Tab>('templates');

  protected readonly templates = loaded<NotificationTemplate[]>(() => ({
    path: '/notification-templates',
    options: { noBranch: true },
  }));
  protected readonly selectedKey = signal('stock.low');
  protected readonly selectedChannel = signal<Channel>('EMAIL');
  protected readonly locale = signal<'en' | 'sw'>('en');
  protected readonly subject = signal('');
  protected readonly body = signal('');
  protected readonly preview = signal<RenderedPreview | null>(null);
  protected readonly busy = signal(false);

  protected readonly keys = computed(() => [
    ...new Set((this.templates.value() ?? []).map((t) => t.key)),
  ]);
  protected readonly current = computed(() =>
    (this.templates.value() ?? []).find(
      (t) =>
        t.key === this.selectedKey() &&
        t.channel === this.selectedChannel() &&
        t.locale === this.locale(),
    ),
  );
  protected readonly hasSubject = computed(
    () => this.selectedChannel() === 'EMAIL' || this.selectedChannel() === 'IN_APP',
  );
  protected readonly dirty = computed(() => {
    const current = this.current();
    return (
      !!current &&
      (this.body() !== current.body ||
        (this.hasSubject() && this.subject() !== (current.subject ?? '')))
    );
  });
  protected readonly params = computed(() => Object.keys(this.preview()?.sampleParams ?? {}));
  /** Placeholders in the subject or message that this message does not supply: they render blank. */
  protected readonly unknownParams = computed(() => {
    const known = new Set(this.params());
    if (!known.size) {
      return [];
    }
    const used = `${this.subject() ?? ''} ${this.body()}`.matchAll(/\{\{\s*(\w+)\s*}}/g);
    return [...new Set([...used].map((m) => m[1]))].filter((name) => !known.has(name));
  });
  protected readonly smsLength = computed(() =>
    this.selectedChannel() === 'SMS' ? (this.preview()?.text.length ?? 0) : 0,
  );
  protected readonly segments = computed(() => Math.max(1, Math.ceil(this.smsLength() / 153)));

  protected readonly channelFilter = signal('');
  protected readonly selectedDelivery = signal<string | null>(null);
  protected readonly statusFilter = signal('');
  protected readonly deliveries = pagedList<NotificationDelivery>(() =>
    this.tab() === 'deliveries'
      ? {
          path: '/notification-deliveries',
          query: { channel: this.channelFilter(), status: this.statusFilter() },
          options: { noBranch: true },
        }
      : null,
  );

  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Load the wording into the editor whenever the template in view changes.
    effect(() => {
      const current = this.current();
      untracked(() => {
        this.subject.set(current?.subject ?? '');
        this.body.set(current?.body ?? '');
      });
    });
    // Re-render the preview a moment after the wording stops changing.
    effect(() => {
      const draft = {
        key: this.selectedKey(),
        channel: this.selectedChannel(),
        locale: this.locale(),
        subject: this.hasSubject() ? this.subject() : null,
        body: this.body() || null,
      };
      untracked(() => {
        if (this.previewTimer) {
          clearTimeout(this.previewTimer);
        }
        this.previewTimer = setTimeout(() => void this.render(draft), 250);
      });
    });
  }

  protected label(key: string): string {
    return TEMPLATE_LABELS[key] ?? key;
  }

  protected customised(key: string): boolean {
    return (this.templates.value() ?? []).some((t) => t.key === key && t.custom);
  }

  protected selectKey(key: string): void {
    this.selectedKey.set(key);
  }

  protected insert(param: string): void {
    this.body.update((body) => `${body}{{${param}}}`);
  }

  protected async save(): Promise<void> {
    const unknown = this.unknownParams();
    if (
      unknown.length &&
      !confirm(
        this.translations.t('ui.tpl.unknownPlaceholders', { names: unknown.join(', ') }) +
          '\n\n' +
          this.translations.t('ui.tpl.saveAnyway'),
      )
    ) {
      return;
    }
    this.busy.set(true);
    try {
      await this.api.put(
        `/notification-templates/${this.selectedKey()}/${this.selectedChannel()}/${this.locale()}`,
        { subject: this.hasSubject() ? this.subject() : null, body: this.body() },
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('toast.wordingSaved'));
      await this.templates.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async reset(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.delete(
        `/notification-templates/${this.selectedKey()}/${this.selectedChannel()}/${this.locale()}`,
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('toast.wordingReset'));
      await this.templates.reload();
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * The email preview is the API's own rendering (every value escaped) shown in an iframe with an
   * empty sandbox, so nothing in it can run script or reach the app.
   */
  protected html(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private async render(draft: {
    key: string;
    channel: Channel;
    locale: string;
    subject: string | null;
    body: string | null;
  }): Promise<void> {
    try {
      this.preview.set(
        await this.api.post<RenderedPreview>('/notification-templates/preview', draft, {
          noBranch: true,
          silent: true,
        }),
      );
    } catch {
      /* keep the last preview while the draft is invalid */
    }
  }
}
