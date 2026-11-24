import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api, Query, RequestOptions } from '../../core/api/api.service';
import { AdverseReaction } from '../../core/api/models';
import { isoDay } from '../../core/format/format';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import AdverseReactionsPage from './adverse-reactions.page';

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

const REPORT: AdverseReaction = {
  uid: 'adr1',
  number: 'ADR-000001',
  branchUid: 'b1',
  customerUid: null,
  patientName: 'A. J.',
  patientAge: 34,
  patientSex: 'FEMALE',
  patientWeightKg: 60,
  productUid: 'p1',
  productName: 'Amoxicillin 250mg',
  batchNumber: 'B-77',
  dose: '250 mg three times a day',
  route: 'Oral',
  indication: 'Chest infection',
  therapyStarted: '2026-11-10',
  therapyStopped: '2026-11-12',
  reaction: 'Itchy rash on the arms',
  onsetDate: '2026-11-12',
  seriousness: 'NOT_SERIOUS',
  seriousReason: null,
  outcome: 'RECOVERING',
  reporterName: 'Amina',
  reporterProfession: 'Pharmacist',
  reporterPhone: null,
  note: null,
  createdAt: '2026-11-13T08:00:00Z',
  createdBy: 'Amina',
};

describe('Adverse reactions page (STD-8)', () => {
  let api: FakeApi;
  let fixture: ComponentFixture<AdverseReactionsPage>;

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

  function click(selector: string): void {
    const button = el().querySelector<HTMLElement>(selector);
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

  async function open(permissions: string[] | null = null): Promise<void> {
    const session = TestBed.inject(SessionStore);
    session.signIn({
      token: 'pcs_abc',
      expiresAt: '2099-01-01T00:00:00Z',
      user: { uid: 'u1', name: 'Amina Said', email: 'a@x.tz', rootAdmin: permissions === null },
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
          roleCode: 'X',
          roleName: 'X',
          permissions,
          allBranches: true,
          branches: [branch],
        },
        [branch],
        branch,
      );
    }
    fixture = TestBed.createComponent(AdverseReactionsPage);
    fixture.detectChanges();
    await settle();
  }

  /** Opens the form and fills what a report needs: the medicine, the reaction and its onset. */
  async function fillForm(): Promise<void> {
    click('[data-testid="adr-new"]');
    await settle();
    const product = el().querySelectorAll<HTMLInputElement>('app-lookup input')[1];
    product.dispatchEvent(new Event('focus'));
    await settle();
    el().querySelectorAll<HTMLButtonElement>('app-lookup .results button')[0].click();
    type('[data-testid="adr-reaction"]', 'Itchy rash on the arms');
    await settle();
  }

  beforeEach(() => {
    localStorage.clear();
    api = new FakeApi();
    api.on('GET', '/adverse-reactions', () => ({ items: [REPORT], nextCursor: null, total: 1 }));
    api.on('GET', '/adverse-reactions/adr1', () => REPORT);
    api.on('GET', '/products', () => ({
      items: [{ uid: 'p1', name: 'Amoxicillin 250mg' }],
      nextCursor: null,
    }));
    api.on('GET', '/customers', () => ({ items: [], nextCursor: null }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Api, useValue: api },
      ],
    });
    vi.spyOn(TestBed.inject(ToastService), 'success');
  });

  afterEach(() => fixture?.destroy());

  it('lists the reports, a page at a time, searched by q', async () => {
    await open();
    expect(el().querySelector('tbody')?.textContent).toContain('ADR-000001');
    expect(el().querySelector('tbody')?.textContent).toContain('Not serious');
    type('[data-testid="adr-search"]', 'rash');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    expect(api.all('GET', '/adverse-reactions').at(-1)?.body).toEqual(
      expect.objectContaining({ q: 'rash', page: 1 }),
    );
  });

  it('the form says it follows the TMDA yellow form, and defaults the reporter to the user', async () => {
    await open();
    click('[data-testid="adr-new"]');
    await settle();
    expect(el().querySelector('[data-testid="adr-form-hint"]')?.textContent).toMatch(
      /TMDA yellow form[\s\S]*Verify/,
    );
    expect(el().querySelector<HTMLInputElement>('[data-testid="adr-reporter"]')?.value).toBe(
      'Amina Said',
    );
    expect(el().querySelector<HTMLInputElement>('[data-testid="adr-onset"]')?.max).toBe(isoDay());
  });

  it('reports a reaction with the medicine picked', async () => {
    api.on('POST', '/adverse-reactions', () => ({ ...REPORT, number: 'ADR-000002' }));
    await open();
    await fillForm();
    click('[data-testid="adr-save"]');
    await settle();
    const sent = api.all('POST', '/adverse-reactions')[0];
    expect(sent.body).toEqual(
      expect.objectContaining({
        productUid: 'p1',
        reaction: 'Itchy rash on the arms',
        onsetDate: isoDay(),
        seriousness: 'NOT_SERIOUS',
        seriousReason: null,
        outcome: 'UNKNOWN',
        reporterName: 'Amina Said',
        customerUid: null,
        patientName: null,
      }),
    );
    // The branch header goes with it (the API needs X-Branch-Id).
    expect(sent.options?.noBranch).toBeFalsy();
    expect(el().querySelector('[data-testid="adr-detail"]')?.textContent).toContain('ADR-000002');
  });

  it('a serious reaction needs its reason before it is sent', async () => {
    api.on('POST', '/adverse-reactions', () => REPORT);
    await open();
    await fillForm();
    choose('[data-testid="adr-seriousness"]', 'SERIOUS');
    await settle();
    click('[data-testid="adr-save"]');
    await settle();
    expect(api.all('POST', '/adverse-reactions')).toEqual([]);
    choose('[data-testid="adr-serious-reason"]', 'HOSPITALISATION');
    await settle();
    click('[data-testid="adr-save"]');
    await settle();
    expect(api.all('POST', '/adverse-reactions')[0].body).toEqual(
      expect.objectContaining({ seriousness: 'SERIOUS', seriousReason: 'HOSPITALISATION' }),
    );
  });

  it('an onset after today is refused before sending', async () => {
    await open();
    await fillForm();
    type('[data-testid="adr-onset"]', isoDay(2));
    await settle();
    click('[data-testid="adr-save"]');
    await settle();
    expect(api.all('POST', '/adverse-reactions')).toEqual([]);
  });

  it('shows the API’s refusal on the field it names', async () => {
    api.on('POST', '/adverse-reactions', () => {
      throw new ApiError(
        422,
        'invalid_therapy_dates',
        'The therapy stopped before it started.',
        'therapyStopped',
      );
    });
    await open();
    await fillForm();
    click('[data-testid="adr-save"]');
    await settle();
    expect(el().querySelector('app-modal')?.textContent).toContain(
      'The therapy stopped before it started.',
    );
  });

  it('opens a report and downloads its TMDA CSV', async () => {
    await open();
    (el().querySelector('tbody .row-link') as HTMLButtonElement).click();
    await settle();
    expect(el().querySelector('[data-testid="adr-detail"]')?.textContent).toContain(
      'Itchy rash on the arms',
    );
    const http = TestBed.inject(HttpTestingController);
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:csv'), revokeObjectURL: vi.fn() });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    click('[data-testid="adr-export"]');
    const request = http.expectOne('/api/v1/adverse-reactions/adr1/export');
    expect(request.request.method).toBe('GET');
    request.flush(new Blob(['Section,Field,Value']), {
      headers: { 'Content-Disposition': 'attachment; filename="ADR-000001.csv"' },
    });
    await settle();
    expect(clicked).toHaveBeenCalled();
    clicked.mockRestore();
    http.verify();
  });

  it('reporting and the CSV need adr.report', async () => {
    await open(['inventory.view', 'health.view']);
    expect(el().querySelector('[data-testid="adr-new"]')).toBeNull();
    (el().querySelector('tbody .row-link') as HTMLButtonElement).click();
    await settle();
    expect(el().querySelector('[data-testid="adr-export"]')).toBeNull();
  });
});
