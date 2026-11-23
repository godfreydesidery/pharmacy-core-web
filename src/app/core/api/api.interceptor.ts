import { Router } from '@angular/router';
import { HttpContextToken, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, from, map, switchMap, throwError } from 'rxjs';
import { ConfirmIdentityService } from '../session/confirm-identity';
import { Translations } from '../i18n/translations.store';
import { SessionStore } from '../session/session.store';
import { SignOutService } from '../session/sign-out';
import { ToastService } from '../ui/toast.service';
import { ApiError, localizeError } from './api-error';

/** Do not show a toast for a failure: the caller shows it itself, such as a form field error. */
export const SILENT = new HttpContextToken<boolean>(() => false);
/** Do not send `X-Branch-Id`, such as for a report across all branches. */
export const NO_BRANCH = new HttpContextToken<boolean>(() => false);
/** Already sent again after the person confirmed their password: do not ask a second time. */
const CONFIRMED = new HttpContextToken<boolean>(() => false);

export const API_PREFIX = '/api/';

/**
 * The money-moving POSTs the API keeps idempotent (IETF Idempotency-Key header): each request
 * carries a fresh key, so a request the network repeats (a proxy retry, the request sent again
 * after "Confirm it is you") is recorded once. POST /sales carries its own key in the body.
 */
const IDEMPOTENT =
  /^\/api\/v1\/(receivables\/(payments|write-offs)|finance\/supplier-payments|expenses|sales\/[^/]+\/returns|vouchers(\/[^/]+\/void)?|stock\/(adjustments|opening)|transfers(\/[^/]+\/receive)?|insurance\/remittances|goods-receipts|destructions|supplier-returns|pos\/payment-requests)$/;

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
 * default, and back to sign-in on 401 (saying why when the session ended for want of use).
 */
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_PREFIX)) {
    return next(request);
  }
  const session = inject(SessionStore);
  const toasts = inject(ToastService);
  const injector = inject(Injector);
  const translations = inject(Translations);

  let headers = request.headers;
  if (!headers.has('X-Correlation-Id')) {
    headers = headers.set('X-Correlation-Id', crypto.randomUUID());
  }
  if (!headers.has('Accept-Language')) {
    // The language of messages the API sends this user, such as an SMS receipt.
    headers = headers.set('Accept-Language', translations.lang());
  }
  if (
    request.method === 'POST' &&
    !headers.has('Idempotency-Key') &&
    IDEMPOTENT.test(request.url.split('?')[0])
  ) {
    headers = headers.set('Idempotency-Key', crypto.randomUUID());
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
      if (error.reason === 'reauthentication_required' && !request.context.get(CONFIRMED)) {
        // A sensitive account change after a while: ask for the password, then send it again.
        return from(injector.get(ConfirmIdentityService).ask()).pipe(
          switchMap((confirmed) =>
            confirmed
              ? next(
                  request.clone({ headers, context: request.context.set(CONFIRMED, true) }),
                ).pipe(
                  map((event: HttpEvent<unknown>) =>
                    event instanceof HttpResponse && isEnvelope(event.body)
                      ? event.clone({ body: event.body.data })
                      : event,
                  ),
                )
              : throwError(() => error),
          ),
        );
      }
      const signingIn = request.url.includes('/auth/sign-in');
      const signingOut = request.url.includes('/auth/sign-out');
      if (error.status === 401 && !signingIn) {
        if (!signingOut) {
          // Looked up here, not above: the service itself sends requests through this interceptor.
          void injector
            .get(SignOutService)
            .end(error.reason === 'session_idle' ? 'idle' : 'expired');
        }
      } else if (error.reason === 'two_factor_required_by_pharmacy') {
        // G16: this pharmacy requires a second factor; set one up, then come back.
        toasts.error(error.message);
        void injector.get(Router).navigateByUrl('/account?setup=2fa');
      } else if (!request.context.get(SILENT)) {
        toasts.error(error.message);
      }
      return throwError(() => error);
    }),
  );
};
