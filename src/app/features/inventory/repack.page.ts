import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Product } from '../../core/api/models';
import { loaded, pagedList } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';

type Kind = 'BREAK_BULK' | 'REPACK' | 'COMPOUND';
type Tab = 'new' | 'history' | 'packs' | 'formulas';

interface TransformationView {
  uid: string;
  number: string;
  type: Kind;
  inputs: {
    productUid: string;
    productName: string;
    batchNumber: string;
    expiryDate: string | null;
    quantity: number;
    unitCost: number;
  }[];
  outputProductUid: string;
  outputProductName: string;
  outputBatchNumber: string;
  outputExpiryDate: string | null;
  outputQuantity: number;
  outputUnitCost: number;
  note: string | null;
  createdAt: string;
  createdBy: string;
}

interface PackLink {
  packProductUid: string;
  packProductName: string;
  unitProductUid: string;
  unitProductName: string;
  unitsPerPack: number;
}

interface FormulaItem {
  ingredientUid: string;
  ingredientName: string;
  quantity: number;
}

interface Row {
  productUid: string | null;
  productName: string;
  quantity: number;
}

/**
 * Inventory → Repack & compound: open packs into units, repack bulk into the pharmacy's own packs,
 * compound preparations from their formula; the history traces every output batch to its inputs.
 */
@Component({
  selector: 'app-repack',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head no-print">
        <div>
          <h1>{{ 'repack.title' | t }}</h1>
          <p class="sub">{{ 'repack.sub' | t }}</p>
        </div>
      </div>
      <div class="card mb no-print">
        <div class="tabs">
          @for (t of tabs; track t) {
            <button type="button" [class.active]="tab() === t" (click)="tab.set(t)">
              {{ 'repack.tab.' + t | t }}
            </button>
          }
        </div>
      </div>
      @if (!session.branch() && (tab() === 'new' || tab() === 'history')) {
        <app-branch-required [what]="'repack.what' | t" />
      } @else {
        @switch (tab()) {
          @case ('new') {
            <div class="card card-pad stack no-print">
              <div class="segmented">
                @for (k of kinds; track k) {
                  <button type="button" [class.active]="kind() === k" (click)="setKind(k)">
                    {{ 'repack.kind.' + k | t }}
                  </button>
                }
              </div>
              <p class="muted">{{ 'repack.hint.' + kind() | t }}</p>

              <h4>{{ 'repack.output' | t }}</h4>
              <div class="form-grid">
                <div class="field full">
                  <label>{{ 'repack.product' | t }}</label>
                  <app-lookup
                    path="/products"
                    [placeholder]="output().productName || ('repack.searchProduct' | t)"
                    [display]="productName"
                    (picked)="pickOutput($event)"
                  />
                </div>
                <div class="field">
                  <label>{{ 'repack.quantity' | t }}</label>
                  <input
                    class="input"
                    type="number"
                    min="1"
                    [value]="output().quantity"
                    (input)="setOutputQuantity(+$any($event.target).value)"
                  />
                </div>
                <div class="field">
                  <label>{{ 'repack.batch' | t }}</label>
                  <input
                    class="input"
                    [value]="batchNumber()"
                    (input)="batchNumber.set($any($event.target).value)"
                    [placeholder]="'repack.batchAuto' | t"
                  />
                </div>
                <div class="field">
                  <label>{{ 'repack.expiry' | t }}</label>
                  <input
                    class="input"
                    type="date"
                    [value]="expiry()"
                    (change)="expiry.set($any($event.target).value)"
                  />
                  <span class="hint">{{ 'repack.expiryHint' | t }}</span>
                </div>
              </div>

              <h4>{{ 'repack.inputs' | t }}</h4>
              @for (row of inputs(); track $index; let i = $index) {
                <div class="row wrap" style="gap: 8px; align-items: end">
                  <div class="field grow">
                    <label>{{ 'repack.product' | t }}</label>
                    <app-lookup
                      path="/products"
                      [placeholder]="row.productName || ('repack.searchProduct' | t)"
                      [display]="productName"
                      (picked)="pickInput(i, $event)"
                    />
                  </div>
                  <div class="field">
                    <label>{{ 'repack.quantity' | t }}</label>
                    <input
                      class="input"
                      type="number"
                      min="1"
                      style="width: 110px"
                      [value]="row.quantity"
                      (input)="setInputQuantity(i, +$any($event.target).value)"
                    />
                  </div>
                  @if (inputs().length > 1) {
                    <button
                      class="icon-btn"
                      type="button"
                      (click)="removeInput(i)"
                      [attr.aria-label]="'repack.remove' | t"
                    >
                      <app-icon name="x" [size]="16" />
                    </button>
                  }
                </div>
              }
              @if (kind() === 'COMPOUND') {
                <button class="btn sm" type="button" (click)="addInput()">
                  <app-icon name="plus" [size]="14" /> {{ 'repack.addIngredient' | t }}
                </button>
              }
              <div class="field">
                <label>{{ 'repack.note' | t }}</label>
                <input
                  class="input"
                  [value]="note()"
                  (input)="note.set($any($event.target).value)"
                />
              </div>
              <div class="row" style="justify-content: flex-end">
                <button class="btn primary" type="button" [disabled]="busy()" (click)="submit()">
                  {{ 'repack.record' | t }}
                </button>
              </div>
            </div>
          }
          @case ('history') {
            <div class="card no-print">
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{{ 'repack.number' | t }}</th>
                      <th>{{ 'repack.type' | t }}</th>
                      <th>{{ 'repack.from' | t }}</th>
                      <th>{{ 'repack.made' | t }}</th>
                      <th>{{ 'repack.batch' | t }}</th>
                      <th>{{ 'repack.expiry' | t }}</th>
                      <th class="right">{{ 'repack.unitCost' | t }}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of history.items(); track t.uid) {
                      <tr>
                        <td class="mono">
                          {{ t.number }}<small class="muted block">{{ t.createdAt | when }}</small>
                        </td>
                        <td>{{ 'repack.kind.' + t.type | t }}</td>
                        <td>
                          @for (i of t.inputs; track $index) {
                            <div>
                              {{ i.quantity }} × {{ i.productName }}
                              <small class="muted mono">{{ i.batchNumber }}</small>
                            </div>
                          }
                        </td>
                        <td>
                          <b>{{ t.outputQuantity }} × {{ t.outputProductName }}</b>
                        </td>
                        <td class="mono">{{ t.outputBatchNumber }}</td>
                        <td>{{ t.outputExpiryDate ?? '—' }}</td>
                        <td class="right">{{ t.outputUnitCost | money }}</td>
                        <td class="right">
                          <button class="btn sm" type="button" (click)="label.set(t)">
                            <app-icon name="printer" [size]="14" /> {{ 'repack.label' | t }}
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="8" class="empty">{{ 'repack.noHistory' | t }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <app-pager
                [count]="history.items().length"
                [total]="history.total()"
                [hasMore]="history.hasMore()"
                [loading]="history.loading()"
                (more)="history.more()"
              />
            </div>
          }
          @case ('packs') {
            <div class="card card-pad mb">
              <div class="row wrap" style="gap: 8px; align-items: end">
                <div class="field grow">
                  <label>{{ 'repack.pack' | t }}</label>
                  <app-lookup
                    path="/products"
                    [placeholder]="'repack.searchProduct' | t"
                    [display]="productName"
                    (picked)="linkDraft.pack = $event?.uid ?? null"
                  />
                </div>
                <div class="field grow">
                  <label>{{ 'repack.unit' | t }}</label>
                  <app-lookup
                    path="/products"
                    [placeholder]="'repack.searchProduct' | t"
                    [display]="productName"
                    (picked)="linkDraft.unit = $event?.uid ?? null"
                  />
                </div>
                <div class="field">
                  <label>{{ 'repack.unitsPerPack' | t }}</label>
                  <input class="input" type="number" min="2" style="width: 110px" #units />
                </div>
                <button class="btn primary" type="button" (click)="saveLink(+units.value)">
                  {{ 'repack.save' | t }}
                </button>
              </div>
            </div>
            <div class="card">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'repack.pack' | t }}</th>
                    <th>{{ 'repack.unit' | t }}</th>
                    <th class="right">{{ 'repack.unitsPerPack' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of links.value() ?? []; track l.unitProductUid) {
                    <tr>
                      <td>{{ l.packProductName }}</td>
                      <td>{{ l.unitProductName }}</td>
                      <td class="right">{{ l.unitsPerPack }}</td>
                      <td class="right">
                        <button class="btn sm ghost" type="button" (click)="removeLink(l)">
                          {{ 'repack.remove' | t }}
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="empty">{{ 'repack.noLinks' | t }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('formulas') {
            <div class="card card-pad stack">
              <div class="field">
                <label>{{ 'repack.preparation' | t }}</label>
                <app-lookup
                  path="/products"
                  [placeholder]="formulaProductName() || ('repack.searchProduct' | t)"
                  [display]="productName"
                  (picked)="pickFormulaProduct($event)"
                />
              </div>
              @if (formulaProduct()) {
                <p class="muted">{{ 'repack.formulaHint' | t }}</p>
                @for (row of formula(); track $index; let i = $index) {
                  <div class="row wrap" style="gap: 8px; align-items: end">
                    <div class="field grow">
                      <label>{{ 'repack.ingredient' | t }}</label>
                      <app-lookup
                        path="/products"
                        [placeholder]="row.ingredientName || ('repack.searchProduct' | t)"
                        [display]="productName"
                        (picked)="
                          row.ingredientUid = $event?.uid ?? '';
                          row.ingredientName = $event?.name ?? ''
                        "
                      />
                    </div>
                    <div class="field">
                      <label>{{ 'repack.perUnit' | t }}</label>
                      <input
                        class="input"
                        type="number"
                        min="0"
                        step="any"
                        style="width: 110px"
                        [value]="row.quantity"
                        (input)="row.quantity = +$any($event.target).value"
                      />
                    </div>
                    <button
                      class="icon-btn"
                      type="button"
                      (click)="removeFormulaRow(i)"
                      [attr.aria-label]="'repack.remove' | t"
                    >
                      <app-icon name="x" [size]="16" />
                    </button>
                  </div>
                }
                <div class="row" style="gap: 8px">
                  <button class="btn sm" type="button" (click)="addFormulaRow()">
                    <app-icon name="plus" [size]="14" /> {{ 'repack.addIngredient' | t }}
                  </button>
                  <span class="grow"></span>
                  <button class="btn primary" type="button" (click)="saveFormula()">
                    {{ 'repack.save' | t }}
                  </button>
                </div>
              }
            </div>
          }
        }
      }
    </div>

    <app-modal [open]="!!label()" [title]="'repack.label' | t" (closed)="label.set(null)">
      @if (label(); as t) {
        <div class="drug-label">
          <b class="pharmacy">{{ session.tenant()?.name }}</b>
          <div class="name">{{ t.outputProductName }}</div>
          <div class="row between">
            <span
              >{{ 'repack.batch' | t }}: <b class="mono">{{ t.outputBatchNumber }}</b></span
            ><span
              >{{ 'repack.expiry' | t }}: <b>{{ t.outputExpiryDate ?? '—' }}</b></span
            >
          </div>
          <div class="muted small">
            {{ 'repack.from' | t }}:
            @for (i of t.inputs; track $index) {
              {{ i.productName }} ({{ i.batchNumber }})
            }
          </div>
          <div class="directions">{{ directions() || ('repack.directionsPlaceholder' | t) }}</div>
          <div class="muted small">{{ t.number }} · {{ t.createdAt | when }}</div>
        </div>
        <div class="field no-print mt">
          <label>{{ 'repack.directions' | t }}</label>
          <input
            class="input"
            [value]="directions()"
            (input)="directions.set($any($event.target).value)"
          />
        </div>
      }
      <ng-container footer>
        <button class="btn" type="button" (click)="label.set(null)">
          {{ 'repack.close' | t }}
        </button>
        <button class="btn primary" type="button" (click)="print()">
          <app-icon name="printer" [size]="16" /> {{ 'repack.print' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .drug-label {
      border: 2px solid var(--text);
      border-radius: 8px;
      padding: 12px 14px;
      max-width: 360px;
      display: grid;
      gap: 6px;
      font-size: 13px;
    }
    .drug-label .name {
      font-size: 16px;
      font-weight: 700;
    }
    .drug-label .directions {
      border-top: 1px dashed var(--border);
      padding-top: 6px;
    }
  `,
})
export default class RepackPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly tabs: Tab[] = ['new', 'history', 'packs', 'formulas'];
  protected readonly kinds: Kind[] = ['BREAK_BULK', 'REPACK', 'COMPOUND'];
  protected readonly tab = signal<Tab>('new');
  protected readonly kind = signal<Kind>('BREAK_BULK');
  protected readonly busy = signal(false);
  protected readonly output = signal<Row>({ productUid: null, productName: '', quantity: 1 });
  protected readonly inputs = signal<Row[]>([{ productUid: null, productName: '', quantity: 1 }]);
  protected readonly batchNumber = signal('');
  protected readonly expiry = signal('');
  protected readonly note = signal('');
  protected readonly label = signal<TransformationView | null>(null);
  protected readonly directions = signal('');
  protected readonly linkDraft: { pack: string | null; unit: string | null } = {
    pack: null,
    unit: null,
  };
  protected readonly formulaProduct = signal<string | null>(null);
  protected readonly formulaProductName = signal('');
  protected readonly formula = signal<FormulaItem[]>([]);
  /** The output's recipe (per one unit made): ingredient rows scale with the quantity made. */
  private readonly recipe = signal<{ productUid: string; productName: string; perUnit: number }[]>(
    [],
  );

  protected readonly history = pagedList<TransformationView>(() =>
    this.tab() === 'history' && this.session.branch() ? { path: '/stock/transformations' } : null,
  );
  protected readonly links = loaded<PackLink[]>(() =>
    this.tab() === 'packs' || this.tab() === 'new'
      ? { path: '/pack-links', options: { noBranch: true } }
      : null,
  );
  protected readonly productName = (p: Product) => p.name;

  protected setKind(kind: Kind): void {
    this.kind.set(kind);
    this.recipe.set([]);
    this.inputs.set([{ productUid: null, productName: '', quantity: 1 }]);
  }

  /** Ingredient rows for making `quantity` by the recipe, rounded up. */
  private applyRecipe(quantity: number): void {
    const recipe = this.recipe();
    if (recipe.length) {
      const n = quantity > 0 ? quantity : 1;
      this.inputs.set(
        recipe.map((r) => ({
          productUid: r.productUid,
          productName: r.productName,
          quantity: Math.ceil(r.perUnit * n),
        })),
      );
    }
  }

  protected async pickOutput(p: Product | null): Promise<void> {
    this.output.update((o) => ({ ...o, productUid: p?.uid ?? null, productName: p?.name ?? '' }));
    this.recipe.set([]);
    if (!p) {
      return;
    }
    if (this.kind() === 'REPACK') {
      // Own packs made from loose units: the pack link gives units per pack.
      const link = (this.links.value() ?? []).find((l) => l.packProductUid === p.uid);
      if (link) {
        this.recipe.set([
          {
            productUid: link.unitProductUid,
            productName: link.unitProductName,
            perUnit: link.unitsPerPack,
          },
        ]);
        this.applyRecipe(this.output().quantity);
      }
    }
    if (this.kind() === 'BREAK_BULK') {
      const link = (this.links.value() ?? []).find((l) => l.unitProductUid === p.uid);
      if (link) {
        this.inputs.set([
          { productUid: link.packProductUid, productName: link.packProductName, quantity: 1 },
        ]);
        this.output.update((o) => ({ ...o, quantity: link.unitsPerPack }));
      }
    }
    if (this.kind() === 'COMPOUND') {
      const items = await this.api.get<FormulaItem[]>(`/products/${p.uid}/formula`, undefined, {
        noBranch: true,
      });
      if (items.length) {
        this.recipe.set(
          items.map((i) => ({
            productUid: i.ingredientUid,
            productName: i.ingredientName,
            perUnit: i.quantity,
          })),
        );
        this.applyRecipe(this.output().quantity);
      }
    }
  }

  protected setOutputQuantity(quantity: number): void {
    this.output.update((o) => ({ ...o, quantity }));
    this.applyRecipe(quantity);
  }

  protected pickInput(i: number, p: Product | null): void {
    this.inputs.update((rows) =>
      rows.map((r, j) =>
        j === i ? { ...r, productUid: p?.uid ?? null, productName: p?.name ?? '' } : r,
      ),
    );
  }

  protected setInputQuantity(i: number, quantity: number): void {
    this.inputs.update((rows) => rows.map((r, j) => (j === i ? { ...r, quantity } : r)));
  }

  protected addInput(): void {
    this.inputs.update((rows) => [...rows, { productUid: null, productName: '', quantity: 1 }]);
  }

  protected removeInput(i: number): void {
    this.inputs.update((rows) => rows.filter((_, j) => j !== i));
  }

  protected async submit(): Promise<void> {
    const out = this.output();
    const inputs = this.inputs().filter((r) => r.productUid && r.quantity > 0);
    if (!out.productUid || !inputs.length || !(out.quantity > 0)) {
      this.toasts.error(this.translations.t('repack.incomplete'));
      return;
    }
    this.busy.set(true);
    try {
      const made = await this.api.post<TransformationView>('/stock/transformations', {
        type: this.kind(),
        inputs: inputs.map((r) => ({ productUid: r.productUid, quantity: r.quantity })),
        output: {
          productUid: out.productUid,
          quantity: out.quantity,
          batchNumber: this.batchNumber() || null,
          expiryDate: this.expiry() || null,
        },
        note: this.note() || null,
      });
      this.toasts.success(this.translations.t('repack.recorded', { number: made.number }));
      this.label.set(made);
      this.batchNumber.set('');
      this.expiry.set('');
      this.note.set('');
    } finally {
      this.busy.set(false);
    }
  }

  protected async saveLink(unitsPerPack: number): Promise<void> {
    if (!this.linkDraft.pack || !this.linkDraft.unit) {
      this.toasts.error(this.translations.t('repack.incomplete'));
      return;
    }
    await this.api.put(
      '/pack-links',
      { packProductUid: this.linkDraft.pack, unitProductUid: this.linkDraft.unit, unitsPerPack },
      { noBranch: true },
    );
    this.toasts.success(this.translations.t('repack.saved'));
    void this.links.reload();
  }

  protected async removeLink(l: PackLink): Promise<void> {
    await this.api.delete(`/pack-links/${l.unitProductUid}`, { noBranch: true });
    void this.links.reload();
  }

  protected async pickFormulaProduct(p: Product | null): Promise<void> {
    this.formulaProduct.set(p?.uid ?? null);
    this.formulaProductName.set(p?.name ?? '');
    this.formula.set(
      p
        ? await this.api.get<FormulaItem[]>(`/products/${p.uid}/formula`, undefined, {
            noBranch: true,
          })
        : [],
    );
  }

  protected addFormulaRow(): void {
    this.formula.update((rows) => [
      ...rows,
      { ingredientUid: '', ingredientName: '', quantity: 1 },
    ]);
  }

  protected removeFormulaRow(i: number): void {
    this.formula.update((rows) => rows.filter((_, j) => j !== i));
  }

  protected async saveFormula(): Promise<void> {
    const uid = this.formulaProduct();
    if (!uid) {
      return;
    }
    const saved = await this.api.put<FormulaItem[]>(
      `/products/${uid}/formula`,
      this.formula()
        .filter((r) => r.ingredientUid && r.quantity > 0)
        .map((r) => ({ ingredientUid: r.ingredientUid, quantity: r.quantity })),
      { noBranch: true },
    );
    this.formula.set(saved);
    this.toasts.success(this.translations.t('repack.saved'));
  }

  protected print(): void {
    window.print();
  }
}
