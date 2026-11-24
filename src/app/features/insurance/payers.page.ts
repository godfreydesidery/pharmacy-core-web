import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { CopayType, PayerView, SchemeView } from '../../core/api/credit.models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

const PRODUCT_TYPES = [
  'MEDICINE',
  'MEDICAL_EQUIPMENT',
  'MEDICAL_SUPPLY',
  'COSMETIC',
  'SUPPLEMENT',
  'BABY_CARE',
  'OTHER',
];

/** Insurers and their schemes: co-pay, annual limit and what each scheme does not cover. */
@Component({
  selector: 'app-payers',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'insurance.payersAmpSchemes' | t }}</h1>
          <p class="sub">
            {{ 'insurance.insurersSuchAsNhifOr' | t }}
          </p>
        </div>
        <div class="actions">
          @if (manage()) {
            <button
              class="btn"
              type="button"
              (click)="editScheme(null)"
              [disabled]="!payers.value()?.length"
            >
              <app-icon name="layers" [size]="16" /> {{ 'insurance.addScheme' | t }}
            </button>
            <button class="btn primary" type="button" (click)="editPayer(null)">
              <app-icon name="plus" [size]="16" /> {{ 'insurance.addPayer' | t }}
            </button>
          }
        </div>
      </div>

      <div class="payers">
        @for (p of payers.value() ?? []; track p.uid) {
          <div class="card payer">
            <div class="card-head">
              <div class="cell-main">
                <span class="thumb tone-purple"><app-icon name="shield" [size]="18" /></span>
                <div>
                  <b>{{ p.name }}</b>
                  <small
                    >{{ p.code }} {{ 'insurance.paysIn' | t }} {{ p.paymentTermsDays }}
                    {{ 'insurance.days' | t
                    }}{{ p.requiresPreauth ? ('ui.l.prePreAuthorisationRequired' | t) : '' }}</small
                  >
                </div>
              </div>
              <div class="actions">
                <app-status [value]="p.active ? 'ACTIVE' : 'INACTIVE'" />
                @if (manage()) {
                  <button
                    class="btn sm"
                    type="button"
                    (click)="editPayer(p)"
                    [attr.aria-label]="'common.edit' | t"
                  >
                    <app-icon name="edit" [size]="14" />
                  </button>
                }
              </div>
            </div>
            <div class="schemes">
              @for (s of schemesOf(p.uid); track s.uid) {
                <div class="scheme">
                  <div class="grow">
                    <b>{{ s.name }}</b>
                    <small class="muted">
                      {{ 'insurance.coPay' | t }} {{ copay(s) }} {{ 'insurance.annualLimit' | t }}
                      {{ s.annualLimit ? (s.annualLimit | money) : 'none' }}
                    </small>
                    @if (s.excludedProductTypes.length) {
                      <div class="chips">
                        @for (t of s.excludedProductTypes; track t) {
                          <span class="badge gray">{{ 'insurance.not' | t }} {{ t | label }}</span>
                        }
                      </div>
                    }
                  </div>
                  <app-status [value]="s.active ? 'ACTIVE' : 'INACTIVE'" />
                  @if (manage()) {
                    <button
                      class="btn sm"
                      type="button"
                      (click)="editScheme(s)"
                      [attr.aria-label]="'common.edit' | t"
                    >
                      <app-icon name="edit" [size]="14" />
                    </button>
                  }
                </div>
              } @empty {
                <p class="muted pad">{{ 'insurance.noSchemesYet' | t }}</p>
              }
            </div>
          </div>
        } @empty {
          <div class="card">
            <app-empty
              [for]="payers"
              icon="shield"
              [title]="'insurance.noPayersYet' | t"
              [text]="'ui.empty.payers' | t"
            />
          </div>
        }
      </div>
    </div>

    <app-modal
      [open]="payerOpen()"
      [title]="payer() ? ('ui.l.editSp' | t) + payer()!.name : ('ui.l.addPayer' | t)"
      (closed)="payerOpen.set(false)"
    >
      <form class="form-grid" [formGroup]="payerForm">
        <div class="field">
          <label>{{ 'insurance.code' | t }}</label><input
            class="input mono"
            formControlName="code"
            placeholder="NHIF"
            [readonly]="!!payer()"
          />
          @if (perr('code'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'insurance.name' | t }}</label><input class="input" formControlName="name" />
          @if (perr('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'insurance.contact' | t }}</label><input
            class="input"
            formControlName="contact"
          />
        </div>
        <div class="field">
          <label>{{ 'insurance.email' | t }}</label><input
            class="input"
            type="email"
            formControlName="email"
          />
        </div>
        <div class="field">
          <label>{{ 'insurance.paysWithinDays' | t }}</label><input
            class="input"
            type="number"
            min="0"
            formControlName="paymentTermsDays"
          />
        </div>
        <label class="check"
          ><input type="checkbox" formControlName="requiresPreauth" />
          {{ 'insurance.requiresPreAuthorisation' | t }}</label
        >
        <label class="check"
          ><input type="checkbox" formControlName="active" /> {{ 'insurance.active' | t }}</label
        >
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="payerOpen.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="savePayer()">
          {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>

    <app-modal
      [open]="schemeOpen()"
      [title]="scheme() ? ('ui.l.editSp' | t) + scheme()!.name : ('ui.l.addScheme' | t)"
      (closed)="schemeOpen.set(false)"
    >
      <form class="form-grid" [formGroup]="schemeForm">
        <div class="field">
          <label>{{ 'insurance.payer' | t }}</label>
          <select class="select" formControlName="payerUid">
            @for (p of payers.value() ?? []; track p.uid) {
              <option [value]="p.uid">{{ p.name }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'insurance.schemeName' | t }}</label><input
            class="input"
            formControlName="name"
            [placeholder]="'insurance.nhifStandard' | t"
          />
          @if (serr('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'insurance.coPay' | t }}</label>
          <select class="select" formControlName="copayType">
            <option value="NONE">{{ 'common.none' | t }}</option>
            <option value="PERCENT">{{ 'insurance.percentOfCoveredItems' | t }}</option>
            <option value="FIXED">{{ 'insurance.fixedAmountPerClaim' | t }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{
            schemeForm.controls.copayType.value === 'PERCENT'
              ? ('ui.l.coPay' | t)
              : ('ui.l.coPayAmount' | t)
          }}</label>
          <input
            class="input"
            type="number"
            min="0"
            step="any"
            formControlName="copayValue"
            [readonly]="schemeForm.controls.copayType.value === 'NONE'"
          />
          @if (serr('copayValue'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'insurance.annualLimitPerMember' | t }}</label><input
            class="input"
            type="number"
            min="0"
            step="any"
            formControlName="annualLimit"
            [placeholder]="'insurance.leave0ForNoLimit' | t"
          />
        </div>
        <div class="field full">
          <label>{{ 'insurance.notCovered' | t }}</label>
          <div class="chips">
            @for (t of productTypes; track t) {
              <button
                type="button"
                class="chip"
                [class.active]="excluded().includes(t)"
                (click)="toggleType(t)"
              >
                {{ t | label }}
              </button>
            }
          </div>
        </div>
        <label class="check"
          ><input type="checkbox" formControlName="active" /> {{ 'insurance.active' | t }}</label
        >
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="schemeOpen.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="saveScheme()">
          {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .payers {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    }
    .schemes {
      display: grid;
      gap: 10px;
      padding: 0 18px 18px;
    }
    .scheme {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .scheme small {
      display: block;
    }
    .grow {
      flex: 1;
    }
    .pad {
      padding: 0 4px;
    }
    .thumb {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
    }
    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .chips {
      margin-top: 6px;
    }
  `,
})
export default class PayersPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly productTypes = PRODUCT_TYPES;
  protected readonly manage = computed(() => this.session.can('partners.manage'));

  protected readonly payers = loaded<PayerView[]>(() => ({
    path: '/insurance/payers',
    options: { noBranch: true },
  }));
  protected readonly schemes = loaded<SchemeView[]>(() => ({
    path: '/insurance/schemes',
    options: { noBranch: true },
  }));

  protected readonly payerOpen = signal(false);
  protected readonly schemeOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly payer = signal<PayerView | null>(null);
  protected readonly scheme = signal<SchemeView | null>(null);
  protected readonly excluded = signal<string[]>([]);

  protected readonly payerForm = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    contact: [''],
    email: [''],
    paymentTermsDays: [30],
    requiresPreauth: [false],
    active: [true],
  });
  protected readonly schemeForm = this.fb.group({
    payerUid: ['', Validators.required],
    name: ['', Validators.required],
    copayType: ['PERCENT' as CopayType],
    copayValue: [10],
    annualLimit: [0],
    active: [true],
  });

  protected schemesOf(payerUid: string): SchemeView[] {
    return (this.schemes.value() ?? []).filter((s) => s.payerUid === payerUid);
  }

  protected copay(s: SchemeView): string {
    if (s.copayType === 'PERCENT') {
      return `${s.copayValue}%`;
    }
    if (s.copayType === 'FIXED') {
      return `${s.copayValue} per claim`;
    }
    return 'none';
  }

  protected perr(name: string): string | null {
    return controlError(this.payerForm.get(name));
  }

  protected serr(name: string): string | null {
    return controlError(this.schemeForm.get(name));
  }

  protected toggleType(type: string): void {
    const now = this.excluded();
    this.excluded.set(now.includes(type) ? now.filter((t) => t !== type) : [...now, type]);
  }

  protected editPayer(p: PayerView | null): void {
    this.payer.set(p);
    this.payerForm.reset({
      code: p?.code ?? '',
      name: p?.name ?? '',
      contact: p?.contact ?? '',
      email: p?.email ?? '',
      paymentTermsDays: p?.paymentTermsDays ?? 30,
      requiresPreauth: p?.requiresPreauth ?? false,
      active: p?.active ?? true,
    });
    this.payerOpen.set(true);
  }

  protected editScheme(s: SchemeView | null): void {
    this.scheme.set(s);
    this.excluded.set(s?.excludedProductTypes ?? ['COSMETIC']);
    this.schemeForm.reset({
      payerUid: s?.payerUid ?? this.payers.value()?.[0]?.uid ?? '',
      name: s?.name ?? '',
      copayType: s?.copayType ?? 'PERCENT',
      copayValue: s?.copayValue ?? 10,
      annualLimit: s?.annualLimit ?? 0,
      active: s?.active ?? true,
    });
    this.schemeOpen.set(true);
  }

  protected async savePayer(): Promise<void> {
    if (!validate(this.payerForm)) {
      return;
    }
    const v = this.payerForm.getRawValue();
    const body = {
      ...v,
      contact: v.contact || null,
      email: v.email || null,
      paymentTermsDays: Number(v.paymentTermsDays) || 0,
    };
    const current = this.payer();
    await this.save(this.payerForm, async () => {
      if (current) {
        await this.api.put(`/insurance/payers/${current.uid}`, body, {
          silent: true,
          noBranch: true,
        });
      } else {
        await this.api.post('/insurance/payers', body, { silent: true, noBranch: true });
      }
      this.payerOpen.set(false);
      this.toasts.success(this.translations.t('toast.payerSaved'));
    });
  }

  protected async saveScheme(): Promise<void> {
    if (!validate(this.schemeForm)) {
      return;
    }
    const v = this.schemeForm.getRawValue();
    const body = {
      ...v,
      copayValue: Number(v.copayValue) || 0,
      annualLimit: Number(v.annualLimit) || null,
      excludedProductTypes: this.excluded(),
      excludedProductUids: this.scheme()?.excludedProductUids ?? [],
    };
    const current = this.scheme();
    await this.save(this.schemeForm, async () => {
      if (current) {
        await this.api.put(`/insurance/schemes/${current.uid}`, body, {
          silent: true,
          noBranch: true,
        });
      } else {
        await this.api.post('/insurance/schemes', body, { silent: true, noBranch: true });
      }
      this.schemeOpen.set(false);
      this.toasts.success(this.translations.t('toast.schemeSaved'));
    });
  }

  private async save(
    form: Parameters<typeof applyApiError>[0],
    work: () => Promise<void>,
  ): Promise<void> {
    this.busy.set(true);
    try {
      await work();
      await Promise.all([this.payers.reload(), this.schemes.reload()]);
    } catch (failure) {
      if (!applyApiError(form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
