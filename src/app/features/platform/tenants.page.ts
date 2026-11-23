import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { RegisterTenant, Tenant } from '../../core/api/models';
import { debounced, pagedList } from '../../core/data/data';
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

@Component({
  selector: 'app-tenants',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'platform.tenants' | t }}</h1>
          <p class="sub">
            {{ 'platform.pharmacyBusinessesOnThePlatform' | t }}
          </p>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" (click)="open()">
            <app-icon name="plus" [size]="16" /> {{ 'platform.registerPharmacy' | t }}
          </button>
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="search"
            ><app-icon name="search" [size]="16" /><input
              [placeholder]="'platform.searchNameOrCode' | t"
              (input)="q.set($any($event.target).value)"
          /></label>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'platform.pharmacy' | t }}</th>
                <th>{{ 'platform.country' | t }}</th>
                <th>{{ 'platform.currency' | t }}</th>
                <th>{{ 'platform.timeZone' | t }}</th>
                <th class="right">{{ 'platform.branches' | t }}</th>
                <th>{{ 'platform.registered2' | t }}</th>
                <th>{{ 'platform.status' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (t of list.items(); track t.uid) {
                <tr class="clickable" [routerLink]="[t.uid]">
                  <td>
                    <div class="cell-main">
                      <span class="thumb tone-blue strong">{{ t.code.slice(0, 2) }}</span>
                      <div>
                        <b>{{ t.name }}</b
                        ><small>{{ t.code }}{{ t.legalName ? ' · ' + t.legalName : '' }}</small>
                      </div>
                    </div>
                  </td>
                  <td>{{ t.country }}</td>
                  <td>{{ t.currency }}</td>
                  <td class="muted">{{ t.timezone }}</td>
                  <td class="right">{{ t.branchCount }}</td>
                  <td class="muted">{{ t.createdAt | day }}</td>
                  <td><app-status [value]="t.status" /></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <app-empty
                      [for]="list"
                      icon="building"
                      [title]="'platform.noPharmacies' | t"
                      [text]="'ui.empty.tenants' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="list" />
      </div>
    </div>

    <app-modal
      [open]="creating()"
      [title]="'platform.registerPharmacy' | t"
      [wide]="true"
      (closed)="creating.set(false)"
    >
      <form [formGroup]="form" class="stack" (ngSubmit)="create()">
        <h4 class="muted">{{ 'platform.business' | t }}</h4>
        <div class="form-grid three">
          <div class="field">
            <label>{{ 'platform.code' | t }}</label
            ><input
              class="input"
              formControlName="code"
              placeholder="AFYA"
              style="text-transform:uppercase"
            />
            <span class="hint">{{ 'platform.212LettersOrDigits' | t }}</span>
            @if (err('code'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'platform.tradingName' | t }}</label
            ><input class="input" formControlName="name" />
            @if (err('name'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'platform.legalName' | t }}</label
            ><input class="input" formControlName="legalName" />
          </div>
          <div class="field">
            <label>{{ 'platform.countryIso' | t }}</label
            ><input
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
            <label>{{ 'platform.currency' | t }}</label
            ><select class="select" formControlName="currency">
              @for (c of currencies; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>{{ 'platform.timeZone' | t }}</label
            ><select class="select" formControlName="timezone">
              @for (z of zones; track z) {
                <option [value]="z">{{ z }}</option>
              }
            </select>
          </div>
        </div>
        <h4 class="muted">{{ 'platform.headOfficeBranch' | t }}</h4>
        <div class="form-grid" formGroupName="headOffice">
          <div class="field">
            <label>{{ 'platform.branchCode' | t }}</label
            ><input class="input" formControlName="code" style="text-transform:uppercase" />
          </div>
          <div class="field">
            <label>{{ 'platform.branchName' | t }}</label
            ><input class="input" formControlName="name" />
          </div>
          <div class="field">
            <label>{{ 'platform.address' | t }}</label
            ><input class="input" formControlName="address" />
          </div>
          <div class="field">
            <label>{{ 'platform.phone' | t }}</label
            ><input class="input" formControlName="phone" />
          </div>
        </div>
        <h4 class="muted">{{ 'platform.firstAdministrator' | t }}</h4>
        <div class="form-grid three" formGroupName="admin">
          <div class="field">
            <label>{{ 'platform.name' | t }}</label
            ><input class="input" formControlName="name" />
          </div>
          <div class="field">
            <label>{{ 'platform.email' | t }}</label
            ><input class="input" type="email" formControlName="email" />
            @if (adminErr('email'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'platform.password' | t }}</label
            ><input
              class="input"
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            @if (adminErr('password'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="creating.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="create()">
          <app-icon name="check" [size]="16" /> {{ 'platform.register' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class TenantsPage implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly zones = ZONES;
  protected readonly currencies = CURRENCIES;
  protected readonly q = signal('');
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<Tenant>(() => ({
    path: '/platform/tenants',
    query: { q: this.query() },
    options: { noBranch: true },
  }));
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{2,12}$/)]],
    name: ['', Validators.required],
    legalName: [''],
    country: ['TZ', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    currency: ['TZS', Validators.required],
    timezone: ['Africa/Dar_es_Salaam', Validators.required],
    headOffice: this.fb.group({
      code: ['HQ', Validators.required],
      name: ['Head Office', Validators.required],
      address: [''],
      phone: [''],
    }),
    admin: this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    }),
  });

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.has('create')) {
      this.open();
    }
  }

  protected err(name: 'code' | 'name' | 'country'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected adminErr(name: 'email' | 'password'): string | null {
    return controlError(this.form.controls.admin.controls[name]);
  }

  protected open(): void {
    this.form.reset();
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    try {
      const value = this.form.getRawValue();
      const body: RegisterTenant = {
        ...value,
        code: value.code.toUpperCase(),
        country: value.country.toUpperCase(),
        headOffice: { ...value.headOffice, code: value.headOffice.code.toUpperCase() },
      };
      const tenant = await this.api.post<Tenant & { adminInvited?: boolean }>(
        '/platform/tenants',
        body,
        { silent: true, noBranch: true },
      );
      this.toasts.success(this.translations.t('toast.tenantRegistered', { name: tenant.name }));
      if (tenant.adminInvited) {
        // The administrator's email already had an account: they join by accepting.
        this.toasts.info(this.translations.t('join.adminInvited', { email: body.admin.email }));
      }
      this.creating.set(false);
      await this.router.navigate(['/platform/tenants', tenant.uid]);
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
