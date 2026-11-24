import { CheckoutRequest } from '../../core/api/models';
import {
  PARKED_LIMIT,
  PARKED_TTL_MS,
  ParkedSale,
  clearParkedOf,
  expired,
  normalize,
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

const NOW = Date.parse('2026-12-01T12:00:00Z');

function sale(id: string, overrides: Partial<ParkedSale> = {}): ParkedSale {
  return {
    id,
    parkedAt: '2026-12-01T10:42:00Z',
    lines: [{ productUid: 'p1', sku: 'P00001', quantity: 2 }],
    customerUid: null,
    discountPercent: 0,
    total: 1300,
    idempotencyKey: `key-${id}`,
    ...overrides,
  };
}

const request: CheckoutRequest = {
  idempotencyKey: 'key-u',
  customerUid: null,
  discountPercent: 0,
  lines: [{ productUid: 'p1', quantity: 2 }],
  payments: [{ method: 'CASH', amount: 1300, reference: null }],
  prescription: null,
};

describe('parked sales', () => {
  it('keeps each cashier’s sales apart per pharmacy and branch', () => {
    expect(parkedKey('t1', 'b1', 'u1')).not.toEqual(parkedKey('t1', 'b2', 'u1'));
    expect(parkedKey('t1', 'b1', 'u1')).not.toEqual(parkedKey('t1', 'b1', 'u2'));
    expect(parkedKey('t1', 'b1', 'u1')).not.toEqual(parkedKey('t2', 'b1', 'u1'));
  });

  it('puts the newest first and keeps no more than the limit', () => {
    let list: ParkedSale[] = [];
    for (let i = 0; i < PARKED_LIMIT + 3; i++) list = park(list, sale(`s${i}`));
    expect(list.length).toBe(PARKED_LIMIT);
    expect(list[0].id).toBe(`s${PARKED_LIMIT + 2}`);
  });

  it('never lets the limit push out an unconfirmed checkout', () => {
    let list: ParkedSale[] = [sale('unsure', { pending: request })];
    for (let i = 0; i < PARKED_LIMIT + 3; i++) list = park(list, sale(`s${i}`));
    expect(list.length).toBe(PARKED_LIMIT);
    expect(list.some((p) => p.id === 'unsure')).toBe(true);
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

  it('survives a reload through storage with its key, and empties the key when none are left', () => {
    const storage = memoryStorage();
    writeParked(storage, 'k', [sale('a'), sale('u', { pending: request, pendingAt: 'x' })]);
    const back = readParked(storage, 'k', NOW);
    expect(back.map((p) => p.id)).toEqual(['a', 'u']);
    expect(back[0].idempotencyKey).toBe('key-a');
    expect(back[1].pending).toEqual(request);
    expect(back[1].idempotencyKey).toBe('key-u');
    writeParked(storage, 'k', []);
    expect(storage.getItem('k')).toBeNull();
  });

  it('reads nothing from missing, broken or foreign storage', () => {
    expect(readParked(null, 'k')).toEqual([]);
    const storage = memoryStorage();
    storage.setItem('k', '{not json');
    expect(readParked(storage, 'k', NOW)).toEqual([]);
    storage.setItem('k', JSON.stringify([{ id: 'x', lines: [] }, sale('ok'), 42, null]));
    expect(readParked(storage, 'k', NOW).map((p) => p.id)).toEqual(['ok']);
  });
});

describe('parked sales expire', () => {
  it('after 12 hours', () => {
    expect(PARKED_TTL_MS).toBe(12 * 3_600_000);
    const at = '2026-12-01T00:00:00Z';
    expect(expired({ parkedAt: at }, Date.parse(at) + PARKED_TTL_MS)).toBe(false);
    expect(expired({ parkedAt: at }, Date.parse(at) + PARKED_TTL_MS + 1)).toBe(true);
    expect(expired({ parkedAt: 'garbage' }, NOW)).toBe(true);
  });

  it('and are dropped when read', () => {
    const storage = memoryStorage();
    writeParked(storage, 'k', [
      sale('fresh', { parkedAt: '2026-12-01T11:00:00Z' }),
      sale('old', { parkedAt: '2026-11-30T23:59:00Z' }),
    ]);
    expect(readParked(storage, 'k', NOW).map((p) => p.id)).toEqual(['fresh']);
  });
});

describe('what a parked sale stores', () => {
  it('holds uids, codes and quantities, not names, phones or insurance numbers', () => {
    const stored = JSON.stringify(sale('a', { customerUid: 'c1' }));
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual(
      [
        'customerUid',
        'discountPercent',
        'id',
        'idempotencyKey',
        'lines',
        'parkedAt',
        'total',
      ].sort(),
    );
    expect(Object.keys(JSON.parse(stored).lines[0]).sort()).toEqual([
      'productUid',
      'quantity',
      'sku',
    ]);
  });

  it('reduces an entry written by an older version to uids, dropping its personal data', () => {
    const old = {
      id: 'old',
      parkedAt: '2026-12-01T10:00:00Z',
      lines: [
        {
          product: {
            productUid: 'p1',
            sku: 'P00001',
            name: 'Morphine 10mg',
            genericName: 'Morphine',
          },
          quantity: 3,
        },
      ],
      customer: {
        uid: 'c1',
        name: 'Asha Juma',
        phone: '+255712000000',
        insuranceNumber: 'NHIF-123',
      },
      discountPercent: 5,
      total: 4500,
    };
    const entry = normalize(old)!;
    expect(entry.lines).toEqual([{ productUid: 'p1', sku: 'P00001', quantity: 3 }]);
    expect(entry.customerUid).toBe('c1');
    expect(entry.idempotencyKey).toMatch(/[0-9a-f-]{36}/);
    const text = JSON.stringify(entry);
    for (const personal of ['Morphine', 'Asha', '+255', 'NHIF']) {
      expect(text).not.toContain(personal);
    }
  });
});

describe('sign-out', () => {
  it('clears the user’s parked sales in every pharmacy and branch, keeping unconfirmed checkouts', () => {
    const storage = memoryStorage();
    const mine1 = parkedKey('t1', 'b1', 'u1');
    const mine2 = parkedKey('t2', 'b9', 'u1');
    const theirs = parkedKey('t1', 'b1', 'u2');
    const now = Date.now();
    const at = new Date(now - 60_000).toISOString();
    writeParked(storage, mine1, [sale('a', { parkedAt: at })]);
    writeParked(storage, mine2, [
      sale('b', { parkedAt: at }),
      sale('u', { parkedAt: at, pending: request }),
    ]);
    writeParked(storage, theirs, [sale('c', { parkedAt: at })]);
    storage.setItem('pharmacy.session', 'kept');

    clearParkedOf(storage, 'u1', now);

    expect(storage.getItem(mine1)).toBeNull();
    expect(readParked(storage, mine2, now).map((p) => p.id)).toEqual(['u']);
    expect(readParked(storage, theirs, now).map((p) => p.id)).toEqual(['c']);
    expect(storage.getItem('pharmacy.session')).toBe('kept');
  });
});
