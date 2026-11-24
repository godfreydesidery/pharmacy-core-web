import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../core/api/api.service';
import StatementsPage from './statements.page';

const VAT = {
  from: '2026-11-01',
  to: '2026-11-30',
  outputVat: 1800,
  vatReversed: 0,
  netOutputVat: 1800,
  inputVat: 300,
  netPayable: 1500,
  categories: [],
  inputVatBeforeApportionment: 500,
  nonReclaimableInputVat: 200,
  reclaimableInputVat: 300,
  apportionments: [
    {
      uid: 'v1',
      period: '2026-11',
      kind: 'MONTHLY',
      method: 'AUTOMATIC',
      ratioPercent: 60,
      taxableSales: 6000,
      exemptSales: 4000,
      directTaxableVat: 0,
      directExemptVat: 0,
      residualVat: 500,
      nonReclaimable: 200,
      adjustment: 200,
      journalNumber: 'JV-2026-000042',
      createdAt: '2026-12-01T00:10:00Z',
    },
  ],
  debitNotes: { salesNet: 1000, salesTax: 180, purchasesNet: 0, purchasesVat: 0 },
};

const RUNS = [
  {
    uid: 'r1',
    period: '2026-11',
    measuredOn: '2026-11-30',
    enabled: true,
    bands: [{ daysToExpiry: 0, percent: 100 }],
    stockAtCost: 10000,
    provision: 700,
    previousProvision: 0,
    adjustment: 700,
    journalNumber: 'JV-2026-000041',
    branches: [
      {
        branchUid: 'b1',
        stockAtCost: 10000,
        provision: 700,
        bands: [{ daysToExpiry: 0, percent: 100, costAtRisk: 700, provision: 700 }],
      },
    ],
    createdAt: '2026-12-01T00:05:00Z',
  },
];

class FakeApi {
  get(path: string): Promise<unknown> {
    if (path === '/reports/vat') return Promise.resolve(VAT);
    if (path === '/reports/expiry-provision') return Promise.resolve(RUNS);
    return Promise.resolve(null);
  }
}

describe('Statements: VAT apportionment and the expiry write-down', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: new FakeApi() }],
    });
  });

  async function settle(fixture: { whenStable(): Promise<unknown> }) {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
    await fixture.whenStable();
  }

  function openTab(element: HTMLElement, label: string): void {
    [...element.querySelectorAll<HTMLButtonElement>('.tabs button')]
      .find((b) => b.textContent?.trim() === label)!
      .click();
  }

  it('shows reclaimable and non-reclaimable input VAT, the ratio and debit notes', async () => {
    const fixture = TestBed.createComponent(StatementsPage);
    const element = fixture.nativeElement as HTMLElement;
    await settle(fixture);
    openTab(element, 'VAT');
    await settle(fixture);
    const apportionment = element.querySelector('[data-testid="vat-apportionment"]')!;
    expect(apportionment.textContent).toContain('Not reclaimable');
    expect(element.textContent).toContain('60%');
    expect(element.textContent).toContain('JV-2026-000042');
    expect(element.querySelector('[data-testid="vat-debit-notes"]')).toBeTruthy();
  });

  it('lists the monthly expiry write-down by band', async () => {
    const fixture = TestBed.createComponent(StatementsPage);
    const element = fixture.nativeElement as HTMLElement;
    await settle(fixture);
    openTab(element, 'Expiry write-down');
    await settle(fixture);
    const run = element.querySelector('[data-testid="writedown-2026-11"]')!;
    expect(run.textContent).toContain('Expired');
    expect(run.textContent).toContain('JV-2026-000041');
  });
});
