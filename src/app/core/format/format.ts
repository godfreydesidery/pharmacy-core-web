/** Pure formatting helpers; the pipes in this folder wrap them for templates. */

const moneyFormats = new Map<string, Intl.NumberFormat>();

/**
 * The Intl locale for plain numbers, such as `sw-TZ`; the Translations store sets it with the
 * language. Money keeps `en-US` so amounts show the unambiguous ISO code (TZS 1,500.00).
 */
let formatLocale = 'en-TZ';

export function setFormatLocale(locale: string): void {
  formatLocale = locale;
}

export function currentFormatLocale(): string {
  return formatLocale;
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale = 'en-US',
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  if (!currency) {
    // The currency is not known yet (settings still loading): never guess one.
    return formatNumberFixed(amount, locale);
  }
  const code = currency;
  const key = `${locale}|${code}`;
  let format = moneyFormats.get(key);
  if (!format) {
    try {
      // Each currency's ISO 4217 minor units (TZS and USD 2, UGX and JPY 0, KWD 3), as the API
      // rounds it; Intl rounds half away from zero (half-up) for display, like the API.
      const digits = minorUnits(code);
      format = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    } catch {
      format = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    moneyFormats.set(key, format);
  }
  return format.format(amount);
}

/** A compact amount for KPI tiles, such as TZS 29.9K or TZS 3.53M; exact below 10,000. */
export function formatMoneyCompact(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale = 'en-US',
  exactBelow = 10_000,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  if (Math.abs(amount) < exactBelow) {
    return formatMoney(amount, currency, locale);
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      notation: 'compact',
      maximumSignificantDigits: 3,
    }).format(amount);
  } catch {
    return formatCompact(amount);
  }
}

/** A compact amount for chart axes, such as 12.5K or 1.2M. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat(formatLocale).format(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The short month name in the current language, such as `Nov`, `Des` in Swahili browsers. */
function monthName(date: Date): string {
  try {
    return new Intl.DateTimeFormat(formatLocale, { month: 'short' }).format(date);
  } catch {
    return MONTHS[date.getMonth()];
  }
}

/** `2026-11-02` or a timestamp → `2 Nov 2026`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getDate()} ${monthName(date)} ${date.getFullYear()}`;
}

/** A timestamp → `2 Nov 2026, 14:05` in the browser's time zone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(value)}, ${hh}:${mm}`;
}

/** `MOBILE_MONEY` → `Mobile money`. */
export function humanize(code: string | null | undefined): string {
  if (!code) {
    return '—';
  }
  const text = code.replace(/[_.]+/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray';

const TONES: Record<string, Tone> = {
  ACTIVE: 'green',
  COMPLETED: 'green',
  RECEIVED: 'green',
  IN_STOCK: 'green',
  DELIVERED: 'green',
  PAID: 'green',
  SUCCEEDED: 'green',
  ORDERED: 'blue',
  IN_TRANSIT: 'blue',
  OTC: 'gray',
  PARTIALLY_RECEIVED: 'amber',
  PARTIALLY_RETURNED: 'amber',
  LOW_STOCK: 'amber',
  PENDING: 'amber',
  ISSUED: 'green',
  PRESCRIPTION: 'purple',
  CONTROLLED: 'red',
  RETURNED: 'gray',
  SUSPENDED: 'red',
  CLOSED: 'gray',
  ERASED: 'gray',
  CANCELLED: 'red',
  OUT_OF_STOCK: 'red',
  EXPIRED: 'red',
  FAILED: 'red',
  INACTIVE: 'gray',
};

export function toneOf(status: string | null | undefined): Tone {
  return (status && TONES[status]) || 'gray';
}

/** Today's date as `YYYY-MM-DD` in the browser's time zone, shifted by `days`. */
export function isoDay(days = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * One CSV cell, quoted. Text a spreadsheet would run as a formula (starting with `=`, `+`, `-`,
 * `@`, tab or carriage return) gets a leading `'` (OWASP "CSV Injection"); numbers stay numbers,
 * so a negative amount is untouched.
 */
export function csvCell(value: string | number | null): string {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** Downloads rows as a CSV file. */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null)[][],
): void {
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Where Intl (CLDR) shows fewer decimals than ISO 4217 gives the currency: CLDR drops the minor
 * unit nobody uses in cash (IQD, SOS, RSD), while ISO 4217, and so the API (the JDK's table), keeps
 * it. Money is rounded to the ISO figure.
 */
const ISO_MINOR_UNITS: Readonly<Record<string, number>> = {
  AFN: 2,
  ALL: 2,
  IQD: 3,
  IRR: 2,
  KPW: 2,
  LAK: 2,
  LBP: 2,
  MGA: 2,
  MMK: 2,
  RSD: 2,
  SLL: 2,
  SOS: 2,
  SYP: 2,
  YER: 2,
};

/**
 * A currency's ISO 4217 minor units, as the API takes them: 2 for TZS, KES and USD, 0 for UGX, RWF
 * and JPY, 3 for KWD (2 when unknown).
 */
export function minorUnits(currency: string | null | undefined): number {
  const code = (currency ?? '').trim().toUpperCase();
  if (code in ISO_MINOR_UNITS) {
    return ISO_MINOR_UNITS[code];
  }
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code || 'USD',
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * An amount as a whole number of minor units (`digits` decimals: cents for 2), rounded half-up: a
 * tie goes away from zero (10.075 → 1008, -0.005 → -1), as the API rounds every amount
 * (`RoundingMode.HALF_UP`). The product is cleaned to six places first: 10.075 × 100 is
 * 1007.4999999999999 in floating point, which a plain Math.round would take down to 1007.
 */
export function toMinor(amount: number, digits: number): number {
  const scaled = Number(((Number(amount) || 0) * 10 ** digits).toFixed(6));
  return Math.sign(scaled) * Math.round(Math.abs(scaled)) || 0;
}

/** A whole number of minor units back as an amount with exactly that many decimals. */
export function fromMinor(minor: number, digits: number): number {
  return Number((minor / 10 ** digits).toFixed(digits));
}

/** `amount` rounded half-up (a tie away from zero) to `digits` decimals. */
export function roundHalfUp(amount: number, digits: number): number {
  return fromMinor(toMinor(amount, digits), digits);
}

/**
 * An amount in `currency`, rounded half-up to its ISO 4217 minor units, as the API rounds money
 * (`Amounts.money`): TZS 1,500.005 → 1,500.01, UGX 1,500.5 → 1,501.
 */
export function roundMoney(amount: number, currency: string | null | undefined): number {
  return roundHalfUp(amount, minorUnits(currency));
}

/**
 * `amount` × `rate` in `currency`, rounded half-up to that currency's minor units, as the API
 * converts (`Conversion.convert`): USD 10 at 2,650 is TZS 26,500.00, USD 0.005 at 1 is USD 0.01.
 */
export function convertMoney(amount: number, rate: number, currency: string): number {
  return roundMoney((Number(amount) || 0) * (Number(rate) || 0), currency);
}

/** An amount with two decimals and no currency, for the moment before the currency is known. */
function formatNumberFixed(amount: number, locale: string): string {
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
