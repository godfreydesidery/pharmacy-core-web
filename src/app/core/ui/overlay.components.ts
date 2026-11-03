import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * A centred dialog. Shown while `open` is true; the body is projected, and the footer comes from
 * an element marked `footer`.
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()"></div>
      <section
        class="modal"
        [class.wide]="wide()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <header>
          <h3>{{ title() }}</h3>
          <button class="icon-btn" type="button" (click)="closed.emit()" aria-label="Close">
            <app-icon name="x" />
          </button>
        </header>
        <div class="body"><ng-content /></div>
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
  readonly open = input(false);
  readonly title = input('');
  readonly wide = input(false);
  readonly closed = output<void>();
}

/** A panel that slides in from the right, for details beside a list. */
@Component({
  selector: 'app-drawer',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()"></div>
      <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <header>
          <div>
            <h3>{{ title() }}</h3>
            @if (subtitle()) {
              <p class="muted">{{ subtitle() }}</p>
            }
          </div>
          <button class="icon-btn" type="button" (click)="closed.emit()" aria-label="Close">
            <app-icon name="x" />
          </button>
        </header>
        <div class="body"><ng-content /></div>
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
  readonly closed = output<void>();
}
