import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../core/api/api.service';
import {
  Category,
  Manufacturer,
  Product,
  ProductInput,
  ProductType,
  Schedule,
  Storage,
  TrackingMode,
  UnitOfMeasure,
  PlanPriceView,
  PriceChange,
} from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { PRODUCT_TYPES, TRACKING_MODES, UNITS, defaultTracking } from '../../core/ui/product-types';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

const SCHEDULES: Schedule[] = ['OTC', 'PRESCRIPTION', 'CONTROLLED'];
const STORAGE: Storage[] = ['ROOM_TEMPERATURE', 'COOL_DRY', 'REFRIGERATED'];

/**
 * Create or edit a product. The form follows the product type: a medicine has its clinical fields
 * (generic name, ATC, dosage form, strength, schedule); equipment such as a wheelchair its brand,
 * model, warranty and serial numbers; anything else just what it needs.
 */
@Component({
  selector: 'app-product-form',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <a class="muted row" routerLink="/catalogue/products"
            ><app-icon name="arrow-left" [size]="15" /> {{ 'catalogue.products' | t }}</a
          >
          <h1 style="margin-top:6px">
            {{
              editing() ? form.controls.name.value || ('ui.l.product' | t) : ('ui.l.newProduct' | t)
            }}
          </h1>
          <p class="sub">
            {{
              editing()
                ? ('ui.l.versionSp' | t) + version()
                : ('ui.l.addAMedicineEquipmentOrAny' | t)
            }}
          </p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/catalogue/products">{{
            canEdit() ? ('ui.l.cancel' | t) : ('ui.l.back' | t)
          }}</a>
          @if (canEdit()) {
            <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
              <app-icon name="check" [size]="16" /> {{ 'catalogue.save' | t }}
            </button>
          }
        </div>
      </div>

      <form [formGroup]="form" class="stack" (ngSubmit)="save()">
        <fieldset class="card card-pad stack" [disabled]="!canEdit()">
          <h3>{{ 'catalogue.whatIsIt' | t }}</h3>
          <div class="type-grid" role="radiogroup" [attr.aria-label]="'catalogue.productType' | t">
            @for (t of types; track t.code) {
              <button
                type="button"
                class="type-card"
                role="radio"
                [attr.aria-checked]="type() === t.code"
                [class.on]="type() === t.code"
                (click)="chooseType(t.code)"
              >
                <span class="bubble tone-{{ t.tone }}"
                  ><app-icon [name]="t.icon" [size]="20"
                /></span>
                <b>{{ 'ui.ptype.' + t.code | t: null : t.label }}</b>
                <small>{{ 'ui.ptype.' + t.code + '.hint' | t: null : t.hint }}</small>
              </button>
            }
          </div>
        </fieldset>

        <div class="grid two">
          <fieldset class="card card-pad stack" [disabled]="!canEdit()">
            <h3>{{ 'catalogue.identity' | t }}</h3>
            <div class="form-grid">
              <div class="field full">
                <label>{{ 'catalogue.name' | t }}</label
                ><input
                  class="input"
                  formControlName="name"
                  [placeholder]="medicine() ? 'Paracetamol 500mg' : 'Wheelchair Standard 18&quot;'"
                />
                @if (err('name'); as m) {
                  <span class="error">{{ m }}</span>
                }
              </div>
              <div class="field">
                <label>{{ 'catalogue.code' | t }}</label
                ><input
                  class="input"
                  formControlName="sku"
                  [placeholder]="'catalogue.codeAuto' | t"
                />
                <span class="hint">{{ 'catalogue.codeHint' | t }}</span>
                @if (err('sku'); as m) {
                  <span class="error">{{ m }}</span>
                }
              </div>
              <div class="field">
                <label>{{ 'catalogue.gtinBarcode' | t }}</label
                ><input class="input" formControlName="gtin" inputmode="numeric" />
                @if (err('gtin'); as m) {
                  <span class="error">{{ m }}</span>
                }
              </div>
              <div class="field">
                <label>{{ 'catalogue.category' | t }}</label
                ><select class="select" formControlName="categoryUid">
                  <option value="">—</option>
                  @for (c of categoryTree(); track c.uid) {
                    <option [value]="c.uid">{{ c.indent }}{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label>{{ 'catalogue.manufacturer' | t }}</label
                ><select class="select" formControlName="manufacturerUid">
                  <option value="">—</option>
                  @for (m of manufacturers.value() ?? []; track m.uid) {
                    <option [value]="m.uid">{{ m.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label>{{ 'catalogue.soldPer' | t }}</label
                ><select class="select" formControlName="unitOfMeasure">
                  @for (u of units; track u) {
                    <option [value]="u">{{ u | label }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label>{{ 'catalogue.storage' | t }}</label
                ><select class="select" formControlName="storage">
                  @for (s of storage; track s) {
                    <option [value]="s">{{ s | label }}</option>
                  }
                </select>
              </div>
              <div class="field full">
                <label>{{ 'catalogue.stockTracking' | t }}</label>
                <div class="tracking" [class.locked]="unitsHeld() > 0">
                  @for (m of trackingModes; track m.code) {
                    <label class="pill" [class.on]="tracking() === m.code">
                      <input type="radio" formControlName="trackingMode" [value]="m.code" />
                      <b>{{ 'ui.tracking.' + m.code | t: null : m.label }}</b
                      ><small>{{ 'ui.tracking.' + m.code + '.hint' | t: null : m.hint }}</small>
                    </label>
                  }
                </div>
                @if (unitsHeld() > 0) {
                  <span class="hint"
                    ><app-icon name="lock" [size]="13" />
                    {{ 'catalogue.trackingLocked' | t: { count: unitsHeld() } }}</span
                  >
                } @else if (tracking() !== defaultTrackingFor()) {
                  <span class="hint">{{
                    'ui.ptype.usualTracking'
                      | t
                        : {
                            type: 'ui.ptype.' + type() | t,
                            mode: trackingLabel(defaultTrackingFor()),
                          }
                  }}</span>
                }
              </div>
            </div>
          </fieldset>

          @if (medicine()) {
            <fieldset class="card card-pad stack" [disabled]="!canEdit()">
              <h3><app-icon name="pill" [size]="18" /> {{ 'catalogue.medicineDetails' | t }}</h3>
              <div class="form-grid">
                <div class="field">
                  <label>{{ 'catalogue.genericNameInn' | t }}</label
                  ><input class="input" formControlName="genericName" placeholder="Paracetamol" />
                  @if (err('genericName'); as m) {
                    <span class="error">{{ m }}</span>
                  }
                </div>
                <div class="field">
                  <label>{{ 'catalogue.atcCode' | t }}</label
                  ><input class="input" formControlName="atcCode" placeholder="N02BE01" />
                  @if (err('atcCode'); as m) {
                    <span class="error">{{ m }}</span>
                  }
                </div>
                <div class="field">
                  <label>{{ 'catalogue.dosageForm' | t }}</label
                  ><select class="select" formControlName="dosageForm">
                    @for (f of forms.value() ?? []; track f) {
                      <option [value]="f">{{ f | label }}</option>
                    }
                  </select>
                  @if (err('dosageForm'); as m) {
                    <span class="error">{{ m }}</span>
                  }
                </div>
                <div class="field">
                  <label>{{ 'catalogue.strength' | t }}</label
                  ><input class="input" formControlName="strength" placeholder="500 mg" />
                </div>
                <div class="field">
                  <label>{{ 'catalogue.packSize' | t }}</label
                  ><input class="input" formControlName="packSize" placeholder="Strip of 10" />
                </div>
                <div class="field">
                  <label>{{ 'catalogue.schedule' | t }}</label
                  ><select class="select" formControlName="schedule">
                    @for (s of schedules; track s) {
                      <option [value]="s">{{ s | label }}</option>
                    }
                  </select>
                </div>
              </div>
            </fieldset>
          } @else {
            <fieldset class="card card-pad stack" [disabled]="!canEdit()">
              <h3>
                <app-icon [name]="typeIcon()" [size]="18" /> {{ 'catalogue.itemDetails' | t }}
              </h3>
              <div class="form-grid">
                <div class="field">
                  <label>{{ 'catalogue.brand' | t }}</label
                  ><input class="input" formControlName="brand" placeholder="Invacare" />
                </div>
                <div class="field">
                  <label>{{ 'catalogue.model' | t }}</label
                  ><input class="input" formControlName="model" placeholder="Action 1" />
                </div>
                <div class="field">
                  <label>{{ 'catalogue.packSize' | t }}</label
                  ><input class="input" formControlName="packSize" placeholder="Box of 100" />
                </div>
                <div class="field">
                  <label>{{ 'catalogue.warrantyMonths' | t }}</label
                  ><input
                    class="input"
                    type="number"
                    min="0"
                    max="120"
                    formControlName="warrantyMonths"
                    placeholder="12"
                  />
                  @if (err('warrantyMonths'); as m) {
                    <span class="error">{{ m }}</span>
                  }
                </div>
              </div>
              @if (tracking() === 'SERIAL') {
                <label class="check"
                  ><input type="checkbox" formControlName="requiresSerialAtSale" />
                  {{ 'catalogue.askForTheSerialNumberAt' | t }}</label
                >
                <div class="notice tone-purple">
                  <app-icon name="barcode" />
                  {{
                    'ui.t.serialNotice' | t: { name: form.controls.name.value || ('ui.t.unit' | t) }
                  }}
                </div>
              }
            </fieldset>
          }
        </div>

        <fieldset class="card card-pad stack" [disabled]="!canEdit()">
          <h3>{{ 'catalogue.pricingStock' | t }}</h3>
          <div class="form-grid four">
            <div class="field">
              <label>{{ 'catalogue.costPrice' | t }}</label
              ><input class="input" type="number" min="0" step="any" formControlName="costPrice" />
              @if (err('costPrice'); as m) {
                <span class="error">{{ m }}</span>
              }
            </div>
            <div class="field">
              <label>{{ 'catalogue.sellingPrice' | t }}</label
              ><input
                class="input"
                type="number"
                min="0"
                step="any"
                formControlName="sellingPrice"
              />
              @if (err('sellingPrice'); as m) {
                <span class="error">{{ m }}</span>
              }
            </div>
            <div class="field">
              <label>{{ 'catalogue.taxRate' | t }}</label
              ><input
                class="input"
                type="number"
                min="0"
                max="100"
                step="any"
                formControlName="taxRatePercent"
              />
            </div>
            <div class="field">
              <label>{{ 'catalogue.reorderLevel' | t }}</label
              ><input class="input" type="number" min="0" formControlName="reorderLevel" />
            </div>
          </div>
          <div class="notice tone-blue">
            <app-icon name="trend" /> {{ 'ui.t.margin' | t: { margin: margin() } }}
          </div>
          @if (editing()) {
            <label class="check"
              ><input type="checkbox" formControlName="active" />
              {{ 'catalogue.activeCanBeBoughtAndSold' | t }}</label
            >
          }
        </fieldset>
      </form>
      @if (editing()) {
        <div class="card mt" data-testid="prices-in-plans">
          <div class="card-head">
            <h3>{{ 'plans.inPlans' | t }}</h3>
            <a class="btn ghost sm" routerLink="/catalogue/pricing-plans">{{
              'plans.title' | t
            }}</a>
          </div>
          <div class="table-wrap">
            <table class="table compact">
              <tbody>
                @for (pp of planPrices.value() ?? []; track pp.planUid) {
                  <tr [class.off]="!pp.active">
                    <td>
                      <b>{{ pp.planUid ? pp.planName : ('plans.normal' | t) }}</b>
                    </td>
                    <td class="muted">{{ 'plans.basis.' + pp.basis | t }}</td>
                    <td class="right">
                      {{ pp.price === null ? '—' : (pp.price | money) }}
                      @for (b of pp.breaks; track b.minQuantity) {
                        <small class="muted block"
                          >≥ {{ b.minQuantity }}: {{ b.price | money }}</small
                        >
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <h4 class="history-title">{{ 'plans.history' | t }}</h4>
          <div class="table-wrap">
            <table class="table compact">
              <tbody>
                @for (h of priceHistory.value() ?? []; track $index) {
                  <tr>
                    <td>{{ h.planName === 'Normal Sale' ? ('plans.normal' | t) : h.planName }}</td>
                    <td class="right">
                      {{ h.oldPrice === null ? '—' : (h.oldPrice | money) }} →
                      <b>{{ h.newPrice === null ? '—' : (h.newPrice | money) }}</b>
                    </td>
                    <td class="muted small">
                      {{ 'plans.source.' + h.source | t }} · {{ h.changedBy }}
                    </td>
                    <td class="muted small right">{{ h.changedAt | when }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td class="muted">{{ 'plans.noHistory' | t }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .history-title {
      padding: 12px 16px 0;
      margin: 0;
    }
    tr.off {
      opacity: 0.55;
    }
    .block {
      display: block;
    }
    fieldset {
      border: 1px solid var(--border);
      margin: 0;
      min-width: 0;
    }
    fieldset:disabled {
      opacity: 0.85;
    }
    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .type-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .type-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition:
        border-color 0.15s,
        box-shadow 0.15s,
        transform 0.15s;
    }
    .type-card:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }
    .type-card.on {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
    }
    .type-card small {
      color: var(--muted);
      font-size: 11.5px;
      line-height: 1.35;
    }
    .type-card .bubble {
      width: 38px;
      height: 38px;
      border-radius: 11px;
      display: grid;
      place-items: center;
    }
    .tracking {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }
    .tracking.locked .pill {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .tracking .pill {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      cursor: pointer;
    }
    .tracking .pill.on {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 7%, transparent);
    }
    .tracking .pill input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .tracking small,
    .hint {
      color: var(--muted);
      font-size: 11.5px;
    }
    .form-grid.four {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
  `,
})
export default class ProductFormPage implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  readonly uid = input<string | undefined>();
  protected readonly schedules = SCHEDULES;
  protected readonly storage = STORAGE;
  protected readonly types = PRODUCT_TYPES;
  protected readonly trackingModes = TRACKING_MODES;
  protected readonly units = UNITS;
  private readonly translations = inject(Translations);
  protected readonly busy = signal(false);
  protected readonly version = signal(0);
  /** Units held across the tenant; while any are, the tracking mode cannot change. */
  protected readonly unitsHeld = signal(0);
  protected readonly editing = computed(() => !!this.uid() && this.uid() !== 'new');
  protected readonly canEdit = computed(() => this.session.can('catalogue.manage'));
  /** The medicine's price in Normal Sale and every plan, and its price history. */
  protected readonly planPrices = loaded<PlanPriceView[]>(() =>
    this.editing()
      ? { path: `/products/${this.uid()}/plan-prices`, options: { noBranch: true, silent: true } }
      : null,
  );
  protected readonly priceHistory = loaded<PriceChange[]>(() =>
    this.editing()
      ? { path: `/products/${this.uid()}/price-history`, options: { noBranch: true, silent: true } }
      : null,
  );
  protected readonly categories = loaded<Category[]>(() => ({
    path: '/categories',
    options: { noBranch: true },
  }));
  protected readonly manufacturers = loaded<Manufacturer[]>(() => ({
    path: '/manufacturers',
    options: { noBranch: true },
  }));
  protected readonly forms = loaded<string[]>(() => ({
    path: '/dosage-forms',
    options: { noBranch: true },
  }));
  private readonly prices = signal({ cost: 0, price: 0 });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    productType: ['MEDICINE' as ProductType, Validators.required],
    trackingMode: ['BATCH_EXPIRY' as TrackingMode, Validators.required],
    unitOfMeasure: ['STRIP' as UnitOfMeasure, Validators.required],
    name: ['', Validators.required],
    genericName: [''],
    sku: [''],
    gtin: ['', Validators.pattern(/^(\d{8}|\d{12,14})?$/)],
    atcCode: ['', Validators.pattern(/^([A-Za-z]\d{2}[A-Za-z]{0,2}\d{0,2})?$/)],
    categoryUid: [''],
    manufacturerUid: [''],
    dosageForm: ['TABLET'],
    strength: [''],
    packSize: [''],
    schedule: ['OTC' as Schedule, Validators.required],
    storage: ['ROOM_TEMPERATURE' as Storage, Validators.required],
    brand: [''],
    model: [''],
    warrantyMonths: [null as number | null, [Validators.min(0), Validators.max(120)]],
    requiresSerialAtSale: [true],
    costPrice: [0, [Validators.required, Validators.min(0)]],
    sellingPrice: [0, [Validators.required, Validators.min(0)]],
    taxRatePercent: [0, [Validators.min(0), Validators.max(100)]],
    reorderLevel: [0, Validators.min(0)],
    active: [true],
  });

  private readonly typeValue = toSignal(this.form.controls.productType.valueChanges, {
    initialValue: this.form.controls.productType.value,
  });
  private readonly trackingValue = toSignal(this.form.controls.trackingMode.valueChanges, {
    initialValue: this.form.controls.trackingMode.value,
  });
  protected readonly type = computed(() => this.typeValue());
  protected readonly tracking = computed(() => this.trackingValue());
  protected readonly medicine = computed(() => this.type() === 'MEDICINE');
  protected readonly defaultTrackingFor = computed(() => defaultTracking(this.type()));
  protected readonly typeIcon = computed(
    () => PRODUCT_TYPES.find((t) => t.code === this.type())?.icon ?? 'tag',
  );

  /** The category tree, parents before children, indented by depth. */
  protected readonly categoryTree = computed(() =>
    [...(this.categories.value() ?? [])]
      .sort((a, b) => (a.path ?? a.name).localeCompare(b.path ?? b.name))
      .map((c) => {
        const depth = (c.path ?? c.name).split(' › ').length - 1;
        return { uid: c.uid, name: c.name, indent: '   '.repeat(depth) };
      }),
  );

  protected readonly margin = computed(() => {
    const { cost, price } = this.prices();
    return price > 0 ? `${Math.round(((price - cost) / price) * 100)}%` : '—';
  });

  constructor() {
    this.form.valueChanges.subscribe((v) =>
      this.prices.set({ cost: Number(v.costPrice) || 0, price: Number(v.sellingPrice) || 0 }),
    );
  }

  async ngOnInit(): Promise<void> {
    if (!this.editing()) {
      return;
    }
    const product = await this.api.get<Product>(`/products/${this.uid()}`, undefined, {
      noBranch: true,
    });
    this.version.set(product.version);
    const held = await this.api
      .get<{ unitsHeld: number }>(`/stock/${this.uid()}/held`, undefined, {
        noBranch: true,
        silent: true,
      })
      .catch(() => null);
    this.unitsHeld.set(held?.unitsHeld ?? 0);
    if (this.unitsHeld() > 0) {
      this.form.controls.trackingMode.disable();
    }
    this.form.patchValue({
      ...product,
      productType: product.productType ?? 'MEDICINE',
      trackingMode: product.trackingMode ?? defaultTracking(product.productType),
      unitOfMeasure: product.unitOfMeasure ?? 'PIECE',
      genericName: product.genericName ?? '',
      sku: product.sku ?? '',
      gtin: product.gtin ?? '',
      atcCode: product.atcCode ?? '',
      categoryUid: product.categoryUid ?? '',
      manufacturerUid: product.manufacturerUid ?? '',
      dosageForm: product.dosageForm ?? 'TABLET',
      strength: product.strength ?? '',
      packSize: product.packSize ?? '',
      brand: product.brand ?? '',
      model: product.model ?? '',
      warrantyMonths: product.warrantyMonths ?? null,
      requiresSerialAtSale: product.requiresSerialAtSale ?? true,
    });
  }

  /** A new type brings its usual tracking and unit, unless the product is being edited. */
  protected chooseType(type: ProductType): void {
    this.form.controls.productType.setValue(type);
    if (!this.editing()) {
      this.form.controls.trackingMode.setValue(defaultTracking(type));
      this.form.controls.unitOfMeasure.setValue(
        type === 'MEDICINE' ? 'STRIP' : type === 'MEDICAL_SUPPLY' ? 'BOX' : 'PIECE',
      );
    }
  }

  protected trackingLabel(mode: TrackingMode): string {
    const fallback = TRACKING_MODES.find((m) => m.code === mode)?.label ?? mode;
    return this.translations.t(`ui.tracking.${mode}`, undefined, fallback).toLowerCase();
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const nullable = (value: string) => (value.trim() ? value.trim() : null);
    const medicine = v.productType === 'MEDICINE';
    const body: ProductInput & { active?: boolean; version?: number } = {
      name: v.name.trim(),
      genericName: medicine ? nullable(v.genericName) : null,
      sku: nullable(v.sku),
      gtin: nullable(v.gtin),
      atcCode: medicine ? (nullable(v.atcCode)?.toUpperCase() ?? null) : null,
      categoryUid: v.categoryUid || null,
      manufacturerUid: v.manufacturerUid || null,
      dosageForm: medicine ? v.dosageForm : null,
      strength: medicine ? nullable(v.strength) : null,
      packSize: nullable(v.packSize),
      schedule: medicine ? v.schedule : 'OTC',
      storage: v.storage,
      costPrice: Number(v.costPrice),
      sellingPrice: Number(v.sellingPrice),
      taxRatePercent: Number(v.taxRatePercent),
      reorderLevel: Number(v.reorderLevel),
      productType: v.productType,
      trackingMode: v.trackingMode,
      unitOfMeasure: v.unitOfMeasure,
      brand: medicine ? null : nullable(v.brand),
      model: medicine ? null : nullable(v.model),
      warrantyMonths:
        medicine || v.warrantyMonths === null || (v.warrantyMonths as unknown) === ''
          ? null
          : Number(v.warrantyMonths),
      requiresSerialAtSale: v.trackingMode === 'SERIAL' ? v.requiresSerialAtSale : null,
    };
    this.busy.set(true);
    try {
      if (this.editing()) {
        const saved = await this.api.put<Product>(
          `/products/${this.uid()}`,
          { ...body, active: v.active, version: this.version() },
          { silent: true, noBranch: true },
        );
        this.version.set(saved.version);
        this.toasts.success(this.translations.t('toast.productSaved'));
      } else {
        const saved = await this.api.post<Product>('/products', body, {
          silent: true,
          noBranch: true,
        });
        this.toasts.success(this.translations.t('toast.productAdded', { name: saved.name }));
        await this.router.navigate(['/catalogue/products', saved.uid], { replaceUrl: true });
      }
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
