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
      // Intl takes each currency's ISO 4217 minor units (TZS and USD 2, JPY 0, KWD 3) and rounds
      // half away from zero (half-up) for display; the API rounds conversions half-even.
      format = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
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
  PRESCRIPTION: 'purple',
  CONTROLLED: 'red',
  RETURNED: 'gray',
  SUSPENDED: 'red',
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

/** Downloads rows as a CSV file. */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null)[][],
): void {
  const escape = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** A currency's ISO 4217 minor units, from Intl (2 when unknown). */
export function minorUnits(currency: string | null | undefined): number {
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** `amount` × `rate` rounded half-even to `currency`'s minor units, as the API converts. */
export function convertHalfEven(amount: number, rate: number, currency: string): number {
  const digits = minorUnits(currency);
  const factor = 10 ** digits;
  const scaled = Number((amount * rate * factor).toFixed(6));
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let rounded: number;
  if (Math.abs(diff - 0.5) < 1e-9) {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(scaled);
  }
  return rounded / factor;
}

/** An amount with two decimals and no currency, for the moment before the currency is known. */
function formatNumberFixed(amount: number, locale: string): string {
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
