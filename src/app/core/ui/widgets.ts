import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Tone, toneOf } from '../format/format';
import { enumLabel } from '../format/pipes';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { IconComponent } from './icon.component';
import { ToastService } from './toast.service';

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

/** "Load more" under a cursor-paged list. */
@Component({
  selector: 'app-pager',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-foot">
      <span>{{
        total() !== null
          ? ('ui.pager.shownOf' | t: { count: count(), total: total() })
          : ('ui.pager.shown' | t: { count: count() })
      }}</span>
      @if (hasMore()) {
        <button class="btn sm" type="button" [disabled]="loading()" (click)="more.emit()">
          {{ (loading() ? 'common.loading' : 'ui.pager.loadMore') | t }}
        </button>
      }
    </div>
  `,
})
export class PagerComponent {
  readonly count = input(0);
  readonly total = input<number | null>(null);
  readonly hasMore = input(false);
  readonly loading = input(false);
  readonly more = output<void>();
}

/** The toasts of {@link ToastService}, bottom right. */
@Component({
  selector: 'app-toaster',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast ' + toast.kind" (click)="toasts.dismiss(toast.id)">
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
}
