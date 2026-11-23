import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { loaded } from '../../core/data/data';
import { downloadCsv } from '../../core/format/format';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';

/*
 * The API contract this page reads. Kept here, apart from the shared models, so a change in the
 * API's shape touches this file only.
 */

/** GET /api/v1/suppliers/balances: one row per supplier the pharmacy deals with. */
export interface SupplierBalance {
  supplierUid: string;
  supplierName: string;
  opening: number;
  received: number;
  returned: number;
  paid: number;
  /** What the pharmacy owes the supplier, in the base currency (negative: the supplier owes). */
  balance: number;
  lastActivity: string | null;
}

export type StatementLineType = 'OPENING' | 'RECEIPT' | 'PAYMENT' | 'RETURN';

/** GET /api/v1/suppliers/{uid}/statement (base currency). */
export interface SupplierStatement {
  supplierUid: string;
  supplierName: string;
  lines: {
    date: string;
    type: StatementLineType;
    documentUid: string | null;
    number: string | null;
    reference: string | null;
    /** Positive raises what is owed (opening, receipt); negative lowers it (payment, return). */
    amount: number;
    balance: number;
  }[];
  balance: number;
}

/** Purchasing → Supplier balances: what the pharmacy owes each supplier, with a statement. */
@Component({
  selector: 'app-supplier-balances',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'payables.title' | t }}</h1>
          <p class="sub">{{ 'payables.sub' | t }}</p>
        </div>
        <div class="actions">
          <button class="btn" type="button" [disabled]="!rows().length" (click)="export()">
            <app-icon name="download" [size]="16" /> {{ 'payables.export' | t }}
          </button>
        </div>
      </div>

      <div class="stats">
        <app-stat
          icon="wallet"
          [label]="'payables.totalOwed' | t"
          [value]="(totalOwed() | money) ?? ''"
          caption=""
        />
        <app-stat
          icon="truck"
          [label]="'payables.suppliersOwed' | t"
          [value]="owedCount()"
          caption=""
        />
      </div>

      <div class="card">
        <div class="toolbar">
          <label class="search grow">
            <app-icon name="search" [size]="16" />
            <input
              [placeholder]="'payables.search' | t"
              [value]="q()"
              (input)="q.set($any($event.target).value)"
            />
          </label>
          <label class="check">
            <input type="checkbox" [checked]="owingOnly()" (change)="owingOnly.set(!owingOnly())" />
            {{ 'payables.owingOnly' | t }}
          </label>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'payables.supplier' | t }}</th>
                <th>{{ 'payables.lastActivity' | t }}</th>
                <th class="right">{{ 'payables.balance' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (b of rows(); track b.supplierUid) {
                <tr class="clickable" (click)="open(b)">
                  <td class="strong">
                    <button type="button" class="row-link">{{ b.supplierName }}</button>
                  </td>
                  <td class="muted">{{ b.lastActivity ? (b.lastActivity | day) : '—' }}</td>
                  <td class="right strong" [class.text-green]="b.balance < 0">
                    {{ b.balance | money }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">
                    <app-empty
                      [loading]="balances.loading()"
                      icon="truck"
                      [title]="'payables.none' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <app-drawer
      [wide]="true"
      [open]="!!selected()"
      [title]="selected()?.supplierName ?? ''"
      [subtitle]="'payables.statement' | t"
      (closed)="selected.set(null)"
    >
      @if (statement.value(); as s) {
        <div class="table-wrap">
          <table class="table statement">
            <thead>
              <tr>
                <th>{{ 'payables.document' | t }}</th>
                <th class="right">{{ 'payables.debit' | t }}</th>
                <th class="right">{{ 'payables.credit' | t }}</th>
                <th class="right">{{ 'payables.balance' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (l of s.lines; track $index) {
                <tr>
                  <td>
                    <small class="muted block">{{ l.date | day }}</small>
                    {{ 'payables.type.' + l.type | t }}
                    @if (l.number) {
                      <span class="mono muted">{{ l.number }}</span>
                    }
                    @if (l.reference) {
                      <small class="muted block">{{ l.reference }}</small>
                    }
                  </td>
                  <!-- A payable account: payments and returns are debits, receipts credits. -->
                  <td class="right">{{ l.amount < 0 ? (-l.amount | money) : '' }}</td>
                  <td class="right">{{ l.amount > 0 ? (l.amount | money) : '' }}</td>
                  <td class="right strong">{{ l.balance | money }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="empty">{{ 'payables.noLines' | t }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="row between closing">
          <span>{{ 'payables.closing' | t }}</span>
          <b>{{ s.balance | money }}</b>
        </div>
      } @else {
        <app-empty [loading]="statement.loading()" icon="file" [title]="'payables.statement' | t" />
      }
    </app-drawer>
  `,
  styles: `
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    /* Four columns that fit the drawer: the date sits above each document. */
    .statement th,
    .statement td {
      padding-left: 8px;
      padding-right: 8px;
    }
    .statement td.right {
      white-space: nowrap;
    }
    .closing {
      padding: 12px 4px 0;
      font-size: 15px;
    }
  `,
})
export default class SupplierBalancesPage {
  private readonly translations = inject(Translations);
  protected readonly q = signal('');
  protected readonly owingOnly = signal(true);
  protected readonly selected = signal<SupplierBalance | null>(null);

  protected readonly balances = loaded<SupplierBalance[]>(() => ({
    path: '/suppliers/balances',
    options: { noBranch: true },
  }));
  protected readonly statement = loaded<SupplierStatement>(() => {
    const supplier = this.selected();
    return supplier
      ? { path: `/suppliers/${supplier.supplierUid}/statement`, options: { noBranch: true } }
      : null;
  });

  /** Largest balances first; settled suppliers hidden unless asked for. */
  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    return (this.balances.value() ?? [])
      .filter((b) => !this.owingOnly() || b.balance !== 0)
      .filter((b) => !q || b.supplierName.toLowerCase().includes(q))
      .sort((a, b) => b.balance - a.balance);
  });
  protected readonly totalOwed = computed(() =>
    (this.balances.value() ?? []).reduce((sum, b) => sum + Math.max(b.balance, 0), 0),
  );
  protected readonly owedCount = computed(
    () => (this.balances.value() ?? []).filter((b) => b.balance > 0).length,
  );

  protected open(balance: SupplierBalance): void {
    this.selected.set(balance);
  }

  protected export(): void {
    const t = (key: string) => this.translations.t(key);
    downloadCsv(
      'supplier-balances.csv',
      [t('payables.supplier'), t('payables.lastActivity'), t('payables.balance')],
      this.rows().map((b) => [b.supplierName, b.lastActivity ?? '', b.balance]),
    );
  }
}
