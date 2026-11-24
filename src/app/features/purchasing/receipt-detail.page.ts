import { SettingsStore } from '../../core/format/settings.store';
import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { AttachmentsComponent } from '../../core/files/attachments.component';
import { SessionStore } from '../../core/session/session.store';
import { GoodsReceipt } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-receipt-detail',
  imports: [TranslatePipe, ...SHARED, AttachmentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (receipt.value(); as r) {
        <div class="page-head">
          <div>
            <a class="muted row" routerLink="/purchasing/receipts"
              ><app-icon name="arrow-left" [size]="15" /> {{ 'purchasing.goodsReceipts' | t }}</a
            >
            <h1 style="margin-top:6px">{{ r.number }}</h1>
            <p class="sub">
              {{ r.supplierName }} ·
              {{ 'ui.t.receivedBy' | t: { when: r.createdAt | when, by: r.createdBy } }}
            </p>
          </div>
          <div class="actions">
            @if (r.purchaseOrderUid) {
              <a class="btn" [routerLink]="['/purchasing/orders', r.purchaseOrderUid]"
                ><app-icon name="bag" [size]="16" /> {{ r.purchaseOrderNumber }}</a
              >
            }
            <button class="btn" type="button" (click)="print()">
              <app-icon name="printer" [size]="16" /> {{ 'purchasing.print' | t }}
            </button>
          </div>
        </div>
        <div class="card print-area">
          <div class="card-pad dl">
            <div>
              <dt>{{ 'purchasing.supplier' | t }}</dt>
              <dd>{{ r.supplierName }}</dd>
            </div>
            <div>
              <dt>{{ 'purchasing.supplierInvoice' | t }}</dt>
              <dd>{{ r.supplierInvoiceNumber ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'purchasing.purchaseOrder' | t }}</dt>
              <dd>{{ r.purchaseOrderNumber ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'purchasing.total' | t }}</dt>
              <dd>{{ r.total | money: r.currency }}</dd>
            </div>
            @if (r.vatTotal) {
              <div>
                <dt>{{ 'vat.onTheInvoice' | t }}</dt>
                <dd data-testid="receipt-vat-total">{{ r.vatTotal | money: r.currency }}</dd>
              </div>
            }
            @if (r.currency !== base()) {
              <div>
                <dt>{{ 'purchasing.rate' | t }}</dt>
                <dd>1 {{ r.currency }} = {{ r.exchangeRate | num }} {{ base() }}</dd>
              </div>
              <div>
                <dt>{{ 'ui.t.inBase' | t: { base: base() } }}</dt>
                <dd class="strong">{{ r.baseTotal | money }}</dd>
              </div>
            }
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'purchasing.product' | t }}</th>
                  <th>{{ 'purchasing.batch' | t }}</th>
                  <th>{{ 'purchasing.expiry' | t }}</th>
                  <th class="right">{{ 'purchasing.quantity' | t }}</th>
                  <th class="right">{{ 'purchasing.unitCost' | t }}</th>
                  <th class="right">{{ 'purchasing.lineTotal' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of r.lines; track $index) {
                  <tr>
                    <td class="strong">{{ l.productName }}</td>
                    <td class="mono">{{ l.batchNumber }}</td>
                    <td>{{ l.expiryDate | day }}</td>
                    <td class="right">{{ l.quantity }}</td>
                    <td class="right">
                      {{ l.unitCost | money: r.currency }}
                      @if (r.currency !== base()) {
                        <small class="muted block">{{ l.baseUnitCost | money }}</small>
                      }
                    </td>
                    <td class="right strong">{{ l.lineTotal | money: r.currency }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5">{{ 'purchasing.total' | t }}</td>
                  <td class="right">{{ r.total | money: r.currency }}</td>
                </tr>
                @if (r.currency !== base()) {
                  <tr class="muted">
                    <td colspan="5">{{ 'ui.t.stockCostIn' | t: { base: base() } }}</td>
                    <td class="right">{{ r.baseTotal | money }}</td>
                  </tr>
                }
              </tfoot>
            </table>
          </div>
          @if (r.note) {
            <div class="card-pad muted">{{ 'ui.t.note' | t: { note: r.note } }}</div>
          }
        </div>
        <app-attachments
          class="block mt"
          ownerType="GOODS_RECEIPT"
          [ownerUid]="r.uid"
          purpose="INVOICE"
          [canManage]="session.can('purchasing.receive')"
        />
      } @else {
        <app-empty
          [for]="receipt"
          icon="download"
          [title]="'purchasing.goodsReceiptNotFound' | t"
        />
      }
    </div>
  `,
})
export default class ReceiptDetailPage {
  protected readonly base = inject(SettingsStore).currency;
  protected readonly session = inject(SessionStore);
  readonly uid = input.required<string>();
  protected readonly receipt = loaded<GoodsReceipt>(() => ({
    path: `/goods-receipts/${this.uid()}`,
  }));

  protected print(): void {
    window.print();
  }
}
