import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { Settings } from '../../core/api/models';
import SettingsPage from './settings.page';
import { SessionStore } from '../../core/session/session.store';

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
  version: 1,
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

describe('SettingsPage: shared counter PCs, stock write-down and VAT apportionment', () => {
  let api: FakeApi;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    api = new FakeApi();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
  });

  async function settle(fixture: { whenStable(): Promise<unknown> }) {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
    await fixture.whenStable();
  }

  async function open() {
    const fixture = TestBed.createComponent(SettingsPage);
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, testId: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function save(fixture: { whenStable(): Promise<unknown> }, element: HTMLElement) {
    element.querySelector<HTMLButtonElement>('.page-head .btn.primary')!.click();
    await settle(fixture);
  }

  it('shows the default write-down bands and sends them with the other settings', async () => {
    const { fixture, element } = await open();
    expect(element.querySelector<HTMLInputElement>('[data-testid="band-days-1"]')!.value).toBe(
      '30',
    );
    expect(element.querySelector<HTMLInputElement>('[data-testid="band-percent-1"]')!.value).toBe(
      '50',
    );
    expect(element.textContent).toContain('accountant should confirm');
    type(element, 'band-percent-2', '20');
    await save(fixture, element);
    expect(api.puts.length).toBe(1);
    expect(api.puts[0].body['expiryProvisionEnabled']).toBe(true);
    expect(api.puts[0].body['expiryProvisionBands']).toEqual([
      { daysToExpiry: 0, percent: 100 },
      { daysToExpiry: 30, percent: 50 },
      { daysToExpiry: 90, percent: 20 },
    ]);
  });

  it('does not send bands whose days do not rise', async () => {
    const { fixture, element } = await open();
    type(element, 'band-days-2', '20');
    await settle(fixture);
    expect(element.querySelector('[data-testid="bands-error"]')).toBeTruthy();
    await save(fixture, element);
    expect(api.puts.length).toBe(0);
  });

  it('adds bands up to five and removes them', async () => {
    const { fixture, element } = await open();
    const add = element.querySelector<HTMLButtonElement>('[data-testid="band-add"]')!;
    add.click();
    await settle(fixture);
    add.click();
    await settle(fixture);
    expect(element.querySelectorAll('[data-testid^="band-days-"]').length).toBe(5);
    expect(add.disabled).toBe(true);
    element.querySelector<HTMLButtonElement>('[data-testid="band-remove-0"]')!.click();
    await settle(fixture);
    expect(element.querySelectorAll('[data-testid^="band-days-"]').length).toBe(4);
  });

  it('needs the recoverable percentage for the fixed method, then sends it', async () => {
    const { fixture, element } = await open();
    const method = element.querySelector<HTMLSelectElement>('[data-testid="apportion-method"]')!;
    method.value = 'FIXED';
    method.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(element.querySelector('[data-testid="apportion-fixed-missing"]')).toBeTruthy();
    await save(fixture, element);
    expect(api.puts.length).toBe(0);

    type(element, 'apportion-fixed', '62.5');
    await save(fixture, element);
    expect(api.puts.length).toBe(1);
    expect(api.puts[0].body['vatApportionmentMethod']).toBe('FIXED');
    expect(api.puts[0].body['vatFixedRecoverablePercent']).toBe(62.5);
    expect(api.puts[0].body['vatYearEndMonth']).toBe(12);
  });

  it('turns shared counter PCs on, and the session moves to this tab only', async () => {
    const { fixture, element } = await open();
    const check = element.querySelector<HTMLInputElement>(
      '[data-testid="shared-counter-pcs"] input',
    )!;
    expect(check.checked).toBe(false);
    check.click();
    await save(fixture, element);
    expect(api.puts[0].body['sharedCounterPcs']).toBe(true);
    expect(TestBed.inject(SessionStore).sharedPc()).toBe(false); // nobody signed in here
  });
});
