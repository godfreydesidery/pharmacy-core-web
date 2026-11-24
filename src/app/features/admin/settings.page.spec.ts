import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { Settings } from '../../core/api/models';
import SettingsPage from './settings.page';

const SETTINGS: Settings = {
  currency: 'TZS',
  timezone: 'Africa/Dar_es_Salaam',
  defaultTaxRatePercent: 18,
  invoicePrefix: 'INV',
  receiptFooter: null,
  maxDiscountPercent: 10,
  expiryAlertDays: 90,
  lowStockAlerts: true,
  smsReceipts: false,
  acceptedCurrencies: ['TZS'],
  pricesIncludeTax: true,
  look: 'PREMIUM',
  idleMinutes: 15,
  approvalLimit: 50000,
  returnWindowDays: 7,
  requireOpenShift: true,
  vatRegistered: true,
  tin: '123456789',
  vrn: null,
};

/** The API as the settings page uses it: the settings in, the change out. */
class FakeApi {
  readonly puts: { path: string; body: Record<string, unknown> }[] = [];

  get(path: string): Promise<unknown> {
    if (path === '/settings') return Promise.resolve({ ...SETTINGS });
    return Promise.resolve([]);
  }

  put(path: string, body: Record<string, unknown>): Promise<unknown> {
    this.puts.push({ path, body });
    return Promise.resolve({ ...SETTINGS, ...body });
  }

  post(): Promise<unknown> {
    return Promise.resolve({});
  }
}

describe('SettingsPage: VAT registration', () => {
  let api: FakeApi;

  beforeEach(() => {
    api = new FakeApi();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
  });

  async function open() {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, testId: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function save(fixture: { whenStable(): Promise<unknown> }, element: HTMLElement) {
    element.querySelector<HTMLButtonElement>('.page-head .btn.primary')!.click();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
    await fixture.whenStable();
  }

  it('shows the registration, the TIN and VRN, and warns when one of them is missing', async () => {
    const { element } = await open();
    const registered = element.querySelector<HTMLInputElement>(
      '[data-testid="vat-registered"] input',
    )!;
    expect(registered.checked).toBe(true);
    expect(element.querySelector<HTMLInputElement>('[data-testid="vat-tin"]')!.value).toBe(
      '123456789',
    );
    expect(element.querySelector('[data-testid="vat-numbers-missing"]')).toBeTruthy();
    expect(element.textContent).toContain('Standard VAT rate %');
  });

  it('saves the TIN and the VRN (upper case), and the warning goes', async () => {
    const { fixture, element } = await open();
    type(element, 'vat-tin', '123-456-789');
    type(element, 'vat-vrn', '40-012345-a');
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="vat-numbers-missing"]')).toBeNull();

    await save(fixture, element);
    expect(api.puts.length).toBe(1);
    expect(api.puts[0].body['vatRegistered']).toBe(true);
    expect(api.puts[0].body['tin']).toBe('123-456-789');
    expect(api.puts[0].body['vrn']).toBe('40-012345-A');
  });

  it('switches VAT registration off', async () => {
    const { fixture, element } = await open();
    const registered = element.querySelector<HTMLInputElement>(
      '[data-testid="vat-registered"] input',
    )!;
    registered.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="vat-numbers-missing"]')).toBeNull();
    await save(fixture, element);
    expect(api.puts[0].body['vatRegistered']).toBe(false);
  });

  it('does not send a TIN that is not 9 digits', async () => {
    const { fixture, element } = await open();
    type(element, 'vat-tin', '12345');
    await save(fixture, element);
    expect(api.puts.length).toBe(0);
  });
});
