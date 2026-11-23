import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { SaleReturn, SaleReturnLine } from '../../core/api/models';
import { loaded, pagedList } from '../../core/data/data';
import { Translations } from '../../core/i18n/translations.store';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-sale-returns',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'sales.salesReturns' | t }}</h1>
          <p class="sub">{{ 'sales.openASaleToReturnItems' | t }}</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/sales"
            ><app-icon name="file" [size]="16" /> {{ 'sales.salesHistory' | t }}</a
          >
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'ui.what.returns' | t" />
      } @else {
        @if (heldLines().length) {
          <div class="card mb" data-testid="held-returns">
            <div class="card-head">
              <div>
                <h3>{{ 'held.title' | t }}</h3>
                <p class="muted small">{{ 'held.text' | t }}</p>
              </div>
            </div>
            <div class="table-wrap">
              <table class="table compact">
                <thead>
                  <tr>
                    <th>{{ 'sales.return' | t }}</th>
                    <th>{{ 'sales.product' | t }}</th>
                    <th>{{ 'sales.batch' | t }}</th>
                    <th class="right">{{ 'held.quantity' | t }}</th>
                    <th>{{ 'sales.date' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of heldLines(); track h.line.uid) {
                    <tr>
                      <td>
                        <b>{{ h.ret.number }}</b>
                        <div class="muted small">{{ h.ret.reason }}</div>
                      </td>
                      <td>{{ h.line.productName }}</td>
                      <td class="mono">{{ h.line.batchNumber }}</td>
                      <td class="right strong">{{ h.line.heldQuantity }}</td>
                      <td class="muted">{{ h.ret.createdAt | when }}</td>
                      <td class="right">
                        @if (session.can('sales.refund')) {
                          <div class="row" style="gap:6px;justify-content:flex-end">
                            <button
                              class="btn sm"
                              type="button"
                              [disabled]="busy()"
                              (click)="release(h.ret, h.line, 'SHELF')"
                            >
                              {{ 'held.toShelf' | t }}
                            </button>
                            <button
                              class="btn danger sm"
                              type="button"
                              [disabled]="busy()"
                              (click)="release(h.ret, h.line, 'DAMAGED')"
                            >
                              {{ 'held.writeOff' | t }}
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'sales.return' | t }}</th>
                  <th>{{ 'sales.sale' | t }}</th>
                  <th>{{ 'sales.items' | t }}</th>
                  <th>{{ 'sales.reason' | t }}</th>
                  <th>{{ 'sales.refund' | t }}</th>
                  <th class="right">{{ 'sales.amount' | t }}</th>
                  <th>{{ 'sales.date' | t }}</th>
                  <th>{{ 'sales.by' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of list.items(); track r.uid) {
                  <tr>
                    <td>
                      <div class="cell-main">
                        <span class="thumb tone-red"><app-icon name="undo" [size]="16" /></span
                        ><b>{{ r.number }}</b>
                      </div>
                    </td>
                    <td>
                      <a class="text-primary" [routerLink]="['/sales', r.saleUid]">{{
                        r.saleNumber
                      }}</a>
                    </td>
                    <td>{{ items(r) }}</td>
                    <td>{{ r.reason }}</td>
                    <td>{{ r.refundMethod | label }}</td>
                    <td class="right">
                      <span class="strong">{{ r.refundTotal | money }}</span>
                      @if (r.refundCurrency) {
                        <div class="muted small">
                          {{ r.refundForeignAmount | money: r.refundCurrency }}
                          @if (r.fxDifference) {
                            ·
                            <span
                              [class.fx-loss]="r.fxDifference > 0"
                              [class.fx-gain]="r.fxDifference < 0"
                            >
                              {{ (r.fxDifference > 0 ? 'sales.fxLoss' : 'sales.fxGain') | t }}
                              {{ (r.fxDifference > 0 ? r.fxDifference : -r.fxDifference) | money }}
                            </span>
                          }
                        </div>
                      }
                    </td>
                    <td class="muted">{{ r.createdAt | when }}</td>
                    <td>{{ r.createdBy }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8">
                      <app-empty [for]="list" icon="undo" [title]="'sales.noReturns' | t" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [list]="list" />
        </div>
      }
    </div>
  `,
  styles: `
    .fx-loss {
      color: var(--red);
    }
    .fx-gain {
      color: var(--green);
    }
  `,
})
export default class ReturnsPage {
  protected readonly session = inject(SessionStore);
  protected readonly list = pagedList<SaleReturn>(() =>
    this.session.branch() ? { path: '/sale-returns' } : null,
  );

  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);
  protected readonly busy = signal(false);
  /** Returned units held aside (quarantine) until released to the shelf or written off. */
  protected readonly held = loaded<SaleReturn[]>(() =>
    this.session.branch() ? { path: '/sale-returns/held', options: { silent: true } } : null,
  );
  protected readonly heldLines = computed(() =>
    (this.held.value() ?? []).flatMap((ret) =>
      ret.lines.filter((line) => (line.heldQuantity ?? 0) > 0).map((line) => ({ ret, line })),
    ),
  );

  protected async release(
    ret: SaleReturn,
    line: SaleReturnLine,
    outcome: 'SHELF' | 'DAMAGED',
  ): Promise<void> {
    const params = { quantity: line.heldQuantity ?? 0, product: line.productName };
    const shelf = outcome === 'SHELF';
    const ok = await this.confirm.ask({
      title: this.translations.t(shelf ? 'held.toShelf' : 'held.writeOff'),
      text: this.translations.t(shelf ? 'held.confirmShelf' : 'held.confirmWriteOff', params),
      icon: shelf ? 'question' : 'danger',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    try {
      await this.api.post(`/sales/returns/${ret.uid}/lines/${line.uid}/release`, { outcome });
      this.toasts.success(this.translations.t(shelf ? 'held.shelved' : 'held.writtenOff', params));
      await Promise.all([this.held.reload(), this.list.reload()]);
    } finally {
      this.busy.set(false);
    }
  }

  protected items(r: SaleReturn): string {
    return r.lines.map((l) => `${l.quantity} × ${l.productName}`).join(', ');
  }
}
