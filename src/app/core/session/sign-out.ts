import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../api/api.service';
import { usableReturnUrl } from './guards';
import { LeaveGuard } from './leave-guard';
import { SESSION_STORAGE_KEY, SessionStore } from './session.store';

/**
 * Why a session ends: the person signed out (`user`), the app signed them out after the
 * inactivity limit (`idle`), the API refused the session (`expired`), or another tab signed out
 * (`elsewhere`).
 */
export type SignOutReason = 'user' | 'idle' | 'expired' | 'elsewhere';

/**
 * The page to open after signing in. A page kept at sign-out names whose it is (`returnFor`, the
 * user's uid): only that person goes back to it, and anyone else signing in at the same computer
 * starts from the workspace. A page with no owner (a link opened while signed out) is anyone's.
 */
export function returnUrlFor(
  returnUrl: string | null | undefined,
  returnFor: string | null | undefined,
  userUid: string,
): string | null {
  const usable = usableReturnUrl(returnUrl);
  return usable && (!returnFor || returnFor === userUid) ? usable : null;
}

/**
 * Ends the session the same way whatever the reason. Unsaved work is kept first, while the session
 * still says where it belongs: the POS parks an unfinished sale. Unless the person signed out
 * themselves, the sign-in page says why and brings them back to the page they were on (that
 * person only: see {@link returnUrlFor}). Signing out in one tab signs out the others.
 */
@Injectable({ providedIn: 'root' })
export class SignOutService {
  private readonly session = inject(SessionStore);
  private readonly leave = inject(LeaveGuard);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  private ending = false;

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key === SESSION_STORAGE_KEY && event.newValue === null && this.session.signedIn()) {
        void this.end('elsewhere');
      }
    });
  }

  /** False when nothing happened: a page with unsaved work kept the person, or already ending. */
  async end(reason: SignOutReason): Promise<boolean> {
    if (this.ending || !this.session.signedIn()) {
      return false;
    }
    this.ending = true;
    try {
      const mayLeave = await this.leave.canLeave();
      if (!mayLeave && reason === 'user') {
        return false;
      }
      if (reason === 'user' || reason === 'idle') {
        // The API records it (an idle one as such); the session is dropped here either way.
        await this.api
          .post('/auth/sign-out', reason === 'idle' ? { reason: 'IDLE' } : {}, { silent: true })
          .catch(() => undefined);
      }
      const returnUrl = reason === 'user' ? null : usableReturnUrl(this.router.url);
      const owner = this.session.user()?.uid;
      this.session.signOut();
      await this.router.navigate(['/sign-in'], {
        queryParams: {
          ...(reason === 'idle' ? { idle: 1 } : reason === 'expired' ? { expired: 1 } : {}),
          ...(returnUrl ? { returnUrl, ...(owner ? { returnFor: owner } : {}) } : {}),
        },
      });
      return true;
    } finally {
      this.ending = false;
    }
  }
}
