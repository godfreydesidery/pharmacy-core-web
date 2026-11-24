import { DestroyRef, Injectable, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Translations } from '../i18n/translations.store';
import { ConfirmService } from '../ui/confirm';

/**
 * A page's check before it is left. `ask` is false when nobody can be asked (the inactivity
 * sign-out, an expired session): the page keeps what it can (the POS parks its sale) and answers
 * at once.
 */
export type LeaveCheck = (ask: boolean) => Promise<boolean>;

/**
 * Lets a page with unsaved work (the POS with an unfinished sale, a goods receipt being typed)
 * ask before it is left: by navigating (the route's canDeactivate) and by the shell's sign-out and
 * branch switch, which do not navigate away first. The page registers its check while it is open.
 */
@Injectable({ providedIn: 'root' })
export class LeaveGuard {
  private check: LeaveCheck | null = null;
  private unsaved: (() => boolean) | null = null;

  /**
   * Registers the open page's check, and optionally how to tell it holds unsaved work (the
   * inactivity warning says so); call the returned function when the page closes.
   */
  register(check: LeaveCheck, unsaved?: () => boolean): () => void {
    this.check = check;
    this.unsaved = unsaved ?? null;
    return () => {
      if (this.check === check) {
        this.check = null;
        this.unsaved = null;
      }
    };
  }

  /** True when there is nothing to lose, or the user agreed to leave. */
  canLeave(ask = true): Promise<boolean> {
    return this.check ? this.check(ask) : Promise.resolve(true);
  }

  /** Whether the open page holds work that leaving would lose. */
  hasUnsaved(): boolean {
    return this.unsaved?.() ?? false;
  }
}

/** For a route whose page registers with {@link LeaveGuard}. */
export const leaveGuard: CanDeactivateFn<unknown> = () => inject(LeaveGuard).canLeave();

/** The handle {@link guardUnsavedWork} gives back. */
export interface UnsavedWork {
  /** The work is saved: the page now leaves without asking (call before navigating away). */
  done(): void;
}

/**
 * Guards a form page (a field initialiser or the constructor; give its route
 * `canDeactivate: [leaveGuard]`): while {@code changed} is true, leaving by a link, the branch
 * switch or sign-out asks first in the app's dialog, and reloading or closing the tab asks
 * through the browser. The inactivity warning mentions the unsaved work.
 */
export function guardUnsavedWork(changed: () => boolean): UnsavedWork {
  let saved = false;
  const dirty = () => !saved && changed();
  const guard = inject(LeaveGuard);
  const confirm = inject(ConfirmService);
  const translations = inject(Translations);
  const unregister = guard.register(async (ask) => {
    if (!dirty() || !ask) {
      return true;
    }
    return confirm.ask({
      icon: 'warning',
      title: translations.t('a11y.leave.title'),
      text: translations.t('a11y.leave.text'),
      confirmText: translations.t('a11y.leave.ok'),
      cancelText: translations.t('a11y.leave.stay'),
      focus: 'cancel',
    });
  }, dirty);
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (dirty()) {
      event.preventDefault();
    }
  };
  window.addEventListener('beforeunload', beforeUnload);
  inject(DestroyRef).onDestroy(() => {
    unregister();
    window.removeEventListener('beforeunload', beforeUnload);
  });
  return {
    done: () => {
      saved = true;
    },
  };
}
