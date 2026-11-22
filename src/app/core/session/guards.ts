import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstAllowedPath } from '../layout/nav';
import { SessionStore } from './session.store';

/**
 * A page worth returning to after signing in, or null. The workspace chooser and the sign-in pages
 * are not: returning to the chooser from the chooser is a navigation to the page already open,
 * which Angular reuses, so the "Opening your pharmacy…" screen never went away.
 */
export function usableReturnUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/')) {
    return null;
  }
  const path = url.split(/[?#]/)[0];
  const skipped = ['/', '/workspace', '/sign-in', '/forgot-password', '/reset-password'];
  return skipped.includes(path) ? null : url;
}

/** Signed in, or back to sign-in with the page to return to. */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  if (session.signedIn()) {
    return true;
  }
  const returnUrl = usableReturnUrl(state.url);
  return inject(Router).createUrlTree(['/sign-in'], {
    queryParams: returnUrl ? { returnUrl } : {},
  });
};

/** Only for someone signed out, such as the sign-in page. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.signedIn() ? inject(Router).createUrlTree(['/workspace']) : true;
};

/** A tenant has been chosen. */
export const workspaceGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.tenant() ? true : inject(Router).createUrlTree(['/workspace']);
};

/** The root administrator only. */
export const rootGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.isRoot() ? true : inject(Router).createUrlTree(['/']);
};

/** The route's `data.permission`; otherwise the first page the session may open. */
export const permissionGuard: CanActivateFn = (route) => {
  const session = inject(SessionStore);
  const permission = route.data['permission'] as string | undefined;
  if (session.can(permission)) {
    return true;
  }
  return inject(Router).createUrlTree([firstAllowedPath((p) => session.can(p))]);
};

/** `/` lands on the first page the session may open. */
export const homeRedirect: CanActivateFn = () => {
  const session = inject(SessionStore);
  return inject(Router).createUrlTree([firstAllowedPath((p) => session.can(p))]);
};
