import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../../core/api/api-error';
import { PaymentRequest } from '../../core/api/models';
import { CheckoutTimeout, TillPayment, applyPush, forApi, pushWanted, uncertain } from './checkout';

describe('an uncertain checkout', () => {
  const refused = (status: number, reason: string) => new ApiError(status, reason, reason);

  it('is one with no clear answer: no connection, no answer in time, a server error', () => {
    expect(uncertain(ApiError.from(new HttpErrorResponse({ status: 0 })))).toBe(true);
    expect(uncertain(new CheckoutTimeout())).toBe(true);
    expect(uncertain(refused(500, 'internal_error'))).toBe(true);
    expect(uncertain(refused(502, 'error'))).toBe(true);
    expect(uncertain(refused(504, 'error'))).toBe(true);
    // A 2xx whose body could not be read: the sale was made.
    expect(uncertain(refused(201, 'error'))).toBe(true);
    expect(uncertain(new Error('boom'))).toBe(true);
  });

  it('counts only the refusals that say the sale may exist', () => {
    expect(uncertain(refused(409, 'idempotency_in_progress'))).toBe(true);
    expect(uncertain(refused(422, 'idempotency_key_reused'))).toBe(true);
  });

  it('is not every 409: a lost lock, a stale record or a missing shift recorded nothing', () => {
    for (const reason of ['busy_try_again', 'stale_version', 'conflict', 'shift_required']) {
      expect(uncertain(refused(409, reason))).toBe(false);
    }
    expect(uncertain(refused(400, 'insufficient_stock'))).toBe(false);
    expect(uncertain(refused(403, 'approval_required'))).toBe(false);
    expect(uncertain(refused(401, 'session_expired'))).toBe(false);
    expect(uncertain(refused(422, 'unpriced_line'))).toBe(false);
  });
});

describe('mobile-money push', () => {
  const request: PaymentRequest = {
    uid: 'req-1',
    methodCode: 'MPESA',
    amount: 1500,
    currency: 'TZS',
    phone: '0712000000',
    status: 'CONFIRMED',
    providerReference: 'QK1',
    failureReason: null,
    expiresAt: '2026-11-23T10:00:00Z',
  };
  const rows: TillPayment[] = [
    { method: 'CASH', amount: 500, reference: null, row: 'a' },
    { method: 'MOBILE_MONEY', channel: 'MPESA', amount: 1500, reference: null, row: 'b' },
  ];

  it('writes the result into the row it was sent from, wherever that row now is', () => {
    const moved = [rows[1], rows[0]]; // the row above was removed or the rows reordered
    const applied = applyPush(moved, 'sale-1', 'sale-1', 'b', request);
    expect(applied?.[0].reference).toBe('req-1');
    expect(applied?.[1].reference).toBeNull();
  });

  it('never writes into another sale, a removed row or a row given another method', () => {
    expect(applyPush(rows, 'sale-2', 'sale-1', 'b', request)).toBeNull();
    expect(applyPush([rows[0]], 'sale-1', 'sale-1', 'b', request)).toBeNull();
    const changed = [rows[0], { ...rows[1], method: 'CARD' as const, channel: 'VISA' }];
    expect(applyPush(changed, 'sale-1', 'sale-1', 'b', request)).toBeNull();
    expect(pushWanted(changed, 'sale-1', 'sale-1', 'b', 'MPESA')).toBe(false);
    expect(pushWanted(rows, 'sale-1', 'sale-1', 'b', 'MPESA')).toBe(true);
  });

  it('sends no row ids to the API', () => {
    expect(forApi(rows).map((p) => 'row' in p)).toEqual([false, false]);
    expect(forApi(rows)[1]).toEqual({
      method: 'MOBILE_MONEY',
      channel: 'MPESA',
      amount: 1500,
      reference: null,
    });
  });
});
