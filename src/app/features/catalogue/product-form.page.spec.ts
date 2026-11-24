import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { Settings } from '../../core/api/models';
import { SettingsStore } from '../../core/format/settings.store';
import { SessionStore } from '../../core/session/session.store';
import ProductFormPage from './product-form.page';

/** The API as a new product's form uses it: empty lists in, the new product out. */
class FakeApi {
  readonly posts: { path: string; body: Record<string, unknown> }[] = [];

  get(): Promise<unknown> {
    return Promise.resolve([]);
  }

  post(path: string, body: Record<string, unknown>): Promise<unknown> {
    this.posts.push({ path, body });
    return Promise.resolve({ uid: 'p-new', name: body['name'], version: 0 });
  }

  put(): Promise<unknown> {
    return Promise.resolve({});
  }
}

describe('ProductFormPage: VAT category', () => {
  let api: FakeApi;

  beforeEach(() => {
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
    const branch = { uid: 'b1', code: 'HQ', name: 'Main' };
    session.enterAsRoot(
      { uid: 't1', code: 'AFYA', name: 'Afya', status: 'ACTIVE' } as never,
      [branch] as never,
      branch as never,
    );
  });

  async function open(settings: Partial<Settings>) {
    TestBed.inject(SettingsStore).set({
      currency: 'TZS',
      acceptedCurrencies: ['TZS'],
      defaultTaxRatePercent: 18,
      ...settings,
    } as Settings);
    const fixture = TestBed.createComponent(ProductFormPage);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function choose(element: HTMLElement, category: string): void {
    const select = element.querySelector<HTMLSelectElement>('[data-testid="tax-category"]')!;
    select.value = category;
    select.dispatchEvent(new Event('change'));
  }

  function hint(element: HTMLElement): string {
    return element.querySelector('[data-testid="tax-rate-hint"]')!.textContent!.trim();
  }

  it('offers the three VAT categories; a new product is exempt', async () => {
    const { element } = await open({ vatRegistered: true });
    const options = [
      ...element.querySelectorAll<HTMLOptionElement>('[data-testid="tax-category"] option'),
    ].map((o) => o.value);
    expect(options).toEqual(['STANDARD', 'ZERO_RATED', 'EXEMPT']);
    expect(element.querySelector<HTMLSelectElement>('[data-testid="tax-category"]')!.value).toBe(
      'EXEMPT',
    );
    expect(hint(element)).toBe('Sold at 0% VAT');
  });

  it('a standard-rated product is sold at the pharmacy’s standard rate, and saved with it', async () => {
    const { fixture, element } = await open({ vatRegistered: true });
    choose(element, 'STANDARD');
    await fixture.whenStable();
    expect(hint(element)).toBe('Sold at 18% VAT');

    const name = element.querySelector<HTMLInputElement>('input[formcontrolname="name"]')!;
    name.value = 'Body Lotion';
    name.dispatchEvent(new Event('input'));
    const generic = element.querySelector<HTMLInputElement>('input[formcontrolname="genericName"]');
    if (generic) {
      generic.value = 'Lotion';
      generic.dispatchEvent(new Event('input'));
    }
    element.querySelector<HTMLButtonElement>('.sticky-actions .btn.primary')!.click();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
    expect(api.posts.length).toBe(1);
    expect(api.posts[0].path).toBe('/products');
    expect(api.posts[0].body['taxCategory']).toBe('STANDARD');
    expect(api.posts[0].body['taxRatePercent']).toBe(18);
  });

  it('tells a pharmacy that is not VAT-registered that it charges no VAT', async () => {
    const { fixture, element } = await open({ vatRegistered: false });
    choose(element, 'STANDARD');
    await fixture.whenStable();
    expect(hint(element)).toBe('The pharmacy is not VAT-registered, so no VAT is charged on it.');
  });
});
