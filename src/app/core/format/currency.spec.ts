import { convertHalfEven, formatMoney, minorUnits } from './format';

const plain = (s: string) => s.replace(/\u00a0/g, ' ');

describe('currencies', () => {
  it('formats each currency with its ISO 4217 minor units', () => {
    expect(plain(formatMoney(1500, 'TZS'))).toBe('TZS 1,500.00');
    expect(plain(formatMoney(1500, 'JPY'))).toBe('¥1,500');
    expect(plain(formatMoney(1.2345, 'KWD'))).toBe('KWD 1.235');
  });

  it('knows minor units', () => {
    expect(minorUnits('TZS')).toBe(2);
    expect(minorUnits('JPY')).toBe(0);
    expect(minorUnits('KWD')).toBe(3);
  });

  it('converts half-even like the API', () => {
    // USD 10 at 2,650 TZS/USD
    expect(convertHalfEven(10, 2650, 'TZS')).toBe(26500);
    // ties go to the even neighbour
    expect(convertHalfEven(0.005, 1, 'USD')).toBe(0);
    expect(convertHalfEven(0.015, 1, 'USD')).toBe(0.02);
    expect(convertHalfEven(155.5, 1, 'JPY')).toBe(156);
    expect(convertHalfEven(154.5, 1, 'JPY')).toBe(154);
  });
});
