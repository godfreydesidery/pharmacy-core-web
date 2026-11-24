import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Tenant } from '../../core/api/models';
import { SHARED } from '../../core/shared';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

const ZONES = [
  'Africa/Dar_es_Salaam',
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Kigali',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'UTC',
];
const CURRENCIES = ['TZS', 'KES', 'UGX', 'RWF', 'NGN', 'ZAR', 'USD'];

/** The root administrator edits a pharmacy's registry details (not its code). */
@Component({
  selector: 'app-tenant-edit',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [open]="open()"
      [title]="'admin2.editPharmacy' | t"
      [wide]="true"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" class="stack" (ngSubmit)="save()">
        <div class="form-grid three">
          <div class="field">
            <label>{{ 'platform.tradingName' | t }}</label><input
              class="input"
              formControlName="name"
            />
            @if (err('name'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'platform.legalName' | t }}</label><input
              class="input"
              formControlName="legalName"
            />
          </div>
          <div class="field">
            <label>{{ 'platform.countryIso' | t }}</label><input
              class="input"
              formControlName="country"
              maxlength="2"
              style="text-transform:uppercase"
            />
            @if (err('country'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'platform.currency' | t }}</label><select
              class="select"
              formControlName="currency"
            >
              @for (c of currencies; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
            <span class="hint">{{ 'admin2.currencyLockHint' | t }}</span>
            @if (err('currency'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'platform.timeZone' | t }}</label><select
              class="select"
              formControlName="timezone"
            >
              @for (z of zones; track z) {
                <option [value]="z">{{ z }}</option>
              }
            </select>
          </div>
        </div>
        <h4 class="muted">{{ 'admin2.contact' | t }}</h4>
        <div class="form-grid">
          <div class="field">
            <label>{{ 'admin2.contactName' | t }}</label><input
              class="input"
              formControlName="contactName"
            />
          </div>
          <div class="field">
            <label>{{ 'admin2.contactEmail' | t }}</label><input
              class="input"
              type="email"
              formControlName="contactEmail"
            />
            @if (err('contactEmail'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'admin2.contactPhone' | t }}</label><input
              class="input"
              formControlName="contactPhone"
              placeholder="+255754000111"
            />
          </div>
          <div class="field">
            <label>{{ 'platform.address' | t }}</label><input
              class="input"
              formControlName="address"
            />
          </div>
          <div class="field full">
            <label class="check"
              ><input type="checkbox" formControlName="directUserCreation" />
              {{ 'logins.directSetting' | t }}</label
            >
            <span class="hint">{{ 'logins.directSettingHint' | t: { code: tenant().code } }}</span>
          </div>
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          <app-icon name="check" [size]="16" /> {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class TenantEditComponent {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  readonly tenant = input.required<Tenant>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<Tenant>();
  protected readonly busy = signal(false);
  protected readonly zones = ZONES;
  protected readonly currencies = CURRENCIES;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    legalName: [''],
    country: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    currency: ['', Validators.required],
    timezone: ['', Validators.required],
    contactName: [''],
    contactEmail: ['', Validators.email],
    contactPhone: [''],
    address: [''],
    directUserCreation: [true],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const t = this.tenant();
        this.form.reset({
          name: t.name,
          legalName: t.legalName ?? '',
          country: t.country,
          currency: t.currency,
          timezone: t.timezone,
          contactName: t.contactName ?? '',
          contactEmail: t.contactEmail ?? '',
          contactPhone: t.contactPhone ?? '',
          address: t.address ?? '',
          directUserCreation: t.directUserCreation ?? true,
        });
      }
    });
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const blank = (s: string) => (s.trim() ? s.trim() : null);
      const tenant = await this.api.put<Tenant>(
        `/platform/tenants/${this.tenant().uid}`,
        {
          name: v.name.trim(),
          legalName: blank(v.legalName),
          country: v.country.toUpperCase(),
          currency: v.currency,
          timezone: v.timezone,
          contactName: blank(v.contactName),
          contactEmail: blank(v.contactEmail),
          contactPhone: blank(v.contactPhone),
          address: blank(v.address),
          directUserCreation: v.directUserCreation,
        },
        { noBranch: true, silent: true },
      );
      this.toasts.success(this.translations.t('admin2.pharmacySaved'));
      this.saved.emit(tenant);
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
