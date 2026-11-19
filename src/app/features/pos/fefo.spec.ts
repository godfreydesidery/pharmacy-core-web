import { Batch } from '../../core/api/models';
import { nextBatch } from './fefo';

function batch(
  batchNumber: string,
  expiryDate: string | null,
  quantity: number,
  extra: Partial<Batch> = {},
): Batch {
  return {
    uid: batchNumber,
    productUid: 'p',
    batchNumber,
    expiryDate,
    quantity,
    unitCost: 100,
    daysLeft: null,
    expired: false,
    ...extra,
  };
}

describe('the batch a line is sold from', () => {
  it('is the nearest expiry that is on hand', () => {
    const line = nextBatch(
      [batch('B', '2029-08-15', 40), batch('A', '2028-02-15', 12), batch('C', '2027-01-15', 0)],
      2,
    );
    expect(line).toEqual({ batchNumber: 'A', expiryDate: '2028-02-15', more: false });
  });

  it('skips expired and recalled batches', () => {
    const line = nextBatch(
      [
        batch('OLD', '2026-12-15', 5, { expired: true }),
        batch('RECALL', '2027-03-15', 9, { quarantined: true }),
        batch('OK', '2028-05-15', 3),
      ],
      1,
    );
    expect(line?.batchNumber).toBe('OK');
  });

  it('says when the quantity runs into the next batch', () => {
    expect(nextBatch([batch('A', '2028-02-15', 3), batch('B', '2029-01-15', 10)], 5)?.more).toBe(
      true,
    );
  });

  it('puts undated batches after dated ones, and is null when nothing can be sold', () => {
    expect(
      nextBatch([batch('NODATE', null, 5), batch('DATED', '2030-01-15', 5)], 1)?.batchNumber,
    ).toBe('DATED');
    expect(nextBatch([batch('X', '2026-01-15', 4, { expired: true })], 1)).toBeNull();
    expect(nextBatch([], 1)).toBeNull();
  });
});
