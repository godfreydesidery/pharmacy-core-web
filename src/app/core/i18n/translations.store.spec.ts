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

  it('chooses the plural form by the language rules (i18n-1: no "1 lines")', () => {
    const lines = '{n, plural, =0 {no lines} one {# line} other {# lines}}';
    expect(translate({ k: lines }, 'k', { n: 0 })).toBe('no lines');
    expect(translate({ k: lines }, 'k', { n: 1 })).toBe('1 line');
    expect(translate({ k: lines }, 'k', { n: 2 })).toBe('2 lines');
    expect(translate({ k: lines }, 'k', { n: 1200 })).toBe('1,200 lines');
    expect(translate(EN, 'pos.linesAndUnits', { lines: 1, units: 1 })).toBe('1 line · 1 unit');
    expect(translate(EN, 'pos.linesAndUnits', { lines: 2, units: 5 })).toBe('2 lines · 5 units');
    expect(translate(SW, 'pos.linesAndUnits', { lines: 1, units: 3 }, undefined, 'sw-TZ')).toBe(
      'mstari 1 · vipimo 3',
    );
  });

  it('fills {{placeholders}} inside a plural option', () => {
    const text = '{{who}}: {n, plural, one {# claim for {{who}}} other {# claims}}';
    expect(translate({ k: text }, 'k', { who: 'NHIF', n: 1 })).toBe('NHIF: 1 claim for NHIF');
  });
});

describe('dictionaries', () => {
  it('Swahili defines no key English lacks', () => {
    expect(Object.keys(SW).filter((key) => !(key in EN))).toEqual([]);
  });

  it('writes every placeholder as {{name}}, which is the only form translate() fills', () => {
    const single = /(?<!\{)\{[a-zA-Z]+\}(?!\})/;
    const offending = [...Object.entries(EN), ...Object.entries(SW)]
      .filter(([, text]) => single.test(text))
      .map(([key]) => key);
    expect(offending).toEqual([]);
  });

  it('uses the same placeholders in English and Swahili', () => {
    const names = (text: string) =>
      [
        ...[...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]),
        ...[...text.matchAll(/\{(\w+), plural,/g)].map((m) => m[1]),
      ]
        .filter((name, i, all) => all.indexOf(name) === i)
        .sort();
    const mismatched = Object.keys(SW).filter(
      (key) => key in EN && names(SW[key]).join() !== names(EN[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('Translations', () => {
  beforeEach(() => localStorage.removeItem('pharmacy.lang'));

  it('switches language at runtime and persists the choice', async () => {
    const translations = TestBed.inject(Translations);
    translations.use('sw');
    // Swahili is a separate chunk: English shows until it has loaded.
    expect(translations.t('nav.sales')).toBe('Sales');
    await translations.load('sw');
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
