import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Route, Router, Routes, TitleStrategy, provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { routes } from '../../app.routes';
import admin from '../../features/admin/admin.routes';
import catalogue from '../../features/catalogue/catalogue.routes';
import finance from '../../features/finance/finance.routes';
import insurance from '../../features/insurance/insurance.routes';
import inventory from '../../features/inventory/inventory.routes';
import platform from '../../features/platform/platform.routes';
import purchasing from '../../features/purchasing/purchasing.routes';
import receivables from '../../features/receivables/receivables.routes';
import sales from '../../features/sales/sales.routes';
import { EN } from './en';
import { SW } from './sw';
import { TranslatedTitleStrategy, titleKey } from './title.strategy';
import { Translations } from './translations.store';

function titles(list: Routes): string[] {
  return list.flatMap((route: Route) => [
    ...(typeof route.title === 'string' ? [route.title] : []),
    ...titles(route.children ?? []),
  ]);
}

@Component({ template: '' })
class Blank {}

describe('route titles (i18n-1)', () => {
  it('makes a key of an English title', () => {
    expect(titleKey('Sign in · Pharmacy Core')).toBe('title.sign-in');
    expect(titleKey('Payers & schemes')).toBe('title.payers-and-schemes');
    expect(titleKey('Point of Sale')).toBe('title.point-of-sale');
  });

  it('has every route title in English and in Swahili', () => {
    const all = titles([
      ...routes,
      ...admin,
      ...catalogue,
      ...finance,
      ...insurance,
      ...inventory,
      ...platform,
      ...purchasing,
      ...receivables,
      ...sales,
    ]);
    expect(all.length).toBeGreaterThan(60);
    const missing = all.map(titleKey).filter((key) => !EN[key] || !SW[key]);
    expect(missing).toEqual([]);
  });

  describe('TranslatedTitleStrategy', () => {
    beforeEach(() => {
      localStorage.removeItem('pharmacy.lang');
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            { path: 'stock', title: 'Stock adjustments', component: Blank },
            { path: 'in', title: 'Sign in · Pharmacy Core', component: Blank },
          ]),
          { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
        ],
      });
    });

    it('shows the tab title in the chosen language, and again when it changes', async () => {
      const translations = TestBed.inject(Translations);
      translations.use('en');
      const router = TestBed.inject(Router);
      const title = TestBed.inject(Title);
      await router.navigateByUrl('/stock');
      expect(title.getTitle()).toBe('Stock adjustments');
      translations.use('sw');
      await translations.load('sw');
      TestBed.tick();
      expect(title.getTitle()).toBe('Marekebisho ya stoo');
      await router.navigateByUrl('/in');
      expect(title.getTitle()).toBe('Ingia · Pharmacy Core');
      translations.use('en');
    });
  });
});
