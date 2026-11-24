import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api, Query, RequestOptions } from '../../core/api/api.service';
import { DataSubjectRequest } from '../../core/api/models';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import PrivacyRequestsPage from './privacy-requests.page';

type Handler = (body: unknown) => unknown;

/** A stand-in for the API: answers by method and path, and records what was sent. */
class FakeApi {
  readonly sent: { method: string; path: string; body: unknown; options?: RequestOptions }[] = [];
  private readonly answers = new Map<string, Handler>();

  on(method: string, path: string, handler: Handler): void {
    this.answers.set(`${method} ${path}`, handler);
  }

  all(method: string, path: string) {
    return this.sent.filter((s) => s.method === method && s.path === path);
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

function request(number: string, extra: Partial<DataSubjectRequest> = {}): DataSubjectRequest {
  return {
    uid: number.toLowerCase(),
    number,
    kind: 'ACCESS',
    status: 'OPEN',
    customerUid: 'c1',
    customerCode: 'CUS-000001',
    customerName: 'Asha Juma',
    receivedAt: '2026-11-01T08:00:00Z',
    dueOn: '2026-12-01',
    completedAt: null,
    completedBy: null,
    outcome: null,
    note: null,
    overdue: false,
    createdAt: '2026-11-01T08:00:00Z',
    createdBy: 'Amina',
    ...extra,
  };
}

describe('Data requests page (STD-5)', () => {
  let api: FakeApi;
  let fixture: ComponentFixture<PrivacyRequestsPage>;

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

  function type(selector: string, value: string): void {
    const input = el().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function choose(selector: string, value: string): void {
    const select = el().querySelector<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  beforeEach(async () => {
    localStorage.clear();
    api = new FakeApi();
    api.on('GET', '/privacy/requests', () => ({
      items: [
        request('DSR-000002', { kind: 'ERASURE', overdue: true, dueOn: '2026-10-30' }),
        request('DSR-000001', {
          kind: 'CORRECTION',
          status: 'COMPLETED',
          outcome: 'Phone corrected',
          completedAt: '2026-11-02T08:00:00Z',
          completedBy: 'Amina',
        }),
      ],
      nextCursor: null,
      total: 2,
    }));
    api.on('GET', '/customers', () => ({
      items: [{ uid: 'c1', code: 'CUS-000001', name: 'Asha Juma', phone: null }],
      nextCursor: null,
      total: 1,
    }));
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
    session.enterAsRoot({ uid: 't1', code: 'AFYA', name: 'Afya' } as never, [], null);
    vi.spyOn(TestBed.inject(ToastService), 'success');
    fixture = TestBed.createComponent(PrivacyRequestsPage);
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => fixture?.destroy());

  it('lists the requests with their due date, the 30-day hint and the overdue ones marked', () => {
    const head = el().querySelector('thead')!.textContent ?? '';
    expect(head).toContain('Due');
    expect(head).toContain('30 days (verify)');
    const overdue = el().querySelector('[data-testid="dsr-row-DSR-000002"]')!;
    expect(overdue.classList).toContain('overdue');
    expect(overdue.querySelector('[data-testid="overdue"]')?.textContent).toContain('Overdue');
    expect(overdue.textContent).toContain('Erasure');
    const done = el().querySelector('[data-testid="dsr-row-DSR-000001"]')!;
    expect(done.querySelector('[data-testid="overdue"]')).toBeNull();
    expect(done.textContent).toContain('Phone corrected');
    // Only an open request can be completed or refused.
    expect(done.querySelector('[data-testid="dsr-complete"]')).toBeNull();
    expect(overdue.querySelector('[data-testid="dsr-complete"]')).not.toBeNull();
  });

  it('filters by status and kind', async () => {
    choose('[data-testid="dsr-status-filter"]', 'OPEN');
    await settle();
    choose('[data-testid="dsr-kind-filter"]', 'ERASURE');
    await settle();
    const last = api.all('GET', '/privacy/requests').at(-1)!;
    expect(last.body).toEqual(expect.objectContaining({ status: 'OPEN', kind: 'ERASURE' }));
    expect(last.options?.noBranch).toBe(true);
  });

  it('logs a new request for the customer picked', async () => {
    api.on('POST', '/privacy/requests', () => request('DSR-000003'));
    click('[data-testid="dsr-new"]');
    await settle();
    const save = el().querySelector<HTMLButtonElement>('[data-testid="dsr-save"]')!;
    expect(save.disabled).toBe(true); // no customer yet
    const received = el().querySelector<HTMLInputElement>('[data-testid="dsr-received-on"]')!;
    expect(received.max).toBe(received.value); // today, at most
    choose('[data-testid="dsr-kind"]', 'OBJECTION');
    const search = el().querySelector<HTMLInputElement>('app-lookup input')!;
    search.dispatchEvent(new Event('focus'));
    await settle();
    click('app-lookup .results button');
    type('app-modal textarea', 'Asked at the counter');
    await settle();
    click('[data-testid="dsr-save"]');
    await settle();
    const sent = api.all('POST', '/privacy/requests')[0];
    expect(sent.body).toEqual({
      kind: 'OBJECTION',
      customerUid: 'c1',
      receivedOn: received.value,
      note: 'Asked at the counter',
    });
    expect(TestBed.inject(ToastService).success).toHaveBeenCalledWith(
      expect.stringContaining('DSR-000003'),
    );
  });

  it('completes an open request with its outcome', async () => {
    api.on('POST', '/privacy/requests/dsr-000002/complete', () =>
      request('DSR-000002', { status: 'COMPLETED' }),
    );
    click(
      '[data-testid="dsr-complete"]',
      el().querySelector('[data-testid="dsr-row-DSR-000002"]')!,
    );
    await settle();
    const save = el().querySelector<HTMLButtonElement>('[data-testid="dsr-closing-save"]')!;
    expect(save.disabled).toBe(true);
    type('[data-testid="dsr-closing-text"]', 'Customer anonymised');
    await settle();
    click('[data-testid="dsr-closing-save"]');
    await settle();
    expect(api.all('POST', '/privacy/requests/dsr-000002/complete')[0].body).toEqual({
      outcome: 'Customer anonymised',
    });
  });

  it('refuses one with the reason, and shows the API’s refusal in the dialog', async () => {
    api.on('POST', '/privacy/requests/dsr-000002/refuse', () => {
      throw new ApiError(409, 'request_closed', 'DSR-000002 is already closed.');
    });
    click('[data-testid="dsr-refuse"]', el().querySelector('[data-testid="dsr-row-DSR-000002"]')!);
    await settle();
    type('[data-testid="dsr-closing-text"]', 'Not the account holder');
    await settle();
    click('[data-testid="dsr-closing-save"]');
    await settle();
    expect(api.all('POST', '/privacy/requests/dsr-000002/refuse')[0].body).toEqual({
      reason: 'Not the account holder',
    });
    expect(el().querySelector('app-modal [role="alert"]')?.textContent).toContain('already closed');
  });
});
