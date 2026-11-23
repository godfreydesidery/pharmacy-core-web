import { Router } from '@angular/router';
import {
  HttpContextToken,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { ConfirmIdentityService } from '../session/confirm-identity';
import { ManagerApprovalService } from '../session/manager-approval';
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
/** The actions a manager already approved for this request: never asked for twice. */
const APPROVED = new HttpContextToken<readonly string[]>(() => []);

export const API_PREFIX = '/api/';

/** A manager's single-use approval of the request (see ManagerApprovalService). */
const APPROVAL_HEADER = 'X-Approval';

/**
 * The money-moving POSTs the API keeps idempotent (IETF Idempotency-Key header): each request
 * carries a fresh key, so a request the network repeats (a proxy retry, the request sent again
 * after "Confirm it is you") is recorded once. POST /sales carries its own key in the body.
 */
const IDEMPOTENT =
  /^\/api\/v1\/(receivables\/(payments|write-offs)|finance\/supplier-payments|expenses|sales\/[^/]+\/returns|sales\/returns\/[^/]+\/lines\/[^/]+\/release|vouchers(\/[^/]+\/void)?|stock\/(adjustments|opening)|transfers(\/[^/]+\/receive)?|insurance\/remittances|goods-receipts|destructions|supplier-returns|pos\/payment-requests)$/;

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

  const unwrap = map((event: HttpEvent<unknown>) =>
    event instanceof HttpResponse && isEnvelope(event.body)
      ? event.clone({ body: event.body.data })
      : event,
  );

  // Sends the request; after "Confirm it is you" or a manager's approval it is sent again through
  // here, so a refusal of the second attempt is handled (and shown) like any other.
  const send = (attempt: HttpRequest<unknown>): Observable<HttpEvent<unknown>> =>
    next(attempt).pipe(
      unwrap,
      catchError((failure: unknown) => {
        const error = localizeError(
          ApiError.from(failure),
          translations.lang(),
          (key, params, fallback) => translations.t(key, params, fallback),
        );
        if (error.reason === 'reauthentication_required' && !attempt.context.get(CONFIRMED)) {
          // A sensitive account change after a while: ask for the password, then send it again.
          return from(injector.get(ConfirmIdentityService).ask()).pipe(
            switchMap((confirmed) =>
              confirmed
                ? send(attempt.clone({ context: attempt.context.set(CONFIRMED, true) }))
                : throwError(() => error),
            ),
          );
        }
        const approved = attempt.context.get(APPROVED);
        const action = String(error.extras['action'] ?? '');
        if (error.reason === 'approval_required' && !approved.includes(action)) {
          // Above the pharmacy's limit: a manager approves on this screen, then it goes again.
          // One request may need two (a late return of a damaged controlled medicine): each
          // approval is added to the list header, and an action is never asked for twice.
          const amount = Number(error.extras['amount'] ?? 0);
          return from(injector.get(ManagerApprovalService).ask({ action, amount })).pipe(
            switchMap((token) => {
              if (!token) {
                return throwError(() => error);
              }
              const sent = attempt.headers.get(APPROVAL_HEADER);
              return send(
                attempt.clone({
                  headers: attempt.headers.set(APPROVAL_HEADER, sent ? `${sent}, ${token}` : token),
                  context: attempt.context.set(APPROVED, [...approved, action]),
                }),
              );
            }),
          );
        }
        const signingIn = attempt.url.includes('/auth/sign-in');
        const signingOut = attempt.url.includes('/auth/sign-out');
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
        } else if (!attempt.context.get(SILENT)) {
          toasts.error(error.message);
        }
        return throwError(() => error);
      }),
    );

  return send(request.clone({ headers }));
};
