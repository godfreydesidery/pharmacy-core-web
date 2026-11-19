import { Customer } from '../../core/api/models';
import { CartLine } from './cart';

/**
 * A sale put aside at the till (the customer stepped away, or another is served first) and picked
 * up again later. Parked sales live in this browser only, for one cashier at one branch: the API
 * creates a sale when it is paid, so nothing is held or reserved before then.
 */
export interface ParkedSale {
  id: string;
  parkedAt: string;
  lines: CartLine[];
  customer: Customer | null;
  discountPercent: number;
  /** The total when parked, to tell sales apart in the list; it is re-priced when resumed. */
  total: number;
}

/** At most this many sales wait at one till; the oldest gives way. */
export const PARKED_LIMIT = 20;

/** Where a cashier's parked sales at a branch are kept. */
export function parkedKey(tenantUid: string, branchUid: string, userUid: string): string {
  return `pos.parked.${tenantUid}.${branchUid}.${userUid}`;
}

/** The parked sales under a key, newest first; nothing when storage is missing or unreadable. */
export function readParked(storage: Pick<Storage, 'getItem'> | null, key: string): ParkedSale[] {
  try {
    const raw = storage?.getItem(key);
    const list = raw ? (JSON.parse(raw) as ParkedSale[]) : [];
    return Array.isArray(list)
      ? list.filter((p) => p && Array.isArray(p.lines) && p.lines.length > 0)
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
  return [sale, ...list.filter((p) => p.id !== sale.id)].slice(0, PARKED_LIMIT);
}

/** Takes a parked sale out of the list, for resuming or discarding it. */
export function unpark(
  list: readonly ParkedSale[],
  id: string,
): { sale: ParkedSale | null; rest: ParkedSale[] } {
  const sale = list.find((p) => p.id === id) ?? null;
  return { sale, rest: list.filter((p) => p.id !== id) };
}
