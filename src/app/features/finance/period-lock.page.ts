import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { loaded } from '../../core/data/data';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

interface PeriodLock {
  lockedThrough: string | null;
  changedAt: string | null;
  changedBy: string | null;
}

/** Yesterday as an ISO date: the latest day that may be locked. */
function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Finance → Period lock: close the books through a date so nothing is posted on or before it. */
@Component({
  selector: 'app-period-lock',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'periodLock.title' | t }}</h1>
          <p class="sub">{{ 'periodLock.sub' | t }}</p>
        </div>
      </div>
      @if (lock.value(); as l) {
        <div class="card card-pad" style="max-width: 640px">
          @if (l.lockedThrough) {
            <div class="notice tone-amber mb">
              <app-icon name="lock" />
              {{ 'periodLock.lockedThrough' | t: { date: l.lockedThrough } }}
            </div>
            <p class="muted small">{{ l.changedBy }} · {{ l.changedAt | when }}</p>
          } @else {
            <div class="notice mb">{{ 'periodLock.open' | t }}</div>
          }
          <ul class="muted small">
            <li>{{ 'periodLock.ruleRefused' | t }}</li>
            <li>{{ 'periodLock.ruleMoved' | t }}</li>
          </ul>
          @if (session.can('finance.manage')) {
            <div class="row mt" style="gap: 8px; align-items: flex-end; flex-wrap: wrap">
              <div class="field">
                <label for="lock-date">{{ 'periodLock.date' | t }}</label>
                <input
                  id="lock-date"
                  class="input"
                  type="date"
                  [max]="latest"
                  [value]="date()"
                  (change)="date.set($any($event.target).value)"
                />
              </div>
              <button
                class="btn primary"
                type="button"
                [disabled]="busy() || !date()"
                (click)="save(date())"
              >
                {{ 'periodLock.lock' | t }}
              </button>
              @if (l.lockedThrough) {
                <button class="btn" type="button" [disabled]="busy()" (click)="save(null)">
                  {{ 'periodLock.unlock' | t }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class PeriodLockPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly latest = yesterday();
  protected readonly busy = signal(false);
  protected readonly date = signal('');
  protected readonly lock = loaded<PeriodLock>(() => ({
    path: '/finance/period-lock',
    options: { noBranch: true },
  }));

  protected async save(lockedThrough: string | null): Promise<void> {
    if (
      lockedThrough === null &&
      !window.confirm(this.translations.t('periodLock.confirmUnlock'))
    ) {
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.api.put<PeriodLock>(
        '/finance/period-lock',
        { lockedThrough },
        { noBranch: true },
      );
      this.lock.set(saved);
      this.date.set('');
      this.toasts.success(
        this.translations.t(lockedThrough ? 'periodLock.locked' : 'periodLock.unlocked'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
