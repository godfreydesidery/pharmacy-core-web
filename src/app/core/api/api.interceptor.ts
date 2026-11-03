import { HttpContextToken, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, throwError } from 'rxjs';
import { Translations } from '../i18n/translations.store';
import { SessionStore } from '../session/session.store';
import { ToastService } from '../ui/toast.service';
import { ApiError, localizeError } from './api-error';

/** Do not show a toast for a failure: the caller shows it itself, such as a form field error. */
export const SILENT = new HttpContextToken<boolean>(() => false);
/** Do not send `X-Branch-Id`, such as for a report across all branches. */
export const NO_BRANCH = new HttpContextToken<boolean>(() => false);

export const API_PREFIX = '/api/';

interface Envelope {
  success: boolean;
  data: unknown;
}

function isEnvelope(body: unknown): body is Envelope {
  return !!body && typeof body === 'object' && 'success' in body && 'data' in body;
}

/**
 * Adds the session's headers to every API request, unwraps the success envelope so callers get
 * `data` directly, and turns failures into {@link ApiError}s in the user's language: a toast by
 * default, and back to sign-in on 401.
 */
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_PREFIX)) {
    return next(request);
  }
  const session = inject(SessionStore);
  const toasts = inject(ToastService);
  const router = inject(Router);
  const translations = inject(Translations);

  let headers = request.headers;
  if (!headers.has('X-Correlation-Id')) {
    headers = headers.set('X-Correlation-Id', crypto.randomUUID());
  }
  if (!headers.has('Accept-Language')) {
    // The language of messages the API sends this user, such as an SMS receipt.
    headers = headers.set('Accept-Language', translations.lang());
  }
  const token = session.token();
  if (token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  // Platform routes act above every tenant: the workspace the root administrator is in must not
  // scope them (the platform audit trail would otherwise show that tenant's entries).
  const platform = request.url.includes('/v1/platform/');
  const tenant = session.tenant();
  if (tenant && !platform && !headers.has('X-Tenant-Id')) {
    headers = headers.set('X-Tenant-Id', tenant.uid);
  }
  const branch = session.branch();
  if (branch && !platform && !headers.has('X-Branch-Id') && !request.context.get(NO_BRANCH)) {
    headers = headers.set('X-Branch-Id', branch.uid);
  }

  return next(request.clone({ headers })).pipe(
    map((event: HttpEvent<unknown>) =>
      event instanceof HttpResponse && isEnvelope(event.body)
        ? event.clone({ body: event.body.data })
        : event,
    ),
    catchError((failure: unknown) => {
      const error = localizeError(
        ApiError.from(failure),
        translations.lang(),
        (key, params, fallback) => translations.t(key, params, fallback),
      );
      const signingIn = request.url.includes('/auth/sign-in');
      if (error.status === 401 && !signingIn) {
        session.signOut();
        void router.navigate(['/sign-in'], { queryParams: { expired: 1 } });
      } else if (!request.context.get(SILENT)) {
        toasts.error(error.message);
      }
      return throwError(() => error);
    }),
  );
};
