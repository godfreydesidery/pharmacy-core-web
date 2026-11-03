import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { EN } from './en';
import { SW } from './sw';
import { Translations, translate } from './translations.store';

describe('translate', () => {
  it('uses the dictionary, then English, then the fallback, then the key', () => {
    expect(translate({ 'a.b': 'Swahili' }, 'a.b')).toBe('Swahili');
    expect(translate({}, 'nav.dashboard')).toBe(EN['nav.dashboard']);
    expect(translate({}, 'nowhere.key', undefined, 'Fallback')).toBe('Fallback');
    expect(translate({}, 'nowhere.key')).toBe('nowhere.key');
  });

  it('fills {{placeholders}}, leaving missing ones empty', () => {
    expect(translate({ k: 'last {{days}} days{{x}}' }, 'k', { days: 30 })).toBe('last 30 days');
  });
});

describe('dictionaries', () => {
  it('Swahili defines no key English lacks', () => {
    expect(Object.keys(SW).filter((key) => !(key in EN))).toEqual([]);
  });
});

describe('Translations', () => {
  beforeEach(() => localStorage.removeItem('pharmacy.lang'));

  it('switches language at runtime and persists the choice', () => {
    const translations = TestBed.inject(Translations);
    translations.use('sw');
    expect(translations.t('nav.sales')).toBe('Mauzo');
    expect(translations.locale()).toBe('sw-TZ');
    TestBed.tick();
    expect(localStorage.getItem('pharmacy.lang')).toBe('sw');
    expect(document.documentElement.lang).toBe('sw');
    translations.use('en');
    expect(translations.t('nav.sales')).toBe('Sales');
  });

  it('falls back to English for a key Swahili lacks', () => {
    const translations = TestBed.inject(Translations);
    translations.use('sw');
    expect(translations.t('only.in.fallback', undefined, 'Fallback text')).toBe('Fallback text');
  });
});
