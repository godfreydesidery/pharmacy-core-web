import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { pagedList } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';

export interface CountLine {
  uid: string;
  productUid: string;
  productName: string;
  batchNumber: string;
  expiryDate: string | null;
  /** Null while the count is open (a blind count), except on the review before posting. */
  expected: number | null;
  counted: number | null;
  variance: number | null;
  varianceValue: number | null;
}

export interface StockCount {
  uid: string;
  number: string;
  status: 'OPEN' | 'POSTED';
  note: string | null;
  lines: number;
  counted: number;
  /** Null while the count is open (blind), except on the review. */
  varianceValue: number | null;
  /** The shortages at cost: above the approval limit posting needs a manager. */
  lossValue?: number | null;
  /** Expected quantities and differences are hidden: the counter counts what is there. */
  blind?: boolean;
  createdAt: string;
  createdBy: string;
  postedAt: string | null;
  items: CountLine[];
}

/**
 * The sheet's rows in a fixed order (product, then expiry, then batch) whatever order the API
 * returns, so a counter never loses their place after saving.
 */
export function sheetOrder(count: StockCount): StockCount {
  const items = [...count.items].sort(
    (a, b) =>
      a.productName.localeCompare(b.productName) ||
      (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') ||
      a.batchNumber.localeCompare(b.batchNumber),
  );
  return { ...count, items };
}

/** Inventory → Stock-takes: count sheets of the branch's stock, and posting the differences. */
@Component({
  selector: 'app-stock-counts',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head no-print">
        <div>
          <h1>{{ 'count.title' | t }}</h1>
          <p class="sub">{{ 'count.sub' | t }}</p>
        </div>
        <div class="actions">
          @if (current()) {
            <button class="btn" type="button" (click)="current.set(null)">
              {{ 'count.back' | t }}
            </button>
            <button class="btn" type="button" (click)="print()">
              <app-icon name="printer" [size]="16" /> {{ 'count.printSheet' | t }}
            </button>
          } @else if (session.branch()) {
            <button class="btn primary" type="button" [disabled]="busy()" (click)="start()">
              <app-icon name="plus" [size]="16" /> {{ 'count.start' | t }}
            </button>
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'count.title' | t" />
      } @else if (current(); as c) {
        <div class="card">
          <div class="card-pad row between">
            <div>
              <h3>{{ c.number }}</h3>
              <span class="muted"
                >{{ c.createdAt | when }} ·
                {{ 'count.progress' | t: { counted: c.counted, lines: c.lines } }}</span
              >
            </div>
            @if (!c.blind) {
              <div class="right">
                <span class="muted">{{ 'count.varianceValue' | t }}</span>
                <h3 [class.text-red]="(c.varianceValue ?? 0) < 0">{{ c.varianceValue | money }}</h3>
                @if (c.lossValue) {
                  <span class="muted small"
                    >{{ 'count.lossValue' | t }} {{ c.lossValue | money }}</span
                  >
                }
              </div>
            } @else {
              <span class="badge gray" data-testid="blind-count">{{ 'count.blind' | t }}</span>
            }
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'count.product' | t }}</th>
                  <th>{{ 'count.batch' | t }}</th>
                  @if (!c.blind) {
                    <th class="right">{{ 'count.expected' | t }}</th>
                  }
                  <th class="right">{{ 'count.counted' | t }}</th>
                  @if (!c.blind) {
                    <th class="right">{{ 'count.difference' | t }}</th>
                    <th class="right">{{ 'count.value' | t }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (l of c.items; track l.uid) {
                  <tr>
                    <td>{{ l.productName }}</td>
                    <td class="mono">
                      {{ l.batchNumber }}
                      @if (l.expiryDate) {
                        <small class="muted" style="display: block">{{ l.expiryDate }}</small>
                      }
                    </td>
                    @if (!c.blind) {
                      <td class="right">{{ l.expected }}</td>
                    }
                    <td class="right">
                      @if (c.status === 'OPEN') {
                        <input
                          class="input sm"
                          type="number"
                          min="0"
                          style="width: 90px"
                          [value]="entries()[l.uid] ?? l.counted ?? ''"
                          (input)="setCount(l.uid, $any($event.target).value)"
                        />
                      } @else {
                        {{ l.counted ?? '—' }}
                      }
                    </td>
                    @if (!c.blind) {
                      <td class="right" [class.text-red]="(l.variance ?? 0) < 0">
                        {{ l.variance ?? '' }}
                      </td>
                      <td class="right">
                        {{ l.varianceValue === null ? '' : (l.varianceValue | money) }}
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (c.status === 'OPEN') {
            <div class="card-pad row no-print" style="justify-content: flex-end; gap: 8px">
              <button class="btn" type="button" [disabled]="busy()" (click)="save()">
                {{ 'count.save' | t }}
              </button>
              @if (session.can('inventory.adjust')) {
                @if (c.blind) {
                  <button
                    class="btn primary"
                    type="button"
                    [disabled]="busy()"
                    data-testid="review-count"
                    (click)="review()"
                  >
                    {{ 'count.review' | t }}
                  </button>
                } @else {
                  <button class="btn primary" type="button" [disabled]="busy()" (click)="post()">
                    {{ 'count.post' | t }}
                  </button>
                }
              }
            </div>
          }
        </div>
      } @else {
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'count.number' | t }}</th>
                <th>{{ 'count.started' | t }}</th>
                <th class="right">{{ 'count.lines' | t }}</th>
                <th class="right">{{ 'count.varianceValue' | t }}</th>
                <th>{{ 'count.status' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of counts.items(); track c.uid) {
                <tr class="clickable" (click)="openCount(c.uid)">
                  <td class="mono strong">
                    <button type="button" class="row-link">{{ c.number }}</button>
                  </td>
                  <td class="muted">{{ c.createdAt | when }}</td>
                  <td class="right">{{ c.counted }} / {{ c.lines }}</td>
                  <td class="right">
                    {{ c.varianceValue === null ? '—' : (c.varianceValue | money) }}
                  </td>
                  <td>{{ 'count.status.' + c.status | t }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="empty">{{ 'count.none' | t }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="counts" />
      }
    </div>
  `,
})
export default class StockCountsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly confirm = inject(ConfirmService);
  protected readonly busy = signal(false);
  protected readonly current = signal<StockCount | null>(null);
  protected readonly entries = signal<Record<string, number | null>>({});
  protected readonly counts = pagedList<StockCount>(() =>
    this.session.branch() && !this.current() ? { path: '/stock-counts' } : null,
  );

  protected async start(): Promise<void> {
    this.busy.set(true);
    try {
      this.current.set(sheetOrder(await this.api.post<StockCount>('/stock-counts', {})));
      this.entries.set({});
    } finally {
      this.busy.set(false);
    }
  }

  protected async openCount(uid: string): Promise<void> {
    this.current.set(sheetOrder(await this.api.get<StockCount>(`/stock-counts/${uid}`)));
    this.entries.set({});
  }

  protected setCount(lineUid: string, value: string): void {
    this.entries.update((e) => ({ ...e, [lineUid]: value === '' ? null : Number(value) }));
  }

  protected async save(): Promise<boolean> {
    const c = this.current();
    if (!c) {
      return false;
    }
    this.busy.set(true);
    try {
      const body = Object.entries(this.entries()).map(([lineUid, counted]) => ({
        lineUid,
        counted,
      }));
      this.current.set(
        sheetOrder(await this.api.put<StockCount>(`/stock-counts/${c.uid}/counts`, body)),
      );
      this.entries.set({});
      this.toasts.success(this.translations.t('count.saved'));
      return true;
    } finally {
      this.busy.set(false);
    }
  }

  /** Saves what was typed, then shows the expected quantities and differences before posting. */
  protected async review(): Promise<void> {
    const c = this.current();
    if (!c || (Object.keys(this.entries()).length && !(await this.save()))) {
      return;
    }
    this.busy.set(true);
    try {
      this.current.set(sheetOrder(await this.api.get<StockCount>(`/stock-counts/${c.uid}/review`)));
    } finally {
      this.busy.set(false);
    }
  }

  protected async post(): Promise<void> {
    const c = this.current();
    if (
      !c ||
      !(await this.confirm.ask({
        title: this.translations.t('common.areYouSure'),
        text: this.translations.t('count.confirmPost'),
        icon: 'warning',
      }))
    ) {
      return;
    }
    if (Object.keys(this.entries()).length && !(await this.save())) {
      return;
    }
    this.busy.set(true);
    try {
      this.current.set(
        sheetOrder(await this.api.post<StockCount>(`/stock-counts/${c.uid}/post`, {})),
      );
      this.toasts.success(this.translations.t('count.posted'));
    } finally {
      this.busy.set(false);
    }
  }

  protected print(): void {
    window.print();
  }
}
