import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { WhenPipe } from '../format/pipes';
import { TranslatePipe } from '../i18n/t.pipe';
import { IconComponent } from '../ui/icon.component';
import { InAppNotification } from './notification.models';
import { NotificationsStore } from './notifications.store';

/** The top bar's bell: a live unread badge and a panel of the newest notifications. */
@Component({
  selector: 'app-bell',
  imports: [IconComponent, RouterLink, WhenPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'outside($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <button
      class="icon-btn bell"
      type="button"
      (click)="toggle()"
      [attr.aria-label]="
        store.unread()
          ? ('ui.bell.unread' | t: { count: store.unread() })
          : ('ui.bell.notifications' | t)
      "
      [attr.aria-expanded]="open()"
    >
      <app-icon name="bell" />
      @if (store.badge(); as badge) {
        <span class="count" aria-hidden="true">{{ badge }}</span>
      }
      @if (store.live()) {
        <span class="live" [title]="'ui.bell.live' | t"></span>
      }
    </button>
    @if (open()) {
      <div class="panel" role="dialog" [attr.aria-label]="'ui.bell.notifications' | t">
        <div class="head">
          <b>{{ 'ui.bell.notifications' | t }}</b>
          @if (store.unread()) {
            <span class="badge blue">{{ 'ui.bell.new' | t: { count: store.unread() } }}</span>
          }
          <span class="grow"></span>
          <button
            class="btn sm ghost"
            type="button"
            [disabled]="!store.unread()"
            (click)="readAll()"
          >
            <app-icon name="check" [size]="14" /> {{ 'ui.bell.markAllRead' | t }}
          </button>
        </div>
        <div class="list">
          @for (item of store.recent(); track item.uid) {
            <button class="item" type="button" [class.unread]="!item.read" (click)="openItem(item)">
              <span class="dot" [class]="'dot ' + item.severity"></span>
              <span class="text">
                <b>{{ item.title }}</b>
                <span>{{ item.body }}</span>
                <small>{{ item.createdAt | when }}</small>
              </span>
            </button>
          } @empty {
            <div class="empty-state">
              <app-icon name="bell" [size]="28" />
              <span>{{ 'ui.bell.caughtUp' | t }}</span>
            </div>
          }
        </div>
        <a class="foot" routerLink="/notifications" (click)="open.set(false)"
          >{{ 'ui.bell.viewAll' | t }} <app-icon name="chevron-right" [size]="14"
        /></a>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }
    .bell {
      position: relative;
    }
    .count {
      position: absolute;
      top: 2px;
      right: 1px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--red, #ef4444);
      color: #fff;
      font-size: 10.5px;
      font-weight: 700;
      line-height: 17px;
      text-align: center;
      box-shadow: 0 0 0 2px var(--surface, #fff);
      animation: pop 0.25s ease-out;
    }
    .live {
      position: absolute;
      bottom: 6px;
      right: 7px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--green, #16a34a);
    }
    .panel {
      position: absolute;
      top: calc(100% + 8px);
      right: -8px;
      width: min(380px, calc(100vw - 24px));
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e8ecf3);
      border-radius: 14px;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
      z-index: 60;
      overflow: hidden;
      animation: drop 0.16s ease-out;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border, #e8ecf3);
    }
    .grow {
      flex: 1;
    }
    .list {
      max-height: 420px;
      overflow-y: auto;
    }
    .item {
      display: flex;
      gap: 10px;
      width: 100%;
      padding: 12px 14px;
      border: 0;
      border-bottom: 1px solid var(--border, #e8ecf3);
      background: none;
      text-align: left;
      cursor: pointer;
      color: inherit;
    }
    .item:hover {
      background: var(--surface-2, #f6f8fc);
    }
    .item.unread {
      background: color-mix(in srgb, var(--primary, #2463eb) 6%, transparent);
    }
    .item .text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      font-size: 13px;
    }
    .item .text span {
      color: var(--muted, #64748b);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .item .text small {
      color: var(--faint, #94a3b8);
      font-size: 11px;
    }
    .dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      margin-top: 6px;
      border-radius: 50%;
      background: var(--primary, #2463eb);
    }
    .dot.warning {
      background: var(--orange, #f97316);
    }
    .dot.critical {
      background: var(--red, #ef4444);
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      color: var(--faint, #94a3b8);
      font-size: 13px;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 11px;
      font-size: 13px;
      font-weight: 600;
      color: var(--primary, #2463eb);
    }
    @keyframes pop {
      from {
        transform: scale(0.5);
      }
    }
    @keyframes drop {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  `,
})
export class BellComponent {
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update((open) => !open);
    if (this.open()) {
      void this.store.loadRecent();
    }
  }

  protected async openItem(item: InAppNotification): Promise<void> {
    this.open.set(false);
    await this.store.markRead(item);
    if (item.link?.startsWith('/')) {
      await this.router.navigateByUrl(item.link);
    }
  }

  protected async readAll(): Promise<void> {
    await this.store.markAllRead();
  }

  protected outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
