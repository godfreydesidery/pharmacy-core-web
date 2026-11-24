import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api, Query, RequestOptions } from '../../core/api/api.service';
import { ControlledProduct, ControlledRegisterLine } from '../../core/api/models';
import { SessionStore } from '../../core/session/session.store';
import ControlledPage from './controlled.page';

/** A stand-in for the API's two controlled-drug reads, recording what was asked. */
class FakeApi {
  readonly gets: { path: string; query?: Query }[] = [];
  products: ControlledProduct[] = [];
  register: ControlledRegisterLine[] = [];

  get<T>(path: string, query?: Query, _options?: RequestOptions): Promise<T> {
    this.gets.push({ path, query });
    if (path === '/controlled-drugs') {
      const page = Number(query?.['page'] ?? 1);
      const limit = Number(query?.['limit'] ?? 25);
      const items = this.products.slice((page - 1) * limit, page * limit);
      return Promise.resolve({
        items,
        nextCursor: page * limit < this.products.length ? String(page + 1) : null,
        total: this.products.length,
        totalCapped: false,
      } as T);
    }
    if (path.endsWith('/register')) {
      return Promise.resolve({
        items: this.register,
        nextCursor: null,
        total: this.register.length,
      } as T);
    }
    return Promise.reject(new ApiError(404, 'not_found', 'Not found'));
  }
  post<T>(): Promise<T> {
    return Promise.reject(new ApiError(404, 'not_found', 'Not found'));
  }
}

function drug(n: number): ControlledProduct {
  return {
    productUid: `p${n}`,
    name: `Drug ${String(n).padStart(3, '0')}`,
    strength: '10 mg',
    dosageForm: 'TABLET',
    onHand: n,
    schedule: 'CONTROLLED',
    controlledNow: true,
  };
}

function line(uid: string, extra: Partial<ControlledRegisterLine>): ControlledRegisterLine {
  return {
    uid,
    at: '2026-11-20T09:00:00Z',
    type: 'SALE',
    reference: 'INV-HQ-000010',
    batchNumber: 'M-1',
    quantityIn: 0,
    quantityOut: 2,
    balance: 18,
    patientName: null,
    prescriberName: null,
    prescriberRegistration: null,
    prescriptionReference: null,
    prescriptionDate: null,
    dispensedBy: 'Juma (pharmacist)',
    withheld: false,
    note: null,
    recordedBy: 'Juma',
    ...extra,
  };
}

describe('Controlled drugs page', () => {
  let api: FakeApi;
  let fixture: ComponentFixture<ControlledPage>;

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

  beforeEach(async () => {
    localStorage.clear();
    api = new FakeApi();
    api.products = Array.from({ length: 30 }, (_, i) => drug(i + 1));
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
    session.enterAsRoot({ uid: 't1', code: 'AFYA', name: 'Afya' } as never, [branch], branch);
    fixture = TestBed.createComponent(ControlledPage);
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => fixture?.destroy());

  it('reads the drugs as a Page, one page at a time', async () => {
    const drugs = () => Array.from(el().querySelectorAll('button.drug')).map((b) => b.textContent);
    expect(drugs().length).toBe(25);
    expect(drugs()[0]).toContain('Drug 001');
    expect(api.gets[0]).toEqual({
      path: '/controlled-drugs',
      query: expect.objectContaining({ page: 1, limit: 25 }),
    });
    const pager = el().querySelector('app-pager')!;
    const next = pager.querySelector<HTMLButtonElement>('button[title="Next page"]')!;
    expect(next.disabled).toBe(false);
    next.click();
    await settle();
    expect(drugs().length).toBe(5);
    expect(drugs()[0]).toContain('Drug 026');
  });

  it('shows the prescription date and who dispensed, and withholds what the caller may not see', async () => {
    api.register = [
      line('l1', {
        patientName: 'Asha Juma',
        prescriberName: 'Dr Mushi',
        prescriberRegistration: 'MCT-1234',
        prescriptionReference: 'RX-9',
        prescriptionDate: '2026-11-18',
      }),
      line('l2', { withheld: true }),
    ];
    (el().querySelector('button.drug') as HTMLButtonElement).click();
    await settle();
    const head = el().querySelector('thead')!.textContent ?? '';
    expect(head).toContain('Prescription date');
    expect(head).toContain('Dispensed by');
    const rows = el().querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Asha Juma');
    expect(rows[0].textContent).toContain('Dr Mushi');
    expect(rows[0].textContent).toContain('Juma (pharmacist)');
    expect(rows[1].querySelector('[data-testid="withheld"]')?.textContent).toContain('Withheld');
    expect(rows[1].textContent).toContain('Juma (pharmacist)');
  });
});
