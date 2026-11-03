import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstAllowedPath } from '../layout/nav';
import { SessionStore } from './session.store';

/** Signed in, or back to sign-in with the page to return to. */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  return session.signedIn()
    ? true
    : inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
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
