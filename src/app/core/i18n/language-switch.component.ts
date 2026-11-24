import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from './t.pipe';
import { LANGUAGES, Lang, Translations } from './translations.store';

/** EN / SW toggle: a compact segmented control for the top bar, or labelled for the Account page. */
@Component({
  selector: 'app-language-switch',
  imports: [IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented lang-switch" role="group" [attr.aria-label]="'common.language' | t">
      @if (!compact()) {
        <app-icon name="globe" [size]="15" />
      }
      @for (language of languages; track language.code) {
        <button
          type="button"
          [class.on]="translations.lang() === language.code"
          [attr.aria-pressed]="translations.lang() === language.code"
          [title]="language.native"
          (click)="use(language.code)"
        >
          {{ compact() ? language.code.toUpperCase() : language.native }}
        </button>
      }
    </div>
  `,
  styles: `
    .lang-switch {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
    }
    .lang-switch app-icon {
      margin: 0 4px 0 6px;
      color: var(--muted);
    }
    .lang-switch button {
      border: 0;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 999px;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
    }
    .lang-switch button.on {
      background: var(--primary);
      color: var(--on-primary);
    }
  `,
})
export class LanguageSwitchComponent {
  protected readonly translations = inject(Translations);
  protected readonly languages = LANGUAGES;
  /** EN/SW only, for the top bar. */
  readonly compact = input(false);

  protected use(lang: Lang): void {
    this.translations.use(lang);
  }
}
