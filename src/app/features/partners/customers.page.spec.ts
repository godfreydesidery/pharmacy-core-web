import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { apiInterceptor } from '../../core/api/api.interceptor';
import { Customer } from '../../core/api/models';
import { ConfirmService } from '../../core/ui/confirm';
import CustomersPage from './customers.page';

/** The page's members these tests drive (protected in the component). */
interface Page {
  form: FormGroup;
  edit(customer: Customer | null): void;
  save(): Promise<void>;
}

function customer(version: number, phone: string | null = null): Customer {
  return {
    uid: 'c1',
    code: 'C00001',
    name: 'Amina Juma',
    phone,
    email: null,
    type: 'RETAIL',
    insuranceProvider: null,
    insuranceNumber: null,
    creditLimit: 0,
    address: null,
    active: true,
    paymentTerms: 'NET_30',
    version,
    createdAt: '2026-11-01T08:00:00Z',
  };
}

const ok = (data: unknown) => ({ success: true, data });

describe('CustomersPage saves with If-Match (STD-10)', () => {
  let http: HttpTestingController;
  let confirm: ConfirmService;
  let page: Page;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CustomersPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    confirm = TestBed.inject(ConfirmService);
    const fixture = TestBed.createComponent(CustomersPage);
    fixture.detectChanges();
    page = fixture.componentInstance as unknown as Page;
  });

  /** Answers the list reads (empty pages) until {@code saving} is done; the list is not looked at. */
  async function finish(saving: Promise<void>): Promise<void> {
    let done = false;
    void saving.then(() => (done = true));
    await vi.waitFor(() => {
      for (const read of http.match((r) => r.method === 'GET' && r.url === '/api/v1/customers')) {
        read.flush(ok({ items: [], nextCursor: null, total: 0 }));
      }
      expect(done).toBe(true);
    });
  }

  it('sends the version of the customer as listed', async () => {
    page.edit(customer(5));
    page.form.controls['phone'].setValue('0712345678');
    const saving = page.save();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/v1/customers/c1');
    expect(put.request.headers.get('If-Match')).toBe('"5"');
    put.flush(ok(customer(6, '0712345678')));
    await finish(saving);
  });

  it('on 412 Reload reads the customer again into the open form', async () => {
    page.edit(customer(5));
    page.form.controls['phone'].setValue('0700000000');
    const saving = page.save();
    http
      .expectOne((r) => r.method === 'PUT' && r.url === '/api/v1/customers/c1')
      .flush(
        { status: 412, reason: 'precondition_failed', detail: 'Changed.', currentVersion: 6 },
        { status: 412, statusText: 'Precondition Failed' },
      );
    await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
    confirm.settle(true);
    const read = await vi.waitFor(() =>
      http.expectOne((r) => r.method === 'GET' && r.url === '/api/v1/customers/c1'),
    );
    read.flush(ok(customer(6, '0755555555')), { headers: { ETag: '"6"' } });
    await saving;
    expect(page.form.controls['phone'].value).toBe('0755555555');

    page.form.controls['name'].setValue('Amina J. Mussa');
    const next = page.save();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/v1/customers/c1');
    expect(put.request.headers.get('If-Match')).toBe('"6"');
    put.flush(ok(customer(7, '0755555555')));
    await finish(next);
  });
});
