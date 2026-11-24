import { convertMoney, formatMoney, minorUnits, roundHalfUp, roundMoney } from './format';

const plain = (s: string) => s.replace(/\u00a0/g, ' ');

describe('currencies', () => {
  it('formats each currency with its ISO 4217 minor units', () => {
    expect(plain(formatMoney(1500, 'TZS'))).toBe('TZS 1,500.00');
    expect(plain(formatMoney(1500, 'JPY'))).toBe('¥1,500');
    expect(plain(formatMoney(1.2345, 'KWD'))).toBe('KWD 1.235');
    expect(plain(formatMoney(1500, 'UGX'))).toBe('UGX 1,500');
    // ISO 4217 keeps the Somali shilling's cents, where Intl (CLDR) shows none.
    expect(plain(formatMoney(1500, 'SOS'))).toBe('SOS 1,500.00');
  });

  it('knows minor units', () => {
    expect(minorUnits('TZS')).toBe(2);
    expect(minorUnits('JPY')).toBe(0);
    expect(minorUnits('KWD')).toBe(3);
    expect(minorUnits('UGX')).toBe(0);
    expect(minorUnits('ugx')).toBe(0);
    expect(minorUnits('RWF')).toBe(0);
    expect(minorUnits('KES')).toBe(2);
    // ISO 4217, as the API (the JDK) has them, where CLDR differs
    expect(minorUnits('SOS')).toBe(2);
    expect(minorUnits('IQD')).toBe(3);
    expect(minorUnits('')).toBe(2);
    expect(minorUnits(null)).toBe(2);
    expect(minorUnits('XYZ1')).toBe(2);
  });

  it('converts half-up like the API, at the target currency’s minor units', () => {
    // USD 10 at 2,650 TZS/USD
    expect(convertMoney(10, 2650, 'TZS')).toBe(26500);
    // a tie goes away from zero, never to the even neighbour
    expect(convertMoney(0.005, 1, 'USD')).toBe(0.01);
    expect(convertMoney(0.015, 1, 'USD')).toBe(0.02);
    expect(convertMoney(0.025, 1, 'USD')).toBe(0.03);
    expect(convertMoney(155.5, 1, 'JPY')).toBe(156);
    expect(convertMoney(154.5, 1, 'JPY')).toBe(155);
    expect(convertMoney(-0.005, 1, 'USD')).toBe(-0.01);
    // UGX has no minor unit: USD 3.77 at 3,700.5 is UGX 13,950.885 → 13,951
    expect(convertMoney(3.77, 3700.5, 'UGX')).toBe(13951);
    expect(convertMoney(10, 0, 'TZS')).toBe(0);
  });

  it('rounds an amount half-up at its currency’s minor units, without float error', () => {
    expect(roundMoney(1500.005, 'TZS')).toBe(1500.01);
    expect(roundMoney(10.075, 'TZS')).toBe(10.08); // 10.074999999999999 in floating point
    expect(roundMoney(1500.5, 'UGX')).toBe(1501);
    expect(roundMoney(1500.49, 'UGX')).toBe(1500);
    expect(roundMoney(-1500.5, 'UGX')).toBe(-1501);
    expect(roundMoney(1.2345, 'KWD')).toBe(1.235);
    expect(roundHalfUp(1.0000005, 6)).toBe(1.000001);
    expect(Object.is(roundMoney(-0.001, 'TZS'), 0)).toBe(true); // no negative zero
  });
});
