import { PaymentRequest, SalePayment } from '../../core/api/models';

/**
 * How long the till waits for POST /sales before it treats the answer as unknown. Checkout can
 * include a payment authorisation and fiscal issue at the server (5 to 30 s with real providers),
 * so the wait is longer than any of those. The request is not abandoned: a late sale still counts.
 */
export const CHECKOUT_TIMEOUT_MS = 45_000;

/** The till stopped waiting for the checkout's answer (see {@link CHECKOUT_TIMEOUT_MS}). */
export class CheckoutTimeout extends Error {
  readonly status = 0;
  readonly reason = 'checkout_timeout';
  constructor() {
    super('The server did not answer in time.');
    this.name = 'CheckoutTimeout';
  }
}

/**
 * Refusals that say the sale may exist (or does): another request with the same key is still
 * running, or the key already made a sale from another body. Every other 4xx is a clear "no":
 * nothing was recorded (409 busy_try_again, stale_version, conflict and shift_required roll back).
 */
const MAY_EXIST = new Set(['idempotency_in_progress', 'idempotency_key_reused']);

/**
 * Whether a failed checkout leaves the sale's fate unknown: no connection, the till's own
 * timeout, a 5xx (the proxy or server may have failed after the sale committed), an unreadable
 * 2xx, a failure outside HTTP, or a refusal in {@link MAY_EXIST}.
 */
export function uncertain(failure: unknown): boolean {
  const error = failure as { status?: unknown; reason?: unknown } | null;
  const status = typeof error?.status === 'number' ? error.status : -1;
  const reason = typeof error?.reason === 'string' ? error.reason : '';
  return status <= 0 || (status >= 200 && status < 300) || status >= 500 || MAY_EXIST.has(reason);
}

/** A payment row at the till; `row` ties a mobile-money push to it and is never sent. */
export interface TillPayment extends SalePayment {
  row?: string;
}

/** The payments as the API takes them: without the till's row ids. */
export function forApi(payments: readonly TillPayment[]): SalePayment[] {
  return payments.map(({ row: _row, ...payment }) => payment);
}

/** A mobile-money push in progress or done, bound to the sale and the row it was sent from. */
export interface PushState {
  phone: string;
  request: PaymentRequest | null;
  busy: boolean;
  /** The sale on screen when it was sent (its cart token). */
  sale: string | null;
}

/**
 * Whether a push is still wanted: the same sale is on screen and its row is still there with the
 * method it was sent for. Polling stops as soon as this is false.
 */
export function pushWanted(
  payments: readonly TillPayment[],
  currentSale: string,
  sale: string,
  row: string,
  methodCode: string,
): boolean {
  return sale === currentSale && payments.some((p) => p.row === row && p.channel === methodCode);
}

/**
 * The payments with a confirmed push applied to the row it came from (its reference becomes the
 * request's uid), or null when that sale or row is gone: a result is never written into another
 * sale or into whichever row now sits at the same position.
 */
export function applyPush(
  payments: readonly TillPayment[],
  currentSale: string,
  sale: string,
  row: string,
  request: PaymentRequest,
): TillPayment[] | null {
  if (!pushWanted(payments, currentSale, sale, row, request.methodCode)) {
    return null;
  }
  return payments.map((p) => (p.row === row ? { ...p, reference: request.uid } : p));
}
