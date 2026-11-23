import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ConfirmService } from '../../core/ui/confirm';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Page, Webhook, WebhookDelivery } from '../../core/api/models';
import { loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-webhooks',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'admin.integrations' | t }}</h1>
          <p class="sub">
            {{ 'admin.webhooksSendEventsToYour' | t }}
          </p>
        </div>
        <div class="actions">
          <button
            class="btn primary"
            type="button"
            [disabled]="atLimit()"
            [attr.title]="atLimit() ? ('webhooks.limit' | t) : null"
            (click)="edit(null)"
          >
            <app-icon name="plus" [size]="16" /> {{ 'admin.addWebhook' | t }}
          </button>
        </div>
      </div>
      <div class="notice tone-blue mb">
        <app-icon name="shield" />
        <span
          >{{ 'webhooks.signing' | t }}
          <span class="mono">webhook-id, webhook-timestamp, webhook-signature</span>
          {{ 'webhooks.signingMore' | t }}</span
        >
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'admin.webhook' | t }}</th>
                <th>{{ 'admin.events' | t }}</th>
                <th>{{ 'admin.status' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (w of hooks.items(); track w.uid) {
                <tr>
                  <td>
                    <div class="cell-main">
                      <span class="thumb tone-purple"><app-icon name="link" [size]="16" /></span>
                      <div>
                        <b>{{ w.name }}</b
                        ><small class="mono">{{ w.url }}</small>
                      </div>
                    </div>
                  </td>
                  <td style="white-space:normal">
                    <div class="chips">
                      @for (e of w.eventTypes; track e) {
                        <span class="badge gray">{{ e }}</span>
                      }
                    </div>
                  </td>
                  <td><app-status [value]="w.active ? 'ACTIVE' : 'INACTIVE'" /></td>
                  <td class="right">
                    <div class="actions" style="justify-content:flex-end">
                      <button class="btn sm" type="button" (click)="showDeliveries(w)">
                        <app-icon name="activity" [size]="14" /> {{ 'admin.deliveries' | t }}
                      </button>
                      <button class="btn sm" type="button" (click)="edit(w)">
                        <app-icon name="edit" [size]="14" />
                      </button>
                      <button
                        class="btn sm"
                        type="button"
                        data-testid="rotate-secret"
                        [disabled]="busy()"
                        (click)="rotate(w)"
                      >
                        <app-icon name="key" [size]="14" /> {{ 'webhooks.rotate' | t }}
                      </button>
                      <button class="btn sm" type="button" (click)="remove(w)">
                        <app-icon name="trash" [size]="14" />
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">
                    <app-empty
                      [for]="hooks"
                      icon="link"
                      [title]="'admin.noWebhooks' | t"
                      [text]="'ui.empty.webhooks' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="hooks" />
      </div>
    </div>

    <app-modal
      [open]="open()"
      [title]="current() ? ('ui.l.editWebhook' | t) : ('ui.l.addWebhook' | t)"
      (closed)="open.set(false)"
    >
      <form class="stack" [formGroup]="form" (ngSubmit)="save()">
        <div class="field">
          <label>{{ 'admin.name' | t }}</label
          ><input class="input" formControlName="name" [placeholder]="'admin.accountingSync' | t" />
          @if (err('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>URL</label
          ><input
            class="input"
            formControlName="url"
            [placeholder]="'admin.httpsExampleComHooksPharmacy' | t"
          />
          @if (err('url'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'admin.events' | t }}</label>
          <div class="chips">
            @for (e of eventTypes.value() ?? []; track e) {
              <button
                type="button"
                class="chip"
                [class.active]="selectedEvents().includes(e)"
                (click)="toggleEvent(e)"
              >
                {{ e }}
              </button>
            }
          </div>
        </div>
        <label class="check"
          ><input type="checkbox" formControlName="active" /> {{ 'admin.active' | t }}</label
        >
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>

    <app-modal
      [open]="!!secret()"
      [title]="'admin.webhookSecret' | t"
      (closed)="secret.set(null); oldUntil.set(null)"
    >
      <div class="stack">
        <div class="notice tone-amber">
          <app-icon name="alert" /> {{ 'admin.copyThisSecretNowIt' | t }}
        </div>
        <div class="secret">{{ secret() }}</div>
        @if (oldUntil(); as until) {
          <p class="muted">{{ 'webhooks.oldUntil' | t: { time: (until | when) } }}</p>
        }
      </div>
      <ng-container footer
        ><button class="btn primary" type="button" (click)="copy()">
          <app-icon name="copy" [size]="16" /> {{ 'admin.copy' | t }}
        </button></ng-container
      >
    </app-modal>

    <app-drawer
      [open]="!!deliveriesOf()"
      [title]="('ui.l.deliveriesSp' | t) + (deliveriesOf()?.name ?? '')"
      (closed)="deliveriesOf.set(null)"
    >
      <div class="stack">
        @for (d of deliveries(); track d.uid) {
          <div class="card card-pad">
            <div class="row">
              <app-status [value]="d.status" /><b class="mono">{{ d.eventType }}</b
              ><span class="grow"></span
              ><span class="muted" style="font-size:12px">{{ d.createdAt | when }}</span>
            </div>
            <div class="muted" style="font-size:12px;margin-top:6px">
              HTTP {{ d.responseStatus ?? '—' }} · {{ d.attempts }} {{ 'admin.attemptS' | t
              }}{{ d.deliveredAt ? ('ui.l.preDeliveredSp' | t) + (d.deliveredAt | when) : '' }}
            </div>
            @if (d.lastError) {
              <div class="text-red" style="font-size:12px;margin-top:4px">{{ d.lastError }}</div>
            }
          </div>
        } @empty {
          <app-empty icon="activity" [title]="'admin.noDeliveriesYet' | t" />
        }
      </div>
    </app-drawer>
  `,
})
export default class WebhooksPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly hooks = pagedList<Webhook>(() => ({
    path: '/webhooks',
    options: { noBranch: true },
  }));
  protected readonly eventTypes = loaded<string[]>(() => ({
    path: '/webhooks/event-types',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<Webhook | null>(null);
  protected readonly selectedEvents = signal<string[]>([]);
  protected readonly secret = signal<string | null>(null);
  /** After a rotation: until when the old secret also signs. */
  protected readonly oldUntil = signal<string | null>(null);
  private readonly confirm = inject(ConfirmService);
  /** At most 10 webhooks per pharmacy (INT-13). */
  protected readonly atLimit = computed(() => (this.hooks.total() ?? 0) >= 10);
  protected readonly deliveriesOf = signal<Webhook | null>(null);
  protected readonly deliveries = signal<WebhookDelivery[]>([]);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    active: [true],
  });

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected edit(hook: Webhook | null): void {
    this.current.set(hook);
    this.form.reset({ name: hook?.name ?? '', url: hook?.url ?? '', active: hook?.active ?? true });
    this.selectedEvents.set(hook?.eventTypes ?? ['sale.completed']);
    this.open.set(true);
  }

  protected toggleEvent(event: string): void {
    this.selectedEvents.update((list) =>
      list.includes(event) ? list.filter((e) => e !== event) : [...list, event],
    );
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    if (!this.selectedEvents().length) {
      this.toasts.error(this.translations.t('toast.chooseEvent'));
      return;
    }
    const body = { ...this.form.getRawValue(), eventTypes: this.selectedEvents() };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(`/webhooks/${current.uid}`, body, { silent: true, noBranch: true });
        this.toasts.success(this.translations.t('toast.webhookSaved'));
      } else {
        const created = await this.api.post<Webhook>('/webhooks', body, {
          silent: true,
          noBranch: true,
        });
        this.secret.set(created.secret ?? null);
      }
      this.open.set(false);
      await this.hooks.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** A new signing secret, shown once; the old one keeps signing for 24 hours. */
  protected async rotate(hook: Webhook): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translations.t('webhooks.rotate'),
      text: this.translations.t('webhooks.confirmRotate', { url: hook.url }),
      icon: 'question',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    try {
      const rotated = await this.api.post<Webhook & { previousSecretUntil?: string | null }>(
        `/webhooks/${hook.uid}/rotate-secret`,
        {},
        { noBranch: true },
      );
      this.oldUntil.set(rotated.previousSecretUntil ?? null);
      this.secret.set(rotated.secret ?? null);
      await this.hooks.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(hook: Webhook): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translations.t('common.areYouSure'),
      text: this.translations.t('confirm.deleteWebhook', { name: hook.name }),
      icon: 'danger',
    });
    if (!ok) {
      return;
    }
    await this.api.delete(`/webhooks/${hook.uid}`, { noBranch: true });
    this.toasts.success(this.translations.t('toast.webhookDeleted'));
    await this.hooks.reload();
  }

  protected async showDeliveries(hook: Webhook): Promise<void> {
    this.deliveriesOf.set(hook);
    this.deliveries.set([]);
    const page = await this.api.get<Page<WebhookDelivery>>(
      `/webhooks/${hook.uid}/deliveries`,
      { limit: 50 },
      { noBranch: true },
    );
    this.deliveries.set(page.items);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.secret() ?? '');
      this.toasts.success(this.translations.t('toast.secretCopied'));
    } catch {
      this.toasts.error(this.translations.t('toast.copyFailed'));
    }
  }
}
