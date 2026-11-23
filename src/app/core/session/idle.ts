import { Injectable, effect, inject, untracked } from '@angular/core';
import { Api } from '../api/api.service';
import { SessionActivity } from '../api/models';
import { Translations } from '../i18n/translations.store';
import { ConfirmService } from '../ui/confirm';
import { LeaveGuard } from './leave-guard';
import { SessionStore } from './session.store';
import { SignOutService } from './sign-out';

/** Shared by the app's tabs: when activity was last reported, and the limit the API gave back. */
interface Reported {
  at: number;
  idleMinutes: number | null;
}

export const ACTIVITY_STORAGE_KEY = 'pharmacy-core.activity';

/** What counts as using the app. A mouse merely moving does not (a bump would keep it open). */
const INPUT_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
/** Input reports itself at most this often, so the limit is kept to within half a minute. */
const REPORT_EVERY_MS = 30_000;
/** The warning shows this long before the end. */
const WARN_BEFORE_MS = 60_000;
const DIALOG_KEY = 'idle';

function readReported(): Reported | null {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Reported) : null;
  } catch {
    return null;
  }
}

function writeReported(reported: Reported | null): void {
  try {
    if (reported) {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(reported));
    } else {
      localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable: this tab keeps its own clock */
  }
}

/**
 * Signs a person out after the pharmacy's inactivity limit (15 minutes unless an admin changed it).
 * Keys, clicks, touches and scrolling count as use and are reported to the API (`POST
 * /auth/activity`), which ends a session left unused for longer, whatever this tab does; background
 * requests do not count. A minute before the end a dialog counts down, with "Stay signed in" and
 * "Sign out". Every tab of the app shares one clock: use in any of them keeps all of them open.
 */
@Injectable({ providedIn: 'root' })
export class IdleWatch {
  private readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly signOut = inject(SignOutService);
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);
  private readonly leave = inject(LeaveGuard);

  private reported: Reported | null = readReported();
  private running = false;
  private reporting = false;
  /** Asked to report while a report was on its way, such as on entering a pharmacy: once more. */
  private reportAgain = false;
  private warning = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly onInput = () => this.used();
  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === ACTIVITY_STORAGE_KEY) {
      this.reported = readReported();
      this.tick();
    }
  };

  constructor() {
    // Watching while signed in; entering a pharmacy reports at once, so its limit applies.
    effect(() => {
      const signedIn = this.session.signedIn();
      this.session.tenant()?.uid;
      untracked(() => {
        if (signedIn) {
          this.start();
          void this.report();
        } else {
          this.stop();
        }
      });
    });
  }

  private start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    for (const name of INPUT_EVENTS) {
      document.addEventListener(name, this.onInput, { capture: true, passive: true });
    }
    window.addEventListener('storage', this.onStorage);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    for (const name of INPUT_EVENTS) {
      document.removeEventListener(name, this.onInput, { capture: true });
    }
    window.removeEventListener('storage', this.onStorage);
    clearInterval(this.timer);
    this.closeWarning();
    this.reported = null;
    writeReported(null);
  }

  /** Input. While the warning shows, only its buttons answer it. */
  private used(): void {
    if (this.warning) {
      return;
    }
    if (!this.reported || Date.now() - this.reported.at >= REPORT_EVERY_MS) {
      void this.report();
    }
  }

  private async report(): Promise<void> {
    if (!this.session.signedIn()) {
      return;
    }
    if (this.reporting) {
      this.reportAgain = true;
      return;
    }
    this.reporting = true;
    // The time the request left: the API's clock restarts no later than this.
    const at = Date.now();
    try {
      const activity = await this.api.post<SessionActivity>(
        '/auth/activity',
        {},
        { silent: true, noBranch: true },
      );
      this.reported = { at, idleMinutes: activity.idleMinutes };
      writeReported(this.reported);
      this.tick();
    } catch {
      /* 401 signs out (the interceptor); offline, the next input tries again */
    } finally {
      this.reporting = false;
      if (this.reportAgain) {
        this.reportAgain = false;
        void this.report();
      }
    }
  }

  private tick(): void {
    const minutes = this.reported?.idleMinutes;
    if (!this.running || !this.reported || !minutes) {
      this.closeWarning();
      return;
    }
    const left = this.reported.at + minutes * 60_000 - Date.now();
    if (left <= 0) {
      this.closeWarning();
      void this.signOut.end('idle');
    } else if (left <= WARN_BEFORE_MS) {
      this.warn(Math.ceil(left / 1000));
    } else {
      // Used in another tab meanwhile.
      this.closeWarning();
    }
  }

  private warn(seconds: number): void {
    // Unsaved work on the page (a receipt being typed) is lost on sign-out: the warning says so.
    const unsaved = this.leave.hasUnsaved() ? this.translations.t('a11y.idle.unsaved') : '';
    const text = [this.translations.t('idle.text', { seconds }), unsaved]
      .filter(Boolean)
      .join('\n');
    if (this.warning) {
      this.confirm.update(DIALOG_KEY, { text });
      return;
    }
    this.warning = true;
    void this.confirm
      .ask({
        key: DIALOG_KEY,
        dismissible: false,
        // In front of any question already open, which waits (unanswered) behind it; nothing
        // asked meanwhile can answer it.
        urgent: true,
        focus: 'confirm',
        icon: 'warning',
        title: this.translations.t('idle.title'),
        text,
        confirmText: this.translations.t('idle.stay'),
        cancelText: this.translations.t('idle.signOut'),
      })
      .then((stay) => {
        if (!this.warning) {
          return; // closed here: used in another tab, or the time ran out
        }
        this.warning = false;
        if (stay) {
          void this.report();
        } else {
          void this.signOut.end('user');
        }
      });
  }

  private closeWarning(): void {
    if (this.warning) {
      this.warning = false;
      this.confirm.dismiss(DIALOG_KEY);
    }
  }
}
