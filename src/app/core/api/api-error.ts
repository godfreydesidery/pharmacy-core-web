import { HttpErrorResponse } from '@angular/common/http';
import type { Lang, Params } from '../i18n/translations.store';

/** An RFC 9457 problem from the API, or a transport failure in the same shape. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  reason?: string;
  field?: string;
  correlationId?: string;
  /** On 423 and 429: when a retry may succeed. */
  retryAfterSeconds?: number;
}

const STANDARD_MEMBERS = new Set([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'reason',
  'field',
  'correlationId',
  'retryAfterSeconds',
]);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string,
    readonly field: string | null = null,
    readonly correlationId: string | null = null,
    readonly retryAfterSeconds: number | null = null,
    /** The problem's other members, such as `action` and `amount` on `approval_required`. */
    readonly extras: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The form control path of the field the API refused, such as `lines.0.quantity`. */
  get controlPath(): string | null {
    return this.field ? this.field.replace(/\[(\d+)\]/g, '.$1') : null;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return new ApiError(
          0,
          'network_error',
          'The server could not be reached. Check your connection.',
        );
      }
      const body = error.error as Partial<ProblemDetail> | string | null;
      if (body && typeof body === 'object') {
        const extras: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body)) {
          if (!STANDARD_MEMBERS.has(key)) {
            extras[key] = value;
          }
        }
        return new ApiError(
          body.status ?? error.status,
          body.reason ?? 'error',
          body.detail ?? body.title ?? error.statusText ?? 'Request failed',
          body.field ?? null,
          body.correlationId ?? null,
          body.retryAfterSeconds ?? null,
          extras,
        );
      }
      return new ApiError(error.status, 'error', error.statusText || 'Request failed');
    }
    return new ApiError(-1, 'client_error', error instanceof Error ? error.message : String(error));
  }
}

/**
 * The error with its message in the user's language. The API writes `detail` in English, naming
 * the product, amount or field; English users keep it. In another language the refusal's
 * `errors.<reason>` line replaces it, and a reason with no line keeps the server's detail.
 */
/** Reasons whose server wording is technical, so even English shows the dictionary text. */
const FRIENDLY_IN_EVERY_LANGUAGE = new Set(['invalid_uid', 'batch_quarantined']);

export function localizeError(
  error: ApiError,
  lang: Lang,
  t: (key: string, params?: Params, fallback?: string) => string,
): ApiError {
  if (lang === 'en' && !FRIENDLY_IN_EVERY_LANGUAGE.has(error.reason)) {
    return error;
  }
  const message = t(`errors.${error.reason}`, undefined, error.message);
  if (message === error.message) {
    return error;
  }
  return new ApiError(
    error.status,
    error.reason,
    message,
    error.field,
    error.correlationId,
    error.retryAfterSeconds,
    error.extras,
  );
}
