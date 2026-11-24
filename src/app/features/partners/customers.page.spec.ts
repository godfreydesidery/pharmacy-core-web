import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api, Query, RequestOptions } from '../../core/api/api.service';
import { Customer, CustomerConsents } from '../../core/api/models';
import { SessionStore } from '../../core/session/session.store';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import CustomersPage from './customers.page';

type Handler = (body: unknown) => unknown;

/** A stand-in for the API: answers by method and path, and records what was sent. */
class FakeApi {
  readonly sent: { method: string; path: string; body: unknown; options?: RequestOptions }[] = [];
  private readonly answers = new Map<string, Handler>();

  on(method: string, path: string, handler: Handler): void {
    this.answers.set(`${method} ${path}`, handler);
  }

  last(method: string, path: string) {
    return [...this.sent].reverse().find((s) => s.method === method && s.path === path);
  }

  private answer<T>(method: string, path: string, body: unknown, options?: RequestOptions) {
    this.sent.push({ method, path, body: JSON.parse(JSON.stringify(body ?? {})), options });
    const handler = this.answers.get(`${method} ${path}`);
    if (!handler) {
      return Promise.reject(new ApiError(404, 'not_found', 'Not found'));
    }
    try {
      return Promise.resolve(handler(body) as T);
    } catch (failure) {
      return Promise.reject(failure);
    }
  }

  get<T>(path: string, query?: Query, options?: RequestOptions): Promise<T> {
    return this.answer<T>('GET', path, query, options);
  }
  post<T>(path: string, body: unknown = {}, options?: RequestOptions): Promise<T> {
    return this.answer<T>('POST', path, body, options);
  }
  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.answer<T>('PUT', path, body, options);
  }
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.answer<T>('DELETE', path, undefined, options);
  }
}

function customer(uid: string, name: string, extra: Partial<Customer> = {}): Customer {
  return {
    uid,
    code: `CUS-${uid}`,
    name,
    phone: '+255700000001',
    email: null,
    type: 'RETAIL',
    insuranceProvider: null,
    insuranceNumber: null,
    creditLimit: 0,
    address: null,
    active: true,
    paymentTerms: 'NET_30',
    createdAt: '2026-11-01T08:00:00Z',
    anonymisedAt: null,
    ...extra,
  };
}

const ASHA = customer('c1', 'Asha Juma');
const GONE = customer('c2', 'Anonymised customer', {
  anonymisedAt: '2026-11-20T09:00:00Z',
  phone: null,
  active: false,
});

const CONSENTS: CustomerConsents = {
  current: [
    { purpose: 'SMS_RECEIPTS', status: 'NONE', since: null, effective: true },
    { purpose: 'MARKETING', status: 'GIVEN', since: '2026-11-02T08:00:00Z', effective: true },
    { purpose: 'INSURER_SHARING', status: 'NONE', since: null, effective: false },
  ],
  history: [
    {
      uid: 'h1',
      purpose: 'MARKETING',
      givenAt: '2026-11-02T08:00:00Z',
      givenBy: 'Amina',
      withdrawnAt: null,
      withdrawnBy: null,
      note: 'at the counter',
      inForce: true,
    },
  ],
};

describe('Customers page: privacy (STD-5)', () => {
  let api: FakeApi;
  let fixture: ComponentFixture<CustomersPage>;
  let confirm: ConfirmService;

  async function settle(): Promise<void> {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
  }

  function el(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function click(selector: string, within: ParentNode = el()): void {
    const button = within.querySelector<HTMLElement>(selector);
    expect(button, selector).not.toBeNull();
    button!.click();
  }

  function rowOf(name: string): HTMLTableRowElement {
    const row = Array.from(el().querySelectorAll<HTMLTableRowElement>('tbody tr')).find((r) =>
      r.textContent?.includes(name),
    );
    expect(row, name).toBeDefined();
    return row!;
  }

  async function open(permissions: string[] | null = null): Promise<void> {
    const session = TestBed.inject(SessionStore);
    session.signIn({
      token: 'pcs_abc',
      expiresAt: '2099-01-01T00:00:00Z',
      user: { uid: 'u1', name: 'Amina', email: 'a@x.tz', rootAdmin: permissions === null },
      memberships: [],
    });
    const branch = { uid: 'b1', code: 'HQ', name: 'Main' };
    if (permissions === null) {
      session.enterAsRoot({ uid: 't1', code: 'AFYA', name: 'Afya' } as never, [branch], branch);
    } else {
      session.enterMembership(
        {
          uid: 'm1',
          tenantUid: 't1',
          tenantCode: 'AFYA',
          tenantName: 'Afya',
          tenantStatus: 'ACTIVE',
          roleUid: 'r1',
          roleCode: 'CASHIER',
          roleName: 'Cashier',
          permissions,
          allBranches: true,
          branches: [branch],
        },
        [branch],
        branch,
      );
    }
    fixture = TestBed.createComponent(CustomersPage);
    fixture.detectChanges();
    await settle();
  }

  beforeEach(() => {
    localStorage.clear();
    api = new FakeApi();
    api.on('GET', '/customers', () => ({
      items: [ASHA, GONE],
      nextCursor: null,
      total: 2,
    }));
    api.on('GET', '/customers/c1/consents', () => CONSENTS);
    api.on('GET', '/customers/c2/consents', () => ({ current: [], history: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Api, useValue: api },
      ],
    });
    confirm = TestBed.inject(ConfirmService);
    vi.spyOn(TestBed.inject(ToastService), 'success');
    vi.spyOn(TestBed.inject(ToastService), 'error');
  });

  afterEach(() => fixture?.destroy());

  it('an anonymised customer shows a badge and cannot be edited', async () => {
    await open();
    const gone = rowOf('Anonymised customer');
    expect(gone.querySelector('[data-testid="anonymised-badge"]')?.textContent).toContain(
      'Anonymised',
    );
    expect(gone.querySelector('[data-testid="edit"]')).toBeNull();
    expect(rowOf('Asha Juma').querySelector('[data-testid="edit"]')).not.toBeNull();
  });

  it('the privacy drawer shows the consents, their history, and records a withdrawal', async () => {
    await open();
    click('[data-testid="privacy"]', rowOf('Asha Juma'));
    await settle();
    const current = el().querySelector('[data-testid="consents-current"]')!;
    expect(current.textContent).toContain('SMS receipts');
    expect(current.textContent).toContain('Marketing messages');
    expect(current.textContent).toContain('Given');
    expect(el().querySelector('[data-testid="consents-history"]')?.textContent).toContain(
      'at the counter',
    );
    api.on('POST', '/customers/c1/consents', () => ({
      ...CONSENTS,
      current: CONSENTS.current.map((c) =>
        c.purpose === 'MARKETING' ? { ...c, status: 'WITHDRAWN', effective: false } : c,
      ),
    }));
    const marketing = Array.from(current.querySelectorAll('tbody tr')).find((r) =>
      r.textContent?.includes('Marketing'),
    )!;
    const withdraw = Array.from(marketing.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Record withdrawal'),
    )!;
    withdraw.click();
    await settle();
    expect(api.last('POST', '/customers/c1/consents')?.body).toEqual({
      purpose: 'MARKETING',
      given: false,
      note: null,
    });
    expect(el().querySelector('[data-testid="consents-current"]')?.textContent).toContain(
      'Withdrawn',
    );
  });

  it('Export personal data POSTs and saves the ZIP the API names', async () => {
    await open();
    click('[data-testid="privacy"]', rowOf('Asha Juma'));
    await settle();
    const http = TestBed.inject(HttpTestingController);
    const created = vi.fn(() => 'blob:zip');
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    click('[data-testid="export-personal-data"]');
    const request = http.expectOne('/api/v1/customers/c1/data-export');
    expect(request.request.method).toBe('POST');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['PK']), {
      headers: {
        'Content-Disposition': 'attachment; filename="CUS-c1-personal-data-2026-11-24.zip"',
      },
    });
    await settle();
    expect(created).toHaveBeenCalled();
    expect(clicked).toHaveBeenCalled();
    clicked.mockRestore();
    http.verify();
  });

  it('Anonymise asks in the app’s dialog, then sends the request', async () => {
    await open();
    click('[data-testid="privacy"]', rowOf('Asha Juma'));
    await settle();
    const ask = vi.spyOn(confirm, 'ask').mockResolvedValue(true);
    api.on('POST', '/customers/c1/anonymise', () => ({ uid: 'r1', number: 'DSR-000001' }));
    click('[data-testid="anonymise"]');
    await settle();
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'danger',
        title: expect.stringContaining('Asha Juma'),
        text: expect.stringMatching(/cannot be undone[\s\S]*Sales, payments, stock and money/),
      }),
    );
    expect(api.last('POST', '/customers/c1/anonymise')?.body).toEqual({ note: null });
    expect(TestBed.inject(ToastService).success).toHaveBeenCalledWith(
      expect.stringContaining('DSR-000001'),
    );
  });

  it('Anonymise sends nothing when the question is cancelled', async () => {
    await open();
    click('[data-testid="privacy"]', rowOf('Asha Juma'));
    await settle();
    vi.spyOn(confirm, 'ask').mockResolvedValue(false);
    click('[data-testid="anonymise"]');
    await settle();
    expect(api.last('POST', '/customers/c1/anonymise')).toBeUndefined();
  });

  it('a refusal (a balance still owed) shows in the drawer', async () => {
    await open();
    click('[data-testid="privacy"]', rowOf('Asha Juma'));
    await settle();
    vi.spyOn(confirm, 'ask').mockResolvedValue(true);
    api.on('POST', '/customers/c1/anonymise', () => {
      throw new ApiError(
        422,
        'subject_has_balance',
        'Asha Juma owes 12,500; settle the account first.',
        null,
        null,
        null,
        { balance: 12500 },
      );
    });
    click('[data-testid="anonymise"]');
    await settle();
    const problem = el().querySelector('[data-testid="privacy-problem"]');
    expect(problem?.getAttribute('role')).toBe('alert');
    expect(problem?.textContent).toContain('owes 12,500');
  });

  it('shows the export and anonymise actions only to those allowed', async () => {
    await open(['partners.view', 'partners.manage']);
    click('[data-testid="privacy"]', rowOf('Asha Juma'));
    await settle();
    expect(el().querySelector('[data-testid="export-personal-data"]')).toBeNull();
    expect(el().querySelector('[data-testid="anonymise"]')).toBeNull();
    fixture.destroy();
    await open(['partners.view', 'data.export', 'health.view']);
    click('[data-testid="privacy"]', rowOf('Asha Juma'));
    await settle();
    expect(el().querySelector('[data-testid="export-personal-data"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="anonymise"]')).toBeNull(); // needs partners.manage
  });

  it('an anonymised customer’s drawer offers no anonymise and no consent changes', async () => {
    await open();
    click('[data-testid="privacy"]', rowOf('Anonymised customer'));
    await settle();
    expect(el().querySelector('[data-testid="anonymised-notice"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="anonymise"]')).toBeNull();
    expect(el().textContent).not.toContain('Record consent');
  });

  describe('the customer form', () => {
    it('starts the consent toggles from the customer’s consents and sends only those changed', async () => {
      await open();
      api.on('PUT', '/customers/c1', () => ASHA);
      click('[data-testid="edit"]', rowOf('Asha Juma'));
      await settle();
      const toggles = el().querySelector('[data-testid="consent-toggles"]')!;
      const boxes = Array.from(toggles.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
      expect(boxes.map((b) => b.checked)).toEqual([true, true, false]);
      boxes[2].click(); // insurer sharing: yes
      await settle();
      click('.btn.primary', el().querySelector('app-modal footer')!);
      await settle();
      const sent = api.last('PUT', '/customers/c1');
      expect((sent?.body as { consents?: unknown }).consents).toEqual({ INSURER_SHARING: true });
    });

    it('sends no consents when none changed', async () => {
      await open();
      api.on('PUT', '/customers/c1', () => ASHA);
      click('[data-testid="edit"]', rowOf('Asha Juma'));
      await settle();
      click('.btn.primary', el().querySelector('app-modal footer')!);
      await settle();
      expect('consents' in (api.last('PUT', '/customers/c1')?.body as object)).toBe(false);
    });

    it('records a correction as the customer’s data-subject request when ticked', async () => {
      await open();
      api.on('PUT', '/customers/c1?dataSubjectRequest=true', () => ASHA);
      click('[data-testid="edit"]', rowOf('Asha Juma'));
      await settle();
      (el().querySelector('[data-testid="correction-request"]') as HTMLInputElement).click();
      await settle();
      click('.btn.primary', el().querySelector('app-modal footer')!);
      await settle();
      expect(api.last('PUT', '/customers/c1?dataSubjectRequest=true')).toBeDefined();
      expect(api.last('PUT', '/customers/c1')).toBeUndefined();
    });

    it('a new customer gets SMS receipts by default; ticking marketing sends it', async () => {
      await open();
      api.on('POST', '/customers', () => ASHA);
      click('.page-head .btn.primary');
      await settle();
      const name = el().querySelector<HTMLInputElement>('input[formcontrolname="name"]')!;
      name.value = 'Neema';
      name.dispatchEvent(new Event('input'));
      const boxes = Array.from(
        el().querySelectorAll<HTMLInputElement>('[data-testid="consent-toggles"] input'),
      );
      expect(boxes.map((b) => b.checked)).toEqual([true, false, false]);
      boxes[1].click();
      expect(el().querySelector('[data-testid="correction-request"]')).toBeNull();
      click('.btn.primary', el().querySelector('app-modal footer')!);
      await settle();
      expect((api.last('POST', '/customers')?.body as { consents?: unknown }).consents).toEqual({
        MARKETING: true,
      });
    });
  });
});
