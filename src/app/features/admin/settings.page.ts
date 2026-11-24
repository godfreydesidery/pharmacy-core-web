import { PharmacyExportService } from '../../core/ui/pharmacy-export';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Api } from '../../core/api/api.service';
import { StaleRecordService, ifMatch } from '../../core/api/concurrency';
import { CurrencyInfo, ExpiryProvisionBand, Settings } from '../../core/api/models';
import {
  DEFAULT_PROVISION_BANDS,
  MAX_PROVISION_BANDS,
  provisionBandsProblem,
} from './provision-bands';
import { SettingsStore } from '../../core/format/settings.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { StoredFile } from '../../core/files/files.service';
import { TenantLogoStore } from '../../core/files/tenant-logo.store';
import { UploadComponent } from '../../core/files/upload.component';
import { FilesService } from '../../core/files/files.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-settings',
  imports: [...SHARED, UploadComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'admin.settings' | t }}</h1>
          <p class="sub">{{ session.tenant()?.name }}</p>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
            <app-icon name="check" [size]="16" /> {{ 'admin.saveChanges' | t }}
          </button>
        </div>
      </div>
      <form class="grid two" [formGroup]="form" (ngSubmit)="save()">
        <div class="card card-pad stack">
          <h3>{{ 'admin.locale' | t }}</h3>
          <div class="form-grid">
            <app-field [label]="'admin.currency' | t" [hint]="'admin.setWhenThePharmacyWas' | t">
              <input class="input" [value]="settings()?.currency ?? ''" disabled />
            </app-field>
            <app-field [label]="'admin.timeZone' | t">
              <input class="input" [value]="settings()?.timezone ?? ''" disabled />
            </app-field>
          </div>
          <h3>{{ 'admin.invoicesAmpTax' | t }}</h3>
          <div class="form-grid">
            <app-field [label]="'admin.invoicePrefix' | t" [error]="err('invoicePrefix')">
              <input
                class="input"
                formControlName="invoicePrefix"
                style="text-transform:uppercase"
              />
            </app-field>
            <div class="field">
              <label for="standard-vat-rate">{{ 'vat.standardRate' | t }}</label><input
                id="standard-vat-rate"
                class="input"
                type="number"
                min="0"
                max="100"
                step="any"
                formControlName="defaultTaxRatePercent"
              />
              <span class="hint">{{ 'vat.standardRateHint' | t }}</span>
            </div>
            <div class="field full">
              <label class="check" data-testid="vat-registered">
                <input type="checkbox" formControlName="vatRegistered" />
                {{ 'vat.registered' | t }}
              </label>
              <span class="hint">{{ 'vat.registeredHint' | t }}</span>
            </div>
            <div class="field">
              <label for="vat-tin">{{ 'vat.tin' | t }}</label><input
                id="vat-tin"
                class="input"
                formControlName="tin"
                inputmode="numeric"
                autocomplete="off"
                data-testid="vat-tin"
              />
              @if (err('tin'); as m) {
                <span class="error">{{ m }}</span>
              }
              <span class="hint">{{ 'vat.tinHint' | t }}</span>
            </div>
            <div class="field">
              <label for="vat-vrn">{{ 'vat.vrn' | t }}</label><input
                id="vat-vrn"
                class="input"
                formControlName="vrn"
                autocomplete="off"
                style="text-transform:uppercase"
                data-testid="vat-vrn"
              />
              @if (err('vrn'); as m) {
                <span class="error">{{ m }}</span>
              }
              <span class="hint">{{ 'vat.vrnHint' | t }}</span>
            </div>
            @if (numbersMissing()) {
              <div class="field full">
                <div class="notice tone-amber" data-testid="vat-numbers-missing">
                  {{ 'vat.numbersMissing' | t }}
                </div>
              </div>
            }
            <app-field class="full" [label]="'admin.receiptFooter' | t">
              <textarea class="input" formControlName="receiptFooter"></textarea>
            </app-field>
          </div>
        </div>
        <div class="card card-pad stack">
          <h3>{{ 'admin.pointOfSale' | t }}</h3>
          <app-field [label]="'admin.maximumDiscount' | t" [hint]="'admin.theMostACashierWith' | t">
            <input
              class="input"
              type="number"
              min="0"
              max="100"
              formControlName="maxDiscountPercent"
            />
          </app-field>
          <h3>{{ 'controls.title' | t }}</h3>
          <div class="field">
            <label for="approval-limit">{{ 'controls.approvalLimit' | t }}</label><input
              id="approval-limit"
              class="input"
              type="number"
              min="0"
              step="1000"
              formControlName="approvalLimit"
              data-testid="approval-limit"
            />
            @if (err('approvalLimit'); as e) {
              <span class="error">{{ e }}</span>
            }
            <span class="hint">{{ 'controls.approvalLimitHint' | t }}</span>
          </div>
          <div class="field">
            <label for="return-window">{{ 'controls.returnWindow' | t }}</label><input
              id="return-window"
              class="input"
              type="number"
              min="0"
              max="365"
              formControlName="returnWindowDays"
              data-testid="return-window"
            />
            @if (err('returnWindowDays'); as e) {
              <span class="error">{{ e }}</span>
            }
            <span class="hint">{{ 'controls.returnWindowHint' | t }}</span>
          </div>
          <div class="field">
            <label class="check" data-testid="require-open-shift">
              <input type="checkbox" formControlName="requireOpenShift" />
              {{ 'controls.requireOpenShift' | t }}
            </label>
            <span class="hint">{{ 'controls.requireOpenShiftHint' | t }}</span>
          </div>
          <div class="field">
            <label class="check" data-testid="sensitive-digest">
              <input type="checkbox" formControlName="sensitiveDigest" />
              {{ 'moneyops.sensitiveDigest' | t }}
            </label>
            <span class="hint">{{ 'moneyops.sensitiveDigestHint' | t }}</span>
          </div>
          <h3>{{ 'idle.security' | t }}</h3>
          <div class="field">
            <label>{{ 'idle.setting' | t }}</label><input
              class="input"
              type="number"
              min="5"
              max="60"
              formControlName="idleMinutes"
            />
            @if (err('idleMinutes'); as e) {
              <span class="error">{{ e }}</span>
            }
            <span class="hint">{{ 'idle.settingHint' | t }}</span>
          </div>
          <div class="field">
            <label class="check" data-testid="require-2fa">
              <input type="checkbox" formControlName="requireTwoFactor" />
              {{ 'staff.require2fa' | t }}
            </label>
            <span class="hint">{{ 'staff.require2faHint' | t }}</span>
            @if (err('requireTwoFactor'); as e) {
              <span class="error">{{ e }}</span>
            }
          </div>
          <div class="field">
            <label class="check" data-testid="shared-counter-pcs">
              <input type="checkbox" formControlName="sharedCounterPcs" />
              {{ 'sharedPc.setting' | t }}
            </label>
            <span class="hint">{{ 'sharedPc.hint' | t }}</span>
          </div>
          <h3>{{ 'admin.alerts' | t }}</h3>
          <app-field [label]="'admin.expiryAlertWindowDays' | t">
            <input
              class="input"
              type="number"
              min="1"
              max="730"
              formControlName="expiryAlertDays"
            />
          </app-field>
          <label class="row" style="justify-content:space-between">
            <span
              ><b style="font-weight:550">{{ 'admin.lowStockAlerts' | t }}</b
              ><br /><small class="muted">{{ 'admin.warnWhenAProductReaches' | t }}</small></span
            >
            <span class="switch"
              ><input type="checkbox" formControlName="lowStockAlerts" /><span></span
            ></span>
          </label>
          <label class="row" style="justify-content:space-between">
            <span
              ><b style="font-weight:550">{{ 'admin.pricesIncludeTax' | t }}</b
              ><br /><small class="muted">{{ 'admin.pricesIncludeTaxHint' | t }}</small></span
            >
            <span class="switch"
              ><input type="checkbox" formControlName="pricesIncludeTax" /><span></span
            ></span>
          </label>
          <label class="row" style="justify-content:space-between">
            <span
              ><b style="font-weight:550">{{ 'admin.smsReceipts' | t }}</b
              ><br /><small class="muted">{{ 'admin.textTheReceiptToA' | t }}</small></span
            >
            <span class="switch"
              ><input type="checkbox" formControlName="smsReceipts" /><span></span
            ></span>
          </label>
          <h3>{{ 'admin.appearance' | t }}</h3>
          <div class="field">
            <label for="look">{{ 'admin.look' | t }}</label>
            <select id="look" class="select" formControlName="look">
              <option value="PREMIUM">{{ 'admin.lookPremium' | t }}</option>
              <option value="CLASSIC">{{ 'admin.lookClassic' | t }}</option>
            </select>
            <span class="hint">{{ 'admin.lookHint' | t }}</span>
          </div>
        </div>
        <div class="card card-pad stack" data-testid="writedown-card">
          <h3>{{ 'writedown.title' | t }}</h3>
          <label class="check" data-testid="writedown-enabled">
            <input type="checkbox" formControlName="expiryProvisionEnabled" />
            {{ 'writedown.enabled' | t }}
          </label>
          <span class="hint">{{ 'writedown.hint' | t }}</span>
          <table class="table bands">
            <thead>
              <tr>
                <th scope="col">{{ 'writedown.days' | t }}</th>
                <th scope="col">{{ 'writedown.percent' | t }}</th>
                <th scope="col">
                  <span class="sr-only">{{ 'writedown.remove' | t }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (band of bands(); track $index; let i = $index) {
                <tr>
                  <td>
                    <input
                      class="input sm"
                      type="number"
                      min="0"
                      max="730"
                      step="1"
                      [attr.aria-label]="'writedown.days' | t"
                      [attr.data-testid]="'band-days-' + i"
                      [value]="band.daysToExpiry"
                      (input)="setBand(i, 'daysToExpiry', $any($event.target).value)"
                    />
                    <small class="muted">{{
                      band.daysToExpiry === 0
                        ? ('writedown.expired' | t)
                        : ('writedown.within' | t: { days: band.daysToExpiry })
                    }}</small>
                  </td>
                  <td>
                    <input
                      class="input sm"
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      [attr.aria-label]="'writedown.percent' | t"
                      [attr.data-testid]="'band-percent-' + i"
                      [value]="band.percent"
                      (input)="setBand(i, 'percent', $any($event.target).value)"
                    />
                  </td>
                  <td>
                    <button
                      class="btn ghost sm"
                      type="button"
                      [attr.aria-label]="'writedown.remove' | t"
                      [attr.data-testid]="'band-remove-' + i"
                      (click)="removeBand(i)"
                    >
                      <app-icon name="x" [size]="14" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <div>
            <button
              class="btn sm"
              type="button"
              data-testid="band-add"
              [disabled]="bands().length >= maxBands"
              (click)="addBand()"
            >
              <app-icon name="plus" [size]="14" /> {{ 'writedown.add' | t }}
            </button>
          </div>
          @if (bandsError(); as key) {
            <span class="error" data-testid="bands-error">{{ key | t: { max: maxBands } }}</span>
          }
        </div>
        <div class="card card-pad stack" data-testid="apportion-card">
          <h3>{{ 'apportion.title' | t }}</h3>
          <span class="hint">{{ 'apportion.hint' | t }}</span>
          <div class="field">
            <label for="apportion-method">{{ 'apportion.method' | t }}</label>
            <select
              id="apportion-method"
              class="select"
              formControlName="vatApportionmentMethod"
              data-testid="apportion-method"
            >
              <option value="AUTOMATIC">{{ 'apportion.AUTOMATIC' | t }}</option>
              <option value="FIXED">{{ 'apportion.FIXED' | t }}</option>
            </select>
            @if (apportionValues().vatApportionmentMethod === 'AUTOMATIC') {
              <span class="hint">{{ 'apportion.automaticHint' | t }}</span>
            }
          </div>
          @if (apportionValues().vatApportionmentMethod === 'FIXED') {
            <div class="field">
              <label for="apportion-fixed">{{ 'apportion.fixedPercent' | t }}</label>
              <input
                id="apportion-fixed"
                class="input"
                type="number"
                min="0"
                max="100"
                step="any"
                formControlName="vatFixedRecoverablePercent"
                data-testid="apportion-fixed"
              />
              @if (err('vatFixedRecoverablePercent'); as e) {
                <span class="error">{{ e }}</span>
              } @else if (fixedMissing()) {
                <span class="error" data-testid="apportion-fixed-missing">{{
                  'apportion.fixedRequired' | t
                }}</span>
              }
            </div>
          }
          <div class="field">
            <label for="apportion-year-end">{{ 'apportion.yearEnd' | t }}</label>
            <select
              id="apportion-year-end"
              class="select"
              formControlName="vatYearEndMonth"
              data-testid="apportion-year-end"
            >
              @for (m of months(); track m.value) {
                <option [ngValue]="m.value">{{ m.name }}</option>
              }
            </select>
            @if (err('vatYearEndMonth'); as e) {
              <span class="error">{{ e }}</span>
            }
          </div>
          @if (apportionValues().vatApportionmentMethod === 'AUTOMATIC') {
            <div class="field">
              <label class="check" data-testid="apportion-round-up">
                <input type="checkbox" formControlName="vatRatioRoundUp" />
                {{ 'apportion.roundUp' | t }}
              </label>
              <span class="hint">{{ 'apportion.roundUpHint' | t }}</span>
            </div>
          }
        </div>
      </form>

      <div class="card card-pad mt row between wrap" data-testid="data-export-card">
        <div>
          <h3>{{ 'data.yourData' | t }}</h3>
          <p class="muted">{{ 'data.exportHint' | t }}</p>
        </div>
        <button
          class="btn"
          type="button"
          data-testid="data-export"
          [disabled]="exporting()"
          (click)="exportData()"
        >
          <app-icon name="download" [size]="16" /> {{ 'data.export' | t }}
        </button>
      </div>

      <div class="card card-pad stack mt">
        <div class="row between">
          <div>
            <h3>{{ 'admin.currencies' | t }}</h3>
            <p class="muted">
              {{ 'admin.pricesStockAndReportsAre' | t }} <b>{{ settings()?.currency }}</b>{{
                'admin.theBaseCurrencyAcceptOther' | t
              }}
            </p>
          </div>
        </div>
        <div class="chips-row">
          <span class="chip on" [title]="'admin.baseCurrency' | t"
            >{{ settings()?.currency }} {{ 'admin.base' | t }}</span
          >
          @for (c of foreign(); track c) {
            <span class="chip">
              {{ c }}
              <button
                type="button"
                class="chip-x"
                (click)="removeCurrency(c)"
                [attr.aria-label]="('ui.l.removeSp' | t) + c"
              >
                <app-icon name="x" [size]="12" />
              </button>
            </span>
          }
          <select class="select sm" style="width:auto" (change)="addCurrency($any($event.target))">
            <option value="">{{ 'admin.addCurrency' | t }}</option>
            @for (c of available(); track c.code) {
              <option [value]="c.code">{{ c.code }} · {{ c.name }}</option>
            }
          </select>
        </div>
        <small class="muted">{{ 'admin.savedWithTheSettingsAbove' | t }}</small>
      </div>

      <div class="card card-pad stack logo-card mt">
        <h3>{{ 'files.logo' | t }}</h3>
        <p class="muted">{{ 'files.logoHint' | t }}</p>
        <div class="logo-row">
          <div class="logo-preview">
            @if (logo.url(); as url) {
              <img [src]="url" alt="" />
            } @else {
              <span class="ws-mark">{{ session.tenant()?.code?.slice(0, 2) }}</span>
            }
          </div>
          <app-upload
            class="grow"
            accept="image/png,image/jpeg,image/webp"
            [owner]="{
              ownerType: 'TENANT',
              ownerUid: session.tenant()?.uid ?? null,
              purpose: 'LOGO',
            }"
            (uploaded)="logoUploaded($event)"
          />
          @if (logo.file(); as current) {
            <button class="btn ghost" type="button" (click)="removeLogo(current)">
              <app-icon name="trash" [size]="15" /> {{ 'common.remove' | t }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .mt {
      margin-top: 18px;
    }
    .bands td {
      vertical-align: top;
    }
    .bands .input {
      width: 7rem;
    }
    .bands small {
      display: block;
    }
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .chip-x {
      border: 0;
      background: none;
      color: inherit;
      padding: 0 0 0 4px;
      cursor: pointer;
      display: inline-grid;
      place-items: center;
    }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .logo-row .grow {
      flex: 1;
      min-width: 240px;
    }
    .logo-preview {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .logo-preview img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .logo-preview .ws-mark {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--primary);
      color: var(--on-primary);
      display: grid;
      place-items: center;
      font-weight: 700;
    }
  `,
})
export default class SettingsPage implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly store = inject(SettingsStore);
  private readonly api = inject(Api);
  protected readonly logo = inject(TenantLogoStore);
  private readonly files = inject(FilesService);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly stale = inject(StaleRecordService);
  protected readonly settings = this.store.settings;
  protected readonly busy = signal(false);
  /** The accepted foreign currencies (the base is always accepted). */
  protected readonly foreign = signal<string[]>([]);
  private readonly catalogue = signal<CurrencyInfo[]>([]);
  protected readonly available = computed(() =>
    this.catalogue().filter(
      (c) => c.code !== this.settings()?.currency && !this.foreign().includes(c.code),
    ),
  );
  protected readonly form = inject(FormBuilder).nonNullable.group({
    defaultTaxRatePercent: [0, [Validators.min(0), Validators.max(100)]],
    invoicePrefix: ['INV', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{1,8}$/)]],
    receiptFooter: [''],
    maxDiscountPercent: [10, [Validators.min(0), Validators.max(100)]],
    expiryAlertDays: [90, [Validators.min(1), Validators.max(730)]],
    lowStockAlerts: [true],
    smsReceipts: [false],
    pricesIncludeTax: [false],
    look: ['PREMIUM' as Settings['look']],
    idleMinutes: [15, [Validators.required, Validators.min(5), Validators.max(60)]],
    requireTwoFactor: [false],
    approvalLimit: [50000, [Validators.required, Validators.min(0)]],
    returnWindowDays: [7, [Validators.required, Validators.min(0), Validators.max(365)]],
    requireOpenShift: [false],
    /** FRD-19: the owners' and admins' morning digest of the day's sensitive actions. */
    sensitiveDigest: [true],
    sharedCounterPcs: [false],
    expiryProvisionEnabled: [true],
    vatApportionmentMethod: ['AUTOMATIC' as 'AUTOMATIC' | 'FIXED'],
    vatFixedRecoverablePercent: [null as number | null, [Validators.min(0), Validators.max(100)]],
    vatYearEndMonth: [12, [Validators.required, Validators.min(1), Validators.max(12)]],
    vatRatioRoundUp: [true],
    vatRegistered: [true],
    /** 9 digits, dashes and spaces allowed (the API keeps the digits); verify with TRA. */
    tin: ['', Validators.pattern(/^\s*(\d[\s-]?){8}\d\s*$|^\s*$/)],
    vrn: ['', Validators.pattern(/^\s*([0-9][0-9A-Za-z-]{7,14})?\s*$/)],
  });

  private readonly vatValues = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  /** The expiry write-down bands (STD-3), edited as rows. */
  protected readonly bands = signal<ExpiryProvisionBand[]>([...DEFAULT_PROVISION_BANDS]);
  protected readonly maxBands = MAX_PROVISION_BANDS;
  protected readonly apportionValues = computed(() => this.vatValues());
  /** Why the bands would be refused (a translation key), or null. */
  protected readonly bandsError = computed(() =>
    provisionBandsProblem(this.bands(), !!this.vatValues().expiryProvisionEnabled),
  );
  /** The fixed method without its percentage. */
  protected readonly fixedMissing = computed(() => {
    const v = this.vatValues();
    return (
      v.vatApportionmentMethod === 'FIXED' &&
      (v.vatFixedRecoverablePercent === null ||
        v.vatFixedRecoverablePercent === undefined ||
        `${v.vatFixedRecoverablePercent}` === '')
    );
  });
  /** The months of the year in the chosen language, for the financial year end. */
  protected readonly months = computed(() => {
    const format = new Intl.DateTimeFormat(this.translations.locale(), { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      name: format.format(new Date(Date.UTC(2026, i, 15))),
    }));
  });

  protected setBand(index: number, field: keyof ExpiryProvisionBand, value: string): void {
    const number = value === '' ? NaN : Number(value);
    this.bands.update((list) =>
      list.map((band, i) => (i === index ? { ...band, [field]: number } : band)),
    );
  }

  protected addBand(): void {
    this.bands.update((list) => {
      if (list.length >= MAX_PROVISION_BANDS) {
        return list;
      }
      const last = list[list.length - 1];
      return [
        ...list,
        last
          ? {
              daysToExpiry: Math.min(last.daysToExpiry + 30, 730),
              percent: Math.max(last.percent / 2, 0),
            }
          : { daysToExpiry: 0, percent: 100 },
      ];
    });
  }

  protected removeBand(index: number): void {
    this.bands.update((list) => list.filter((_, i) => i !== index));
  }

  /** Registered for VAT without its TIN or VRN: every receipt would lack them. */
  protected readonly numbersMissing = computed(() => {
    const v = this.vatValues();
    return !!v.vatRegistered && (!v.tin?.trim() || !v.vrn?.trim());
  });

  async ngOnInit(): Promise<void> {
    await this.load();
    this.catalogue.set(
      await this.api
        .get<CurrencyInfo[]>('/currencies', undefined, { silent: true, noBranch: true })
        .catch(() => []),
    );
  }

  /** Reads the settings into the form as they are on the server, their version included. */
  private async load(): Promise<void> {
    const settings = await this.api.get<Settings>('/settings', undefined, { noBranch: true });
    this.store.set(settings);
    this.form.reset({
      ...this.form.getRawValue(),
      ...settings,
      receiptFooter: settings.receiptFooter ?? '',
      vatRegistered: settings.vatRegistered ?? true,
      sensitiveDigest: settings.sensitiveDigest ?? true,
      tin: settings.tin ?? '',
      vrn: settings.vrn ?? '',
      sharedCounterPcs: settings.sharedCounterPcs ?? false,
      expiryProvisionEnabled: settings.expiryProvisionEnabled ?? true,
      vatApportionmentMethod: settings.vatApportionmentMethod ?? 'AUTOMATIC',
      vatFixedRecoverablePercent: settings.vatFixedRecoverablePercent ?? null,
      vatYearEndMonth: settings.vatYearEndMonth ?? 12,
      vatRatioRoundUp: settings.vatRatioRoundUp ?? true,
    });
    this.bands.set(
      (settings.expiryProvisionBands ?? DEFAULT_PROVISION_BANDS).map((band) => ({ ...band })),
    );
    this.foreign.set((settings.acceptedCurrencies ?? []).filter((c) => c !== settings.currency));
  }

  protected addCurrency(select: HTMLSelectElement): void {
    const code = select.value;
    select.value = '';
    if (code) {
      this.foreign.update((list) => [...list, code].sort());
    }
  }

  protected removeCurrency(code: string): void {
    this.foreign.update((list) => list.filter((c) => c !== code));
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  private readonly pharmacyExport = inject(PharmacyExportService);
  protected readonly exporting = this.pharmacyExport.busy;

  /** Every record of the pharmacy, with its files, as one ZIP (its right to take its data). */
  protected exportData(): Promise<void> {
    return this.pharmacyExport.run();
  }

  protected async save(): Promise<void> {
    if (!validate(this.form) || this.bandsError() || this.fixedMissing()) {
      return;
    }
    const v = this.form.getRawValue();
    // The version as last loaded or saved: the page may save several times without reloading.
    const version = this.settings()?.version;
    this.busy.set(true);
    try {
      const saved = await this.api.put<Settings>(
        '/settings',
        {
          ...this.settings(),
          ...v,
          invoicePrefix: v.invoicePrefix.toUpperCase(),
          receiptFooter: v.receiptFooter || null,
          // Blank clears the number; the API keeps a TIN as its 9 digits and a VRN in upper case.
          tin: v.tin.trim(),
          vrn: v.vrn.trim().toUpperCase(),
          acceptedCurrencies: [this.settings()?.currency, ...this.foreign()].filter(Boolean),
          expiryProvisionBands: this.bands(),
          vatFixedRecoverablePercent:
            v.vatApportionmentMethod === 'FIXED' ? Number(v.vatFixedRecoverablePercent) : null,
        },
        { silent: true, noBranch: true, headers: ifMatch(version) },
      );
      this.store.set(saved);
      this.toasts.success(this.translations.t('toast.settingsSaved'));
    } catch (failure) {
      if (await this.stale.handle(failure, () => this.load())) {
        return;
      }
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async logoUploaded(file: StoredFile): Promise<void> {
    // a pharmacy has one logo: the newest replaces the others
    const previous = this.logo.file();
    await this.logo.reload();
    if (previous && previous.uid !== file.uid) {
      await this.files.delete(previous.uid).catch(() => undefined);
    }
  }

  protected async removeLogo(file: StoredFile): Promise<void> {
    await this.files.delete(file.uid);
    await this.logo.reload();
  }
}
