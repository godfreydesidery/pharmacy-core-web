import { PaymentMethod, SalePayment, SellableProduct } from '../../core/api/models';

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

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Gross per line, the sale-wide discount on each line, then tax on what remains (tax exclusive). */
export function cartTotals(lines: readonly CartLine[], discountPercent: number): CartTotals {
  const rate = Math.min(Math.max(discountPercent || 0, 0), 100);
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  let items = 0;
  for (const line of lines) {
    const gross = round2(line.product.sellingPrice * line.quantity);
    const lineDiscount = round2((gross * rate) / 100);
    const lineTax = round2(((gross - lineDiscount) * (line.product.taxRatePercent || 0)) / 100);
    subtotal += gross;
    discount += lineDiscount;
    tax += lineTax;
    items += line.quantity;
  }
  subtotal = round2(subtotal);
  discount = round2(discount);
  tax = round2(tax);
  return { items, subtotal, discount, tax, total: round2(subtotal - discount + tax) };
}

/** Adds one unit of a product, never beyond what is on hand. */
export function addToCart(lines: readonly CartLine[], product: SellableProduct): CartLine[] {
  const existing = lines.find((line) => line.product.productUid === product.productUid);
  if (!existing) {
    return product.quantityOnHand > 0 ? [...lines, { product, quantity: 1 }] : [...lines];
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

/** Sets a line's quantity, clamped to what is on hand; zero or less removes it. */
export function setQuantity(
  lines: readonly CartLine[],
  productUid: string,
  quantity: number,
): CartLine[] {
  return lines
    .map((line) =>
      line.product.productUid === productUid
        ? { ...line, quantity: Math.min(Math.floor(quantity), line.product.quantityOnHand) }
        : line,
    )
    .filter((line) => line.quantity > 0);
}

/**
 * A payment's value in the base currency: its amount at the rate locked when it was taken (a
 * payment in the base currency has no rate). The API's figure, rounded half-even, is authoritative.
 */
export function baseValue(payment: SalePayment): number {
  return round2((Number(payment.amount) || 0) * (payment.exchangeRate ?? 1));
}

/** What the payments cover in the base currency, whatever currencies they are in. */
export function paidTotal(payments: readonly SalePayment[]): number {
  return round2(payments.reduce((sum, p) => sum + baseValue(p), 0));
}

/**
 * Change is given only from cash (in any currency), always in base cash, and never more than the
 * cash handed over.
 */
export function changeDue(payments: readonly SalePayment[], total: number): number {
  const paid = paidTotal(payments);
  const cash = paidTotal(payments.filter((p) => p.method === 'CASH'));
  return round2(Math.max(0, Math.min(paid - total, cash)));
}

export function needsPrescription(lines: readonly CartLine[]): boolean {
  return lines.some((line) => line.product.schedule !== 'OTC');
}

export function needsCustomer(methods: readonly PaymentMethod[]): boolean {
  return methods.some(
    (method) => method === 'CREDIT' || method === 'INSURANCE' || method === 'ACCOUNT_CREDIT',
  );
}
