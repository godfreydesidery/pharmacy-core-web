import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Api } from '../../core/api/api.service';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';
import { TEMPLATE_LABELS } from '../../core/notifications/notification.models';

/** One message as it was sent; secrets in its links come back masked from the API. */
interface DeliveryDetail {
  uid: string;
  templateKey: string;
  channel: string;
  recipientName: string | null;
  to: string | null;
  locale: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  provider: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

/** The delivery log's row detail: content, recipient, provider answer, and resend. */
@Component({
  selector: 'app-delivery-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer
      [open]="!!uid()"
      [title]="'admin2.deliveryDetail' | t"
      [subtitle]="messageName(detail()?.templateKey)"
      (closed)="closed.emit()"
    >
      @if (detail(); as d) {
        <div class="stack">
          <dl class="dl">
            <div>
              <dt>{{ 'admin.channel' | t }}</dt>
              <dd>{{ d.channel | label }}</dd>
            </div>
            <div>
              <dt>{{ 'admin.to' | t }}</dt>
              <dd>
                {{ d.recipientName ?? '' }} <span class="mono">{{ d.to ?? '—' }}</span>
              </dd>
            </div>
            <div>
              <dt>{{ 'admin.status' | t }}</dt>
              <dd><app-status [value]="d.status" /></dd>
            </div>
            <div>
              <dt>{{ 'admin.provider' | t }}</dt>
              <dd>{{ d.provider ?? '—' }} · {{ 'admin.attempts' | t }} {{ d.attempts }}</dd>
            </div>
            <div>
              <dt>{{ 'admin.created' | t }}</dt>
              <dd>
                {{ d.createdAt | when }}{{ d.sentAt ? ' → ' : ''
                }}{{ d.sentAt ? (d.sentAt | when) : '' }}
              </dd>
            </div>
          </dl>
          @if (d.lastError) {
            <div class="notice tone-red"><app-icon name="alert" /> {{ d.lastError }}</div>
          }
          @if (d.subject) {
            <div>
              <div class="muted small">{{ 'admin2.subject' | t }}</div>
              <b>{{ d.subject }}</b>
            </div>
          }
          <div>
            <div class="muted small">{{ 'admin2.messageText' | t }}</div>
            <pre class="message">{{ d.body }}</pre>
            <small class="muted">{{ 'admin2.secretsMasked' | t }}</small>
          </div>
          @if (d.channel !== 'IN_APP') {
            <div>
              <button class="btn primary" type="button" [disabled]="busy()" (click)="resend(d)">
                <app-icon name="refresh" [size]="15" /> {{ 'admin2.resend' | t }}
              </button>
            </div>
          }
        </div>
      } @else {
        <app-empty [loading]="true" icon="activity" [title]="''" />
      }
    </app-drawer>
  `,
  styles: `
    .message {
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--surface-hover);
      border-radius: 10px;
      padding: 12px;
      font: inherit;
      font-size: 13px;
      margin: 4px 0;
    }
  `,
})
export class DeliveryDetailComponent {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);

  /** The message's name in the current language, not its template key. */
  protected messageName(key: string | undefined): string {
    return key ? this.translations.t(`tpl.${key}`, undefined, TEMPLATE_LABELS[key] ?? key) : '';
  }
  readonly uid = input<string | null>(null);
  readonly closed = output<void>();
  readonly resent = output<void>();
  protected readonly detail = signal<DeliveryDetail | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      const uid = this.uid();
      this.detail.set(null);
      if (uid) {
        void this.api
          .get<DeliveryDetail>(`/notification-deliveries/${uid}`, undefined, { noBranch: true })
          .then((d) => this.detail.set(d));
      }
    });
  }

  protected async resend(d: DeliveryDetail): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post(`/notification-deliveries/${d.uid}/resend`, {}, { noBranch: true });
      this.toasts.success(this.translations.t('admin2.resent', { to: d.to ?? '' }));
      this.resent.emit();
      this.closed.emit();
    } finally {
      this.busy.set(false);
    }
  }
}
