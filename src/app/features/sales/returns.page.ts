import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SaleReturn } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
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
                      <app-empty
                        [loading]="list.loading()"
                        icon="undo"
                        [title]="'sales.noReturns' | t"
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

  protected items(r: SaleReturn): string {
    return r.lines.map((l) => `${l.quantity} × ${l.productName}`).join(', ');
  }
}
