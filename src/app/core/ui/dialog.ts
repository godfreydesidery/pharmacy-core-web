import {
  Directive,
  ElementRef,
  Injectable,
  OnDestroy,
  OnInit,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

/**
 * The one way the app's dialogs behave (WAI-ARIA Authoring Practices, modal dialog pattern):
 * focus moves into a dialog when it opens, Tab and Shift+Tab stay inside it while it is open, and
 * focus goes back to where it was when it closes. Escape closes only the top dialog of a stack.
 *
 * Built as a focus trap rather than the native `<dialog>` and `showModal()`: a modal `<dialog>`
 * makes the rest of the page inert and draws in the top layer, so the app's toasts (which must
 * stay readable while a dialog is open) would sit under it, and every overlay's backdrop, layering
 * and animation would have to be redone. The trap keeps the current overlays as they are.
 */

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let nextId = 0;

/** An id unique in the page, for aria-labelledby, aria-describedby and label `for`. */
export function uniqueId(prefix: string): string {
  return `${prefix}-${++nextId}`;
}

/** Whether focus can go to the element now: in the page, enabled and not hidden. */
export function canFocus(element: Element | null | undefined): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    return false;
  }
  if (element.matches(':disabled') || element.closest('[hidden], [inert]')) {
    return false;
  }
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/** The elements Tab reaches inside {@code root}, in order. */
export function focusables(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(canFocus);
}

interface OpenDialog {
  readonly element: HTMLElement;
  readonly escape: () => void;
  readonly focusFirst: () => void;
}

/** The dialogs open now, the last on top; owns the keys and focus for the whole page. */
@Injectable({ providedIn: 'root' })
export class DialogStack {
  private readonly open: OpenDialog[] = [];
  private listening = false;

  private readonly onKeydown = (event: KeyboardEvent) => {
    const top = this.top();
    if (!top) {
      return;
    }
    if (event.key === 'Escape' || event.key === 'Esc') {
      // A control inside that used Escape itself (a drop-down closing) prevents the default.
      if (!event.defaultPrevented) {
        event.preventDefault();
        top.escape();
      }
    } else if (event.key === 'Tab') {
      this.trap(top, event);
    }
  };

  /** Focus that leaves the top dialog (a click outside, a script) is brought back. */
  private readonly onFocusIn = (event: FocusEvent) => {
    const top = this.top();
    const target = event.target as Node | null;
    if (!top || !target || top.element.contains(target)) {
      return;
    }
    if (target instanceof Element && target.closest('[data-dialog-outside]')) {
      return; // the toasts: they may be read and dismissed while a dialog is open
    }
    top.focusFirst();
  };

  /** The dialog on top, which alone answers Escape and holds the focus. */
  top(): OpenDialog | undefined {
    return this.open[this.open.length - 1];
  }

  /** How many dialogs are open. */
  get size(): number {
    return this.open.length;
  }

  add(dialog: OpenDialog): void {
    this.open.push(dialog);
    if (!this.listening) {
      this.listening = true;
      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('focusin', this.onFocusIn);
    }
  }

  remove(dialog: OpenDialog): void {
    const index = this.open.indexOf(dialog);
    if (index >= 0) {
      this.open.splice(index, 1);
    }
    if (!this.open.length && this.listening) {
      this.listening = false;
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('focusin', this.onFocusIn);
    }
  }

  /**
   * After a dialog closed: focus goes back to {@code returnTo}, into the dialog now on top, or,
   * when what opened the dialog is gone or disabled (the sale's Complete button after the
   * receipt), to the page's first field marked autofocus or the main region, never to nowhere.
   * Focus a page has already moved somewhere on purpose is left alone.
   */
  restore(returnTo: HTMLElement | null, closed?: HTMLElement): void {
    const active = document.activeElement;
    const top = this.top();
    if (top) {
      if (!top.element.contains(active)) {
        if (canFocus(returnTo) && top.element.contains(returnTo)) {
          returnTo.focus();
        } else {
          top.focusFirst();
        }
      }
      return;
    }
    const lost =
      !active || active === document.body || !active.isConnected || !!closed?.contains(active);
    if (!lost) {
      return;
    }
    if (canFocus(returnTo)) {
      returnTo.focus();
      return;
    }
    const main = document.querySelector<HTMLElement>('main');
    const field = main?.querySelector<HTMLElement>('[autofocus]');
    if (canFocus(field)) {
      field.focus();
    } else if (main) {
      if (!main.hasAttribute('tabindex')) {
        main.setAttribute('tabindex', '-1');
      }
      main.focus({ preventScroll: true });
    }
  }

  private trap(top: OpenDialog, event: KeyboardEvent): void {
    const items = focusables(top.element);
    const active = document.activeElement;
    if (!items.length) {
      event.preventDefault();
      top.element.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const inside = !!active && top.element.contains(active);
    if (event.shiftKey && (!inside || active === first || active === top.element)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }
}

/**
 * Makes its element a modal dialog: put it on the panel (not the backdrop) and give it a role,
 * `aria-labelledby` and, when it has one, `aria-describedby`.
 *
 * - `appDialogFocus`: a selector for what takes the focus on open (a danger confirm's Cancel).
 *   Otherwise the first `[autofocus]` inside, then the first field or button in
 *   `[data-dialog-start]` (a modal's body), then the panel itself.
 * - `appDialogReturn`: where focus goes on close, when not the element focused at open.
 * - `(dialogEscape)`: Escape, only while this dialog is on top.
 */
@Directive({
  selector: '[appDialog]',
  host: { 'aria-modal': 'true', tabindex: '-1' },
})
export class DialogDirective implements OnInit, OnDestroy {
  private readonly stack = inject(DialogStack);
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;

  readonly initialFocus = input<string | null>(null, { alias: 'appDialogFocus' });
  readonly returnTo = input<HTMLElement | null | undefined>(undefined, {
    alias: 'appDialogReturn',
  });
  readonly dialogEscape = output<void>();

  private opener: HTMLElement | null = null;
  private readonly entry: OpenDialog = {
    element: this.element,
    escape: () => this.dialogEscape.emit(),
    focusFirst: () => this.focusFirst(),
  };

  constructor() {
    afterNextRender(() => {
      if (!this.element.contains(document.activeElement)) {
        this.focusInitial();
      }
    });
  }

  ngOnInit(): void {
    const given = this.returnTo();
    const active = document.activeElement;
    this.opener =
      given !== undefined
        ? given
        : active instanceof HTMLElement && active !== document.body
          ? active
          : null;
    this.stack.add(this.entry);
  }

  ngOnDestroy(): void {
    this.stack.remove(this.entry);
    const opener = this.opener;
    const element = this.element;
    // Once any dialog replacing this one has arrived (a queued question).
    queueMicrotask(() => this.stack.restore(opener, element));
  }

  private focusInitial(): void {
    const selector = this.initialFocus();
    const chosen = selector ? this.element.querySelector<HTMLElement>(selector) : null;
    if (canFocus(chosen)) {
      chosen.focus();
      return;
    }
    const auto = this.element.querySelector<HTMLElement>('[autofocus]');
    if (canFocus(auto)) {
      auto.focus();
      return;
    }
    const start = this.element.querySelector('[data-dialog-start]');
    const first = start ? focusables(start)[0] : undefined;
    (first ?? this.element).focus();
  }

  private focusFirst(): void {
    (focusables(this.element)[0] ?? this.element).focus();
  }
}
