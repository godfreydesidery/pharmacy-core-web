import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Plan, PlanInput } from '../../core/api/subscription.models';
import { loaded } from '../../core/data/data';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { applyApiError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';

/** Platform → Plans: subscription plans, their prices, caps and modules. */
@Component({
  selector: 'app-plans',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'plans.title' | t }}</h1>
          <p class="sub">{{ 'plans.sub' | t }}</p>
        </div>
        <div class="actions">
          <button class="btn" type="button" (click)="runLifecycle()">
            <app-icon name="refresh" [size]="16" /> {{ 'plans.runNow' | t }}
          </button>
          <button class="btn primary" type="button" (click)="edit(null)">
            <app-icon name="plus" [size]="16" /> {{ 'plans.new' | t }}
          </button>
        </div>
      </div>
      <div class="grid plans">
        @for (p of plans.value() ?? []; track p.uid) {
          <div class="card card-pad stack plan" [class.inactive]="!p.active">
            <div class="row between">
              <div>
                <h3>{{ p.name }}</h3>
                <small class="muted mono">{{ p.code }}</small>
              </div>
              @if (!p.active) {
                <span class="badge">{{ 'plans.inactive' | t }}</span>
              }
            </div>
            <div class="price">
              <b>{{ p.priceMonthly | money: p.currency }}</b>
              <small class="muted"> / {{ 'plans.month' | t }}</small>
              <div class="muted small">
                {{ p.priceYearly | money: p.currency }} / {{ 'plans.year' | t }}
              </div>
            </div>
            @if (p.description) {
              <p class="muted">{{ p.description }}</p>
            }
            <ul class="limits">
              <li>
                {{ 'plans.limit.BRANCHES' | t }}: <b>{{ cap(p.maxBranches) }}</b>
              </li>
              <li>
                {{ 'plans.limit.USERS' | t }}: <b>{{ cap(p.maxUsers) }}</b>
              </li>
              <li>
                {{ 'plans.limit.PRODUCTS' | t }}: <b>{{ cap(p.maxProducts) }}</b>
              </li>
              <li>
                {{ 'plans.limit.SMS' | t }}: <b>{{ cap(p.smsPerMonth) }}</b>
              </li>
              @for (f of allFeatures; track f) {
                <li [class.off]="!p.features.includes(f)">
                  <app-icon [name]="p.features.includes(f) ? 'check' : 'x'" [size]="14" />
                  {{ 'plans.feature.' + f | t }}
                </li>
              }
              <li>
                {{ 'plans.trialDays' | t }}: <b>{{ p.trialDays }}</b>
              </li>
            </ul>
            <button class="btn sm" type="button" (click)="edit(p)">{{ 'plans.edit' | t }}</button>
          </div>
        } @empty {
          <div class="card card-pad empty">{{ 'plans.none' | t }}</div>
        }
      </div>
      @if (runLog().length) {
        <div class="card card-pad mt">
          <h3>{{ 'plans.runResult' | t }}</h3>
          <ul>
            @for (line of runLog(); track $index) {
              <li class="mono small">{{ line }}</li>
            }
          </ul>
        </div>
      }
    </div>

    <app-modal
      [open]="editing()"
      [title]="(uid() ? 'plans.edit' : 'plans.new') | t"
      [wide]="true"
      (closed)="editing.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <div class="field">
          <label>{{ 'plans.code' | t }}</label>
          <input class="input mono" formControlName="code" style="text-transform: uppercase" />
        </div>
        <div class="field">
          <label>{{ 'plans.name' | t }}</label>
          <input class="input" formControlName="name" />
        </div>
        <div class="field full">
          <label>{{ 'plans.description' | t }}</label>
          <input class="input" formControlName="description" />
        </div>
        <div class="field">
          <label>{{ 'plans.currency' | t }}</label>
          <input class="input mono" formControlName="currency" maxlength="3" />
        </div>
        <div class="field">
          <label>{{ 'plans.priceMonthly' | t }}</label>
          <input class="input" type="number" min="0" formControlName="priceMonthly" />
        </div>
        <div class="field">
          <label>{{ 'plans.priceYearly' | t }}</label>
          <input class="input" type="number" min="0" formControlName="priceYearly" />
        </div>
        <div class="field">
          <label>{{ 'plans.trialDays' | t }}</label>
          <input class="input" type="number" min="0" formControlName="trialDays" />
        </div>
        <div class="field">
          <label>{{ 'plans.limit.BRANCHES' | t }}</label>
          <input
            class="input"
            type="number"
            min="1"
            formControlName="maxBranches"
            [placeholder]="'plans.unlimited' | t"
          />
        </div>
        <div class="field">
          <label>{{ 'plans.limit.USERS' | t }}</label>
          <input
            class="input"
            type="number"
            min="1"
            formControlName="maxUsers"
            [placeholder]="'plans.unlimited' | t"
          />
        </div>
        <div class="field">
          <label>{{ 'plans.limit.PRODUCTS' | t }}</label>
          <input
            class="input"
            type="number"
            min="1"
            formControlName="maxProducts"
            [placeholder]="'plans.unlimited' | t"
          />
        </div>
        <div class="field">
          <label>{{ 'plans.limit.SMS' | t }}</label>
          <input
            class="input"
            type="number"
            min="0"
            formControlName="smsPerMonth"
            [placeholder]="'plans.unlimited' | t"
          />
        </div>
        <div class="field">
          <label>{{ 'plans.sortOrder' | t }}</label>
          <input class="input" type="number" formControlName="sortOrder" />
        </div>
        <div class="field full">
          <label>{{ 'plans.modules' | t }}</label>
          <div class="row wrap" style="gap: 14px">
            <label class="check"
              ><input type="checkbox" formControlName="insurance" />
              {{ 'plans.feature.INSURANCE' | t }}</label
            >
            <label class="check"
              ><input type="checkbox" formControlName="multiCurrency" />
              {{ 'plans.feature.MULTI_CURRENCY' | t }}</label
            >
            <label class="check"
              ><input type="checkbox" formControlName="integrations" />
              {{ 'plans.feature.INTEGRATIONS' | t }}</label
            >
            <label class="check"
              ><input type="checkbox" formControlName="advancedReports" />
              {{ 'plans.feature.ADVANCED_REPORTS' | t }}</label
            >
          </div>
        </div>
        <label class="check full"
          ><input type="checkbox" formControlName="active" /> {{ 'plans.activeHint' | t }}</label
        >
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="editing.set(false)">
          {{ 'plans.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'plans.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .plans {
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .plan.inactive {
      opacity: 0.6;
    }
    .price b {
      font-size: 22px;
    }
    .limits {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 4px;
      font-size: 13px;
    }
    .limits li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .limits li.off {
      color: var(--muted);
      text-decoration: line-through;
    }
  `,
})
export default class PlansPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly allFeatures = [
    'INSURANCE',
    'MULTI_CURRENCY',
    'INTEGRATIONS',
    'ADVANCED_REPORTS',
  ] as const;
  protected readonly plans = loaded<Plan[]>(() => ({
    path: '/platform/plans',
    options: { noBranch: true },
  }));
  protected readonly editing = signal(false);
  protected readonly uid = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly runLog = signal<string[]>([]);
  protected readonly form = inject(FormBuilder).group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    description: [''],
    currency: ['TZS', Validators.required],
    priceMonthly: [0, [Validators.required, Validators.min(0)]],
    priceYearly: [0, [Validators.required, Validators.min(0)]],
    maxBranches: [null as number | null],
    maxUsers: [null as number | null],
    maxProducts: [null as number | null],
    smsPerMonth: [null as number | null],
    insurance: [false],
    multiCurrency: [false],
    integrations: [false],
    advancedReports: [false],
    trialDays: [30, [Validators.required, Validators.min(0)]],
    sortOrder: [0],
    active: [true],
  });

  protected cap(value: number | null): string {
    return value == null ? this.translations.t('plans.unlimited') : String(value);
  }

  protected edit(p: Plan | null): void {
    this.uid.set(p?.uid ?? null);
    this.form.reset({
      code: p?.code ?? '',
      name: p?.name ?? '',
      description: p?.description ?? '',
      currency: p?.currency ?? 'TZS',
      priceMonthly: p?.priceMonthly ?? 0,
      priceYearly: p?.priceYearly ?? 0,
      maxBranches: p?.maxBranches ?? null,
      maxUsers: p?.maxUsers ?? null,
      maxProducts: p?.maxProducts ?? null,
      smsPerMonth: p?.smsPerMonth ?? null,
      insurance: p?.features.includes('INSURANCE') ?? false,
      multiCurrency: p?.features.includes('MULTI_CURRENCY') ?? false,
      integrations: p?.features.includes('INTEGRATIONS') ?? false,
      advancedReports: p?.features.includes('ADVANCED_REPORTS') ?? false,
      trialDays: p?.trialDays ?? 30,
      sortOrder: p?.sortOrder ?? 0,
      active: p?.active ?? true,
    });
    if (p) {
      this.form.controls.code.disable();
    } else {
      this.form.controls.code.enable();
    }
    this.editing.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const body: PlanInput = {
      code: (v.code ?? '').toUpperCase(),
      name: v.name ?? '',
      description: v.description || null,
      currency: (v.currency ?? 'TZS').toUpperCase(),
      priceMonthly: Number(v.priceMonthly),
      priceYearly: Number(v.priceYearly),
      maxBranches: blankToNull(v.maxBranches),
      maxUsers: blankToNull(v.maxUsers),
      maxProducts: blankToNull(v.maxProducts),
      smsPerMonth: blankToNull(v.smsPerMonth),
      insurance: !!v.insurance,
      multiCurrency: !!v.multiCurrency,
      integrations: !!v.integrations,
      advancedReports: !!v.advancedReports,
      trialDays: Number(v.trialDays),
      sortOrder: Number(v.sortOrder) || 0,
      active: !!v.active,
    };
    this.busy.set(true);
    try {
      const uid = this.uid();
      if (uid) {
        await this.api.put(`/platform/plans/${uid}`, body, { silent: true, noBranch: true });
      } else {
        await this.api.post('/platform/plans', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('plans.saved'));
      this.editing.set(false);
      void this.plans.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async runLifecycle(): Promise<void> {
    const log = await this.api.post<string[]>(
      '/platform/subscriptions/run',
      {},
      { noBranch: true },
    );
    this.runLog.set(log.length ? log : [this.translations.t('plans.nothingToDo')]);
  }
}

function blankToNull(value: number | string | null | undefined): number | null {
  return value === null || value === undefined || value === '' ? null : Number(value);
}
