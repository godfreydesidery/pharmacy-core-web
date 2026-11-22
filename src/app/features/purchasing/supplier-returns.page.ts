import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Batch, GoodsReceipt, Product, Supplier } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';

interface ReturnLine {
  productUid: string;
  productName: string;
  batchUid: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

interface SupplierReturn {
  uid: string;
  number: string;
  supplierUid: string;
  supplierName: string;
  goodsReceiptUid: string | null;
  goodsReceiptNumber: string | null;
  reason: string;
  note: string | null;
  total: number;
  createdAt: string;
  createdBy: string;
  /** The recorder's name (older records: their reference). */
  createdByName?: string;
  lines: ReturnLine[];
}

interface DraftLine {
  product: Product | null;
  batches: Batch[];
  batchUid: string;
  quantity: number;
}

/** Purchasing → Supplier returns: stock sent back to a supplier, with its printable debit note. */
@Component({
  selector: 'app-supplier-returns',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head no-print">
        <div>
          <h1>{{ 'sret.title' | t }}</h1>
          <p class="sub">{{ 'sret.sub' | t }}</p>
        </div>
        <div class="actions">
          @if (current()) {
            <button class="btn" type="button" (click)="current.set(null)">
              <app-icon name="arrow-left" [size]="16" /> {{ 'sret.back' | t }}
            </button>
            <button class="btn" type="button" (click)="print()">
              <app-icon name="printer" [size]="16" /> {{ 'sret.print' | t }}
            </button>
          } @else if (session.branch() && session.can('purchasing.receive')) {
            <button class="btn primary" type="button" (click)="open()">
              <app-icon name="plus" [size]="16" /> {{ 'sret.new' | t }}
            </button>
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'sret.title' | t" />
      } @else if (current(); as r) {
        <div class="card print-area">
          <div class="card-pad">
            <div class="row between">
              <div>
                <h2>{{ 'sret.debitNote' | t }}</h2>
                <div class="muted">{{ session.tenant()?.name }} · {{ session.branch()?.name }}</div>
              </div>
              <div class="right">
                <h3 class="mono">{{ r.number }}</h3>
                <div class="muted">{{ r.createdAt | when }}</div>
              </div>
            </div>
          </div>
          <div class="card-pad dl">
            <div>
              <dt>{{ 'sret.supplier' | t }}</dt>
              <dd>{{ r.supplierName }}</dd>
            </div>
            <div>
              <dt>{{ 'sret.receipt' | t }}</dt>
              <dd>{{ r.goodsReceiptNumber ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'sret.reason' | t }}</dt>
              <dd>{{ r.reason }}</dd>
            </div>
            <div>
              <dt>{{ 'sret.by' | t }}</dt>
              <dd>{{ r.createdByName ?? r.createdBy }}</dd>
            </div>
            @if (r.note) {
              <div>
                <dt>{{ 'sret.note' | t }}</dt>
                <dd>{{ r.note }}</dd>
              </div>
            }
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'sret.product' | t }}</th>
                  <th>{{ 'sret.batch' | t }}</th>
                  <th>{{ 'sret.expiry' | t }}</th>
                  <th class="right">{{ 'sret.quantity' | t }}</th>
                  <th class="right">{{ 'sret.unitCost' | t }}</th>
                  <th class="right">{{ 'sret.lineTotal' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of r.lines; track l.batchUid) {
                  <tr>
                    <td class="strong">{{ l.productName }}</td>
                    <td class="mono">{{ l.batchNumber }}</td>
                    <td>{{ l.expiryDate ? (l.expiryDate | day) : '—' }}</td>
                    <td class="right">{{ l.quantity | num }}</td>
                    <td class="right">{{ l.unitCost | money }}</td>
                    <td class="right">{{ l.lineTotal | money }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5" class="right strong">{{ 'sret.total' | t }}</td>
                  <td class="right strong">{{ r.total | money }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="card-pad muted">{{ 'sret.footer' | t }}</div>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'sret.number' | t }}</th>
                  <th>{{ 'sret.when' | t }}</th>
                  <th>{{ 'sret.supplier' | t }}</th>
                  <th>{{ 'sret.receipt' | t }}</th>
                  <th>{{ 'sret.reason' | t }}</th>
                  <th class="right">{{ 'sret.total' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of returns.items(); track r.uid) {
                  <tr class="clickable" (click)="current.set(r)">
                    <td class="mono strong">{{ r.number }}</td>
                    <td class="muted">{{ r.createdAt | when }}</td>
                    <td>{{ r.supplierName }}</td>
                    <td class="mono">{{ r.goodsReceiptNumber ?? '—' }}</td>
                    <td>{{ r.reason }}</td>
                    <td class="right">{{ r.total | money }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <app-empty
                        [loading]="returns.loading()"
                        icon="truck"
                        [title]="'sret.none' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [list]="returns" />
        </div>
      }
    </div>

    <app-modal [open]="editing()" [title]="'sret.new' | t" (closed)="editing.set(false)">
      <div class="form-grid">
        <div class="field full">
          <label>{{ 'sret.supplier' | t }}</label>
          <app-lookup
            path="/suppliers"
            [placeholder]="'sret.searchSupplier' | t"
            (picked)="pickSupplier($event)"
          />
        </div>
        <div class="field full">
          <label>{{ 'sret.receipt' | t }}</label>
          <select class="select" [value]="receiptUid()" (change)="receiptUid.set(sel($event))">
            <option value="">{{ 'sret.noReceipt' | t }}</option>
            @for (g of receipts(); track g.uid) {
              <option [value]="g.uid">{{ g.number }} · {{ g.createdAt | day }}</option>
            }
          </select>
        </div>
        <div class="field full">
          <label>{{ 'sret.reason' | t }}</label>
          <input
            class="input"
            [value]="reason()"
            (input)="reason.set(sel($event))"
            [placeholder]="'sret.reasonHint' | t"
          />
        </div>
        @for (line of lines(); track $index; let i = $index) {
          <div class="field full">
            <label>{{ 'sret.lineN' | t: { n: i + 1 } }}</label>
            <div class="row" style="gap: 8px; flex-wrap: wrap">
              <div style="flex: 2 1 220px">
                <app-lookup
                  path="/products"
                  [small]="true"
                  [placeholder]="'sret.searchProduct' | t"
                  (picked)="pickProduct(i, $event)"
                />
              </div>
              <select
                class="select"
                style="flex: 2 1 200px"
                [value]="line.batchUid"
                (change)="patch(i, { batchUid: sel($event) })"
              >
                <option value="">{{ 'sret.chooseBatch' | t }}</option>
                @for (b of line.batches; track b.uid) {
                  <option [value]="b.uid">
                    {{ b.batchNumber }} · {{ b.expiryDate ?? '—' }} · {{ b.quantity }}
                  </option>
                }
              </select>
              <input
                class="input"
                type="number"
                min="1"
                style="flex: 0 1 90px"
                [value]="line.quantity"
                (input)="patch(i, { quantity: +sel($event) })"
              />
              @if (lines().length > 1) {
                <button class="btn ghost" type="button" (click)="removeLine(i)">
                  <app-icon name="x" [size]="16" />
                </button>
              }
            </div>
          </div>
        }
        <div class="field full">
          <button class="btn sm" type="button" (click)="addLine()">
            <app-icon name="plus" [size]="14" /> {{ 'sret.addLine' | t }}
          </button>
        </div>
        <div class="field full">
          <label>{{ 'sret.note' | t }}</label>
          <textarea class="input" [value]="note()" (input)="note.set(sel($event))"></textarea>
        </div>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="editing.set(false)">
          {{ 'sret.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'sret.record' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class SupplierReturnsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly current = signal<SupplierReturn | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly supplierUid = signal('');
  protected readonly receipts = signal<GoodsReceipt[]>([]);
  protected readonly receiptUid = signal('');
  protected readonly reason = signal('');
  protected readonly note = signal('');
  protected readonly lines = signal<DraftLine[]>([]);
  protected readonly returns = pagedList<SupplierReturn>(() =>
    this.session.branch() ? { path: '/supplier-returns' } : null,
  );

  protected sel(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected open(): void {
    this.supplierUid.set('');
    this.receipts.set([]);
    this.receiptUid.set('');
    this.reason.set('');
    this.note.set('');
    this.lines.set([{ product: null, batches: [], batchUid: '', quantity: 1 }]);
    this.editing.set(true);
  }

  protected async pickSupplier(supplier: Supplier | null): Promise<void> {
    this.supplierUid.set(supplier?.uid ?? '');
    this.receiptUid.set('');
    this.receipts.set(
      supplier
        ? (
            await this.api.get<{ items: GoodsReceipt[] }>('/goods-receipts', {
              supplierUid: supplier.uid,
              limit: 50,
            })
          ).items
        : [],
    );
  }

  protected async pickProduct(index: number, product: Product | null): Promise<void> {
    const batches = product ? await this.api.get<Batch[]>(`/stock/${product.uid}/batches`) : [];
    this.patch(index, { product, batches, batchUid: batches.length === 1 ? batches[0].uid : '' });
  }

  protected patch(index: number, change: Partial<DraftLine>): void {
    this.lines.update((all) => all.map((l, i) => (i === index ? { ...l, ...change } : l)));
  }

  protected addLine(): void {
    this.lines.update((all) => [...all, { product: null, batches: [], batchUid: '', quantity: 1 }]);
  }

  protected removeLine(index: number): void {
    this.lines.update((all) => all.filter((_, i) => i !== index));
  }

  protected async save(): Promise<void> {
    const lines = this.lines().filter((l) => l.product && l.batchUid);
    if (!this.supplierUid() || !this.reason().trim() || !lines.length) {
      this.toasts.error(this.translations.t('sret.incomplete'));
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.api.post<SupplierReturn>('/supplier-returns', {
        supplierUid: this.supplierUid(),
        goodsReceiptUid: this.receiptUid() || null,
        reason: this.reason(),
        note: this.note() || null,
        lines: lines.map((l) => ({
          productUid: l.product!.uid,
          batchUid: l.batchUid,
          quantity: l.quantity,
        })),
      });
      this.toasts.success(this.translations.t('sret.recorded'));
      this.editing.set(false);
      this.current.set(saved);
      this.returns.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected print(): void {
    window.print();
  }
}
