import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Settings, CurrencyInfo } from '../../core/api/models';
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
            <div class="field">
              <label>{{ 'admin.currency' | t }}</label
              ><input class="input" [value]="settings()?.currency ?? ''" disabled /><span
                class="hint"
                >{{ 'admin.setWhenThePharmacyWas' | t }}</span
              >
            </div>
            <div class="field">
              <label>{{ 'admin.timeZone' | t }}</label
              ><input class="input" [value]="settings()?.timezone ?? ''" disabled />
            </div>
          </div>
          <h3>{{ 'admin.invoicesAmpTax' | t }}</h3>
          <div class="form-grid">
            <div class="field">
              <label>{{ 'admin.invoicePrefix' | t }}</label
              ><input
                class="input"
                formControlName="invoicePrefix"
                style="text-transform:uppercase"
              />
              @if (err('invoicePrefix'); as m) {
                <span class="error">{{ m }}</span>
              }
            </div>
            <div class="field">
              <label>{{ 'admin.defaultTaxRate' | t }}</label
              ><input
                class="input"
                type="number"
                min="0"
                max="100"
                step="any"
                formControlName="defaultTaxRatePercent"
              />
            </div>
            <div class="field full">
              <label>{{ 'admin.receiptFooter' | t }}</label
              ><textarea class="input" formControlName="receiptFooter"></textarea>
            </div>
          </div>
        </div>
        <div class="card card-pad stack">
          <h3>{{ 'admin.pointOfSale' | t }}</h3>
          <div class="field">
            <label>{{ 'admin.maximumDiscount' | t }}</label
            ><input
              class="input"
              type="number"
              min="0"
              max="100"
              formControlName="maxDiscountPercent"
            />
            <span class="hint">{{ 'admin.theMostACashierWith' | t }}</span>
          </div>
          <h3>{{ 'admin.alerts' | t }}</h3>
          <div class="field">
            <label>{{ 'admin.expiryAlertWindowDays' | t }}</label
            ><input
              class="input"
              type="number"
              min="1"
              max="730"
              formControlName="expiryAlertDays"
            />
          </div>
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
        </div>
      </form>

      <div class="card card-pad stack mt">
        <div class="row between">
          <div>
            <h3>{{ 'admin.currencies' | t }}</h3>
            <p class="muted">
              {{ 'admin.pricesStockAndReportsAre' | t }} <b>{{ settings()?.currency }}</b
              >{{ 'admin.theBaseCurrencyAcceptOther' | t }}
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
      color: #fff;
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
  });

  async ngOnInit(): Promise<void> {
    const settings = await this.api.get<Settings>('/settings', undefined, { noBranch: true });
    this.store.set(settings);
    this.form.patchValue({ ...settings, receiptFooter: settings.receiptFooter ?? '' });
    this.foreign.set((settings.acceptedCurrencies ?? []).filter((c) => c !== settings.currency));
    this.catalogue.set(
      await this.api
        .get<CurrencyInfo[]>('/currencies', undefined, { silent: true, noBranch: true })
        .catch(() => []),
    );
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

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      const saved = await this.api.put<Settings>(
        '/settings',
        {
          ...this.settings(),
          ...v,
          invoicePrefix: v.invoicePrefix.toUpperCase(),
          receiptFooter: v.receiptFooter || null,
          acceptedCurrencies: [this.settings()?.currency, ...this.foreign()].filter(Boolean),
        },
        { silent: true, noBranch: true },
      );
      this.store.set(saved);
      this.toasts.success(this.translations.t('toast.settingsSaved'));
    } catch (failure) {
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
