import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { apiUrl } from '../api/api.service';
import { ApiError } from '../api/api-error';
import { SILENT } from '../api/api.interceptor';
import { SettingsStore } from '../format/settings.store';
import { formatMoney } from '../format/format';
import { DialogDirective } from '../ui/dialog';

interface LastCount {
  countedCash: number;
  closedAt: string;
  cashierName: string | null;
}

/**
 * "Open shift" at the till (the owner's choice of 23 Nov 2026): when the pharmacy requires an open
 * shift and the cashier has none, the API refuses a sale, refund or voucher with 409
 * `shift_required`; the interceptor asks here, the cashier confirms the cash in the drawer
 * (suggested from the last close's count), the shift opens and the request is sent again. Nothing
 * opens by itself: someone always counts the starting cash.
 */
@Injectable({ providedIn: 'root' })
export class OpenShiftService {
  private readonly http = inject(HttpClient);

  /** The open request: resolves true once a shift is open, false when cancelled. */
  readonly open = signal<((opened: boolean) => void) | null>(null);
  /** Counts shifts opened here, so the till's shift strip can refresh. */
  readonly opened = signal(0);
  private pending: Promise<boolean> | null = null;

  /** Asks once at a time; several refused requests wait for the same answer. */
  ask(): Promise<boolean> {
    if (!this.pending) {
      this.pending = new Promise<boolean>((resolve) =>
        this.open.set((opened) => {
          this.open.set(null);
          this.pending = null;
          if (opened) {
            this.opened.update((n) => n + 1);
          }
          resolve(opened);
        }),
      );
    }
    return this.pending;
  }

  /** The cash counted at the branch's last close, to suggest the float; null before any. */
  async lastCount(): Promise<LastCount | null> {
    try {
      return await firstValueFrom(
        this.http.get<LastCount | null>(apiUrl('/shifts/last-count'), {
          context: new HttpContext().set(SILENT, true),
        }),
      );
    } catch {
      return null;
    }
  }

  async openShift(openingFloat: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          apiUrl('/shifts/open'),
          { openingFloat },
          { context: new HttpContext().set(SILENT, true) },
        ),
      );
    } catch (failure) {
      const error = ApiError.from(failure);
      // Opened meanwhile (another tab): that is what was wanted.
      if (error.reason !== 'shift_open') {
        throw error;
      }
    }
  }
}

@Component({
  selector: 'app-open-shift',
  imports: [FormsModule, TranslatePipe, DialogDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.open()) {
      <div class="backdrop" (click)="cancel()">
        <form
          class="popup"
          role="dialog"
          appDialog
          appDialogFocus="#open-shift-float"
          (dialogEscape)="cancel()"
          aria-labelledby="open-shift-title"
          aria-describedby="open-shift-text"
          data-testid="open-shift"
          (click)="$event.stopPropagation()"
          (ngSubmit)="submit()"
        >
          <h2 id="open-shift-title">{{ 'openShift.title' | t }}</h2>
          <p id="open-shift-text">{{ 'openShift.text' | t }}</p>
          <div class="field">
            <label for="open-shift-float">{{ 'openShift.float' | t }}</label>
            <input
              #float
              id="open-shift-float"
              name="float"
              class="input"
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              [(ngModel)]="floatValue"
              [attr.aria-invalid]="error() ? 'true' : null"
              aria-describedby="open-shift-hint open-shift-error"
            />
            <span id="open-shift-hint" class="hint">{{ hint() }}</span>
          </div>
          <p id="open-shift-error" class="error" role="alert">{{ error() }}</p>
          <div class="actions">
            <button type="button" class="btn ghost" (click)="cancel()">
              {{ 'common.cancel' | t }}
            </button>
            <button type="submit" class="btn primary" [disabled]="busy() || floatValue < 0">
              {{ 'openShift.open' | t }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 305;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.45);
    }
    .popup {
      width: min(400px, 100%);
      padding: 24px;
      border-radius: 14px;
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-lg);
    }
    h2 {
      margin: 0 0 6px;
      font-size: 1.15rem;
    }
    p {
      margin: 0 0 14px;
      color: var(--muted);
    }
    .field {
      display: grid;
      gap: 6px;
      margin-bottom: 12px;
    }
    .error {
      min-height: 1.2em;
      margin: 0 0 8px;
      color: var(--red);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class OpenShiftComponent {
  protected readonly service = inject(OpenShiftService);
  private readonly translations = inject(Translations);
  private readonly settings = inject(SettingsStore);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly hint = signal('');
  protected floatValue = 0;
  private readonly float = viewChild<ElementRef<HTMLInputElement>>('float');

  constructor() {
    effect(() => {
      if (this.service.open()) {
        this.floatValue = 0;
        this.error.set('');
        this.hint.set(this.translations.t('openShift.hintNone'));
        void this.suggest();
        setTimeout(() => this.float()?.nativeElement.select());
      }
    });
  }

  private async suggest(): Promise<void> {
    const last = await this.service.lastCount();
    if (last && this.service.open()) {
      this.floatValue = last.countedCash;
      this.hint.set(
        this.translations.t('openShift.hintLast', {
          amount: formatMoney(last.countedCash, this.settings.currency()),
        }),
      );
      setTimeout(() => this.float()?.nativeElement.select());
    }
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.floatValue < 0) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.service.openShift(Number(this.floatValue) || 0);
      this.close(true);
    } catch (failure) {
      this.error.set((failure as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.close(false);
  }

  private close(opened: boolean): void {
    const answer = this.service.open();
    answer?.(opened);
  }
}
