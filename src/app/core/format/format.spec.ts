import { formatDate, formatMoney, humanize, toneOf } from './format';

/** Intl separates the currency code with a no-break space. */
const plain = (text: string) => text.replace(/ /g, ' ');

describe('format', () => {
  it('formats money in the tenant currency with two decimals', () => {
    expect(plain(formatMoney(1500, 'TZS'))).toBe('TZS 1,500.00');
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatMoney(null, 'TZS')).toBe('—');
  });

  it('falls back to a plain number for an unknown currency code', () => {
    expect(formatMoney(10, 'NOT-A-CODE')).toBe('10.00');
  });

  it('formats dates without time zone drift', () => {
    expect(formatDate('2026-11-02')).toBe('2 Nov 2026');
    expect(formatDate(null)).toBe('—');
  });

  it('turns codes into labels and tones', () => {
    expect(humanize('MOBILE_MONEY')).toBe('Mobile money');
    expect(humanize('sale.completed')).toBe('Sale completed');
    expect(toneOf('LOW_STOCK')).toBe('amber');
    expect(toneOf('UNKNOWN')).toBe('gray');
  });
});
