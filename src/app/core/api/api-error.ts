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

/** Reasons whose server wording is technical, so even English shows the dictionary text. */
const FRIENDLY_IN_EVERY_LANGUAGE = new Set(['invalid_uid', 'batch_quarantined']);

/** Returned by `t` when the dictionary has no line, so a missing line is told from a found one. */
const MISSING = '\u0000errors.missing';

/**
 * The placeholders a refusal's line may use: the problem's extra members that are plain values
 * (such as `batchUnitCost` on `batch_cost_differs`), numbers in the language's digits. The API
 * lists each reason's members in `src/app/core/i18n/api-reasons.json`; `npm run i18n:check`
 * refuses a line that uses one the reason does not carry.
 */
export function errorParams(error: ApiError, lang: Lang): Params {
  const params: Record<string, string> = {};
  const locale = lang === 'sw' ? 'sw-TZ' : 'en-TZ';
  for (const [name, value] of Object.entries(error.extras)) {
    if (typeof value === 'number') {
      params[name] = value.toLocaleString(locale, { maximumFractionDigits: 2 });
    } else if (typeof value === 'string' || typeof value === 'boolean') {
      params[name] = String(value);
    }
  }
  return params;
}

/**
 * The error with its message in the user's language. The API writes `detail` in English, naming
 * the product, amount or field; English users keep it. In another language the refusal's
 * `errors.<reason>` line replaces it, its `{{name}}` placeholders filled from the problem's extra
 * members. An `invalid_<field>` reason with no line of its own (the API's generic input checks)
 * takes `errors.invalid_input`; any other reason with no line keeps the server's detail.
 */
export function localizeError(
  error: ApiError,
  lang: Lang,
  t: (key: string, params?: Params, fallback?: string) => string,
): ApiError {
  if (lang === 'en' && !FRIENDLY_IN_EVERY_LANGUAGE.has(error.reason)) {
    return error;
  }
  const params = errorParams(error, lang);
  let message = t(`errors.${error.reason}`, params, MISSING);
  if (message === MISSING && error.reason.startsWith('invalid_')) {
    message = t('errors.invalid_input', params, MISSING);
  }
  if (message === MISSING || message === error.message) {
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
