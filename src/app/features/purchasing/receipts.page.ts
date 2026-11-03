import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GoodsReceipt } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-receipts',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'purchasing.goodsReceipts' | t }}</h1>
          <p class="sub">
            Deliveries received at {{ session.branch()?.name ?? '—' }}, with batch and expiry.
          </p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/purchasing/orders"
            ><app-icon name="bag" [size]="16" /> {{ 'purchasing.purchaseOrders' | t }}</a
          >
          @if (session.can('purchasing.receive') && session.branch()) {
            <a class="btn primary" routerLink="/purchasing/receipts/new"
              ><app-icon name="plus" [size]="16" /> {{ 'purchasing.receiveGoods' | t }}</a
            >
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required what="Receiving goods" />
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'purchasing.receipt' | t }}</th>
                  <th>{{ 'purchasing.supplier' | t }}</th>
                  <th>{{ 'purchasing.supplierInvoice' | t }}</th>
                  <th>{{ 'purchasing.purchaseOrder' | t }}</th>
                  <th>{{ 'purchasing.received' | t }}</th>
                  <th class="right">{{ 'purchasing.lines' | t }}</th>
                  <th class="right">{{ 'purchasing.total' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of list.items(); track r.uid) {
                  <tr class="clickable" [routerLink]="[r.uid]">
                    <td>
                      <div class="cell-main">
                        <span class="thumb tone-teal"
                          ><app-icon name="download" [size]="16"
                        /></span>
                        <div>
                          <b>{{ r.number }}</b
                          ><small>by {{ r.createdBy }}</small>
                        </div>
                      </div>
                    </td>
                    <td>{{ r.supplierName }}</td>
                    <td>{{ r.supplierInvoiceNumber ?? '—' }}</td>
                    <td>{{ r.purchaseOrderNumber ?? '—' }}</td>
                    <td class="muted">{{ r.createdAt | when }}</td>
                    <td class="right">{{ r.lines.length }}</td>
                    <td class="right strong">{{ r.total | money }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <app-empty
                        [loading]="list.loading()"
                        icon="download"
                        [title]="'purchasing.noGoodsReceivedYet' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager
            [count]="list.items().length"
            [total]="list.total()"
            [hasMore]="list.hasMore()"
            [loading]="list.loading()"
            (more)="list.more()"
          />
        </div>
      }
    </div>
  `,
})
export default class ReceiptsPage {
  protected readonly session = inject(SessionStore);
  protected readonly list = pagedList<GoodsReceipt>(() =>
    this.session.branch() ? { path: '/goods-receipts' } : null,
  );
}
