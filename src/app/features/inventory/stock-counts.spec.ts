import { CountLine, StockCount, sheetOrder } from './stock-counts.page';

function line(productName: string, batchNumber: string, expiryDate: string | null): CountLine {
  return {
    uid: `${productName}-${batchNumber}`,
    productUid: productName,
    productName,
    batchNumber,
    expiryDate,
    expected: 1,
    counted: null,
    variance: null,
    varianceValue: null,
  };
}

describe('stock-take sheet', () => {
  it('keeps rows by product, then expiry, then batch, whatever the API order', () => {
    const count = {
      items: [
        line('Paracetamol', 'B2', '2027-01-01'),
        line('Amoxicillin', 'A1', null),
        line('Paracetamol', 'B1', '2026-12-01'),
        line('Amoxicillin', 'A0', '2026-06-01'),
      ],
    } as StockCount;
    expect(sheetOrder(count).items.map((l) => l.batchNumber)).toEqual(['A0', 'A1', 'B1', 'B2']);
  });
});
