import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Product } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';

interface RecallBatch {
  uid: string;
  productUid: string;
  productName: string | null;
  batchNumber: string;
  expiryDate: string | null;
  onHand: number;
  quarantined: boolean;
  quarantineReason: string | null;
  quarantinedAt: string | null;
  quarantinedBy: string | null;
}

interface SaleOfBatch {
  saleUid: string;
  saleNumber: string;
  soldAt: string;
  branchName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  patientName: string | null;
  quantity: number;
  returnedQuantity: number;
}

interface Recall {
  batch: RecallBatch;
  sales: SaleOfBatch[];
  unitsWithCustomers: number;
}

/**
 * Inventory → Recalls: pick a product and a batch, see every sale that took it (with the customer's
 * phone), and quarantine what is left so it is no longer sold or moved.
 */
@Component({
  selector: 'app-recalls',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head no-print">
        <div>
          <h1>{{ 'recall.title' | t }}</h1>
          <p class="sub">{{ 'recall.sub' | t }}</p>
        </div>
        @if (recall()) {
          <div class="actions">
            <button class="btn" type="button" (click)="recall.set(null)">
              <app-icon name="arrow-left" [size]="16" /> {{ 'recall.back' | t }}
            </button>
            <button class="btn" type="button" (click)="print()">
              <app-icon name="printer" [size]="16" /> {{ 'recall.print' | t }}
            </button>
          </div>
        }
      </div>

      @if (recall(); as r) {
        <div class="card print-area">
          <div class="card-pad row between">
            <div>
              <h3>
                {{ r.batch.productName }} · <span class="mono">{{ r.batch.batchNumber }}</span>
              </h3>
              <span class="muted">
                {{ 'recall.expires' | t }}
                {{ r.batch.expiryDate ? (r.batch.expiryDate | day) : '—' }} ·
                {{ 'recall.onHand' | t: { n: r.batch.onHand } }} ·
                {{ 'recall.withCustomers' | t: { n: r.unitsWithCustomers } }}
              </span>
            </div>
            @if (r.batch.quarantined) {
              <span class="badge red">{{ 'recall.quarantined' | t }}</span>
            } @else {
              <span class="badge green">{{ 'recall.available' | t }}</span>
            }
          </div>
          @if (r.batch.quarantined) {
            <div class="card-pad">
              <div class="notice tone-red">
                {{ 'recall.quarantinedBecause' | t: { reason: r.batch.quarantineReason ?? '' } }}
                <span class="muted">
                  — {{ r.batch.quarantinedBy }}, {{ r.batch.quarantinedAt ?? '' | when }}</span
                >
              </div>
            </div>
          }
          @if (session.can('inventory.adjust')) {
            <div class="card-pad row no-print" style="gap: 8px">
              @if (r.batch.quarantined) {
                <button class="btn" type="button" [disabled]="busy()" (click)="release()">
                  {{ 'recall.release' | t }}
                </button>
              } @else {
                <input
                  class="input"
                  style="flex: 1"
                  [value]="reason()"
                  (input)="reason.set($any($event.target).value)"
                  [placeholder]="'recall.reasonHint' | t"
                />
                <button
                  class="btn danger"
                  type="button"
                  [disabled]="busy() || !reason().trim()"
                  (click)="quarantine()"
                >
                  {{ 'recall.quarantine' | t }}
                </button>
              }
            </div>
          }
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'recall.sale' | t }}</th>
                  <th>{{ 'recall.when' | t }}</th>
                  <th>{{ 'recall.branch' | t }}</th>
                  <th>{{ 'recall.customer' | t }}</th>
                  <th>{{ 'recall.phone' | t }}</th>
                  <th>{{ 'recall.patient' | t }}</th>
                  <th class="right">{{ 'recall.quantity' | t }}</th>
                  <th class="right">{{ 'recall.returned' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of r.sales; track s.saleUid) {
                  <tr>
                    <td class="mono strong">{{ s.saleNumber }}</td>
                    <td class="muted">{{ s.soldAt | when }}</td>
                    <td>{{ s.branchName ?? '—' }}</td>
                    <td>{{ s.customerName ?? ('recall.walkIn' | t) }}</td>
                    <td class="mono">{{ s.customerPhone ?? '—' }}</td>
                    <td>{{ s.patientName ?? '—' }}</td>
                    <td class="right">{{ s.quantity | num }}</td>
                    <td class="right">{{ s.returnedQuantity | num }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="empty">{{ 'recall.noSales' | t }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="card-pad">
            <label for="recall-product">{{ 'recall.product' | t }}</label>
            <app-lookup
              inputId="recall-product"
              path="/products"
              [placeholder]="'recall.searchProduct' | t"
              (picked)="pickProduct($event)"
            />
          </div>
          @if (product()) {
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'recall.batch' | t }}</th>
                    <th>{{ 'recall.expiry' | t }}</th>
                    <th class="right">{{ 'recall.onHandCol' | t }}</th>
                    <th>{{ 'recall.status' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (b of batches(); track b.uid) {
                    <tr class="clickable" (click)="openBatch(b.uid)">
                      <td class="mono strong">
                        <button type="button" class="row-link">{{ b.batchNumber }}</button>
                      </td>
                      <td>{{ b.expiryDate ? (b.expiryDate | day) : '—' }}</td>
                      <td class="right">{{ b.onHand | num }}</td>
                      <td>
                        @if (b.quarantined) {
                          <span class="badge red">{{ 'recall.quarantined' | t }}</span>
                        } @else {
                          <span class="badge green">{{ 'recall.available' | t }}</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="empty">{{ 'recall.noBatches' | t }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class RecallsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly product = signal<Product | null>(null);
  protected readonly batches = signal<RecallBatch[]>([]);
  protected readonly recall = signal<Recall | null>(null);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);

  protected async pickProduct(product: Product | null): Promise<void> {
    this.product.set(product);
    this.batches.set(
      product ? await this.api.get<RecallBatch[]>(`/recalls/products/${product.uid}/batches`) : [],
    );
  }

  protected async openBatch(uid: string): Promise<void> {
    this.reason.set('');
    this.recall.set(await this.api.get<Recall>(`/recalls/batches/${uid}`));
  }

  protected async quarantine(): Promise<void> {
    await this.change('quarantine', { reason: this.reason() }, 'recall.quarantinedToast');
  }

  protected async release(): Promise<void> {
    await this.change('release', {}, 'recall.releasedToast');
  }

  private async change(action: string, body: object, toast: string): Promise<void> {
    const r = this.recall();
    if (!r) {
      return;
    }
    this.busy.set(true);
    try {
      this.recall.set(
        await this.api.post<Recall>(`/recalls/batches/${r.batch.uid}/${action}`, body),
      );
      this.toasts.success(this.translations.t(toast));
      const product = this.product();
      if (product) {
        await this.pickProduct(product);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected print(): void {
    window.print();
  }
}
