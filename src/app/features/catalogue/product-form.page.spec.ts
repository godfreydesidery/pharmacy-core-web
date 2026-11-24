import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { apiInterceptor } from '../../core/api/api.interceptor';
import { Product } from '../../core/api/models';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import ProductFormPage from './product-form.page';

/** The page's members these tests drive (protected in the component). */
interface Page {
  form: FormGroup;
  version: Signal<number>;
  save(): Promise<void>;
}

function product(version: number, name = 'Paracetamol 500mg'): Product {
  return {
    uid: 'p1',
    name,
    genericName: 'Paracetamol',
    sku: 'P00001',
    gtin: null,
    atcCode: null,
    categoryUid: null,
    categoryName: null,
    manufacturerUid: null,
    manufacturerName: null,
    dosageForm: 'TABLET',
    strength: '500 mg',
    packSize: null,
    schedule: 'OTC',
    storage: 'ROOM_TEMPERATURE',
    costPrice: 800,
    sellingPrice: 1500,
    taxRatePercent: 0,
    reorderLevel: 10,
    productType: 'MEDICINE',
    trackingMode: 'BATCH_EXPIRY',
    unitOfMeasure: 'STRIP',
    brand: null,
    model: null,
    warrantyMonths: null,
    requiresSerialAtSale: null,
    active: true,
    version,
    createdAt: '2026-11-01T08:00:00Z',
  } as Product;
}

const ok = (data: unknown) => ({ success: true, data });
const PRECONDITION_FAILED = {
  status: 412,
  title: 'Precondition Failed',
  detail: 'Someone else changed this product.',
  reason: 'precondition_failed',
  currentVersion: 8,
};

describe('ProductFormPage saves with If-Match (STD-10)', () => {
  let http: HttpTestingController;
  let confirm: ConfirmService;
  let toasts: ToastService;
  let fixture: ComponentFixture<ProductFormPage>;
  let page: Page;
  /** What GET /products/p1 answers now. */
  let onServer: Product;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductFormPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    confirm = TestBed.inject(ConfirmService);
    toasts = TestBed.inject(ToastService);
  });

  /** Answers every read the page has sent: the product as on the server, the rest empty. */
  function serveReads(): number {
    const reads = http.match((r) => r.method === 'GET');
    for (const read of reads) {
      const url = read.request.url;
      if (url === '/api/v1/products/p1') {
        read.flush(ok(onServer), { headers: { ETag: `"${onServer.version}"` } });
      } else if (url === '/api/v1/stock/p1/held') {
        read.flush(ok({ unitsHeld: 0 }));
      } else {
        read.flush(ok([]));
      }
    }
    return reads.length;
  }

  async function settle(): Promise<void> {
    for (let round = 0; round < 6; round++) {
      serveReads();
      await new Promise((resolve) => setTimeout(resolve));
    }
  }

  async function open(version: number): Promise<void> {
    onServer = product(version);
    fixture = TestBed.createComponent(ProductFormPage);
    fixture.componentRef.setInput('uid', 'p1');
    fixture.detectChanges();
    page = fixture.componentInstance as unknown as Page;
    await settle();
    expect(page.version()).toBe(version);
  }

  function nextSave(): TestRequest {
    return http.expectOne((r) => r.method === 'PUT' && r.url === '/api/v1/products/p1');
  }

  it('sends the version it loaded, then the one the save answered', async () => {
    await open(7);
    page.form.controls['name'].setValue('Paracetamol 500mg tablets');

    const first = page.save();
    const put = nextSave();
    expect(put.request.headers.get('If-Match')).toBe('"7"');
    expect((put.request.body as { version: number }).version).toBe(7);
    put.flush(ok({ ...product(8), name: 'Paracetamol 500mg tablets' }), {
      headers: { ETag: '"8"' },
    });
    await first;
    expect(page.version()).toBe(8);

    // A second save on the same page, without a reload, carries the new version.
    page.form.controls['reorderLevel'].setValue(20);
    const second = page.save();
    const again = nextSave();
    expect(again.request.headers.get('If-Match')).toBe('"8"');
    again.flush(ok(product(9)));
    await second;
    expect(page.version()).toBe(9);
  });

  it('on 412 asks in the dialog, without a toast, and Reload reads the product again', async () => {
    await open(7);
    page.form.controls['name'].setValue('My local edit');
    page.form.markAsDirty();

    const saving = page.save();
    nextSave().flush(PRECONDITION_FAILED, { status: 412, statusText: 'Precondition Failed' });
    await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
    expect(confirm.current()!.title).toBe('Someone else changed this');
    expect(confirm.current()!.confirmText).toBe('Reload');
    expect(toasts.toasts().filter((t) => t.kind === 'error')).toEqual([]);

    // Someone else renamed it meanwhile; Reload shows their change and drops the local edit.
    onServer = product(8, 'Panadol 500mg');
    confirm.settle(true);
    await vi.waitFor(() => expect(serveReads()).toBeGreaterThan(0));
    await settle();
    await saving;
    expect(page.form.controls['name'].value).toBe('Panadol 500mg');
    expect(page.form.dirty).toBe(false);
    expect(page.version()).toBe(8);
    expect(toasts.toasts().filter((t) => t.kind === 'error')).toEqual([]);

    // The next save goes with the version just read.
    const next = page.save();
    const put = nextSave();
    expect(put.request.headers.get('If-Match')).toBe('"8"');
    put.flush(ok(product(9, 'Panadol 500mg')));
    await next;
  });

  it('treats a 409 stale_version the same way, and Keep editing leaves the form as it is', async () => {
    await open(7);
    page.form.controls['name'].setValue('My local edit');

    const saving = page.save();
    nextSave().flush(
      { status: 409, reason: 'stale_version', detail: 'The product changed meanwhile.' },
      { status: 409, statusText: 'Conflict' },
    );
    await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
    confirm.settle(false);
    await saving;

    http.expectNone('/api/v1/products/p1');
    expect(page.form.controls['name'].value).toBe('My local edit');
    expect(page.version()).toBe(7);
    expect(toasts.toasts().filter((t) => t.kind === 'error')).toEqual([]);
  });
});
