import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api, Query, RequestOptions } from '../../core/api/api.service';
import { Product } from '../../core/api/models';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import ProductFormPage from './product-form.page';

const PRODUCT: Product = {
  uid: 'p1',
  name: 'Amoxicillin 250mg',
  genericName: 'Amoxicillin',
  sku: 'P00002',
  gtin: null,
  atcCode: 'J01CA04',
  categoryUid: null,
  manufacturerUid: null,
  dosageForm: 'CAPSULE',
  strength: '250 mg',
  packSize: null,
  schedule: 'PRESCRIPTION',
  sellingPrice: 3000,
  costPrice: 2000,
  taxRatePercent: 0,
  reorderLevel: 10,
  storage: 'ROOM_TEMPERATURE',
  productType: 'MEDICINE',
  trackingMode: 'BATCH_EXPIRY',
  unitOfMeasure: 'STRIP',
  brand: null,
  model: null,
  warrantyMonths: null,
  requiresSerialAtSale: null,
  tmdaRegistrationNumber: 'TAN 21 HM 0123',
  categoryName: null,
  manufacturerName: null,
  active: true,
  version: 3,
  createdAt: '2026-01-01T00:00:00Z',
};

/** A stand-in for the API reads of the product form, recording the PUT. */
class FakeApi {
  readonly puts: { path: string; body: unknown }[] = [];

  get<T>(path: string, _query?: Query, _options?: RequestOptions): Promise<T> {
    if (path === '/products/p1') return Promise.resolve(PRODUCT as T);
    if (path === '/stock/p1/held') return Promise.resolve({ unitsHeld: 0 } as T);
    if (path === '/dosage-forms') return Promise.resolve(['CAPSULE', 'TABLET'] as T);
    if (['/categories', '/manufacturers'].includes(path) || path.startsWith('/products/p1/')) {
      return Promise.resolve([] as T);
    }
    return Promise.reject(new ApiError(404, 'not_found', 'Not found'));
  }
  put<T>(path: string, body: unknown): Promise<T> {
    this.puts.push({ path, body });
    return Promise.resolve({ ...PRODUCT, version: 4 } as T);
  }
  post<T>(): Promise<T> {
    return Promise.reject(new ApiError(404, 'not_found', 'Not found'));
  }
}

describe('Product form: TMDA registration number (STD-8)', () => {
  let api: FakeApi;
  let fixture: ComponentFixture<ProductFormPage>;

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
    fixture = TestBed.createComponent(ProductFormPage);
    fixture.componentRef.setInput('uid', 'p1');
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => fixture?.destroy());

  it('shows the product’s TMDA registration number and saves a change to it', async () => {
    const input = el().querySelector<HTMLInputElement>('[data-testid="tmda-registration"]')!;
    expect(input.value).toBe('TAN 21 HM 0123');
    expect(input.maxLength).toBe(60);
    input.value = '  TAN 22 HM 0456 ';
    input.dispatchEvent(new Event('input'));
    await settle();
    (el().querySelector('.sticky-actions .btn.primary') as HTMLButtonElement).click();
    await settle();
    expect(api.puts[0].path).toBe('/products/p1');
    expect(api.puts[0].body).toEqual(
      expect.objectContaining({ tmdaRegistrationNumber: 'TAN 22 HM 0456', version: 3 }),
    );
  });

  it('sends null when the number is cleared', async () => {
    const input = el().querySelector<HTMLInputElement>('[data-testid="tmda-registration"]')!;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await settle();
    (el().querySelector('.sticky-actions .btn.primary') as HTMLButtonElement).click();
    await settle();
    expect(api.puts[0].body).toEqual(expect.objectContaining({ tmdaRegistrationNumber: null }));
  });
});
