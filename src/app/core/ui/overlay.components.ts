import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { ConfirmService } from './confirm';
import { DialogDirective, uniqueId } from './dialog';
import { IconComponent } from './icon.component';

/** Closing a dialog that holds unsaved changes asks first (the owner's rule). */
async function mayDiscard(
  dirty: boolean,
  confirm: ConfirmService,
  t: Translations,
): Promise<boolean> {
  if (!dirty) {
    return true;
  }
  return confirm.ask({
    icon: 'warning',
    title: t.t('a11y.discard.title'),
    text: t.t('a11y.discard.text'),
    confirmText: t.t('a11y.discard.ok'),
    cancelText: t.t('a11y.discard.keep'),
    focus: 'cancel',
  });
}

/**
 * A centred dialog. Shown while `open` is true; the body is projected, and the footer comes from
 * an element marked `footer`. Focus moves in on open, stays inside and returns on close
 * ({@link DialogDirective}). With `dirty`, closing (×, Escape, a click beside it) asks first.
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent, TranslatePipe, DialogDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="requestClose()"></div>
      <section
        class="modal"
        [class.wide]="wide()"
        role="dialog"
        appDialog
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="describedBy()"
        (dialogEscape)="requestClose()"
      >
        <header>
          <h3 [id]="titleId">{{ title() }}</h3>
          <button
            class="icon-btn"
            type="button"
            (click)="requestClose()"
            [attr.aria-label]="'ui.close' | t"
          >
            <app-icon name="x" />
          </button>
        </header>
        <div class="body" data-dialog-start><ng-content /></div>
        <footer><ng-content select="[footer]" /></footer>
      </section>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(2px);
      z-index: 90;
      animation: fade 0.15s;
    }
    .modal {
      position: fixed;
      left: 50%;
      top: 6vh;
      transform: translateX(-50%);
      width: min(620px, calc(100vw - 24px));
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: 91;
      animation: rise 0.18s ease;
    }
    .modal.wide {
      width: min(900px, calc(100vw - 24px));
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }
    h3 {
      font-size: 16px;
      font-weight: 650;
    }
    .body {
      padding: 20px;
      overflow-y: auto;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 20px;
      border-top: 1px solid var(--border);
    }
    footer:empty {
      display: none;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translate(-50%, 8px);
      }
    }
  `,
})
export class ModalComponent {
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);
  readonly open = input(false);
  readonly title = input('');
  readonly wide = input(false);
  /** The id of an element in the body that describes the dialog (its intro text), if any. */
  readonly describedBy = input<string | null>(null);
  /** True while the dialog holds changes not yet saved: closing asks before they are lost. */
  readonly dirty = input(false);
  readonly closed = output<void>();
  protected readonly titleId = uniqueId('modal-title');

  protected async requestClose(): Promise<void> {
    if (await mayDiscard(this.dirty(), this.confirm, this.translations)) {
      this.closed.emit();
    }
  }
}

/** A panel that slides in from the right, for details beside a list. */
@Component({
  selector: 'app-drawer',
  imports: [IconComponent, TranslatePipe, DialogDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="requestClose()"></div>
      <aside
        class="drawer"
        [class.wide]="wide()"
        role="dialog"
        appDialog
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="subtitle() ? subtitleId : null"
        (dialogEscape)="requestClose()"
      >
        <header>
          <div>
            <h3 [id]="titleId">{{ title() }}</h3>
            @if (subtitle()) {
              <p class="muted" [id]="subtitleId">{{ subtitle() }}</p>
            }
          </div>
          <button
            class="icon-btn"
            type="button"
            (click)="requestClose()"
            [attr.aria-label]="'ui.close' | t"
          >
            <app-icon name="x" />
          </button>
        </header>
        <div class="body" data-dialog-start><ng-content /></div>
      </aside>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      z-index: 80;
    }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(560px, 100vw);
      background: var(--surface);
      border-left: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      z-index: 81;
      display: flex;
      flex-direction: column;
      animation: slide 0.2s ease;
    }
    .drawer.wide {
      width: min(720px, 100vw);
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
    }
    h3 {
      font-size: 16px;
      font-weight: 650;
    }
    p {
      font-size: 12.5px;
      margin-top: 2px;
    }
    .body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    @keyframes slide {
      from {
        transform: translateX(24px);
        opacity: 0;
      }
    }
  `,
})
export class DrawerComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  /** Room for a table of four or more columns (statements). */
  readonly wide = input(false);
  /** True while the drawer holds changes not yet saved: closing asks before they are lost. */
  readonly dirty = input(false);
  readonly closed = output<void>();
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);
  protected readonly titleId = uniqueId('drawer-title');
  protected readonly subtitleId = uniqueId('drawer-subtitle');

  protected async requestClose(): Promise<void> {
    if (await mayDiscard(this.dirty(), this.confirm, this.translations)) {
      this.closed.emit();
    }
  }
}
