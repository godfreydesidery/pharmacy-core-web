import { SellableProduct } from '../../core/api/models';
import {
  addToCart,
  cartTotals,
  changeDue,
  needsCustomer,
  needsPrescription,
  paidTotal,
  setQuantity,
} from './cart';

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
});
