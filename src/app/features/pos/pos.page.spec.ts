import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Signal, WritableSignal } from '@angular/core';
import { Api, Query, RequestOptions } from '../../core/api/api.service';
import { ApiError } from '../../core/api/api-error';
import {
  CheckoutRequest,
  PaymentRequest,
  Sale,
  SellableProduct,
  Settings,
} from '../../core/api/models';
import { SettingsStore } from '../../core/format/settings.store';
import { LeaveGuard } from '../../core/session/leave-guard';
import { SessionStore } from '../../core/session/session.store';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import { CartLine } from './cart';
import { CHECKOUT_TIMEOUT_MS, TillPayment } from './checkout';
import { ParkedSale, parkedKey } from './parked';
import PosPage from './pos.page';

/** The page's members these tests drive (protected in the component). */
interface Page {
  lines: WritableSignal<CartLine[]>;
  payments: WritableSignal<TillPayment[]>;
  locked: Signal<boolean>;
  pending: Signal<CheckoutRequest | null>;
  problem: Signal<string | null>;
  receipt: Signal<Sale | null>;
  parked: Signal<ParkedSale[]>;
  parkedList: Signal<ParkedSale[]>;
  cartId: Signal<string>;
  discountPercent: Signal<number>;
  unpricedLines: Signal<CartLine[]>;
  idempotencyKey: string;
  add(product: SellableProduct, quantity?: number): void;
  setQty(line: CartLine, quantity: number): void;
  setDiscount(value: number): void;
  addPayment(): void;
  removePayment(index: number): void;
  setPhone(index: number, phone: string): void;
  sendToPhone(index: number): Promise<void>;
  parkSale(): void;
  newSale(): void;
  resume(id: string): Promise<void>;
  checkout(): Promise<void>;
  checkAgain(): Promise<void>;
  exact(): void;
  parkBeforeUnload(): void;
}

const KEY = parkedKey('t1', 'b1', 'u1');

function product(uid: string, sku: string, name: string, price = 1500): SellableProduct {
  return {
    productUid: uid,
    name,
    genericName: null,
    sku,
    gtin: null,
    dosageForm: null,
    strength: null,
    categoryUid: null,
    categoryName: null,
    schedule: 'OTC',
    sellingPrice: price,
    taxRatePercent: 0,
    quantityOnHand: 50,
    productType: 'MEDICINE',
    trackingMode: 'BATCH_EXPIRY',
    unitOfMeasure: 'STRIP',
    requiresSerialAtSale: false,
  };
}

const PARACETAMOL = product('p1', 'P00001', 'Paracetamol 500mg');
const AMOXICILLIN = product('p2', 'P00002', 'Amoxicillin 250mg', 3.34);

function saleOf(request: CheckoutRequest): Sale {
  return {
    uid: 'sale-1',
    number: 'INV-HQ-000123',
    branchUid: 'b1',
    branchName: 'Main',
    customerUid: null,
    customerName: null,
    status: 'COMPLETED',
    discountPercent: 0,
    subtotal: 1500,
    discountTotal: 0,
    taxTotal: 0,
    total: 1500,
    paidTotal: 1500,
    changeDue: 0,
    lines: [],
    payments: request.payments,
    prescription: null,
    cashierName: 'Amina',
    createdAt: '2026-11-23T10:00:00Z',
  } as Sale;
}

type Handler = (body: unknown, options?: RequestOptions) => Promise<unknown>;

/** A stand-in for the API: answers by path, and records what was sent. */
class FakeApi {
  readonly sent: { method: string; path: string; body: unknown; options?: RequestOptions }[] = [];
  readonly gets = new Map<string, Handler>();
  readonly posts = new Map<string, Handler>();
  unpriced = new Set<string>();

  constructor() {
    this.gets.set('/pos/products', (query) => {
      const uids = String((query as Query)['uids'] ?? '');
      if (uids) {
        const wanted = uids.split(',');
        return Promise.resolve({
          items: [PARACETAMOL, AMOXICILLIN].filter((p) => wanted.includes(p.productUid)),
          nextCursor: null,
        });
      }
      const q = String((query as Query)['q'] ?? '');
      return Promise.resolve({
        items: [PARACETAMOL, AMOXICILLIN].filter((p) => p.sku === q || p.name.includes(q)),
        nextCursor: null,
      });
    });
    this.posts.set('/pos/prices', (body) => {
      const lines = (body as { lines: { productUid: string; quantity: number }[] }).lines;
      return Promise.resolve(
        lines.map((l) => {
          const p = [PARACETAMOL, AMOXICILLIN].find((x) => x.productUid === l.productUid)!;
          return {
            productUid: l.productUid,
            quantity: l.quantity,
            unitPrice: p.sellingPrice,
            retailPrice: p.sellingPrice,
            source: 'RETAIL',
            label: null,
            belowCost: false,
            unpriced: this.unpriced.has(l.productUid),
          };
        }),
      );
    });
  }

  salesPosts(): { body: CheckoutRequest; options?: RequestOptions }[] {
    return this.sent
      .filter((s) => s.method === 'POST' && s.path === '/sales')
      .map((s) => ({ body: s.body as CheckoutRequest, options: s.options }));
  }

  count(method: string, path: string): number {
    return this.sent.filter((s) => s.method === method && s.path === path).length;
  }

  get<T>(path: string, query?: Query, options?: RequestOptions): Promise<T> {
    this.sent.push({ method: 'GET', path, body: query, options });
    const handler = this.gets.get(path) ?? this.prefixed(this.gets, path);
    return (handler ? handler(query ?? {}, options) : Promise.reject(notFound())) as Promise<T>;
  }

  post<T>(path: string, body: unknown = {}, options?: RequestOptions): Promise<T> {
    // What HttpClient would put on the wire: the body as JSON, read back.
    this.sent.push({ method: 'POST', path, body: JSON.parse(JSON.stringify(body)), options });
    const handler = this.posts.get(path);
    return (handler ? handler(body, options) : Promise.reject(notFound())) as Promise<T>;
  }

  put<T>(): Promise<T> {
    return Promise.reject(notFound());
  }

  delete<T>(): Promise<T> {
    return Promise.reject(notFound());
  }

  private prefixed(map: Map<string, Handler>, path: string): Handler | undefined {
    for (const [prefix, handler] of map) {
      if (prefix.endsWith('/') && path.startsWith(prefix)) return handler;
    }
    return undefined;
  }
}

function notFound(): ApiError {
  return new ApiError(404, 'not_found', 'Not found');
}

describe('POS page', () => {
  let api: FakeApi;
  let fixture: ComponentFixture<PosPage>;
  let page: Page;
  let toasts: ToastService;

  async function settle(): Promise<void> {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
  }

  async function open(): Promise<void> {
    fixture = TestBed.createComponent(PosPage);
    page = fixture.componentInstance as unknown as Page;
    fixture.detectChanges();
    await settle();
  }

  /** Destroys the page and opens a new one, as a reload does (storage stays). */
  async function reload(): Promise<void> {
    page.parkBeforeUnload();
    fixture.destroy();
    await open();
  }

  function element(selector: string): HTMLElement | null {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  function stored(): ParkedSale[] {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as ParkedSale[];
  }

  /** A cart of two Paracetamol, priced, paid in cash. */
  async function cart(): Promise<void> {
    page.add(PARACETAMOL, 2);
    await settle();
    page.payments.set([{ method: 'CASH', amount: 3000, reference: null }]);
  }

  beforeEach(async () => {
    localStorage.clear();
    api = new FakeApi();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    const session = TestBed.inject(SessionStore);
    session.signIn({
      token: 'pcs_abc',
      expiresAt: '2099-01-01T00:00:00Z',
      user: { uid: 'u1', name: 'Amina', email: 'a@x.tz', rootAdmin: true },
      memberships: [],
    });
    const branch = { uid: 'b1', code: 'HQ', name: 'Main' };
    session.enterAsRoot(
      { uid: 't1', code: 'AFYA', name: 'Afya', status: 'ACTIVE' } as never,
      [branch] as never,
      branch as never,
    );
    TestBed.inject(SettingsStore).set({
      currency: 'TZS',
      acceptedCurrencies: ['TZS'],
      pricesIncludeTax: true,
      maxDiscountPercent: 10,
    } as Settings);
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    toasts = TestBed.inject(ToastService);
    vi.spyOn(toasts, 'error');
    await open();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  describe('an uncertain checkout (WEB-2)', () => {
    beforeEach(async () => {
      await cart();
      api.posts.set('/sales', () =>
        Promise.reject(new ApiError(0, 'network_error', 'The server could not be reached.')),
      );
      await page.checkout();
      await settle();
    });

    it('locks the cart: no edits, no parking, no new sale', async () => {
      expect(page.locked()).toBe(true);
      const before = JSON.stringify(page.lines());
      page.add(AMOXICILLIN);
      page.setQty(page.lines()[0], 9);
      page.setDiscount(5);
      page.addPayment();
      page.parkSale();
      page.newSale();
      await settle();
      expect(JSON.stringify(page.lines())).toBe(before);
      expect(page.discountPercent()).toBe(0);
      expect(page.payments().length).toBe(1);
      expect(page.parkedList()).toEqual([]);
      expect(element('.complete')).toBeNull();
      const panel = element('[data-testid="pos-uncertain"]');
      expect(panel?.getAttribute('role')).toBe('alert');
      expect(panel?.textContent).toContain('We could not confirm this sale');
      expect(element('.cart-card')?.hasAttribute('inert')).toBe(true);
    });

    it('the shell may not take the cashier away (branch switch, menu, sign-out)', async () => {
      expect(await TestBed.inject(LeaveGuard).canLeave()).toBe(false);
      expect(page.locked()).toBe(true);
    });

    it('stores the cart with its key and the exact request, but no names', () => {
      const [entry] = stored();
      const [first] = api.salesPosts();
      expect(entry.id).toBe(page.cartId());
      expect(entry.idempotencyKey).toBe(first.body.idempotencyKey);
      expect(entry.pending).toEqual(first.body);
      expect(JSON.stringify(entry)).not.toContain('Paracetamol');
    });

    it('Check again sends the same key and body; the sale it returns completes', async () => {
      api.posts.set('/sales', (body) => Promise.resolve(saleOf(body as CheckoutRequest)));
      await page.checkAgain();
      await settle();
      const [first, second] = api.salesPosts();
      expect(JSON.stringify(second.body)).toBe(JSON.stringify(first.body));
      expect(second.options?.headers?.['Idempotency-Key']).toBe(first.body.idempotencyKey);
      expect(first.options?.headers?.['Idempotency-Key']).toBe(first.body.idempotencyKey);
      expect(page.receipt()?.number).toBe('INV-HQ-000123');
      expect(page.locked()).toBe(false);
      expect(page.lines()).toEqual([]);
      expect(stored()).toEqual([]);
      expect(page.idempotencyKey).not.toBe(first.body.idempotencyKey); // a new sale, a new key
    });

    it('survives a reload: still locked, and Check again resends the very same request', async () => {
      const [first] = api.salesPosts();
      await reload();
      expect(page.locked()).toBe(true);
      expect(page.lines().map((l) => [l.product.name, l.quantity])).toEqual([
        ['Paracetamol 500mg', 2],
      ]);
      expect(page.parkedList()).toEqual([]); // on screen, not listed twice
      api.posts.set('/sales', (body) => Promise.resolve(saleOf(body as CheckoutRequest)));
      await page.checkAgain();
      await settle();
      const resent = api.salesPosts().at(-1)!;
      expect(JSON.stringify(resent.body)).toBe(JSON.stringify(first.body));
      expect(resent.options?.headers?.['Idempotency-Key']).toBe(first.body.idempotencyKey);
      expect(page.receipt()).not.toBeNull();
      expect(stored()).toEqual([]);
    });

    it('a clear refusal on Check again unlocks the cart and says why, in the Payment card', async () => {
      api.posts.set('/sales', () =>
        Promise.reject(new ApiError(400, 'insufficient_stock', 'Only 1 Paracetamol 500mg left.')),
      );
      const key = page.idempotencyKey;
      await page.checkAgain();
      await settle();
      expect(page.locked()).toBe(false);
      expect(stored()).toEqual([]);
      expect(page.idempotencyKey).toBe(key); // nothing was recorded under it
      const alert = element('[data-testid="pos-problem"]');
      expect(alert?.getAttribute('role')).toBe('alert');
      expect(alert?.textContent).toContain('Only 1 Paracetamol 500mg left.');
      expect(toasts.error).not.toHaveBeenCalled();
    });
  });

  it('a 409 that recorded nothing (busy_try_again) does not lock the cart', async () => {
    await cart();
    api.posts.set('/sales', () =>
      Promise.reject(new ApiError(409, 'busy_try_again', 'Another till was using the same stock.')),
    );
    await page.checkout();
    await settle();
    expect(page.locked()).toBe(false);
    expect(page.problem()).toContain('Another till');
  });

  it('a server error locks the cart too', async () => {
    await cart();
    api.posts.set('/sales', () => Promise.reject(new ApiError(502, 'error', 'Bad Gateway')));
    await page.checkout();
    await settle();
    expect(page.locked()).toBe(true);
  });

  it('a sale parked and resumed keeps its key, through a reload as well', async () => {
    await cart();
    const key = page.idempotencyKey;
    const id = page.cartId();
    page.parkSale();
    await settle();
    expect(page.lines()).toEqual([]);
    expect(page.idempotencyKey).not.toBe(key);
    expect(stored()[0].idempotencyKey).toBe(key);
    await reload();
    await page.resume(id);
    await settle();
    expect(page.idempotencyKey).toBe(key);
    expect(page.cartId()).toBe(id);
    expect(page.lines().map((l) => [l.product.name, l.quantity])).toEqual([
      ['Paracetamol 500mg', 2],
    ]);
    api.posts.set('/sales', (body) => Promise.resolve(saleOf(body as CheckoutRequest)));
    await page.checkout();
    expect(api.salesPosts()[0].body.idempotencyKey).toBe(key);
  });

  it('resuming without a connection keeps the parked sale for another try', async () => {
    await cart();
    const id = page.cartId();
    page.parkSale();
    api.gets.set('/pos/products', () =>
      Promise.reject(new ApiError(0, 'network_error', 'The server could not be reached.')),
    );
    await page.resume(id);
    await settle();
    expect(page.lines()).toEqual([]);
    expect(page.parkedList().map((p) => p.id)).toEqual([id]);
    expect(page.problem()).toContain('could not be loaded');
  });

  it('a parked sale is stored by uid and code, with no product or customer names', async () => {
    await cart();
    page.parkSale();
    const text = localStorage.getItem(KEY) ?? '';
    expect(text).toContain('"productUid":"p1"');
    expect(text).toContain('"sku":"P00001"');
    expect(text).not.toContain('Paracetamol');
  });

  it('the till stops waiting after a while, and an answer that comes later completes the sale', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await cart();
    let answer: (sale: Sale) => void = () => undefined;
    api.posts.set('/sales', () => new Promise((resolve) => (answer = resolve as typeof answer)));
    const done = page.checkout();
    await vi.advanceTimersByTimeAsync(CHECKOUT_TIMEOUT_MS + 10);
    await done;
    expect(page.locked()).toBe(true);
    answer(saleOf(api.salesPosts()[0].body));
    await vi.advanceTimersByTimeAsync(0);
    expect(page.locked()).toBe(false);
    expect(page.receipt()?.number).toBe('INV-HQ-000123');
  });

  describe('unpriced lines (UX-1)', () => {
    it('block Complete sale and are listed in the Payment card, each with Remove', async () => {
      api.unpriced.add('p2');
      page.add(PARACETAMOL);
      page.add(AMOXICILLIN);
      await settle();
      expect(page.unpricedLines().map((l) => l.product.productUid)).toEqual(['p2']);
      const list = element('[data-testid="pos-unpriced-list"]');
      expect(list?.getAttribute('role')).toBe('alert');
      expect(list?.textContent).toContain('Amoxicillin 250mg');
      expect((element('.complete') as HTMLButtonElement).disabled).toBe(true);
      await page.checkout();
      expect(api.salesPosts()).toEqual([]);
      expect(page.problem()).toContain('price');
      (list!.querySelector('li button') as HTMLButtonElement).click();
      await settle();
      expect(page.lines().map((l) => l.product.productUid)).toEqual(['p1']);
      expect(element('[data-testid="pos-unpriced-list"]')).toBeNull();
    });
  });

  it('checkout problems stay in the Payment card instead of a toast (UX-2)', async () => {
    await page.checkout();
    expect(element('[data-testid="pos-problem"]')?.textContent).toContain('Add at least one item');
    await cart();
    page.payments.set([{ method: 'CASH', amount: 100, reference: null }]);
    await page.checkout();
    expect(element('[data-testid="pos-problem"]')?.textContent).toContain(
      'The payments do not cover the total',
    );
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('Exact is the total to the cent: 3 × 3.34 is 10.02, not 10.03 (WEB-10)', async () => {
    page.add(AMOXICILLIN, 3);
    await settle();
    page.payments.set([{ method: 'CASH', amount: 0, reference: null }]);
    page.exact();
    expect(page.payments()[0].amount).toBe(10.02);
  });

  describe('mobile-money push (WEB-9)', () => {
    const pending = (status: PaymentRequest['status']): PaymentRequest => ({
      uid: 'req-1',
      methodCode: 'MPESA',
      amount: 1000,
      currency: 'TZS',
      phone: '0712000000',
      status,
      providerReference: null,
      failureReason: null,
      expiresAt: '2099-01-01T00:00:00Z',
    });
    let status: PaymentRequest['status'];

    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      status = 'PENDING';
      api.posts.set('/pos/payment-requests', () => Promise.resolve(pending('PENDING')));
      api.gets.set('/pos/payment-requests/', () => Promise.resolve(pending(status)));
      await cart();
      page.payments.set([
        { method: 'CASH', amount: 2000, reference: null },
        { method: 'MOBILE_MONEY', channel: 'MPESA', amount: 1000, reference: null },
      ]);
      page.setPhone(1, '0712000000');
    });

    it('binds the result to its row and sale, not to the row index', async () => {
      const sending = page.sendToPhone(1);
      await vi.advanceTimersByTimeAsync(0);
      const sent = api.sent.find((s) => s.path === '/pos/payment-requests')!;
      expect((sent.body as { saleKey: string }).saleKey).toBe(page.idempotencyKey);
      page.removePayment(0); // the M-Pesa row moves up to index 0
      status = 'CONFIRMED';
      await vi.advanceTimersByTimeAsync(2100);
      await sending;
      expect(page.payments()).toHaveLength(1);
      expect(page.payments()[0].channel).toBe('MPESA');
      expect(page.payments()[0].reference).toBe('req-1');
    });

    it('stops polling when the sale on screen changes, and writes nothing into the next one', async () => {
      const sending = page.sendToPhone(1);
      await vi.advanceTimersByTimeAsync(2100);
      const polls = api.count('GET', '/pos/payment-requests/req-1');
      page.parkSale(); // another sale comes on screen
      page.payments.set([
        { method: 'CASH', amount: 0, reference: null },
        { method: 'MOBILE_MONEY', channel: 'MPESA', amount: 1000, reference: null },
      ]);
      status = 'CONFIRMED';
      await vi.advanceTimersByTimeAsync(10_000);
      await sending;
      expect(api.count('GET', '/pos/payment-requests/req-1')).toBe(polls);
      expect(page.payments().every((p) => p.reference === null)).toBe(true);
    });

    it('stops polling when the page is closed', async () => {
      const sending = page.sendToPhone(1);
      await vi.advanceTimersByTimeAsync(2100);
      const polls = api.count('GET', '/pos/payment-requests/req-1');
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(20_000);
      await sending;
      expect(api.count('GET', '/pos/payment-requests/req-1')).toBe(polls);
    });
  });
});
