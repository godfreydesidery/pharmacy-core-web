import { SellableProduct, TillMethod } from '../../core/api/models';
import {
  addToCart,
  available,
  cartTotals,
  changeDue,
  coveringAmount,
  exactTender,
  fromMinor,
  needsCustomer,
  needsPrescription,
  paidTotal,
  setQuantity,
  splitPayment,
  toMinor,
} from './cart';

function till(code: string, kind: TillMethod['kind']): TillMethod {
  return {
    code,
    name: code,
    label: code,
    kind,
    adapter: 'MANUAL',
    requiresReference: false,
    push: false,
    accountReference: null,
    enabled: true,
  };
}

function product(overrides: Partial<SellableProduct> = {}): SellableProduct {
  return {
    productUid: 'p1',
    name: 'Paracetamol 500mg',
    genericName: 'Paracetamol',
    sku: 'PCM500',
    gtin: null,
    dosageForm: 'TABLET',
    strength: '500 mg',
    categoryUid: null,
    categoryName: null,
    schedule: 'OTC',
    sellingPrice: 1500,
    taxRatePercent: 0,
    quantityOnHand: 10,
    productType: 'MEDICINE',
    trackingMode: 'BATCH_EXPIRY',
    unitOfMeasure: 'STRIP',
    requiresSerialAtSale: false,
    ...overrides,
  };
}

describe('cart', () => {
  it('totals gross, discount and tax per line', () => {
    const lines = [
      { product: product({ sellingPrice: 1000, taxRatePercent: 18 }), quantity: 2 },
      { product: product({ productUid: 'p2', sellingPrice: 333.33 }), quantity: 3 },
    ];
    const totals = cartTotals(lines, 10);
    expect(totals.items).toBe(5);
    expect(totals.subtotal).toBe(2999.99);
    expect(totals.discount).toBe(300); // 200 + 100.00
    expect(totals.tax).toBe(324); // (2000 - 200) × 18%
    expect(totals.total).toBe(3023.99);
  });

  it('clamps the discount to 0–100%', () => {
    const lines = [{ product: product({ sellingPrice: 100 }), quantity: 1 }];
    expect(cartTotals(lines, 150).total).toBe(0);
    expect(cartTotals(lines, -5).total).toBe(100);
  });

  it('adds a product once, then increments, never beyond what is on hand', () => {
    const p = product({ quantityOnHand: 2 });
    let lines = addToCart([], p);
    lines = addToCart(lines, p);
    lines = addToCart(lines, p);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it('does not add an out-of-stock product', () => {
    expect(addToCart([], product({ quantityOnHand: 0 }))).toEqual([]);
  });

  it('removes a line when its quantity drops to zero', () => {
    const lines = addToCart([], product());
    expect(setQuantity(lines, 'p1', 0)).toEqual([]);
  });

  it('gives change from cash only', () => {
    expect(changeDue([{ method: 'CASH', amount: 5000, reference: null }], 4200)).toBe(800);
    expect(changeDue([{ method: 'CARD', amount: 5000, reference: null }], 4200)).toBe(0);
    expect(
      changeDue(
        [
          { method: 'MOBILE_MONEY', amount: 4000, reference: 'MP1' },
          { method: 'CASH', amount: 1000, reference: null },
        ],
        4200,
      ),
    ).toBe(800);
    expect(
      paidTotal([
        { method: 'CASH', amount: 0.1, reference: null },
        { method: 'CASH', amount: 0.2, reference: null },
      ]),
    ).toBe(0.3);
  });

  it('knows when a prescription or a customer is needed', () => {
    expect(
      needsPrescription([{ product: product({ schedule: 'PRESCRIPTION' }), quantity: 1 }]),
    ).toBe(true);
    expect(needsPrescription([{ product: product(), quantity: 1 }])).toBe(false);
    expect(needsCustomer(['CASH', 'CREDIT'])).toBe(true);
    expect(needsCustomer(['CASH', 'CARD'])).toBe(false);
  });

  it('sells loose units and units from linked packs, never more', () => {
    const strip = product({ quantityOnHand: 0, openableUnits: 50 });
    expect(available(strip)).toBe(50);
    const lines = addToCart([], strip);
    expect(lines).toEqual([{ product: strip, quantity: 1 }]);
    expect(setQuantity(lines, 'p1', 80)[0].quantity).toBe(50);
    expect(addToCart([], product({ quantityOnHand: 0 }))).toEqual([]);
    expect(available(product({ quantityOnHand: 3, openableUnits: 10 }))).toBe(13);
  });

  it('opens a split row on a real method of the pharmacy, kind and channel together', () => {
    const methods = [
      till('CASH', 'CASH'),
      till('MPESA', 'MOBILE_MONEY'),
      till('CRDB', 'BANK_TRANSFER'),
    ];
    expect(splitPayment(methods, 3000)).toEqual({
      method: 'MOBILE_MONEY',
      channel: 'MPESA',
      amount: 3000,
      reference: null,
    });
    expect(splitPayment([till('CASH', 'CASH')], 10)).toEqual({
      method: 'CASH',
      channel: 'CASH',
      amount: 10,
      reference: null,
    });
    expect(splitPayment(null, 5)).toEqual({ method: 'MOBILE_MONEY', amount: 5, reference: null });
  });
});

describe('prices that include VAT', () => {
  const lotion = {
    productUid: 'l',
    name: 'Body Lotion',
    sellingPrice: 3540,
    taxRatePercent: 18,
    quantityOnHand: 10,
  } as SellableProduct;

  it('charges the shelf price and shows the VAT inside it', () => {
    const totals = cartTotals([{ product: lotion, quantity: 1 }], 0, undefined, true);
    expect(totals.total).toBe(3540);
    expect(totals.tax).toBe(540);
  });

  it('takes the VAT out of what is left after a discount, to the cent', () => {
    const shelf = { ...lotion, sellingPrice: 3200 } as SellableProduct;
    const totals = cartTotals([{ product: shelf, quantity: 2 }], 10, undefined, true);
    expect(totals.total).toBe(5760);
    expect(totals.tax).toBe(878.64);
  });

  it('adds the VAT on top when prices exclude it, as before', () => {
    expect(cartTotals([{ product: lotion, quantity: 1 }], 0).total).toBe(4177.2);
  });
});

describe('Exact, in whole minor units', () => {
  const cash = (amount: number) => ({ method: 'CASH' as const, amount, reference: null });

  it('turns amounts into cents without float error', () => {
    expect(toMinor(10.075, 2)).toBe(1008); // 1007.4999999999999 in floating point
    expect(toMinor(3.34 * 3, 2)).toBe(1002); // 10.020000000000001
    expect(toMinor(10.075, 3)).toBe(10075);
    expect(toMinor(0.1 + 0.2, 2)).toBe(30);
    expect(fromMinor(1002, 2)).toBe(10.02);
  });

  it('is the total itself, never a cent more', () => {
    expect(exactTender(3.34 * 3, [cash(0)], 2)).toBe(10.02);
    expect(exactTender(1.15 * 3, [cash(0)], 2)).toBe(3.45); // 3.4499999999999997
    // The old way: Math.ceil on the float, a cent too much for 1.10, 2.20, 0.07 and 131 more.
    expect(Math.ceil(1.1 * 100) / 100).toBe(1.11);
    expect(exactTender(1.1, [cash(0)], 2)).toBe(1.1);
    expect(exactTender(0.07, [cash(0)], 2)).toBe(0.07);
    expect(exactTender(10.075, [cash(0)], 2)).toBe(10.08);
    expect(exactTender(10.075, [cash(0)], 3, 3)).toBe(10.075);
    expect(exactTender(1300, [cash(0)], 2)).toBe(1300);
  });

  it('works out every total with cents from 0.01 to 99.99 exactly', () => {
    for (let cents = 1; cents < 10_000; cents++) {
      const total = cents / 100;
      expect(exactTender(total, [cash(0)], 2)).toBe(total);
    }
  });

  it('takes the other payments off before the first', () => {
    const payments = [cash(0), { method: 'CARD' as const, amount: 3.34, reference: null }];
    expect(exactTender(10.02, payments, 2)).toBe(6.68);
    expect(exactTender(3, payments, 2)).toBe(0); // already covered: nothing, not a negative
  });

  it('a foreign first payment covers what is due at its rate, rounding up to its cent', () => {
    const usd = {
      method: 'CASH' as const,
      amount: 0,
      reference: null,
      currency: 'USD',
      exchangeRate: 2650,
    };
    const amount = exactTender(10_000, [usd], 2);
    expect(amount).toBe(3.78); // 3.77 USD is 9,990.50 TZS: short
    expect(toMinor(amount * 2650, 2)).toBeGreaterThanOrEqual(1_000_000);
    expect(toMinor(3.77 * 2650, 2)).toBeLessThan(1_000_000);
  });

  it('a switch of currency keeps the base value covered with the fewest units', () => {
    expect(coveringAmount(5300, 2650, 2)).toBe(2);
    expect(coveringAmount(5300.01, 2650, 2)).toBe(2.01);
    expect(coveringAmount(1000, 0.7, 0)).toBe(1429); // 1428 × 0.7 is 999.60: short
    expect(coveringAmount(10.02, null, 2)).toBe(10.02);
  });
});
