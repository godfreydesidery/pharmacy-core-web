import { Pipe, PipeTransform, inject } from '@angular/core';
import { Params, Translations } from './translations.store';

/**
 * `{{ 'nav.dashboard' | t }}`, `{{ 'dashboard.subtitle' | t: { tenant: name } }}` or, for keys
 * built at runtime, `{{ key | t: null : 'English fallback' }}`. Impure, so it follows the language
 * signal.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly translations = inject(Translations);

  transform(key: string | null | undefined, params?: Params | null, fallback?: string): string {
    if (!key) {
      return fallback ?? '';
    }
    return this.translations.t(key, params ?? undefined, fallback);
  }
}
