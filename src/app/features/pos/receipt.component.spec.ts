import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { Api } from '../../core/api/api.service';
import { Sale } from '../../core/api/models';
import { Translations } from '../../core/i18n/translations.store';
import { ReceiptComponent } from './receipt.component';

const SALE = {
  uid: 's1',
  number: 'INV-HQ-000001',
  branchName: 'Main',
  customerName: null,
  cashierName: 'Amina',
  createdAt: '2026-11-23T10:00:00Z',
  subtotal: 3000,
  discountTotal: 0,
  taxTotal: 0,
  total: 3000,
  changeDue: 0,
  priceListName: null,
  payments: [{ method: 'CASH', amount: 3000, reference: null }],
  lines: [
    {
      uid: 'l1',
      productName: 'Paracetamol 500mg',
      quantity: 2,
      lineTotal: 3000,
      batchNumber: 'B-77',
      expiryDate: '2029-08-31',
      serialNumbers: [],
      warrantyEndsOn: null,
    },
  ],
  fiscalDocuments: [],
} as unknown as Sale;

@Component({
  imports: [ReceiptComponent],
  template: `<app-receipt [sale]="sale()" />`,
})
class Host {
  readonly sale = signal(SALE);
}

describe('ReceiptComponent (i18n-1: the printed receipt follows the language)', () => {
  beforeEach(() => {
    localStorage.removeItem('pharmacy.lang');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: {} }],
    });
  });

  async function text(): Promise<string> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('prints the batch and expiry in English', async () => {
    TestBed.inject(Translations).use('en');
    expect(await text()).toContain('Batch B-77 · exp');
  });

  it('prints them in Swahili, with no English words left', async () => {
    const translations = TestBed.inject(Translations);
    translations.use('sw');
    await translations.load('sw');
    const printed = await text();
    expect(printed).toContain('Bechi B-77 · inaisha');
    expect(printed).not.toContain('Batch');
    expect(printed).not.toContain(' exp ');
    translations.use('en');
  });
});
