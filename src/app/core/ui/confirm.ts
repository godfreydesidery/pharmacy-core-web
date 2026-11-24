import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '../i18n/t.pipe';
import { DialogDirective, uniqueId } from './dialog';

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
  /** Names the dialog, so its opener can {@link ConfirmService.update} or dismiss it later. */
  key?: string;
  /** False: only the two buttons answer it, not Escape or a click beside it. */
  dismissible?: boolean;
  /**
   * Which button takes the focus, so Enter (or a barcode scanner's Enter) answers it: the safe
   * one, Cancel, for a danger dialog; the confirm button otherwise.
   */
  focus?: 'confirm' | 'cancel';
  /**
   * Shown at once, in front of a dialog already open (which waits, unanswered, until this one is
   * answered): the inactivity warning, which cannot wait its turn.
   */
  urgent?: boolean;
}

/** A question waiting in the queue, or on screen. */
export interface OpenConfirm extends ConfirmOptions {
  readonly id: number;
  readonly resolve: (ok: boolean) => void;
  /** What had the focus when it was asked: the focus goes back there afterwards. */
  readonly opener: HTMLElement | null;
}

let nextConfirm = 0;

function focused(): HTMLElement | null {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Asks the user to confirm, in an animated dialog instead of the browser's confirm box:
 * `if (!(await confirm.ask({ title, text, icon: 'danger' }))) return;`
 *
 * One question shows at a time. Another asked meanwhile waits its turn and never answers the one
 * on screen; an `urgent` one (the inactivity warning) goes in front, and the one it covered shows
 * again, still unanswered, once it is answered.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly queue = signal<readonly OpenConfirm[]>([]);
  /** The question on screen. */
  readonly current = computed<OpenConfirm | null>(() => this.queue()[0] ?? null);
  /** How many questions are waiting, the one on screen included. */
  readonly waiting = computed(() => this.queue().length);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const entry: OpenConfirm = {
        icon: 'question',
        ...options,
        id: ++nextConfirm,
        resolve,
        opener: focused(),
      };
      this.queue.update((queue) => (options.urgent ? [entry, ...queue] : [...queue, entry]));
    });
  }

  /** Changes the dialog named {@code key}, shown or waiting, such as a countdown in its text. */
  update(key: string, changes: Partial<ConfirmOptions>): void {
    this.queue.update((queue) =>
      queue.map((open) => (open.key === key ? { ...open, ...changes } : open)),
    );
  }

  /** Closes the dialog named {@code key}, shown or waiting, answering it "no". */
  dismiss(key: string): void {
    for (const open of this.queue().filter((o) => o.key === key)) {
      this.answer(open.id, false);
    }
  }

  /** Answers the question {@code id} (and only it), wherever it is in the queue. */
  answer(id: number, ok: boolean): void {
    const open = this.queue().find((o) => o.id === id);
    if (!open) {
      return;
    }
    this.queue.update((queue) => queue.filter((o) => o.id !== id));
    open.resolve(ok);
  }

  /** Answers the question on screen. */
  settle(ok: boolean): void {
    const open = this.current();
    if (open) {
      this.answer(open.id, ok);
    }
  }
}

/** The dialog for {@link ConfirmService}, placed once at the app root. */
@Component({
  selector: 'app-confirm',
  imports: [TranslatePipe, DialogDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (c of shown(); track c.id) {
      <div
        class="backdrop"
        [class.closing]="closingId() === c.id"
        (click)="c.dismissible !== false && close(c, false)"
      >
        <div
          class="popup"
          [class.closing]="closingId() === c.id"
          role="alertdialog"
          appDialog
          [appDialogFocus]="safeFirst(c) ? '.cancel' : '.ok'"
          [appDialogReturn]="c.opener"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="c.text ? textId : null"
          [attr.data-key]="c.key ?? null"
          (dialogEscape)="c.dismissible !== false && close(c, false)"
          (click)="$event.stopPropagation()"
        >
          <div class="icon" [class]="'icon ' + c.icon" aria-hidden="true">
            <span class="glyph">{{ c.icon === 'question' ? '?' : '!' }}</span>
          </div>
          <h2 [id]="titleId">{{ c.title }}</h2>
          @if (c.text) {
            <p [id]="textId">{{ c.text }}</p>
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
            <button type="button" class="cancel" (click)="close(c, false)">
              {{ c.cancelText ?? ('common.cancel' | t) }}
            </button>
            <button type="button" class="ok" [class]="'ok ' + c.icon" (click)="close(c, true)">
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
      z-index: 320;
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
      box-shadow: var(--ring);
    }
    .cancel {
      background: var(--surface-2);
      color: var(--text);
    }
    .ok.question {
      background: var(--green);
      color: var(--on-green);
    }
    .ok.warning {
      background: var(--amber);
      color: var(--on-amber);
    }
    .ok.danger {
      background: var(--red);
      color: var(--on-red);
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
  /** The question on screen, as a list of one: a new question is a new dialog (focus, animation). */
  protected readonly shown = computed(() => {
    const current = this.confirm.current();
    return current ? [current] : [];
  });
  protected readonly closingId = signal<number | null>(null);
  protected readonly titleId = uniqueId('confirm-title');
  protected readonly textId = uniqueId('confirm-text');

  /** A danger question, or one asked so, starts on Cancel: a stray Enter never confirms it. */
  protected safeFirst(c: OpenConfirm): boolean {
    return c.focus ? c.focus === 'cancel' : c.icon === 'danger';
  }

  /** Plays the closing animation, then answers that question (not whichever shows by then). */
  protected close(c: OpenConfirm, ok: boolean): void {
    if (this.closingId() !== null) {
      return;
    }
    this.closingId.set(c.id);
    setTimeout(() => {
      this.closingId.set(null);
      this.confirm.answer(c.id, ok);
    }, 150);
  }
}
