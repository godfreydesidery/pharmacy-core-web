import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../core/api/api-error';
import { Api, Query, RequestOptions } from '../core/api/api.service';
import { Settings } from '../core/api/models';
import { SettingsStore } from '../core/format/settings.store';
import { SessionStore } from '../core/session/session.store';
import { ConfirmOptions, ConfirmService } from '../core/ui/confirm';
import AdjustmentsPage from './inventory/adjustments.page';
import SupplierPaymentsPage from './finance/supplier-payments.page';
import ReceiptFormPage from './purchasing/receipt-form.page';
import SaleDetailPage from './sales/sale-detail.page';

/** A stand-in for the API: lists are empty, the sale is a fixed one, every POST is recorded. */
class FakeApi {
  readonly posts: { path: string; body: unknown }[] = [];
  readonly answers = new Map<string, unknown>();

  get<T>(path: string, _query?: Query, _options?: RequestOptions): Promise<T> {
    if (this.answers.has(path)) {
      return Promise.resolve(this.answers.get(path) as T);
    }
    if (/\/batches$/.test(path)) {
      return Promise.resolve([{ uid: 'bt1', batchNumber: 'B-77', quantity: 10 }] as T);
    }
    return Promise.resolve({ items: [], nextCursor: null } as T);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    this.posts.push({ path, body });
    return Promise.resolve({ uid: 'x1', number: 'N-1', refundTotal: 0 } as T);
  }

  put<T>(): Promise<T> {
    return Promise.reject(new ApiError(404, 'not_found', 'Not found'));
  }

  delete<T>(): Promise<T> {
    return Promise.reject(new ApiError(404, 'not_found', 'Not found'));
  }
}

type Saving = { save(): Promise<void>; form: FormGroup };

/**
 * UX-12: posting a goods receipt, a stock adjustment, a supplier payment or a refund asks first in
 * the app's dialog, with the figures, and nothing is sent when the answer is no.
 */
describe('postings are confirmed with their figures (UX-12)', () => {
  let api: FakeApi;
  let asked: ConfirmOptions[];
  let answer: boolean;

  beforeEach(() => {
    api = new FakeApi();
    asked = [];
    answer = false;
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
    TestBed.inject(SettingsStore).set({
      currency: 'TZS',
      acceptedCurrencies: ['TZS'],
    } as Settings);
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockImplementation((options) => {
      asked.push(options);
      return Promise.resolve(answer);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function open<T>(page: Type<T>, inputs: Record<string, unknown> = {}): Promise<T> {
    const fixture = TestBed.createComponent(page);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  const details = () => (asked[0]?.details ?? []).map((d) => `${d.label}: ${d.value}`).join(' | ');

  it('a stock adjustment: product, batch, units and reason; nothing sent on No', async () => {
    const page = (await open(AdjustmentsPage)) as unknown as Saving & {
      pickProduct(p: unknown): Promise<void>;
    };
    await page.pickProduct({ uid: 'p1', name: 'Paracetamol 500mg', trackingMode: 'BATCH_EXPIRY' });
    page.form.patchValue({
      batchUid: 'bt1',
      quantityChange: -3,
      reasonCode: 'DAMAGE',
      note: 'Wet',
    });
    await page.save();
    expect(asked).toHaveLength(1);
    expect(details()).toContain('Paracetamol 500mg');
    expect(details()).toContain('B-77');
    expect(details()).toContain('3 units off the stock');
    expect(details()).toContain('Damage');
    expect(api.posts).toEqual([]);
    answer = true;
    await page.save();
    expect(api.posts.map((p) => p.path)).toEqual(['/stock/adjustments']);
  });

  it('a supplier payment: supplier, amount, method and receipts', async () => {
    const page = (await open(SupplierPaymentsPage)) as unknown as Saving & {
      openForm(): void;
      pickSupplier(s: unknown): Promise<void>;
    };
    page.openForm();
    await page.pickSupplier({ uid: 's1', name: 'Medisupply Ltd' });
    page.form.patchValue({ amount: 250000, paymentMethod: 'BANK_TRANSFER' });
    await page.save();
    expect(details()).toContain('Medisupply Ltd');
    expect(details()).toContain('250,000');
    expect(details()).toContain('Bank transfer');
    expect(details()).toContain('on account');
    expect(api.posts).toEqual([]);
  });

  it('a goods receipt: supplier, lines, units and total', async () => {
    const page = (await open(ReceiptFormPage)) as unknown as Saving & {
      addProduct(p: unknown): void;
      pickedSupplier: { set(v: string): void };
    };
    page.form.patchValue({ supplierUid: 's1' });
    page.pickedSupplier.set('Medisupply Ltd');
    page.addProduct({
      uid: 'p1',
      name: 'Paracetamol 500mg',
      costPrice: 1000,
      trackingMode: 'QUANTITY',
    });
    const line = (page.form.get('lines') as unknown as { at(i: number): FormGroup }).at(0);
    line.patchValue({ quantity: 12, unitCost: 1000 });
    await page.save();
    expect(asked).toHaveLength(1);
    expect(details()).toContain('Medisupply Ltd');
    expect(details()).toContain('1 line · 12 units');
    expect(details()).toContain('12,000');
    expect(api.posts).toEqual([]);
  });

  it('a refund: items, amount and how it is paid back', async () => {
    api.answers.set('/sales/sale-1', {
      uid: 'sale-1',
      number: 'INV-1',
      status: 'COMPLETED',
      lines: [
        {
          uid: 'l1',
          productUid: 'p1',
          productName: 'Paracetamol 500mg',
          quantity: 4,
          returnedQuantity: 0,
          lineTotal: 6000,
          serialNumbers: [],
          returnedSerialNumbers: [],
          schedule: 'OTC',
        },
      ],
      payments: [{ method: 'CASH', amount: 6000 }],
      fiscalDocuments: [],
    });
    const page = (await open(SaleDetailPage, { uid: 'sale-1' })) as unknown as {
      submitReturn(): Promise<void>;
      quantities: { set(v: Record<string, number>): void };
      reason: { set(v: string): void };
      sale: { reload(): Promise<void>; value(): unknown };
    };
    await page.sale.reload();
    page.quantities.set({ l1: 2 });
    page.reason.set('Wrong strength');
    await page.submitReturn();
    expect(asked).toHaveLength(1);
    expect(details()).toContain('1 line · 2 units');
    expect(details()).toContain('3,000');
    expect(details()).toContain('Cash');
    expect(api.posts).toEqual([]);
  });
});
