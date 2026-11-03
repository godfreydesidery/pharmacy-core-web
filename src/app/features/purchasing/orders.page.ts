import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PurchaseOrder, PurchaseOrderStatus } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

const STATUSES: PurchaseOrderStatus[] = ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

@Component({
  selector: 'app-purchase-orders',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'purchasing.purchaseOrders' | t }}</h1>
          <p class="sub">Orders to suppliers for {{ session.branch()?.name ?? '—' }}</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/purchasing/receipts"
            ><app-icon name="download" [size]="16" /> {{ 'purchasing.goodsReceipts' | t }}</a
          >
          @if (session.can('purchasing.manage') && session.branch()) {
            <a class="btn primary" routerLink="/purchasing/orders/new"
              ><app-icon name="plus" [size]="16" /> {{ 'purchasing.newOrder' | t }}</a
            >
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required what="Purchasing" />
      } @else {
        <div class="card">
          <div class="toolbar">
            <div class="chips">
              <button
                type="button"
                class="chip"
                [class.active]="!status()"
                (click)="status.set('')"
              >
                {{ 'purchasing.all' | t }}
              </button>
              @for (s of statuses; track s) {
                <button
                  type="button"
                  class="chip"
                  [class.active]="status() === s"
                  (click)="status.set(s)"
                >
                  {{ s | label }}
                </button>
              }
            </div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'purchasing.order' | t }}</th>
                  <th>{{ 'purchasing.supplier' | t }}</th>
                  <th>{{ 'purchasing.ordered' | t }}</th>
                  <th>{{ 'purchasing.expected' | t }}</th>
                  <th class="right">{{ 'purchasing.lines' | t }}</th>
                  <th class="right">{{ 'purchasing.total' | t }}</th>
                  <th>{{ 'purchasing.status' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (o of list.items(); track o.uid) {
                  <tr class="clickable" [routerLink]="[o.uid]">
                    <td>
                      <div class="cell-main">
                        <span class="thumb tone-green"><app-icon name="bag" [size]="16" /></span>
                        <div>
                          <b>{{ o.number }}</b
                          ><small>by {{ o.createdBy }}</small>
                        </div>
                      </div>
                    </td>
                    <td>{{ o.supplierName }}</td>
                    <td class="muted">{{ o.createdAt | day }}</td>
                    <td class="muted">{{ o.expectedDate | day }}</td>
                    <td class="right">{{ o.lines.length }}</td>
                    <td class="right strong">{{ o.total | money }}</td>
                    <td><app-status [value]="o.status" /></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <app-empty
                        [loading]="list.loading()"
                        icon="bag"
                        [title]="'purchasing.noPurchaseOrders' | t"
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
export default class OrdersPage {
  protected readonly session = inject(SessionStore);
  protected readonly statuses = STATUSES;
  protected readonly status = signal('');
  protected readonly list = pagedList<PurchaseOrder>(() =>
    this.session.branch() ? { path: '/purchase-orders', query: { status: this.status() } } : null,
  );
}
