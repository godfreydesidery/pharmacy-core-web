import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { pagedList } from '../../core/data/data';
import { InAppNotification } from '../../core/notifications/notification.models';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { SHARED } from '../../core/shared';

/** Every in-app notification of the signed-in user, live as new ones arrive. */
@Component({
  selector: 'app-inbox',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'notifications.notifications' | t }}</h1>
          <p class="sub">
            @if (store.live()) {
              <span class="badge green dot">{{ 'notifications.live' | t }}</span>
            }
            {{ store.unread() }} {{ 'notifications.unread' | t }}
          </p>
        </div>
        <div class="actions">
          <div class="segmented" role="tablist">
            <button type="button" [class.active]="!unreadOnly()" (click)="unreadOnly.set(false)">
              {{ 'notifications.all' | t }}
            </button>
            <button type="button" [class.active]="unreadOnly()" (click)="unreadOnly.set(true)">
              {{ 'notifications.unread2' | t }}
            </button>
          </div>
          <button
            class="btn"
            type="button"
            [disabled]="!store.unread()"
            (click)="store.markAllRead()"
          >
            <app-icon name="check" [size]="16" /> {{ 'notifications.markAllRead' | t }}
          </button>
        </div>
      </div>

      <div class="card inbox">
        @for (item of list.items(); track item.uid) {
          <button class="row-item" type="button" [class.unread]="!item.read" (click)="open(item)">
            <span class="sev" [class]="'sev ' + item.severity">
              <app-icon [name]="item.severity === 'info' ? 'bell' : 'alert'" [size]="16" />
            </span>
            <span class="text">
              <b>{{ item.title }}</b>
              <span>{{ item.body }}</span>
            </span>
            <span class="meta">
              <small>{{ item.createdAt | when }}</small>
              @if (!item.read) {
                <span class="new">{{ 'notifications.new' | t }}</span>
              }
            </span>
          </button>
        } @empty {
          <app-empty
            [for]="list"
            icon="bell"
            [title]="
              unreadOnly() ? ('ui.l.noUnreadNotifications' | t) : ('ui.l.noNotificationsYet' | t)
            "
            [text]="'ui.empty.inbox' | t"
          />
        }
        <app-pager [list]="list" />
      </div>
    </div>
  `,
  styles: `
    .inbox {
      overflow: hidden;
    }
    .row-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      width: 100%;
      padding: 16px 18px;
      border: 0;
      border-bottom: 1px solid var(--border, #e8ecf3);
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.12s;
    }
    .row-item:hover {
      background: var(--surface-2, #f6f8fc);
    }
    .row-item.unread {
      background: color-mix(in srgb, var(--primary, #2463eb) 5%, transparent);
    }
    .sev {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--primary, #2463eb) 12%, transparent);
      color: var(--primary, #2463eb);
    }
    .sev.warning {
      background: color-mix(in srgb, var(--orange, #f97316) 14%, transparent);
      color: var(--orange, #f97316);
    }
    .sev.critical {
      background: color-mix(in srgb, var(--red, #ef4444) 14%, transparent);
      color: var(--red, #ef4444);
    }
    .text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      font-size: 13.5px;
    }
    .text span {
      color: var(--muted, #64748b);
      white-space: pre-line;
    }
    .meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      flex-shrink: 0;
      color: var(--faint, #94a3b8);
    }
    .new {
      font-size: 11px;
      font-weight: 700;
      color: var(--primary, #2463eb);
    }
    .more {
      display: flex;
      justify-content: center;
      padding: 14px;
    }
    .segmented {
      display: inline-flex;
      padding: 3px;
      border: 1px solid var(--border, #e8ecf3);
      border-radius: 10px;
      background: var(--surface, #fff);
    }
    .segmented button {
      border: 0;
      background: none;
      padding: 6px 14px;
      border-radius: 7px;
      font-weight: 600;
      color: var(--muted, #64748b);
      cursor: pointer;
    }
    .segmented button.active {
      background: var(--surface-2, #f1f5f9);
      color: var(--text, #1e293b);
    }
  `,
})
export default class InboxPage {
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  protected readonly unreadOnly = signal(false);
  protected readonly list = pagedList<InAppNotification>(() => ({
    path: '/notifications',
    query: { unreadOnly: this.unreadOnly() },
    options: { noBranch: true },
  }));

  constructor() {
    let first = true;
    effect(() => {
      this.store.revision();
      if (first) {
        first = false;
        return;
      }
      untracked(() => void this.list.reload());
    });
  }

  protected async open(item: InAppNotification): Promise<void> {
    await this.store.markRead(item);
    if (item.link?.startsWith('/')) {
      await this.router.navigateByUrl(item.link);
    }
  }
}
