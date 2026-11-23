import { SettingsStore } from '../../core/format/settings.store';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AttachmentsComponent } from '../../core/files/attachments.component';
import { Api } from '../../core/api/api.service';
import { PurchaseOrder } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-order-detail',
  imports: [TranslatePipe, ...SHARED, AttachmentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (order.value(); as o) {
        <div class="page-head">
          <div>
            <a class="muted row" routerLink="/purchasing/orders"
              ><app-icon name="arrow-left" [size]="15" /> {{ 'purchasing.purchaseOrders' | t }}</a
            >
            <h1 class="row" style="margin-top:6px">
              {{ o.number }} <app-status [value]="o.status" />
            </h1>
            <p class="sub">
              {{ o.supplierName }} ·
              {{ 'ui.t.placedBy' | t: { when: o.createdAt | when, by: o.createdBy } }}
            </p>
          </div>
          <div class="actions">
            @if (open(o) && session.can('purchasing.receive')) {
              <a
                class="btn primary"
                routerLink="/purchasing/receipts/new"
                [queryParams]="{ po: o.uid }"
                ><app-icon name="download" [size]="16" /> {{ 'purchasing.receiveGoods' | t }}</a
              >
            }
            @if (o.status === 'ORDERED' && session.can('purchasing.manage')) {
              <button class="btn danger" type="button" (click)="cancelling.set(true)">
                <app-icon name="x" [size]="16" /> {{ 'purchasing.cancelOrder' | t }}
              </button>
            }
          </div>
        </div>
        <div class="grid kpis mb">
          <app-stat
            [label]="'purchasing.orderTotal' | t"
            [value]="o.total | compactMoney: o.currency"
            [hint]="o.total | money: o.currency"
            icon="bag"
            tone="green"
            [caption]="
              o.currency === base()
                ? o.lines.length + ('ui.l.preLines' | t)
                : (o.baseTotal | money) + ('ui.l.preAtSp' | t) + (o.exchangeRate | num)
            "
          />
          <app-stat
            [label]="'purchasing.expected' | t"
            [value]="o.expectedDate | day"
            icon="calendar"
            tone="blue"
            [caption]="'purchasing.delivery' | t"
          />
          <app-stat
            [label]="'purchasing.received' | t"
            [value]="received(o) + ' / ' + ordered(o)"
            icon="box"
            tone="purple"
            [caption]="'purchasing.units' | t"
          />
        </div>
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'purchasing.product' | t }}</th>
                  <th class="right">{{ 'purchasing.ordered' | t }}</th>
                  <th class="right">{{ 'purchasing.received' | t }}</th>
                  <th class="right">{{ 'purchasing.outstanding' | t }}</th>
                  <th class="right">{{ 'purchasing.unitCost' | t }}</th>
                  <th class="right">{{ 'purchasing.lineTotal' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of o.lines; track l.uid) {
                  <tr>
                    <td class="strong">{{ l.productName }}</td>
                    <td class="right">{{ l.quantity }}</td>
                    <td class="right">{{ l.receivedQuantity }}</td>
                    <td class="right" [class.text-amber]="l.quantity > l.receivedQuantity">
                      {{ l.quantity - l.receivedQuantity }}
                    </td>
                    <td class="right">{{ l.unitCost | money: o.currency }}</td>
                    <td class="right strong">{{ l.lineTotal | money: o.currency }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5">{{ 'purchasing.total' | t }}</td>
                  <td class="right">{{ o.total | money: o.currency }}</td>
                </tr>
                @if (o.currency !== base()) {
                  <tr class="muted">
                    <td colspan="5">
                      {{
                        'ui.t.lockedRate'
                          | t: { base: base(), rate: o.exchangeRate | num, currency: o.currency }
                      }}
                    </td>
                    <td class="right">{{ o.baseTotal | money }}</td>
                  </tr>
                }
              </tfoot>
            </table>
          </div>
          @if (o.note) {
            <div class="card-pad muted">{{ 'ui.t.note' | t: { note: o.note } }}</div>
          }
        </div>
        <app-attachments
          class="block mt"
          ownerType="PURCHASE_ORDER"
          [ownerUid]="o.uid"
          purpose="INVOICE"
          [canManage]="session.can('purchasing.manage')"
        />
      } @else {
        <app-empty [for]="order" icon="bag" [title]="'purchasing.purchaseOrderNotFound' | t" />
      }
    </div>
    <app-modal
      [open]="cancelling()"
      [title]="'purchasing.cancelPurchaseOrder' | t"
      (closed)="cancelling.set(false)"
    >
      <div class="field">
        <label>{{ 'purchasing.reason' | t }}</label
        ><textarea class="input" #reason></textarea>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="cancelling.set(false)">
          {{ 'purchasing.keepOrder' | t }}
        </button>
        <button class="btn danger" type="button" [disabled]="busy()" (click)="cancel(reason.value)">
          {{ 'purchasing.cancelOrder' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class OrderDetailPage {
  protected readonly base = inject(SettingsStore).currency;
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  readonly uid = input.required<string>();
  protected readonly order = loaded<PurchaseOrder>(() => ({
    path: `/purchase-orders/${this.uid()}`,
  }));
  protected readonly cancelling = signal(false);
  protected readonly busy = signal(false);

  protected open(o: PurchaseOrder): boolean {
    return o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED';
  }

  protected ordered(o: PurchaseOrder): number {
    return o.lines.reduce((sum, l) => sum + l.quantity, 0);
  }

  protected received(o: PurchaseOrder): number {
    return o.lines.reduce((sum, l) => sum + l.receivedQuantity, 0);
  }

  protected async cancel(reason: string): Promise<void> {
    this.busy.set(true);
    try {
      this.order.set(
        await this.api.post<PurchaseOrder>(`/purchase-orders/${this.uid()}/cancel`, { reason }),
      );
      this.toasts.success(this.translations.t('toast.orderCancelled'));
      this.cancelling.set(false);
    } finally {
      this.busy.set(false);
    }
  }
}
