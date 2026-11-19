import { Batch } from '../../core/api/models';

/** What the till shows of the batches a cart line will be sold from. */
export interface LineBatch {
  batchNumber: string;
  expiryDate: string | null;
  /** The quantity in the cart is more than this batch holds, so the next batch is used too. */
  more: boolean;
}

/**
 * The batch the API will sell first (first expiry, first out): on hand, not expired, not
 * recalled, the nearest expiry first; a batch without expiry after dated ones. Null when nothing
 * is sellable, which the API will refuse anyway.
 */
export function nextBatch(batches: readonly Batch[], quantity: number): LineBatch | null {
  const sellable = batches
    .filter((b) => b.quantity > 0 && !b.expired && !b.quarantined)
    .sort((a, b) => {
      if (a.expiryDate === b.expiryDate) return a.batchNumber.localeCompare(b.batchNumber);
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
  const first = sellable[0];
  if (!first) return null;
  return {
    batchNumber: first.batchNumber,
    expiryDate: first.expiryDate,
    more: quantity > first.quantity,
  };
}
