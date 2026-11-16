import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { ExchangeRate, LatestRate } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { SettingsStore } from '../../core/format/settings.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

interface RateCard {
  code: string;
  latest: LatestRate | null;
  missing: boolean;
}

/** The tenant's exchange rates: what each accepted currency is worth in the base today. */
@Component({
  selector: 'app-fx-rates',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'finance.exchangeRates' | t }}</h1>
          <p class="sub">
            {{ 'finance.baseCurrency' | t }} <b>{{ base() }}</b
            >{{ 'finance.foreignCurrencySalesAndPurchases' | t }} {{ base() }}.
          </p>
        </div>
        <div class="actions">
          @if (session.can('finance.manage')) {
            <button class="btn" type="button" [disabled]="refreshing()" (click)="refresh()">
              <app-icon name="refresh" [size]="16" />
              {{ refreshing() ? ('ui.l.refreshing' | t) : ('ui.l.refreshFromProvider' | t) }}
            </button>
            <button class="btn primary" type="button" (click)="openForm()">
              <app-icon name="plus" [size]="16" /> {{ 'finance.recordRate' | t }}
            </button>
          }
        </div>
      </div>

      @if (foreign().length === 0) {
        <div class="card card-pad mb">
          <app-empty
            icon="globe"
            title="Only {{ base() }} is accepted"
            [text]="'ui.empty.noForeign' | t"
          />
        </div>
      } @else {
        <div class="grid kpis mb">
          @for (card of cards(); track card.code) {
            <div class="card stat fx-card" [class.warn]="card.missing || card.latest?.stale">
              <div class="bubble tone-blue">
                <span class="fx-code">{{ card.code }}</span>
              </div>
              <div class="grow">
                <small>1 {{ card.code }} =</small>
                @if (card.latest; as r) {
                  <div class="value">
                    {{ r.rate | num }} <span class="unit">{{ base() }}</span>
                  </div>
                  <div class="delta">
                    @if (r.stale) {
                      <span class="badge amber dot"
                        >{{ 'finance.stale' | t }} {{ r.effectiveOn | day }}</span
                      >
                    } @else {
                      <span>{{ r.source | label }} · {{ r.effectiveOn | day }}</span>
                    }
                  </div>
                } @else {
                  <div class="value muted">—</div>
                  <div class="delta">
                    <span class="badge red dot">{{ 'finance.noRate' | t }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <div class="card">
        <div class="toolbar">
          <select class="select" style="width:auto" (change)="quote.set($any($event.target).value)">
            <option value="">{{ 'finance.allCurrencies' | t }}</option>
            @for (c of foreign(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'finance.effective' | t }}</th>
                <th>{{ 'finance.pair' | t }}</th>
                <th class="right">{{ 'finance.rate' | t }}</th>
                <th>{{ 'finance.means' | t }}</th>
                <th>{{ 'finance.source' | t }}</th>
                <th>{{ 'finance.recorded' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of list.items(); track r.uid) {
                <tr>
                  <td>{{ r.effectiveOn | day }}</td>
                  <td class="mono strong">{{ r.base }}/{{ r.quote }}</td>
                  <td class="right mono">{{ r.rate | num }}</td>
                  <td class="muted">1 {{ r.base }} = {{ r.rate | num }} {{ r.quote }}</td>
                  <td>
                    <span
                      class="badge"
                      [class.blue]="r.source !== 'MANUAL'"
                      [class.gray]="r.source === 'MANUAL'"
                      >{{ r.source | label }}</span
                    >
                  </td>
                  <td class="muted">{{ r.createdAt | when }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <app-empty
                      [loading]="list.loading()"
                      icon="trend"
                      [title]="'finance.noRatesYet' | t"
                      [text]="'ui.empty.rates' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager
          [count]="list.items().length"
          [total]="list.total()"
          [hasMore]="list.hasMore()"
          [loading]="list.loading()"
          (more)="list.more()"
        />
      </div>
    </div>

    <app-modal
      [open]="open()"
      [title]="'finance.recordExchangeRate' | t"
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <div class="field">
          <label>{{ 'finance.currency' | t }}</label>
          <select class="select" formControlName="base">
            @for (c of foreign(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'finance.effectiveOn' | t }}</label>
          <input class="input" type="date" formControlName="effectiveOn" [max]="today" />
        </div>
        <div class="field full">
          <label>1 {{ form.controls.base.value }} {{ 'finance.howMany' | t }} {{ base() }}?</label>
          <input class="input lg mono" type="number" min="0" step="any" formControlName="rate" />
          @if (err('rate'); as m) {
            <span class="error">{{ m }}</span>
          }
          <span class="hint">{{ 'finance.baseUnitsPer1Foreign' | t }}</span>
        </div>
      </form>
      <div footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ busy() ? ('ui.l.saving' | t) : ('ui.l.saveRate' | t) }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .fx-code {
        font-weight: 750;
        font-size: 12px;
        letter-spacing: 0.04em;
      }
      .fx-card.warn {
        border-color: color-mix(in srgb, var(--amber, #d97706) 45%, var(--border));
      }
      .unit {
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }
      .hint {
        font-size: 12px;
        color: var(--muted);
      }
    `,
  ],
})
export default class FxRatesPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly settings = inject(SettingsStore);
  protected readonly today = isoDay();
  protected readonly base = this.settings.currency;
  protected readonly foreign = computed(() =>
    (this.settings.settings()?.acceptedCurrencies ?? []).filter((c) => c !== this.base()),
  );
  protected readonly quote = signal('');
  protected readonly list = pagedList<ExchangeRate>(() => ({
    path: '/fx/rates',
    query: { quote: this.quote() },
    options: { noBranch: true },
  }));
  protected readonly cards = signal<RateCard[]>([]);
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    base: [''],
    rate: [0, [Validators.required, Validators.min(0.0000001)]],
    effectiveOn: [isoDay(), Validators.required],
  });

  constructor() {
    effect(() => {
      void this.loadCards(this.foreign());
    });
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected openForm(): void {
    this.form.reset({ base: this.foreign()[0] ?? '', rate: 0, effectiveOn: isoDay() });
    this.open.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      await this.api.post(
        '/fx/rates',
        { base: v.base, quote: this.base(), rate: Number(v.rate), effectiveOn: v.effectiveOn },
        { silent: true, noBranch: true },
      );
      this.toasts.success(
        this.translations.t('toast.rateRecorded', {
          base: v.base,
          rate: v.rate,
          quote: this.base(),
        }),
      );
      this.open.set(false);
      await Promise.all([this.list.reload(), this.loadCards(this.foreign())]);
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      const rates = await this.api.post<ExchangeRate[]>(
        '/fx/rates/refresh',
        {},
        { noBranch: true },
      );
      this.toasts.success(
        rates.length
          ? this.translations.t('toast.ratesRefreshed', { count: rates.length })
          : this.translations.t('toast.noRateProvider'),
      );
      await Promise.all([this.list.reload(), this.loadCards(this.foreign())]);
    } finally {
      this.refreshing.set(false);
    }
  }

  private async loadCards(codes: string[]): Promise<void> {
    const base = this.base();
    const cards = await Promise.all(
      codes.map(async (code): Promise<RateCard> => {
        try {
          const latest = await this.api.get<LatestRate>(
            '/fx/rates/latest',
            { base: code, quote: base },
            { silent: true, noBranch: true },
          );
          return { code, latest, missing: false };
        } catch {
          return { code, latest: null, missing: true };
        }
      }),
    );
    this.cards.set(cards);
  }
}
