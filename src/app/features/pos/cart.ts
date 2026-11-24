import { PaymentMethod, SalePayment, SellableProduct, TillMethod } from '../../core/api/models';
import { fromMinor, roundHalfUp, toMinor } from '../../core/format/format';

export { fromMinor, toMinor };

/** Pure POS arithmetic. The API prices the sale itself; this previews the same rules. */

export interface CartLine {
  product: SellableProduct;
  quantity: number;
  /** The units sold of a serial-tracked product; their count is the quantity. */
  serials?: string[];
}

export interface CartTotals {
  items: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * Money in the base currency, rounded half-up to its minor units (`digits`: 2 for TZS, 0 for UGX),
 * as the API rounds every amount.
 */
export const money = (value: number, digits = 2): number => roundHalfUp(value, digits);

/** `percent` of `amount` as the API works it (Amounts.percentOf): to 6 places, then money. */
export function percentOf(amount: number, percent: number, digits = 2): number {
  return percent ? money(roundHalfUp((amount * percent) / 100, 6), digits) : 0;
}

/**
 * Gross per line, then the sale-wide discount on each line. Prices that exclude tax get tax added on
 * what remains; prices that include it keep what remains as the line's total, the tax inside it
 * being rate ÷ (100 + rate) of it. Each amount is rounded half-up to the base currency's minor
 * units (`baseDigits`). The API applies the same rules (SaleTotals).
 */
/** A line's unit price: the catalogue price unless pricing (lists, promotions) says otherwise. */
export type PriceOf = (line: CartLine) => number;

export function cartTotals(
  lines: readonly CartLine[],
  discountPercent: number,
  priceOf: PriceOf = (line) => line.product.sellingPrice,
  taxIncluded = false,
  baseDigits = 2,
): CartTotals {
  const rate = Math.min(Math.max(discountPercent || 0, 0), 100);
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  let items = 0;
  for (const line of lines) {
    const gross = money(priceOf(line) * line.quantity, baseDigits);
    const lineDiscount = percentOf(gross, rate, baseDigits);
    const taxRate = line.product.taxRatePercent || 0;
    const lineTax = taxIncluded
      ? taxRate
        ? money(roundHalfUp(((gross - lineDiscount) * taxRate) / (100 + taxRate), 6), baseDigits)
        : 0
      : percentOf(gross - lineDiscount, taxRate, baseDigits);
    subtotal += gross;
    discount += lineDiscount;
    tax += lineTax;
    items += line.quantity;
  }
  subtotal = money(subtotal, baseDigits);
  discount = money(discount, baseDigits);
  tax = money(tax, baseDigits);
  const total = taxIncluded ? subtotal - discount : subtotal - discount + tax;
  return { items, subtotal, discount, tax, total: money(total, baseDigits) };
}

/**
 * Units the till can sell: loose units on hand plus those it can get by opening linked packs (the
 * API opens a pack automatically when the loose units run out).
 */
export function available(product: SellableProduct): number {
  return Math.max(product.quantityOnHand, 0) + Math.max(product.openableUnits ?? 0, 0);
}

/** Adds one unit of a product, never beyond what is available. */
export function addToCart(lines: readonly CartLine[], product: SellableProduct): CartLine[] {
  const existing = lines.find((line) => line.product.productUid === product.productUid);
  if (!existing) {
    return available(product) > 0 ? [...lines, { product, quantity: 1 }] : [...lines];
  }
  return setQuantity(lines, product.productUid, existing.quantity + 1);
}

/**
 * Sets the units of a serial-tracked product on the sale: the quantity is their count, and no
 * units removes the line.
 */
export function withSerials(
  lines: readonly CartLine[],
  product: SellableProduct,
  serials: readonly string[],
): CartLine[] {
  const rest = lines.filter((line) => line.product.productUid !== product.productUid);
  if (!serials.length) {
    return rest;
  }
  const existing = lines.findIndex((line) => line.product.productUid === product.productUid);
  const line: CartLine = { product, quantity: serials.length, serials: [...serials] };
  if (existing < 0) {
    return [...rest, line];
  }
  const next = [...lines];
  next[existing] = line;
  return next;
}

/** Sets a line's quantity, clamped to what is available; zero or less removes it. */
export function setQuantity(
  lines: readonly CartLine[],
  productUid: string,
  quantity: number,
): CartLine[] {
  return lines
    .map((line) =>
      line.product.productUid === productUid
        ? { ...line, quantity: Math.min(Math.floor(quantity), available(line.product)) }
        : line,
    )
    .filter((line) => line.quantity > 0);
}

/**
 * A payment's value in the base currency: its amount at the rate locked when it was taken (a
 * payment in the base currency has no rate), rounded half-up to the base's minor units
 * (`baseDigits`) as the API converts a tender. The API's figure is authoritative.
 */
export function baseValue(payment: SalePayment, baseDigits = 2): number {
  return money((Number(payment.amount) || 0) * (payment.exchangeRate ?? 1), baseDigits);
}

/**
 * The smallest amount in a currency (with `digits` decimals, at `rate` base units each) whose base
 * value covers `due`, worked in whole minor units so no float error adds a cent. With no rate the
 * amount is in the base itself: `due`, rounded to the base's minor unit.
 */
export function coveringAmount(
  due: number,
  rate: number | null | undefined,
  digits: number,
  baseDigits = 2,
): number {
  const dueMinor = Math.max(toMinor(due, baseDigits), 0);
  if (!rate || rate === 1) {
    return fromMinor(toMinor(fromMinor(dueMinor, baseDigits), digits), digits);
  }
  const covers = (minor: number) =>
    toMinor(fromMinor(minor, digits) * rate, baseDigits) >= dueMinor;
  // A first guess from the division, cleaned of float noise, then moved to the exact edge.
  let minor = Math.ceil(Number(((dueMinor / 10 ** baseDigits / rate) * 10 ** digits).toFixed(6)));
  while (!covers(minor)) minor++;
  while (minor > 0 && covers(minor - 1)) minor--;
  return fromMinor(minor, digits);
}

/**
 * "Exact": what the first payment must be for the payments to cover the total. The other payments'
 * base values are taken off in whole minor units, then the rest is converted at the first
 * payment's rate (rounding up, so a foreign payment never falls a cent short).
 */
export function exactTender(
  total: number,
  payments: readonly SalePayment[],
  digits: number,
  baseDigits = 2,
): number {
  const others = payments
    .slice(1)
    .reduce((sum, p) => sum + toMinor(baseValue(p, baseDigits), baseDigits), 0);
  const dueMinor = Math.max(toMinor(total, baseDigits) - others, 0);
  return coveringAmount(
    fromMinor(dueMinor, baseDigits),
    payments[0]?.exchangeRate,
    digits,
    baseDigits,
  );
}

/** What the payments cover in the base currency, whatever currencies they are in. */
export function paidTotal(payments: readonly SalePayment[], baseDigits = 2): number {
  return money(
    payments.reduce((sum, p) => sum + baseValue(p, baseDigits), 0),
    baseDigits,
  );
}

/**
 * Change is given only from cash (in any currency), always in base cash, and never more than the
 * cash handed over.
 */
export function changeDue(payments: readonly SalePayment[], total: number, baseDigits = 2): number {
  const paid = paidTotal(payments, baseDigits);
  const cash = paidTotal(
    payments.filter((p) => p.method === 'CASH'),
    baseDigits,
  );
  return money(Math.max(0, Math.min(paid - total, cash)), baseDigits);
}

/**
 * A new split-payment row: the first method the pharmacy accepts that is not cash (else cash),
 * with its booking kind and its channel set together, so the select shows what will be recorded.
 * Without the pharmacy's list, plain mobile money.
 */
export function splitPayment(
  methods: readonly TillMethod[] | null | undefined,
  amount: number,
): SalePayment {
  const usable = (methods ?? []).filter((m) => m.enabled !== false);
  const pick = usable.find((m) => m.kind !== 'CASH') ?? usable.find((m) => m.kind === 'CASH');
  if (!pick) {
    return { method: 'MOBILE_MONEY', amount, reference: null };
  }
  return { method: pick.kind as PaymentMethod, channel: pick.code, amount, reference: null };
}

export function needsPrescription(lines: readonly CartLine[]): boolean {
  return lines.some((line) => line.product.schedule !== 'OTC');
}

export function needsCustomer(methods: readonly PaymentMethod[]): boolean {
  return methods.some(
    (method) => method === 'CREDIT' || method === 'INSURANCE' || method === 'ACCOUNT_CREDIT',
  );
}
