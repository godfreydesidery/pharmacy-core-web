import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { apiInterceptor } from '../../core/api/api.interceptor';
import { Settings } from '../../core/api/models';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import SettingsPage from './settings.page';

/** The page's members these tests drive (protected in the component). */
interface Page {
  form: FormGroup;
  settings: Signal<Settings | null>;
  save(): Promise<void>;
}

function settings(version: number, receiptFooter: string | null = null): Settings {
  return {
    currency: 'TZS',
    timezone: 'Africa/Dar_es_Salaam',
    defaultTaxRatePercent: 18,
    invoicePrefix: 'INV',
    receiptFooter,
    maxDiscountPercent: 10,
    expiryAlertDays: 90,
    lowStockAlerts: true,
    smsReceipts: false,
    acceptedCurrencies: ['TZS'],
    pricesIncludeTax: false,
    look: 'PREMIUM',
    idleMinutes: 15,
    requireTwoFactor: false,
    approvalLimit: 50000,
    returnWindowDays: 7,
    requireOpenShift: false,
    version,
  };
}

const ok = (data: unknown) => ({ success: true, data });

describe('SettingsPage saves with If-Match (STD-10)', () => {
  let http: HttpTestingController;
  let confirm: ConfirmService;
  let toasts: ToastService;
  let page: Page;
  /** What GET /settings answers now. */
  let onServer: Settings;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    confirm = TestBed.inject(ConfirmService);
    toasts = TestBed.inject(ToastService);
    onServer = settings(3);
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    page = fixture.componentInstance as unknown as Page;
    await settle();
    expect(page.settings()?.version).toBe(3);
  });

  /** Answers every read the page has sent: the settings as on the server, the rest empty. */
  function serveReads(): number {
    const reads = http.match((r) => r.method === 'GET');
    for (const read of reads) {
      if (read.request.url === '/api/v1/settings') {
        read.flush(ok(onServer), { headers: { ETag: `"${onServer.version}"` } });
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

  function nextSave(): TestRequest {
    return http.expectOne((r) => r.method === 'PUT' && r.url === '/api/v1/settings');
  }

  it('sends the version it loaded, and the saved version on the next save', async () => {
    page.form.controls['receiptFooter'].setValue('Asante!');
    const first = page.save();
    const put = nextSave();
    expect(put.request.headers.get('If-Match')).toBe('"3"');
    put.flush(ok(settings(4, 'Asante!')), { headers: { ETag: '"4"' } });
    await first;

    page.form.controls['expiryAlertDays'].setValue(120);
    const second = page.save();
    const again = nextSave();
    expect(again.request.headers.get('If-Match')).toBe('"4"');
    again.flush(ok({ ...settings(5, 'Asante!'), expiryAlertDays: 120 }));
    await second;
    expect(page.settings()?.version).toBe(5);
  });

  it('on 412 asks in the dialog, and Reload reads the settings again into the form', async () => {
    page.form.controls['receiptFooter'].setValue('My local footer');
    const saving = page.save();
    nextSave().flush(
      {
        status: 412,
        reason: 'precondition_failed',
        detail: 'The settings changed meanwhile.',
        currentVersion: 4,
      },
      { status: 412, statusText: 'Precondition Failed' },
    );
    await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
    expect(confirm.current()!.text).toBe(
      'Someone else changed this; reload to see their change. Reloading drops the changes you made here.',
    );
    expect(toasts.toasts().filter((t) => t.kind === 'error')).toEqual([]);

    onServer = settings(4, 'Karibu tena');
    confirm.settle(true);
    await vi.waitFor(() => expect(serveReads()).toBeGreaterThan(0));
    await settle();
    await saving;
    expect(page.form.controls['receiptFooter'].value).toBe('Karibu tena');
    expect(page.settings()?.version).toBe(4);

    const next = page.save();
    const put = nextSave();
    expect(put.request.headers.get('If-Match')).toBe('"4"');
    put.flush(ok(settings(5, 'Karibu tena')));
    await next;
  });
});
