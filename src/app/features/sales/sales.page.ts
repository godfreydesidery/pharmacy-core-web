import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SaleSummary } from '../../core/api/models';
import { debounced, pagedList } from '../../core/data/data';
import { downloadCsv, humanize } from '../../core/format/format';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-sales',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'sales.salesHistory' | t }}</h1>
          <p class="sub">{{ session.branch()?.name ?? 'Choose a branch' }}</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/sales/returns"
            ><app-icon name="undo" [size]="16" /> {{ 'sales.returns' | t }}</a
          >
          @if (session.can('sales.sell')) {
            <a class="btn primary" routerLink="/pos"
              ><app-icon name="plus" [size]="16" /> {{ 'sales.newSale' | t }}</a
            >
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required what="Sales history" />
      } @else {
        <div class="card">
          <div class="toolbar">
            <label class="search"
              ><app-icon name="search" [size]="16" /><input
                [placeholder]="'sales.invoiceNumberOrCustomer' | t"
                (input)="q.set($any($event.target).value)"
            /></label>
            <select
              class="select"
              style="width:auto"
              (change)="status.set($any($event.target).value)"
            >
              <option value="">{{ 'sales.allStatuses' | t }}</option>
              <option value="COMPLETED">{{ 'sales.completed' | t }}</option>
              <option value="PARTIALLY_RETURNED">{{ 'sales.partiallyReturned' | t }}</option>
              <option value="RETURNED">{{ 'sales.returned' | t }}</option>
            </select>
            <input
              class="input"
              style="width:auto"
              type="date"
              (change)="from.set($any($event.target).value)"
              [attr.aria-label]="'sales.from' | t"
            />
            <input
              class="input"
              style="width:auto"
              type="date"
              (change)="to.set($any($event.target).value)"
              [attr.aria-label]="'sales.to' | t"
            />
            <div class="spacer"></div>
            <button class="btn" type="button" (click)="export()">
              <app-icon name="download" [size]="16" /> {{ 'sales.export' | t }}
            </button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'sales.invoice' | t }}</th>
                  <th>{{ 'sales.customer' | t }}</th>
                  <th>{{ 'sales.date' | t }}</th>
                  <th>{{ 'sales.cashier' | t }}</th>
                  <th>{{ 'sales.payment' | t }}</th>
                  <th class="right">{{ 'sales.items' | t }}</th>
                  <th class="right">{{ 'sales.total' | t }}</th>
                  <th>{{ 'sales.status' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of list.items(); track s.uid) {
                  <tr class="clickable" [routerLink]="[s.uid]">
                    <td>
                      <div class="cell-main">
                        <span class="thumb tone-blue"><app-icon name="receipt" [size]="16" /></span
                        ><b>{{ s.number }}</b>
                      </div>
                    </td>
                    <td>{{ s.customerName ?? 'Walk-in' }}</td>
                    <td class="muted">{{ s.createdAt | when }}</td>
                    <td>{{ s.cashierName }}</td>
                    <td>{{ methods(s) }}</td>
                    <td class="right">{{ s.itemCount }}</td>
                    <td class="right strong">{{ s.total | money }}</td>
                    <td><app-status [value]="s.status" /></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8">
                      <app-empty
                        [loading]="list.loading()"
                        icon="receipt"
                        [title]="'sales.noSales' | t"
                        text="Sales made at the POS appear here."
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
export default class SalesPage {
  protected readonly session = inject(SessionStore);
  protected readonly q = signal('');
  protected readonly status = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<SaleSummary>(() =>
    this.session.branch()
      ? {
          path: '/sales',
          query: { q: this.query(), status: this.status(), from: this.from(), to: this.to() },
        }
      : null,
  );

  protected methods(sale: SaleSummary): string {
    return sale.paymentMethods.map(humanize).join(', ');
  }

  protected export(): void {
    downloadCsv(
      'sales.csv',
      ['Invoice', 'Customer', 'Date', 'Cashier', 'Payment', 'Items', 'Total', 'Status'],
      this.list
        .items()
        .map((s) => [
          s.number,
          s.customerName ?? 'Walk-in',
          s.createdAt,
          s.cashierName,
          this.methods(s),
          s.itemCount,
          s.total,
          s.status,
        ]),
    );
  }
}
