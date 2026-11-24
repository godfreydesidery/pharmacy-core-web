import { Injectable } from '@angular/core';

/** How long a handed-over temporary password waits for the next page, at most. */
export const HANDOFF_MS = 60_000;

/**
 * Carries the temporary password a staff login just typed at sign-in to the page that replaces it,
 * in memory only (adversarial review WEB-16). Router state would keep it in `history.state`, where
 * it outlives the page: back, forward and a reload bring it back, and so does anyone who opens the
 * browser's history entries. Here it is read once, within a minute, and then gone.
 */
@Injectable({ providedIn: 'root' })
export class TemporaryPasswordHandoff {
  private value: string | null = null;
  private until = 0;

  /** The time, in milliseconds; replaced in tests. */
  now: () => number = () => Date.now();

  /** Keeps `password` for the next {@link take}. */
  give(password: string): void {
    this.value = password || null;
    this.until = this.now() + HANDOFF_MS;
  }

  /** The password given, once, if it is still fresh; null otherwise. */
  take(): string | null {
    const value = this.value !== null && this.now() <= this.until ? this.value : null;
    this.value = null;
    this.until = 0;
    return value;
  }
}
