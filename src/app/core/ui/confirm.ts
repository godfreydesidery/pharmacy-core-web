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
import { TranslatePipe } from '../i18n/t.pipe';

/** question (blue ?), warning (amber !) or danger (red !: deleting, voiding, cancelling). */
export type ConfirmIcon = 'question' | 'warning' | 'danger';

export interface ConfirmOptions {
  title: string;
  text?: string;
  /** Label / value rows shown under the text, such as a sale's total and change. */
  details?: readonly { label: string; value: string }[];
  icon?: ConfirmIcon;
  /** The confirm button's words; "Yes, continue" when left out. */
  confirmText?: string;
  /** The cancel button's words; "Cancel" when left out. */
  cancelText?: string;
}

interface Open extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Asks the user to confirm, in an animated dialog instead of the browser's confirm box:
 * `if (!(await confirm.ask({ title, text, icon: 'danger' }))) return;`
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly state = signal<Open | null>(null);
  readonly current = this.state.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this.state()?.resolve(false);
    return new Promise((resolve) => this.state.set({ icon: 'question', ...options, resolve }));
  }

  /** Called by the dialog once its closing animation has played. */
  settle(ok: boolean): void {
    const open = this.state();
    this.state.set(null);
    open?.resolve(ok);
  }
}

/** The dialog for {@link ConfirmService}, placed once at the app root. */
@Component({
  selector: 'app-confirm',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'current() && close(false)' },
  template: `
    @if (current(); as c) {
      <div class="backdrop" [class.closing]="closing()" (click)="close(false)">
        <div
          class="popup"
          [class.closing]="closing()"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="c.title"
          (click)="$event.stopPropagation()"
        >
          <div class="icon" [class]="'icon ' + c.icon">
            <span class="glyph">{{ c.icon === 'question' ? '?' : '!' }}</span>
          </div>
          <h2>{{ c.title }}</h2>
          @if (c.text) {
            <p>{{ c.text }}</p>
          }
          @if (c.details?.length) {
            <dl>
              @for (d of c.details; track d.label) {
                <div>
                  <dt>{{ d.label }}</dt>
                  <dd>{{ d.value }}</dd>
                </div>
              }
            </dl>
          }
          <div class="actions">
            <button type="button" class="cancel" (click)="close(false)">
              {{ c.cancelText ?? ('common.cancel' | t) }}
            </button>
            <button #ok type="button" class="ok" [class]="'ok ' + c.icon" (click)="close(true)">
              {{ c.confirmText ?? ('common.confirm' | t) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 300;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.45);
      animation: fade-in 0.2s ease-out;
    }
    .backdrop.closing {
      animation: fade-out 0.15s ease-in forwards;
    }
    .popup {
      width: min(420px, 100%);
      padding: 28px 24px 22px;
      border-radius: 14px;
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-lg);
      text-align: center;
      animation: pop-in 0.3s ease-out;
    }
    .popup.closing {
      animation: pop-out 0.15s ease-in forwards;
    }
    .icon {
      width: 76px;
      height: 76px;
      margin: 0 auto 16px;
      border: 4px solid currentColor;
      border-radius: 50%;
      display: grid;
      place-items: center;
      animation: icon-in 0.5s ease-out;
    }
    .icon.question {
      color: var(--primary);
    }
    .icon.warning {
      color: var(--amber);
    }
    .icon.danger {
      color: var(--red);
    }
    .glyph {
      font-size: 44px;
      font-weight: 700;
      line-height: 1;
    }
    .icon.question .glyph {
      animation: spin-in 0.8s ease-out;
    }
    .icon.warning .glyph,
    .icon.danger .glyph {
      animation: pulse 0.75s ease-in-out infinite alternate;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 21px;
      font-weight: 650;
    }
    p {
      margin: 0 0 4px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-line;
    }
    dl {
      margin: 14px 0 0;
      padding: 10px 14px;
      border-radius: 10px;
      background: var(--surface-2);
      text-align: left;
    }
    dl div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 3px 0;
      font-size: 14px;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 22px;
    }
    .actions button {
      min-width: 110px;
      height: 42px;
      padding: 0 18px;
      border: 0;
      border-radius: 8px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition:
        filter 0.15s,
        box-shadow 0.15s;
    }
    .actions button:hover {
      filter: brightness(0.95);
    }
    .actions button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--primary-soft-2);
    }
    .cancel {
      background: var(--surface-2);
      color: var(--text);
    }
    .ok {
      color: #fff;
    }
    .ok.question {
      background: var(--green);
    }
    .ok.warning {
      background: var(--amber);
    }
    .ok.danger {
      background: var(--red);
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }
    @keyframes fade-out {
      to {
        opacity: 0;
      }
    }
    @keyframes pop-in {
      0% {
        transform: scale(0.7);
      }
      45% {
        transform: scale(1.05);
      }
      80% {
        transform: scale(0.97);
      }
      100% {
        transform: scale(1);
      }
    }
    @keyframes pop-out {
      to {
        transform: scale(0.6);
        opacity: 0;
      }
    }
    @keyframes icon-in {
      from {
        transform: rotateX(100deg);
        opacity: 0;
      }
    }
    @keyframes spin-in {
      from {
        transform: rotateY(-360deg);
      }
    }
    @keyframes pulse {
      to {
        transform: scale(1.18);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .backdrop,
      .popup,
      .icon,
      .glyph {
        animation: none !important;
      }
    }
  `,
})
export class ConfirmDialogComponent {
  private readonly confirm = inject(ConfirmService);
  protected readonly current = this.confirm.current;
  protected readonly closing = signal(false);
  private readonly ok = viewChild<ElementRef<HTMLButtonElement>>('ok');

  constructor() {
    // Enter confirms: the confirm button takes the focus when the dialog opens.
    effect(() => {
      if (this.current()) {
        this.closing.set(false);
        setTimeout(() => this.ok()?.nativeElement.focus());
      }
    });
  }

  /** Plays the closing animation, then answers. */
  protected close(ok: boolean): void {
    if (this.closing()) {
      return;
    }
    this.closing.set(true);
    setTimeout(() => this.confirm.settle(ok), 150);
  }
}
