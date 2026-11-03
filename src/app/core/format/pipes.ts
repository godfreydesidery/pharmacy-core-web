import { Pipe, PipeTransform, inject } from '@angular/core';
import { Translations } from '../i18n/translations.store';
import { SettingsStore } from './settings.store';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  humanize,
} from './format';

/** An amount in the tenant's currency. Impure so it follows the currency once settings load. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly settings = inject(SettingsStore);

  transform(amount: number | null | undefined, currency?: string): string {
    return formatMoney(amount, currency ?? this.settings.currency());
  }
}

/** A compact amount for KPI tiles and narrow cards, such as TZS 29.9K. */
@Pipe({ name: 'compactMoney', pure: false })
export class CompactMoneyPipe implements PipeTransform {
  private readonly settings = inject(SettingsStore);

  transform(amount: number | null | undefined, currency?: string): string {
    return formatMoneyCompact(amount, currency ?? this.settings.currency());
  }
}

@Pipe({ name: 'num' })
export class NumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatNumber(value);
  }
}

@Pipe({ name: 'day' })
export class DayPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDate(value);
  }
}

@Pipe({ name: 'when' })
export class WhenPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDateTime(value);
  }
}

/**
 * An enum value as words in the current language: `enum.<TYPE>.<VALUE>` when a type is given and
 * defined, else `enum.<VALUE>`, else the value humanised. Impure, so it follows the language.
 */
@Pipe({ name: 'label', pure: false })
export class LabelPipe implements PipeTransform {
  private readonly translations = inject(Translations);

  transform(value: string | null | undefined, type?: string): string {
    return enumLabel(this.translations, value, type);
  }
}

export function enumLabel(
  translations: Translations,
  value: string | null | undefined,
  type?: string,
): string {
  if (!value) {
    return humanize(value);
  }
  const plain = translations.t(`enum.${value}`, undefined, humanize(value));
  return type ? translations.t(`enum.${type}.${value}`, undefined, plain) : plain;
}

export const FORMAT_PIPES = [
  MoneyPipe,
  CompactMoneyPipe,
  NumberPipe,
  DayPipe,
  WhenPipe,
  LabelPipe,
] as const;
