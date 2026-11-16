import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { loaded } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

export interface ShiftView {
  uid: string;
  cashier: string;
  cashierName: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  sales: number;
  salesTotal: number;
  tenders: Record<string, number>;
  changeGiven: number;
  cashRefunds: number;
  expectedCash: number;
  countedCash: number | null;
  variance: number | null;
  note: string | null;
}

/**
 * The till shift strip on the POS: open a shift with a float, or close it by counting the cash,
 * which prints the Z report (expected against counted).
 */
@Component({
  selector: 'app-shift-bar',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shift-bar no-print" [class.open]="!!shift.value()">
      @if (shift.value(); as s) {
        <app-icon name="clock" [size]="15" />
        <span>{{ 'shift.openSince' | t: { time: (s.openedAt | when) } }}</span>
        <span class="muted"
          >· {{ 'shift.sales' | t: { count: s.sales } }} · {{ s.salesTotal | money }}</span
        >
        <span class="grow"></span>
        <button class="btn sm" type="button" (click)="closing.set(true)">
          {{ 'shift.close' | t }}
        </button>
      } @else if (!shift.loading()) {
        <app-icon name="alert" [size]="15" />
        <span>{{ 'shift.none' | t }}</span>
        <span class="grow"></span>
        <input
          class="input sm"
          type="number"
          min="0"
          step="any"
          style="width: 120px"
          [placeholder]="'shift.float' | t"
          #float
        />
        <button class="btn sm primary" type="button" (click)="open(+float.value || 0)">
          {{ 'shift.open' | t }}
        </button>
      }
    </div>

    <app-modal
      [open]="closing() || !!report()"
      [title]="(report() ? 'shift.zReport' : 'shift.close') | t"
      (closed)="closing.set(false); report.set(null)"
    >
      @if (report() ?? shift.value(); as s) {
        <div class="z">
          <b>{{ session.tenant()?.name }} · {{ session.branch()?.name }}</b>
          <div>{{ s.cashierName ?? s.cashier }}</div>
          <div class="muted">
            {{ s.openedAt | when }} – {{ (s.closedAt | when) ?? ('shift.now' | t) }}
          </div>
          <table class="table">
            <tbody>
              <tr>
                <td>{{ 'shift.float' | t }}</td>
                <td class="right">{{ s.openingFloat | money }}</td>
              </tr>
              <tr>
                <td>{{ 'shift.salesCount' | t }}</td>
                <td class="right">{{ s.sales }} · {{ s.salesTotal | money }}</td>
              </tr>
              @for (t of tenders(s); track t[0]) {
                <tr>
                  <td>{{ 'ui.pay.' + t[0] | t: null : t[0] }}</td>
                  <td class="right">{{ t[1] | money }}</td>
                </tr>
              }
              <tr>
                <td>{{ 'shift.change' | t }}</td>
                <td class="right">− {{ s.changeGiven | money }}</td>
              </tr>
              <tr>
                <td>{{ 'shift.cashRefunds' | t }}</td>
                <td class="right">− {{ s.cashRefunds | money }}</td>
              </tr>
              <tr class="strong">
                <td>{{ 'shift.expected' | t }}</td>
                <td class="right">{{ s.expectedCash | money }}</td>
              </tr>
              @if (s.countedCash !== null) {
                <tr>
                  <td>{{ 'shift.counted' | t }}</td>
                  <td class="right">{{ s.countedCash | money }}</td>
                </tr>
                <tr class="strong" [class.text-red]="(s.variance ?? 0) < 0">
                  <td>{{ 'shift.variance' | t }}</td>
                  <td class="right">{{ s.variance | money }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!report()) {
          <div class="form-grid no-print">
            <div class="field">
              <label>{{ 'shift.counted' | t }}</label>
              <input class="input" type="number" min="0" step="any" #counted />
            </div>
            <div class="field">
              <label>{{ 'shift.note' | t }}</label>
              <input class="input" #note />
            </div>
          </div>
          <div class="row no-print" style="justify-content: flex-end; gap: 8px; margin-top: 12px">
            <button
              class="btn primary"
              type="button"
              [disabled]="busy()"
              (click)="close(counted.value, note.value)"
            >
              {{ 'shift.close' | t }}
            </button>
          </div>
        }
      }
      <ng-container footer>
        @if (report()) {
          <button class="btn primary" type="button" (click)="print()">
            <app-icon name="printer" [size]="16" /> {{ 'shift.print' | t }}
          </button>
        }
      </ng-container>
    </app-modal>
  `,
  styles: `
    .shift-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 10px;
      margin-bottom: 12px;
      background: var(--amber-soft, #fff7e6);
      font-size: 13px;
    }
    .shift-bar.open {
      background: var(--primary-soft);
    }
    .z {
      display: grid;
      gap: 4px;
      font-size: 13px;
    }
  `,
})
export class ShiftBarComponent {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly shift = loaded<ShiftView | null>(() =>
    this.session.branch() ? { path: '/shifts/current' } : null,
  );
  protected readonly closing = signal(false);
  protected readonly busy = signal(false);
  protected readonly report = signal<ShiftView | null>(null);

  /** Re-reads the open shift's figures, e.g. after the till completes a sale. */
  refresh(): void {
    void this.shift.reload();
  }

  protected tenders(s: ShiftView): [string, number][] {
    return Object.entries(s.tenders);
  }

  protected async open(openingFloat: number): Promise<void> {
    await this.api.post('/shifts/open', { openingFloat });
    this.toasts.success(this.translations.t('shift.opened'));
    void this.shift.reload();
  }

  protected async close(counted: string, note: string): Promise<void> {
    if (counted === '') {
      this.toasts.error(this.translations.t('shift.countNeeded'));
      return;
    }
    this.busy.set(true);
    try {
      const z = await this.api.post<ShiftView>('/shifts/close', {
        countedCash: Number(counted),
        note: note || null,
      });
      this.closing.set(false);
      this.report.set(z);
      void this.shift.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected print(): void {
    window.print();
  }
}
