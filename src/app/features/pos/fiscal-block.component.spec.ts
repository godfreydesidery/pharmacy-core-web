import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { FiscalDocument, Sale, Settings } from '../../core/api/models';
import { SettingsStore } from '../../core/format/settings.store';
import { FiscalBlockComponent, printedTin, qrDataUrl } from './fiscal-block.component';
import { ReceiptComponent } from './receipt.component';

function document(overrides: Partial<FiscalDocument> = {}): FiscalDocument {
  return {
    uid: 'doc-1',
    kind: 'RECEIPT',
    status: 'ISSUED',
    provider: 'simulator',
    branchUid: 'b1',
    sourceUid: 'sale-1',
    sourceNumber: 'INV-HQ-000123',
    saleUid: 'sale-1',
    businessDate: '2026-11-24',
    sellerTin: '123456789',
    sellerVrn: '40-012345-A',
    total: 2480,
    taxTotal: 180,
    receiptNumber: 'SIM-HQ-R00000042',
    verificationCode: 'A1B2C3D4E5',
    qrPayload: 'SIMULATED FISCAL RECEIPT|NO:SIM-HQ-R00000042',
    globalCounter: 42,
    dailyCounter: 7,
    issuedAt: '2026-11-24T08:00:01Z',
    attempts: 1,
    lastError: null,
    createdAt: '2026-11-24T08:00:00Z',
    z: null,
    ...overrides,
  };
}

function sale(documents: FiscalDocument[]): Sale {
  return {
    uid: 'sale-1',
    number: 'INV-HQ-000123',
    branchUid: 'b1',
    branchName: 'Main',
    customerUid: null,
    customerName: null,
    status: 'COMPLETED',
    discountPercent: 0,
    subtotal: 2480,
    discountTotal: 0,
    taxTotal: 180,
    total: 2480,
    paidTotal: 2480,
    changeDue: 0,
    lines: [],
    payments: [{ method: 'CASH', amount: 2480, reference: null }],
    prescription: null,
    cashierName: 'Amina',
    createdAt: '2026-11-24T08:00:00Z',
    fiscalStatus: documents[0]?.status ?? null,
    fiscalDocuments: documents,
  };
}

const shown = signal<Sale>(sale([]));

@Component({
  imports: [FiscalBlockComponent],
  template: `<app-fiscal-block [sale]="sale()" />`,
})
class Host {
  readonly sale = shown;
}

describe('printedTin', () => {
  it('prints a TIN kept as 9 digits in groups of three', () => {
    expect(printedTin('123456789')).toBe('123-456-789');
    expect(printedTin('12-34')).toBe('12-34');
    expect(printedTin(null)).toBeNull();
  });
});

describe('qrDataUrl', () => {
  it('draws the QR code as an SVG image, without a canvas', async () => {
    const url = await qrDataUrl('SIMULATED FISCAL RECEIPT');
    expect(url.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(url)).toContain('<svg');
  });
});

describe('FiscalBlockComponent (the receipt’s fiscal block)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: {} }],
    });
  });

  async function render(value: Sale, settings: Partial<Settings> | null = null) {
    if (settings) {
      TestBed.inject(SettingsStore).set(settings as Settings);
    }
    shown.set(value);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    // the QR code is drawn asynchronously
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.tick();
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('prints an issued receipt: TIN, VRN, number, verification code, counters and QR code', async () => {
    const element = await render(sale([document()]));
    const seller = element.querySelector('[data-testid="fiscal-seller"]')!.textContent!;
    expect(seller).toContain('TIN: 123-456-789');
    expect(seller).toContain('VRN: 40-012345-A');
    expect(element.querySelector('[data-testid="fiscal-number"]')!.textContent).toBe(
      'SIM-HQ-R00000042',
    );
    expect(element.textContent).toContain('A1B2C3D4E5');
    expect(element.textContent).toContain('GC 42 · DC 7');
    const qr = element.querySelector<HTMLImageElement>('[data-testid="fiscal-qr"]');
    expect(qr?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });

  it('says a receipt is pending until the tax authority answers, with no QR code', async () => {
    const element = await render(
      sale([document({ status: 'PENDING', receiptNumber: null, qrPayload: null })]),
    );
    expect(element.querySelector('[data-testid="fiscal-pending"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="fiscal-qr"]')).toBeNull();
    expect(element.querySelector('[data-testid="fiscal-number"]')).toBeNull();
  });

  it('says the tax authority refused a receipt', async () => {
    const element = await render(
      sale([document({ status: 'FAILED', receiptNumber: null, lastError: 'TIN unknown' })]),
    );
    expect(element.querySelector('[data-testid="fiscal-failed"]')).toBeTruthy();
  });

  it('lists the credit notes of the sale’s returns', async () => {
    const element = await render(
      sale([
        document(),
        document({
          uid: 'doc-2',
          kind: 'CREDIT_NOTE',
          sourceNumber: 'SRN-HQ-000001',
          receiptNumber: 'SIM-HQ-C00000043',
        }),
      ]),
    );
    const notes = element.querySelectorAll('[data-testid="fiscal-credit-note"]');
    expect(notes.length).toBe(1);
    expect(notes[0].textContent).toContain('SRN-HQ-000001');
    expect(notes[0].textContent).toContain('SIM-HQ-C00000043');
  });

  it('prints the pharmacy’s TIN and VRN without a fiscal integration, when VAT-registered', async () => {
    const element = await render(sale([]), {
      vatRegistered: true,
      tin: '987654321',
      vrn: '40-999999-B',
    });
    expect(element.querySelector('[data-testid="fiscal-seller"]')!.textContent).toContain(
      'TIN: 987-654-321',
    );
    expect(element.querySelector('[data-testid="fiscal-receipt"]')).toBeNull();
  });

  it('prints no TIN for a pharmacy that is not VAT-registered and has no fiscal receipt', async () => {
    const element = await render(sale([]), { vatRegistered: false, tin: '987654321' });
    expect(element.querySelector('[data-testid="fiscal-seller"]')).toBeNull();
  });

  it('is part of the printed receipt', async () => {
    const fixture = TestBed.createComponent(ReceiptComponent);
    fixture.componentRef.setInput('sale', sale([document()]));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-fiscal-block')).toBeTruthy();
    expect(element.querySelector('[data-testid="fiscal-number"]')!.textContent).toBe(
      'SIM-HQ-R00000042',
    );
  });
});
