import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../api/api.service';
import { SessionStore } from '../session/session.store';
import { IconComponent } from '../ui/icon.component';
import { ToastService } from '../ui/toast.service';
import {
  CATEGORY_LABELS,
  CHANNELS,
  CHANNEL_LABELS,
  Channel,
  NotificationPreference,
} from './notification.models';
import { Translations } from '../i18n/translations.store';

/** The signed-in user's channels per notification category, saved as each switch changes. */
@Component({
  selector: 'app-notification-preferences',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card card-pad stack prefs">
      <div>
        <h3>Notifications</h3>
        <p class="muted">Choose how {{ session.tenant()?.name ?? 'this pharmacy' }} reaches you.</p>
      </div>
      @if (!session.tenant()) {
        <div class="notice tone-blue">
          <app-icon name="bell" /> Choose a pharmacy to set its notification preferences.
        </div>
      } @else {
        <div class="table-wrap">
          <table class="table compact">
            <thead>
              <tr>
                <th>Category</th>
                @for (channel of channels; track channel) {
                  <th class="center">{{ labels[channel] }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (pref of preferences(); track pref.category) {
                <tr>
                  <td style="white-space:normal">
                    <b>{{ category(pref.category).label }}</b>
                    <small class="muted block">{{ category(pref.category).hint }}</small>
                  </td>
                  @for (channel of channels; track channel) {
                    <td class="center">
                      <label class="switch" [class.locked]="pref.category === 'access'">
                        <input
                          type="checkbox"
                          [checked]="pref.channels.includes(channel)"
                          [disabled]="pref.category === 'access' || saving()"
                          (change)="toggle(pref, channel, $any($event.target).checked)"
                          [attr.aria-label]="
                            category(pref.category).label + ' by ' + labels[channel]
                          "
                        />
                        <span></span>
                      </label>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="hint">
          SMS and WhatsApp reach you only when your pharmacy has connected an SMS provider.
        </p>
      }
    </section>
  `,
  styles: `
    .prefs {
      max-width: 760px;
    }
    .center {
      text-align: center;
    }
    .block {
      display: block;
      margin-top: 2px;
      font-weight: 400;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 38px;
      height: 22px;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .switch span {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: var(--border-strong, #cbd5e1);
      cursor: pointer;
      transition: background 0.15s;
    }
    .switch span::before {
      content: '';
      position: absolute;
      left: 3px;
      top: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s;
    }
    .switch input:checked + span {
      background: var(--primary, #2463eb);
    }
    .switch input:checked + span::before {
      transform: translateX(16px);
    }
    .switch input:focus-visible + span {
      outline: 2px solid var(--primary, #2463eb);
      outline-offset: 2px;
    }
    .switch.locked span {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class NotificationPreferencesComponent {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly channels = CHANNELS;
  protected readonly labels = CHANNEL_LABELS;
  protected readonly preferences = signal<NotificationPreference[]>([]);
  protected readonly saving = signal(false);

  constructor() {
    if (this.session.tenant()) {
      void this.load();
    }
  }

  protected category(code: string): { label: string; hint: string } {
    return CATEGORY_LABELS[code] ?? { label: code, hint: '' };
  }

  protected async toggle(
    preference: NotificationPreference,
    channel: Channel,
    on: boolean,
  ): Promise<void> {
    const channels = on
      ? [...new Set([...preference.channels, channel])]
      : preference.channels.filter((c) => c !== channel);
    this.saving.set(true);
    try {
      const saved = await this.api.put<NotificationPreference[]>(
        '/notification-preferences',
        [{ category: preference.category, channels }],
        { noBranch: true },
      );
      this.preferences.set(saved);
      this.toasts.success(this.translations.t('toast.notificationPreferencesSaved'));
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.preferences.set(
      await this.api.get<NotificationPreference[]>('/notification-preferences', undefined, {
        noBranch: true,
      }),
    );
  }
}
