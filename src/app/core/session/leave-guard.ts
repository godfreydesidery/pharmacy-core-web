import { Injectable, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

/**
 * Lets a page with unsaved work (the POS with an unfinished sale) ask before it is left: by
 * navigating (the route's canDeactivate) and by the shell's sign-out and branch switch, which do
 * not navigate away first. The page registers its check while it is open.
 */
@Injectable({ providedIn: 'root' })
export class LeaveGuard {
  private check: (() => Promise<boolean>) | null = null;

  /** Registers the open page's check; call the returned function when the page closes. */
  register(check: () => Promise<boolean>): () => void {
    this.check = check;
    return () => {
      if (this.check === check) {
        this.check = null;
      }
    };
  }

  /** True when there is nothing to lose, or the user agreed to leave. */
  canLeave(): Promise<boolean> {
    return this.check ? this.check() : Promise.resolve(true);
  }
}

/** For a route whose page registers with {@link LeaveGuard}. */
export const leaveGuard: CanDeactivateFn<unknown> = () => inject(LeaveGuard).canLeave();
