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
    const lang = this.lang();
    return translate(this.loaded()[lang] ?? EN, key, params, fallback, LOCALES[lang]);
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

/**
 * The text of `key` in `dictionary`, falling back to English, then `fallback`, then the key.
 * `{{name}}` takes `params.name`. A plural takes the ICU form, chosen by the language's plural rules
 * (`Intl.PluralRules` of `locale`): `{count, plural, =0 {no lines} one {# line} other {# lines}}`,
 * `#` being the number; the options may hold `{{placeholders}}` too.
 */
export function translate(
  dictionary: Dictionary,
  key: string,
  params?: Params,
  fallback?: string,
  locale = 'en-TZ',
): string {
  const text = dictionary[key] ?? EN[key] ?? fallback ?? key;
  if (!params) {
    return text;
  }
  return plurals(text, params, locale).replace(/\{\{\s*(\w+)\s*}}/g, (whole, name: string) => {
    const value = params[name];
    return value === null || value === undefined ? '' : String(value);
  });
}

const PLURAL_START = /\{\s*(\w+)\s*,\s*plural\s*,/g;
const pluralRules = new Map<string, Intl.PluralRules>();

/** Each `{name, plural, ...}` block of `text` replaced by the option its number takes. */
function plurals(text: string, params: Params, locale: string): string {
  if (!text.includes('plural')) {
    return text;
  }
  let out = '';
  let from = 0;
  PLURAL_START.lastIndex = 0;
  for (let m = PLURAL_START.exec(text); m; m = PLURAL_START.exec(text)) {
    const end = closing(text, m.index);
    if (end < 0) {
      break;
    }
    const options = parseOptions(text.slice(m.index + m[0].length, end));
    const count = Number(params[m[1]] ?? 0);
    let rules = pluralRules.get(locale);
    if (!rules) {
      rules = new Intl.PluralRules(locale);
      pluralRules.set(locale, rules);
    }
    const chosen = options[`=${count}`] ?? options[rules.select(count)] ?? options['other'] ?? '';
    out += text.slice(from, m.index) + chosen.replace(/#/g, count.toLocaleString(locale));
    from = end + 1;
    PLURAL_START.lastIndex = from;
  }
  return out + text.slice(from);
}

/** The index of the `}` closing the `{` at `open`, or -1. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** `one {# line} other {# lines}` as `{ one: '# line', other: '# lines' }`. */
function parseOptions(body: string): Record<string, string> {
  const options: Record<string, string> = {};
  const selector = /\s*(=\d+|zero|one|two|few|many|other)\s*\{/g;
  for (let m = selector.exec(body); m; m = selector.exec(body)) {
    const open = m.index + m[0].length - 1;
    const end = closing(body, open);
    if (end < 0) {
      break;
    }
    options[m[1]] = body.slice(open + 1, end);
    selector.lastIndex = end + 1;
  }
  return options;
}
