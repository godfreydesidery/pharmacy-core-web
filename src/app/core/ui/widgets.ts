import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { Tone, toneOf } from '../format/format';
import { enumLabel } from '../format/pipes';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { IconComponent } from './icon.component';
import { Toast, ToastService } from './toast.service';
import { PAGE_SIZES, PagedList } from '../data/data';

/** A status as a coloured pill, such as COMPLETED or LOW_STOCK. */
@Component({
  selector: 'app-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge dot" [class]="toneClass()">{{ text() }}</span>`,
})
export class StatusBadgeComponent {
  readonly value = input.required<string | null | undefined>();
  readonly tone = input<Tone | null>(null);
  readonly label = input<string | null>(null);
  private readonly translations = inject(Translations);
  protected readonly text = computed(
    () => this.label() ?? enumLabel(this.translations, this.value()),
  );
  protected readonly toneClass = computed(() => `badge dot ${this.tone() ?? toneOf(this.value())}`);
}

/** A KPI tile: icon bubble, label, value and the change against the previous period. */
@Component({
  selector: 'app-stat',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card stat">
      <div class="bubble" [class]="'bubble tone-' + tone()">
        <app-icon [name]="icon()" [size]="22" />
      </div>
      <div class="grow">
        <small>{{ label() }}</small>
        <div class="value" [attr.title]="hint()">{{ value() }}</div>
        @if (change() !== null && change() !== undefined) {
          <div class="delta" [class.down]="(change() ?? 0) < 0 !== inverse()">
            {{ (change() ?? 0) >= 0 ? '↑' : '↓' }} {{ abs() }}% <span>{{ caption() }}</span>
          </div>
        } @else if (caption()) {
          <div class="delta">
            <span>{{ caption() }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class StatComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input('chart');
  readonly tone = input<Tone | 'orange' | 'teal'>('blue');
  readonly change = input<number | null | undefined>(null);
  readonly caption = input('vs previous period');
  /** The exact value, shown on hover when {@code value} is compact. */
  readonly hint = input<string | null>(null);
  /** A rise is bad, such as for expenses. */
  readonly inverse = input(false);
  protected readonly abs = computed(() => Math.abs(this.change() ?? 0).toFixed(1));
}

/** The empty or loading state of a list. */
@Component({
  selector: 'app-empty',
  imports: [IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      @if (loading()) {
        <div class="stack" style="max-width:420px;margin:0 auto">
          <div class="skeleton"></div>
          <div class="skeleton" style="width:80%"></div>
          <div class="skeleton" style="width:60%"></div>
        </div>
      } @else {
        <app-icon [name]="icon()" [size]="34" [stroke]="1.4" />
        <b>{{ title() ?? ('ui.empty.nothing' | t) }}</b>
        <span>{{ text() }}</span>
      }
    </div>
  `,
})
export class EmptyComponent {
  readonly loading = input(false);
  readonly icon = input('box');
  readonly title = input<string | null>(null);
  readonly text = input('');
}

/**
 * The foot of a paged table: "Showing 26–50 of 312", rows per page, and first / previous / page
 * numbers / next / last. The page numbers keep the first and last page and those around the
 * current one, with "…" between.
 */
@Component({
  selector: 'app-pager',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-foot pager">
      <span class="range">{{
        list().total()
          ? ('ui.pager.range' | t: { from: from(), to: to(), total: list().total() })
          : ('ui.pager.none' | t)
      }}</span>
      <label class="size"
        >{{ 'ui.pager.rows' | t }}
        <select
          class="select sm"
          [value]="list().size()"
          (change)="list().setSize(+$any($event.target).value)"
        >
          @for (n of sizes; track n) {
            <option [value]="n" [selected]="n === list().size()">{{ n }}</option>
          }
        </select></label
      >
      @if (list().pages() > 1) {
        <nav class="pages" [attr.aria-label]="'ui.pager.pages' | t">
          <button
            class="btn sm icon"
            type="button"
            [disabled]="busyOr(list().page() === 1)"
            [title]="'ui.pager.first' | t"
            (click)="list().goTo(1)"
          >
            «
          </button>
          <button
            class="btn sm icon"
            type="button"
            [disabled]="busyOr(list().page() === 1)"
            [title]="'ui.pager.previous' | t"
            (click)="list().goTo(list().page() - 1)"
          >
            ‹
          </button>
          @for (n of numbers(); track $index) {
            @if (n === 0) {
              <span class="gap">…</span>
            } @else {
              <button
                class="btn sm num"
                type="button"
                [class.on]="n === list().page()"
                [attr.aria-current]="n === list().page() ? 'page' : null"
                [disabled]="list().loading()"
                (click)="list().goTo(n)"
              >
                {{ n }}
              </button>
            }
          }
          <button
            class="btn sm icon"
            type="button"
            [disabled]="busyOr(list().page() === list().pages())"
            [title]="'ui.pager.next' | t"
            (click)="list().goTo(list().page() + 1)"
          >
            ›
          </button>
          <button
            class="btn sm icon"
            type="button"
            [disabled]="busyOr(list().page() === list().pages())"
            [title]="'ui.pager.last' | t"
            (click)="list().goTo(list().pages())"
          >
            »
          </button>
        </nav>
      }
    </div>
  `,
  styles: `
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 18px;
    }
    .range {
      margin-right: auto;
    }
    .size {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .size .select {
      width: auto;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .pages {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .num,
    .icon {
      min-width: 32px;
      justify-content: center;
    }
    .num.on {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--on-primary);
    }
    .gap {
      padding: 0 4px;
      color: var(--muted);
    }
  `,
})
export class PagerComponent {
  readonly list = input.required<PagedList<unknown>>();
  protected readonly sizes = PAGE_SIZES;
  protected readonly from = computed(() =>
    this.list().total() ? (this.list().page() - 1) * this.list().size() + 1 : 0,
  );
  protected readonly to = computed(() =>
    Math.min(this.list().page() * this.list().size(), this.list().total() ?? 0),
  );
  /** Page numbers to show, 0 standing for "…": 1 … 4 5 6 … 13. */
  protected readonly numbers = computed(() => {
    const last = this.list().pages();
    const page = this.list().page();
    if (last <= 7) {
      return Array.from({ length: last }, (_, i) => i + 1);
    }
    const around = [page - 1, page, page + 1].filter((n) => n > 1 && n < last);
    if (page <= 3) {
      around.push(2, 3, 4);
    }
    if (page >= last - 2) {
      around.push(last - 3, last - 2, last - 1);
    }
    const shown = [...new Set([1, ...around, last])].sort((a, b) => a - b);
    const out: number[] = [];
    shown.forEach((n, i) => {
      if (i > 0 && n - shown[i - 1] > 1) {
        out.push(0);
      }
      out.push(n);
    });
    return out;
  });

  protected busyOr(disabled: boolean): boolean {
    return disabled || this.list().loading();
  }
}

/** The toasts of {@link ToastService}, bottom right. */
@Component({
  selector: 'app-toaster',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" data-dialog-outside>
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast ' + toast.kind + (toast.link ? ' linked' : '')"
          (click)="open(toast)"
        >
          <app-icon
            [name]="toast.kind === 'error' ? 'alert' : toast.kind === 'info' ? 'bell' : 'check'"
          />
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: 20px;
      bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 200;
      max-width: min(420px, calc(100vw - 40px));
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #0f172a;
      color: #fff;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      animation: in 0.2s ease;
    }
    .toast.success app-icon {
      color: #4ade80;
    }
    .toast.error app-icon {
      color: #f87171;
    }
    .toast.info app-icon {
      color: #93c5fd;
    }
    .toast.linked span {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    @keyframes in {
      from {
        transform: translateY(8px);
        opacity: 0;
      }
    }
  `,
})
export class ToasterComponent {
  protected readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected open(toast: Toast): void {
    this.toasts.dismiss(toast.id);
    if (toast.link) {
      void this.router.navigateByUrl(toast.link);
    }
  }
}
