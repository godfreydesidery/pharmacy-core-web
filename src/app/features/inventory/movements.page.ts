import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Movement, MovementType } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

export const MOVEMENT_TYPES: MovementType[] = [
  'OPENING',
  'RECEIPT',
  'SALE',
  'SALE_RETURN',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
];

@Component({
  selector: 'app-movements',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'inventory.stockMovements' | t }}</h1>
          <p class="sub">{{ 'inventory.theAppendOnlyLedgerEveryQuantity' | t }}</p>
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'ui.what.ledger' | t" />
      } @else {
        <div class="card">
          <div class="toolbar">
            <select
              class="select"
              style="width:auto"
              (change)="type.set($any($event.target).value)"
            >
              <option value="">{{ 'inventory.allMovementTypes' | t }}</option>
              @for (t of types; track t) {
                <option [value]="t">{{ t | label }}</option>
              }
            </select>
            @if (productUid()) {
              <a class="chip active" routerLink="/inventory/movements">{{
                'inventory.oneProductOnly' | t
              }}</a>
            }
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'inventory.when' | t }}</th>
                  <th>{{ 'inventory.medicine' | t }}</th>
                  <th>{{ 'inventory.batch' | t }}</th>
                  <th>{{ 'inventory.type' | t }}</th>
                  <th class="right">{{ 'inventory.change' | t }}</th>
                  <th class="right">{{ 'inventory.balance' | t }}</th>
                  <th>{{ 'inventory.reference' | t }}</th>
                  <th>{{ 'inventory.reason' | t }}</th>
                  <th>{{ 'inventory.by' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (m of list.items(); track m.uid) {
                  <tr>
                    <td class="muted">{{ m.createdAt | when }}</td>
                    <td class="strong">{{ m.productName }}</td>
                    <td class="mono">{{ m.batchNumber }}</td>
                    <td>
                      <app-status
                        [value]="m.type"
                        [tone]="m.quantityChange < 0 ? 'amber' : 'green'"
                      />
                    </td>
                    <td
                      class="right strong"
                      [class.text-red]="m.quantityChange < 0"
                      [class.text-green]="m.quantityChange > 0"
                    >
                      {{ m.quantityChange > 0 ? '+' : '' }}{{ m.quantityChange }}
                    </td>
                    <td class="right">{{ m.balanceAfter | num }}</td>
                    <td>{{ m.reference ?? '—' }}</td>
                    <td class="muted">
                      {{ m.reasonCode | label }}{{ m.note ? ' · ' + m.note : '' }}
                    </td>
                    <td>{{ m.createdBy }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9">
                      <app-empty
                        [loading]="list.loading()"
                        icon="activity"
                        [title]="'inventory.noMovements' | t"
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
export default class MovementsPage {
  protected readonly session = inject(SessionStore);
  readonly productUid = input<string | undefined>();
  protected readonly types = MOVEMENT_TYPES;
  protected readonly type = signal('');
  protected readonly list = pagedList<Movement>(() =>
    this.session.branch()
      ? { path: '/stock/movements', query: { type: this.type(), productUid: this.productUid() } }
      : null,
  );
}
