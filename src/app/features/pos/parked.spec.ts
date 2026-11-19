import { SellableProduct } from '../../core/api/models';
import {
  PARKED_LIMIT,
  ParkedSale,
  park,
  parkedKey,
  readParked,
  unpark,
  writeParked,
} from './parked';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const product = {
  productUid: 'p1',
  name: 'Paracetamol 500mg',
  sellingPrice: 650,
} as SellableProduct;

function sale(id: string): ParkedSale {
  return {
    id,
    parkedAt: '2026-12-01T10:42:00Z',
    lines: [{ product, quantity: 2 }],
    customer: null,
    discountPercent: 0,
    total: 1300,
  };
}

describe('parked sales', () => {
  it('keeps each cashier’s sales apart per pharmacy and branch', () => {
    expect(parkedKey('t1', 'b1', 'u1')).not.toEqual(parkedKey('t1', 'b2', 'u1'));
    expect(parkedKey('t1', 'b1', 'u1')).not.toEqual(parkedKey('t1', 'b1', 'u2'));
  });

  it('puts the newest first and keeps no more than the limit', () => {
    let list: ParkedSale[] = [];
    for (let i = 0; i < PARKED_LIMIT + 3; i++) list = park(list, sale(`s${i}`));
    expect(list.length).toBe(PARKED_LIMIT);
    expect(list[0].id).toBe(`s${PARKED_LIMIT + 2}`);
  });

  it('parking the same sale again replaces it rather than duplicating it', () => {
    const list = park(park([], sale('a')), { ...sale('a'), total: 999 });
    expect(list.length).toBe(1);
    expect(list[0].total).toBe(999);
  });

  it('takes a sale out to resume it, leaving the rest', () => {
    const { sale: picked, rest } = unpark([sale('a'), sale('b')], 'a');
    expect(picked?.id).toBe('a');
    expect(rest.map((p) => p.id)).toEqual(['b']);
    expect(unpark(rest, 'missing').sale).toBeNull();
  });

  it('survives a reload through storage, and empties the key when none are left', () => {
    const storage = memoryStorage();
    writeParked(storage, 'k', [sale('a')]);
    expect(readParked(storage, 'k').map((p) => p.id)).toEqual(['a']);
    writeParked(storage, 'k', []);
    expect(storage.getItem('k')).toBeNull();
  });

  it('reads nothing from missing, broken or foreign storage', () => {
    expect(readParked(null, 'k')).toEqual([]);
    const storage = memoryStorage();
    storage.setItem('k', '{not json');
    expect(readParked(storage, 'k')).toEqual([]);
    storage.setItem('k', JSON.stringify([{ id: 'x', lines: [] }, sale('ok')]));
    expect(readParked(storage, 'k').map((p) => p.id)).toEqual(['ok']);
  });
});
