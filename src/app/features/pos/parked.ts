import { CheckoutRequest } from '../../core/api/models';

/**
 * A sale put aside at the till (the customer stepped away, or another is served first) and picked
 * up again later. Parked sales live in this browser only, for one cashier at one branch of one
 * pharmacy: the API creates a sale when it is paid, so nothing is held or reserved before then.
 *
 * Storage keeps no personal data and no medicine names: products and the customer by uid (and the
 * product's code, to find it again), with quantities. Names, prices and stock are read again from
 * the API when the sale is resumed. The one exception is an unconfirmed checkout (`pending`): its
 * request is kept exactly as it was sent, because sending it again byte for byte, with the same
 * idempotency key, is what returns the sale already made instead of making a second one.
 */
export interface ParkedSale {
  id: string;
  parkedAt: string;
  lines: ParkedLine[];
  customerUid: string | null;
  discountPercent: number;
  /** The total when parked, to tell sales apart in the list; it is re-priced when resumed. */
  total: number;
  /** The sale's idempotency key: it stays with the cart through parking and reloads. */
  idempotencyKey: string;
  /** A checkout that got no clear answer: the exact request to send again. */
  pending?: CheckoutRequest | null;
  /** When that checkout was first sent, to look the sale up around that time. */
  pendingAt?: string | null;
}

export interface ParkedLine {
  productUid: string;
  /** The product's code (unique in the pharmacy), to find it again at the till. */
  sku: string | null;
  quantity: number;
  serials?: string[];
}

/** At most this many sales wait at one till; the oldest gives way. */
export const PARKED_LIMIT = 20;

/**
 * A parked sale is dropped 12 hours after it was parked. That covers a customer who comes back
 * later the same day (a long shift is 12 hours), but no cart waits overnight into another day's
 * prices, stock and cashier. A pharmacy with "Shared counter PCs" on drops them at the end of its
 * business day instead (see {@link ParkedExpiry}).
 */
export const PARKED_TTL_MS = 12 * 60 * 60 * 1000;

const PREFIX = 'pos.parked.';

/** Where a cashier's parked sales at a branch are kept. */
export function parkedKey(tenantUid: string, branchUid: string, userUid: string): string {
  return `${PREFIX}${tenantUid}.${branchUid}.${userUid}`;
}

/**
 * How long parked sales last at this pharmacy. With "Shared counter PCs" on (WEB-5), a parked sale
 * lasts until the end of the business day it was parked in, in the pharmacy's time zone, so no cart
 * is left on a shared computer overnight; otherwise {@link PARKED_TTL_MS}.
 */
export interface ParkedExpiry {
  sharedPc: boolean;
  /** The pharmacy's IANA time zone, such as Africa/Dar_es_Salaam; the browser's when missing. */
  timeZone?: string | null;
}

/** The calendar day (YYYY-MM-DD) of an instant in a time zone; the browser's for an unknown one. */
export function businessDay(at: number, timeZone?: string | null): string {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: timeZone || undefined });
  } catch {
    format = new Intl.DateTimeFormat('en-CA', options);
  }
  const parts = Object.fromEntries(format.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}

/**
 * Whether a parked sale has expired (or has no readable time): older than {@link PARKED_TTL_MS},
 * or, on shared counter PCs, parked on an earlier business day of the pharmacy.
 */
export function expired(
  sale: Pick<ParkedSale, 'parkedAt'>,
  now = Date.now(),
  expiry?: ParkedExpiry | null,
): boolean {
  const at = Date.parse(sale.parkedAt);
  if (!Number.isFinite(at)) {
    return true;
  }
  if (expiry?.sharedPc) {
    return at > now || businessDay(at, expiry.timeZone) !== businessDay(now, expiry.timeZone);
  }
  return now - at > PARKED_TTL_MS;
}

/**
 * A stored entry in today's shape, or null when it is unusable. Entries written before parked
 * sales dropped personal data (whole product and customer objects) are reduced to uids here, so
 * the first write afterwards removes the names from storage.
 */
export function normalize(raw: unknown): ParkedSale | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const entry = raw as Record<string, unknown>;
  if (typeof entry['id'] !== 'string' || !Array.isArray(entry['lines'])) {
    return null;
  }
  const lines: ParkedLine[] = [];
  for (const item of entry['lines'] as Record<string, unknown>[]) {
    const product = (item?.['product'] ?? null) as Record<string, unknown> | null;
    const productUid = item?.['productUid'] ?? product?.['productUid'];
    const quantity = Number(item?.['quantity']);
    if (typeof productUid !== 'string' || !(quantity > 0)) {
      continue;
    }
    const sku = item['sku'] ?? product?.['sku'] ?? null;
    const serials = item['serials'];
    lines.push({
      productUid,
      sku: typeof sku === 'string' ? sku : null,
      quantity: Math.floor(quantity),
      ...(Array.isArray(serials) && serials.length ? { serials: serials.map(String) } : {}),
    });
  }
  if (!lines.length) {
    return null;
  }
  const customer = entry['customer'] as Record<string, unknown> | null | undefined;
  const customerUid = entry['customerUid'] ?? customer?.['uid'] ?? null;
  const pending = (entry['pending'] ?? null) as CheckoutRequest | null;
  const key = entry['idempotencyKey'];
  return {
    id: entry['id'],
    parkedAt: String(entry['parkedAt'] ?? ''),
    lines,
    customerUid: typeof customerUid === 'string' ? customerUid : null,
    discountPercent: Number(entry['discountPercent']) || 0,
    total: Number(entry['total']) || 0,
    idempotencyKey:
      pending?.idempotencyKey ?? (typeof key === 'string' && key ? key : crypto.randomUUID()),
    ...(pending
      ? { pending, pendingAt: String(entry['pendingAt'] ?? entry['parkedAt'] ?? '') }
      : {}),
  };
}

/**
 * The parked sales under a key, newest first, without expired ones; nothing when storage is
 * missing or unreadable.
 */
export function readParked(
  storage: Pick<Storage, 'getItem'> | null,
  key: string,
  now = Date.now(),
  expiry?: ParkedExpiry | null,
): ParkedSale[] {
  try {
    const raw = storage?.getItem(key);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.map(normalize).filter((p): p is ParkedSale => p !== null && !expired(p, now, expiry))
      : [];
  } catch {
    return [];
  }
}

export function writeParked(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  key: string,
  list: readonly ParkedSale[],
): void {
  try {
    if (list.length) {
      storage?.setItem(key, JSON.stringify(list));
    } else {
      storage?.removeItem(key);
    }
  } catch {
    // Private windows and full storage: parking still works until the page is closed.
  }
}

/** Puts a sale at the front of the list, keeping the newest {@link PARKED_LIMIT}. */
export function park(list: readonly ParkedSale[], sale: ParkedSale): ParkedSale[] {
  const all = [sale, ...list.filter((p) => p.id !== sale.id)];
  // An unconfirmed checkout never gives way to the limit: dropping it would lose its key.
  let room = Math.max(PARKED_LIMIT - all.filter((p) => p.pending).length, 1);
  return all.filter((p) => !!p.pending || room-- > 0);
}

/** Takes a parked sale out of the list, for resuming or discarding it. */
export function unpark(
  list: readonly ParkedSale[],
  id: string,
): { sale: ParkedSale | null; rest: ParkedSale[] } {
  const sale = list.find((p) => p.id === id) ?? null;
  return { sale, rest: list.filter((p) => p.id !== id) };
}

/**
 * At sign-out: removes the user's parked sales in every pharmacy and branch of this browser. An
 * unconfirmed checkout stays (until it expires), so that after signing in again the cashier can
 * still ask the API about it with its key instead of ringing the sale up a second time.
 */
export function clearParkedOf(storage: Storage | null, userUid: string, now = Date.now()): void {
  if (!storage || !userUid) {
    return;
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX) && key.endsWith(`.${userUid}`)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      writeParked(
        storage,
        key,
        readParked(storage, key, now).filter((p) => p.pending),
      );
    }
  } catch {
    // Storage unavailable: nothing was kept there either.
  }
}
