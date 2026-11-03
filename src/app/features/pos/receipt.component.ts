import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Sale } from '../../core/api/models';
import { SettingsStore } from '../../core/format/settings.store';
import { FORMAT_PIPES } from '../../core/format/pipes';
import { LogoComponent } from '../../core/layout/logo.component';
import { SessionStore } from '../../core/session/session.store';
import { TenantLogoStore } from '../../core/files/tenant-logo.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

/** A printable receipt; `window.print()` prints only `.print-area`. */
@Component({
  selector: 'app-receipt',
  imports: [TranslatePipe, LogoComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="receipt print-area">
      <div class="center">
        @if (logo.url(); as url) {
          <img class="receipt-logo" [src]="url" alt="" />
        } @else {
          <app-logo [size]="36" />
        }
      </div>
      <b class="center block">{{ session.tenant()?.name }}</b>
      <div class="center muted small">{{ sale().branchName }}</div>
      <div class="row between small muted">
        <span>{{ sale().number }}</span
        ><span>{{ sale().createdAt | when }}</span>
      </div>
      <div class="small muted">
        Customer: {{ sale().customerName ?? 'Walk-in customer' }} · Cashier:
        {{ sale().cashierName }}
      </div>
      <table>
        <thead>
          <tr>
            <th>{{ 'pos.item' | t }}</th>
            <th class="right">{{ 'pos.qty' | t }}</th>
            <th class="right">{{ 'pos.amount' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (line of sale().lines; track line.uid) {
            <tr>
              <td>
                {{ line.productName }}
                <div class="faint small">
                  @if (line.serialNumbers.length) {
                    S/N {{ line.serialNumbers.join(', ') }}
                  } @else if (line.expiryDate) {
                    Batch {{ line.batchNumber }} · exp {{ line.expiryDate | day }}
                  } @else if (line.batchNumber && line.batchNumber !== '-') {
                    Batch {{ line.batchNumber }}
                  }
                  @if (line.warrantyEndsOn) {
                    <div>Warranty until {{ line.warrantyEndsOn | day }}</div>
                  }
                </div>
              </td>
              <td class="right">{{ line.quantity }}</td>
              <td class="right">{{ line.lineTotal | money }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="totals">
        <div class="row between">
          <span class="muted">{{ 'pos.subtotal' | t }}</span
          ><span>{{ sale().subtotal | money }}</span>
        </div>
        @if (sale().discountTotal) {
          <div class="row between">
            <span class="muted">{{ 'pos.discount2' | t }}</span
            ><span>− {{ sale().discountTotal | money }}</span>
          </div>
        }
        <div class="row between">
          <span class="muted">{{ 'pos.tax' | t }}</span
          ><span>{{ sale().taxTotal | money }}</span>
        </div>
        <div class="row between grand">
          <span>{{ 'pos.total' | t }}</span
          ><span>{{ sale().total | money }}</span>
        </div>
        @for (p of sale().payments; track $index) {
          <div class="row between small">
            <span class="muted"
              >{{ p.method | label }}{{ p.reference ? ' · ' + p.reference : '' }}</span
            ><span
              >{{ p.amount | money: p.currency ?? undefined }}
              @if (p.currency && p.baseAmount !== undefined && p.amount !== p.baseAmount) {
                <small class="muted">({{ p.baseAmount | money }})</small>
              }
            </span>
          </div>
        }
        @if (sale().changeDue) {
          <div class="row between strong">
            <span>{{ 'pos.change' | t }}</span
            ><span>{{ sale().changeDue | money }}</span>
          </div>
        }
      </div>
      <p class="center muted small footer">
        {{ settings.settings()?.receiptFooter ?? 'Thank you. Get well soon.' }}
      </p>
    </div>
  `,
  styles: `
    .receipt-logo {
      max-width: 120px;
      max-height: 56px;
      object-fit: contain;
    }
    .receipt {
      max-width: 360px;
      margin: 0 auto;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .block {
      display: block;
    }
    .small {
      font-size: 11.5px;
    }
    .between {
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    th {
      text-align: left;
      font-size: 11.5px;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      padding: 6px 4px;
    }
    td {
      padding: 6px 4px;
      border-bottom: 1px dashed var(--border);
      vertical-align: top;
    }
    .grand {
      font-size: 16px;
      font-weight: 700;
      border-top: 1px dashed var(--border-strong);
      padding-top: 8px;
      margin-top: 4px;
    }
    .footer {
      margin-top: 10px;
    }
  `,
})
export class ReceiptComponent {
  protected readonly session = inject(SessionStore);
  protected readonly logo = inject(TenantLogoStore);
  protected readonly settings = inject(SettingsStore);
  readonly sale = input.required<Sale>();
}
