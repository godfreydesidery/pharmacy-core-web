import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Translations } from './translations.store';

/** The product name some titles end with (the pages outside the signed-in shell). */
const SUFFIX = ' · Pharmacy Core';

/**
 * The dictionary key of a route's English title: `title.` and the title in lower case with dashes,
 * without the product suffix: "Sign in · Pharmacy Core" → `title.sign-in`, "Payers & schemes" →
 * `title.payers-and-schemes`.
 */
export function titleKey(english: string): string {
  const base = english.endsWith(SUFFIX) ? english.slice(0, -SUFFIX.length) : english;
  return (
    'title.' +
    base
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/** A route's title in the chosen language (English when the key is missing), suffix kept. */
export function translatedTitle(english: string, translations: Translations): string {
  const suffix = english.endsWith(SUFFIX) ? SUFFIX : '';
  const base = suffix ? english.slice(0, -suffix.length) : english;
  return translations.t(titleKey(english), undefined, base) + suffix;
}

/**
 * The browser tab's title (i18n-1): the route's `title` (written in English in the routes) shown in
 * the chosen language, and shown again when the language changes.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translations = inject(Translations);
  private readonly english = signal<string | null>(null);

  constructor() {
    super();
    effect(() => {
      const english = this.english();
      if (english) {
        this.title.setTitle(translatedTitle(english, this.translations));
      }
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const english = this.buildTitle(snapshot);
    if (english) {
      this.english.set(english);
      this.title.setTitle(translatedTitle(english, this.translations));
    }
  }
}
