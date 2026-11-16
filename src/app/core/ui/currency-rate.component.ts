import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { Api } from '../api/api.service';
import { LatestRate } from '../api/models';
import { TranslatePipe } from '../i18n/t.pipe';
import { SettingsStore } from '../format/settings.store';

import { IconComponent } from './icon.component';

/**
 * A currency picker with its exchange rate: base units per 1 unit of the chosen currency. Choosing
 * a foreign currency prefills today's rate (editable, or locked with `locked`), warns when that
 * rate is over 7 days old, and points to Finance → Exchange rates when there is none.
 */
@Component({
  selector: 'app-currency-rate',
  imports: [IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fx" [class.compact]="compact()">
      <select
        class="select"
        [class.sm]="compact()"
        [value]="currency()"
        [disabled]="locked() || lockCurrency()"
        (change)="choose($any($event.target).value)"
        [attr.aria-label]="'ui.currency' | t"
      >
        @for (c of accepted(); track c) {
          <option [value]="c" [selected]="c === currency()">{{ c }}</option>
        }
      </select>
      @if (foreign()) {
        <div class="rate">
          <span class="muted">1 {{ currency() }} =</span>
          <input
            class="input mono"
            [class.sm]="compact()"
            type="number"
            min="0"
            step="any"
            [value]="rate()"
            [readOnly]="locked()"
            (input)="rate.set(+$any($event.target).value)"
            [attr.aria-label]="'ui.exchangeRate' | t"
          />
          <span class="muted">{{ base() }}</span>
        </div>
        @if (missing() && !(rate() > 0)) {
          <span class="note red"
            ><app-icon name="alert" [size]="13" />
            {{ 'ui.fx.missing' | t: { currency: currency() } }}</span
          >
        } @else if (missing()) {
          <span class="note amber"
            ><app-icon name="edit" [size]="13" /> {{ 'ui.fx.byHand' | t }}</span
          >
        } @else if (stale()) {
          <span class="note amber"
            ><app-icon name="clock" [size]="13" />
            {{ 'ui.fx.stale' | t: { date: effectiveOn() } }}</span
          >
        }
      }
    </div>
  `,
  styles: [
    `
      .fx {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .fx select {
        width: auto;
        min-width: 84px;
      }
      .rate {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
      }
      .rate input {
        width: 120px;
      }
      .fx.compact .rate input {
        width: 96px;
      }
      .note {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        width: 100%;
      }
      .note.red {
        color: var(--red, #dc2626);
      }
      .note.amber {
        color: var(--amber, #d97706);
      }
    `,
  ],
})
export class CurrencyRateComponent {
  private readonly api = inject(Api);
  private readonly settings = inject(SettingsStore);

  /** The chosen currency; empty means the base. */
  readonly currency = model('');
  /** Base units per 1 unit of `currency`. */
  readonly rate = model(1);
  /** Keep the currency and rate as given (a receipt follows its order). */
  readonly locked = input(false);
  /** Keep the currency but allow the rate to be overridden (a receipt may differ from its order). */
  readonly lockCurrency = input(false);
  readonly compact = input(false);

  protected readonly base = this.settings.currency;
  protected readonly accepted = computed(
    () => this.settings.settings()?.acceptedCurrencies ?? [this.base()],
  );
  protected readonly foreign = computed(() => !!this.currency() && this.currency() !== this.base());
  protected readonly stale = signal(false);
  protected readonly missing = signal(false);
  protected readonly effectiveOn = signal('');

  constructor() {
    effect(() => {
      const base = this.base();
      if (!this.currency() && base) {
        untracked(() => this.currency.set(base));
      }
    });
  }

  protected async choose(code: string): Promise<void> {
    this.currency.set(code);
    this.stale.set(false);
    this.missing.set(false);
    if (code === this.base()) {
      this.rate.set(1);
      return;
    }
    try {
      const latest = await this.api.get<LatestRate>(
        '/fx/rates/latest',
        { base: code, quote: this.base() },
        { silent: true, noBranch: true },
      );
      this.rate.set(latest.rate);
      this.stale.set(latest.stale);
      this.effectiveOn.set(latest.effectiveOn);
    } catch {
      this.missing.set(true);
      this.rate.set(0);
    }
  }
}
