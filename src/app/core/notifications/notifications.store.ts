import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api, apiUrl } from '../api/api.service';
import { Page } from '../api/models';
import { SessionStore } from '../session/session.store';
import { ToastService } from '../ui/toast.service';
import { InAppNotification, StreamEvent, UnreadCount } from './notification.models';

const RECENT = 8;

/**
 * The signed-in user's in-app notifications as signals, kept live by a Server-Sent Events stream
 * (`/notifications/stream`). It reconnects with backoff and re-opens whenever the session or the
 * tenant changes. EventSource cannot send headers, so the stream takes the token and tenant as
 * query parameters, on that one route only.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly toasts = inject(ToastService);

  private readonly unreadState = signal(0);
  private readonly recentState = signal<InAppNotification[]>([]);
  private readonly liveState = signal(false);
  /** Bumped on every pushed message, so pages can refresh their own lists. */
  private readonly revisionState = signal(0);

  readonly unread = this.unreadState.asReadonly();
  readonly recent = this.recentState.asReadonly();
  readonly live = this.liveState.asReadonly();
  readonly revision = this.revisionState.asReadonly();
  readonly badge = computed(() => {
    const count = this.unreadState();
    return count > 99 ? '99+' : count > 0 ? String(count) : '';
  });

  private source: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 2_000;
  /** The latest connection attempt; an older one's ticket is thrown away. */
  private attempt = 0;

  constructor() {
    effect(() => {
      const token = this.session.token();
      const tenant = this.session.tenant()?.uid ?? null;
      untracked(() => this.connect(token, tenant));
    });
  }

  /** Loads the newest messages for the bell's panel. */
  async loadRecent(): Promise<void> {
    if (!this.session.token()) {
      return;
    }
    try {
      const page = await this.api.get<Page<InAppNotification>>(
        '/notifications',
        { limit: RECENT },
        { noBranch: true, silent: true },
      );
      this.recentState.set(page.items);
    } catch {
      /* the bell stays usable; the inbox page shows errors */
    }
  }

  async markRead(notification: InAppNotification): Promise<void> {
    if (notification.read) {
      return;
    }
    const result = await this.api.post<UnreadCount>(
      `/notifications/${notification.uid}/read`,
      {},
      { noBranch: true, silent: true },
    );
    this.unreadState.set(result.count);
    this.recentState.update((items) =>
      items.map((item) => (item.uid === notification.uid ? { ...item, read: true } : item)),
    );
    this.revisionState.update((n) => n + 1);
  }

  async markAllRead(): Promise<void> {
    await this.api.post<UnreadCount>('/notifications/read-all', {}, { noBranch: true });
    this.unreadState.set(0);
    this.recentState.update((items) => items.map((item) => ({ ...item, read: true })));
    this.revisionState.update((n) => n + 1);
  }

  private connect(token: string | null, tenant: string | null): void {
    this.disconnect();
    if (!token || typeof EventSource === 'undefined') {
      this.unreadState.set(0);
      this.recentState.set([]);
      return;
    }
    // EventSource cannot send the session token as a header, and a token in a URL ends up in
    // logs: the stream opens with a 60-second ticket, a new one for every (re)connection.
    const attempt = ++this.attempt;
    this.api
      .post<{ ticket: string }>(
        '/notifications/stream-ticket',
        {},
        { silent: true, noBranch: true },
      )
      .then(({ ticket }) => {
        if (attempt === this.attempt && this.session.token() === token) {
          this.open(ticket, token, tenant);
        }
      })
      .catch(() => {
        if (attempt === this.attempt) {
          this.scheduleReconnect(token, tenant);
        }
      });
  }

  private open(ticket: string, token: string, tenant: string | null): void {
    const params = new URLSearchParams({ ticket });
    if (tenant) {
      params.set('tenant', tenant);
    }
    const source = new EventSource(`${apiUrl('/notifications/stream')}?${params}`);
    this.source = source;
    source.addEventListener('ready', (event) => {
      this.retryDelay = 2_000;
      this.liveState.set(true);
      this.unreadState.set(this.parse(event)?.unreadCount ?? 0);
      void this.loadRecent();
    });
    source.addEventListener('notification', (event) => {
      const pushed = this.parse(event);
      if (!pushed) {
        return;
      }
      this.unreadState.set(pushed.unreadCount);
      const latest = pushed.latest;
      if (latest) {
        this.recentState.update((items) =>
          [latest, ...items.filter((item) => item.uid !== latest.uid)].slice(0, RECENT),
        );
        if (latest.severity !== 'info') {
          this.toasts.info(latest.title);
        }
      }
      this.revisionState.update((n) => n + 1);
    });
    source.onerror = () => {
      this.liveState.set(false);
      if (source.readyState === EventSource.CLOSED) {
        this.scheduleReconnect(token, tenant);
      }
    };
  }

  private scheduleReconnect(token: string, tenant: string | null): void {
    if (this.retryTimer) {
      return;
    }
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.session.token() === token) {
        this.connect(token, tenant);
      }
    }, delay);
  }

  private disconnect(): void {
    this.attempt++;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.source?.close();
    this.source = null;
    this.liveState.set(false);
  }

  private parse(event: Event): StreamEvent | null {
    try {
      return JSON.parse((event as MessageEvent<string>).data) as StreamEvent;
    } catch {
      return null;
    }
  }
}
