import { EN } from '../i18n/en';
import { SW } from '../i18n/sw';
import { Params, translate } from '../i18n/translations.store';
import { ApiError, errorParams, localizeError } from './api-error';

const swahili = (key: string, params?: Params, fallback?: string) =>
  translate(SW, key, params, fallback);
const english = (key: string, params?: Params, fallback?: string) =>
  translate(EN, key, params, fallback);

describe('localizeError', () => {
  const short = new ApiError(422, 'payment_short', 'The payments cover 9,000.00 of 10,000.00.');

  it('keeps the server detail in English, which names the amounts', () => {
    expect(localizeError(short, 'en', swahili)).toBe(short);
  });

  it('uses the Swahili line for a known reason and keeps the rest of the error', () => {
    const field = new ApiError(422, 'weak_password', 'Too short.', 'password', 'c-1', null);
    const localized = localizeError(field, 'sw', swahili);
    expect(localized.message).toBe(SW['errors.weak_password']);
    expect(localized.reason).toBe('weak_password');
    expect(localized.field).toBe('password');
    expect(localized.correlationId).toBe('c-1');
    expect(localizeError(short, 'sw', swahili).message).toBe('Malipo hayatoshi kufikia jumla.');
  });

  it('explains a recalled batch with the dictionary line even in English', () => {
    const recalled = new ApiError(422, 'batch_quarantined', 'Batch BX-1 is quarantined.');
    expect(localizeError(recalled, 'en', english).message).toBe(EN['errors.batch_quarantined']);
    expect(localizeError(recalled, 'sw', swahili).message).toBe(SW['errors.batch_quarantined']);
  });

  it('falls back to the server detail for a reason with no line', () => {
    const odd = new ApiError(409, 'some_future_reason', 'Something the web does not know yet.');
    expect(localizeError(odd, 'sw', swahili)).toBe(odd);
  });

  it('fills the placeholders from the problem members, numbers in the language', () => {
    const cost = new ApiError(
      422,
      'batch_cost_differs',
      'Batch B-7 of Panadol is held at 1250.5 a unit; opening stock of it comes at that cost.',
      'unitCost',
      null,
      null,
      { batchUnitCost: 1250.5 },
    );
    const localized = localizeError(cost, 'sw', swahili);
    expect(localized.message).toContain('1,250.5');
    expect(localized.message).not.toContain('{{');
    expect(localized.extras).toEqual({ batchUnitCost: 1250.5 });
    expect(errorParams(cost, 'sw')).toEqual({ batchUnitCost: '1,250.5' });
  });

  it('passes text and flags through, and leaves out objects', () => {
    const extras = { action: 'LATE_RETURN', amount: 0, urgent: true, nested: { a: 1 } };
    const error = new ApiError(403, 'approval_required', 'Approve.', null, null, null, extras);
    expect(errorParams(error, 'en')).toEqual({
      action: 'LATE_RETURN',
      amount: '0',
      urgent: 'true',
    });
  });

  it('gives an input check with no line of its own the general one', () => {
    const check = new ApiError(422, 'invalid_batch_number', 'batchNumber is required.');
    expect(localizeError(check, 'sw', swahili).message).toBe(SW['errors.invalid_input']);
    expect(localizeError(check, 'en', english)).toBe(check);
    const named = new ApiError(422, 'invalid_gtin', 'gtin must be 8 to 14 digits.');
    expect(localizeError(named, 'sw', swahili).message).toBe(SW['errors.invalid_gtin']);
  });

  it('defines every Swahili reason line in English too', () => {
    const reasons = Object.keys(SW).filter((key) => key.startsWith('errors.'));
    expect(reasons.length).toBeGreaterThan(50);
    expect(reasons.filter((key) => !(key in EN))).toEqual([]);
  });
});
