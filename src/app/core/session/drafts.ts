import { Injectable, inject } from '@angular/core';
import { Translations } from '../i18n/translations.store';
import { ConfirmService } from '../ui/confirm';
import { SessionStore } from './session.store';

/** How long a kept draft is offered back: a working day. */
export const DRAFT_TTL_MS = 8 * 60 * 60 * 1000;
const PREFIX = 'pharmacy.draft.v1.';

/** A form's unsaved work as storage keeps it. */
interface StoredDraft {
  savedAt: string;
  data: unknown;
}

/**
 * Unsaved form work kept over a sign-out the person did not choose (the inactivity limit, an
 * expired session), and offered back when they sign in again. A draft belongs to one user, one
 * pharmacy and one branch, and lasts {@link DRAFT_TTL_MS}. Forms keep only what they need to be
 * typed again (uids, quantities, costs, notes), never health details; a draft is kept in this
 * browser's local storage, and any storage failure only means the draft is not kept.
 */
@Injectable({ providedIn: 'root' })
export class DraftStore {
  private readonly session = inject(SessionStore);

  /** The storage key of form `id` for the person signed in now, or null when nobody is. */
  keyOf(id: string): string | null {
    const user = this.session.user()?.uid;
    const tenant = this.session.tenant()?.uid;
    if (!user || !tenant) {
      return null;
    }
    return `${PREFIX}${tenant}.${this.session.branch()?.uid ?? 'all'}.${user}.${id}`;
  }

  keep(id: string, data: unknown): void {
    const key = this.keyOf(id);
    if (!key) {
      return;
    }
    try {
      const draft: StoredDraft = { savedAt: new Date().toISOString(), data };
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* no storage, or full: the draft is not kept */
    }
  }

  /** The kept draft of form `id`, if it is still fresh (an expired one is removed). */
  read(id: string): StoredDraft | null {
    const key = this.keyOf(id);
    if (!key) {
      return null;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      const draft = JSON.parse(raw) as StoredDraft;
      const age = Date.now() - Date.parse(draft.savedAt);
      if (!(age >= 0 && age < DRAFT_TTL_MS)) {
        localStorage.removeItem(key);
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  }

  drop(id: string): void {
    const key = this.keyOf(id);
    try {
      if (key) localStorage.removeItem(key);
    } catch {
      /* nothing kept */
    }
  }

  /** Removes every expired draft in this browser (anyone's), so old ones do not pile up. */
  sweep(): void {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key?.startsWith(PREFIX)) continue;
        try {
          const draft = JSON.parse(localStorage.getItem(key) ?? '') as StoredDraft;
          if (!(Date.now() - Date.parse(draft.savedAt) < DRAFT_TTL_MS))
            localStorage.removeItem(key);
        } catch {
          localStorage.removeItem(key);
        }
      }
    } catch {
      /* no storage */
    }
  }
}

/** What a form tells {@link guardUnsavedWork} so its work survives a forced sign-out. */
export interface DraftOptions<T> {
  /** The form's name, such as `purchasing.receipt`; null when this page keeps no draft. */
  id: () => string | null;
  /** The work to keep: plain data only, no health details. */
  save: () => T;
  /** Puts a kept draft back into the form (and marks it changed). */
  restore: (draft: T) => void | Promise<void>;
}

/**
 * Offers the kept draft of a form back ("Restore what you were typing?"); the draft goes either
 * way. True when it was restored.
 */
export async function offerDraft<T>(
  drafts: DraftStore,
  confirm: ConfirmService,
  translations: Translations,
  options: DraftOptions<T>,
): Promise<boolean> {
  drafts.sweep();
  const id = options.id();
  const draft = id ? drafts.read(id) : null;
  if (!id || !draft) {
    return false;
  }
  const time = new Date(draft.savedAt).toLocaleString(translations.locale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const restore = await confirm.ask({
    icon: 'question',
    title: translations.t('ux.draft.title'),
    text: translations.t('ux.draft.text', { time }),
    confirmText: translations.t('ux.draft.restore'),
    cancelText: translations.t('ux.draft.discard'),
    dismissible: false,
  });
  drafts.drop(id);
  if (restore) {
    await options.restore(draft.data as T);
  }
  return restore;
}
