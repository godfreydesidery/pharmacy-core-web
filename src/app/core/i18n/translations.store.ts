import { Injectable, computed, effect, signal } from '@angular/core';
import { setFormatLocale } from '../format/format';
import { EN } from './en';

export type Lang = 'en' | 'sw';
export type Dictionary = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number | null | undefined>>;

export const LANGUAGES: ReadonlyArray<{ code: Lang; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'sw', label: 'Swahili', native: 'Kiswahili' },
];

/**
 * English ships in the first download (every key's fallback); Swahili is a separate chunk, loaded
 * when chosen. Until it arrives, text shows in English.
 */
const LOADERS: Readonly<Record<Lang, () => Promise<Dictionary>>> = {
  en: () => Promise.resolve(EN),
  sw: () => import('./sw').then((m) => m.SW),
};
const STORAGE_KEY = 'pharmacy.lang';
const LOCALES: Readonly<Record<Lang, string>> = { en: 'en-TZ', sw: 'sw-TZ' };

/**
 * Runtime translations as signals: switching language re-renders every template that reads a
 * translation, with no reload. Keys are `area.key`, such as `nav.dashboard` or
 * `dashboard.sales`; a key missing in Swahili falls back to English, then to the fallback text
 * given by the caller, then to the key itself. `{{name}}` placeholders take `params`.
 */
@Injectable({ providedIn: 'root' })
export class Translations {
  /** The app's instance, for plain functions (such as form messages) that cannot inject. */
  static current: Translations | null = null;

  readonly lang = signal<Lang>(Translations.stored());
  /** The dictionaries loaded so far; English always. */
  private readonly loaded = signal<Partial<Record<Lang, Dictionary>>>({ en: EN });
  /** The Intl locale for numbers and dates, such as `sw-TZ`. */
  readonly locale = computed(() => LOCALES[this.lang()]);

  constructor() {
    Translations.current = this;
    effect(() => {
      const lang = this.lang();
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* private mode: the choice lasts for this tab only */
      }
      document.documentElement.lang = lang;
      setFormatLocale(LOCALES[lang]);
    });
  }

  use(lang: Lang): void {
    this.lang.set(lang);
    void this.load(lang);
  }

  /**
   * Loads `lang`'s dictionary (once). The app awaits the stored language before it starts, so a
   * Swahili user never sees English first.
   */
  async load(lang: Lang = this.lang()): Promise<void> {
    if (this.loaded()[lang]) {
      return;
    }
    const dictionary = await LOADERS[lang]();
    this.loaded.update((all) => ({ ...all, [lang]: dictionary }));
  }

  /** The text of `key` in the current language; reading it tracks the language signal. */
  t(key: string, params?: Params, fallback?: string): string {
    return translate(this.loaded()[this.lang()] ?? EN, key, params, fallback);
  }

  private static stored(): Lang {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'en' || value === 'sw') {
        return value;
      }
    } catch {
      /* no storage */
    }
    return navigator.language?.toLowerCase().startsWith('sw') ? 'sw' : 'en';
  }
}

/** The text of `key` in `dictionary`, falling back to English, then `fallback`, then the key. */
export function translate(
  dictionary: Dictionary,
  key: string,
  params?: Params,
  fallback?: string,
): string {
  const text = dictionary[key] ?? EN[key] ?? fallback ?? key;
  if (!params) {
    return text;
  }
  return text.replace(/\{\{\s*(\w+)\s*}}/g, (whole, name: string) => {
    const value = params[name];
    return value === null || value === undefined ? '' : String(value);
  });
}
