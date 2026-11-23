import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { guardUnsavedWork } from '../../core/session/leave-guard';
import { SessionStore } from '../../core/session/session.store';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

interface PartyLine {
  type: 'CUSTOMER' | 'SUPPLIER';
  uid: string;
  name: string;
  amount: number;
}

interface OpeningBalance {
  uid: string;
  asOf: string;
  cash: number;
  bank: number;
  mobileMoney: number;
  inventory: number;
  receivables: number;
  payables: number;
  capital: number;
  journalNumber: string | null;
  parties: PartyLine[];
  createdAt: string;
  createdBy: string;
}

interface Status {
  posted: OpeningBalance | null;
  stockAtCost: number;
}

interface Row {
  uid: string;
  name: string;
  amount: number;
}

/**
 * A pharmacy's opening balances: money held, stock at cost, what customers owe and what is owed to
 * suppliers. Posted once; owner's equity takes the difference.
 */
@Component({
  selector: 'app-opening-balances',
  imports: [...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'admin2.openingBalances' | t }}</h1>
          <p class="sub">{{ 'admin2.openingIntro' | t }}</p>
        </div>
      </div>

      @if (status.value(); as s) {
        @if (s.posted; as o) {
          <div class="notice tone-green mb">
            <app-icon name="check" />
            {{ 'admin2.openingPosted' | t: { number: o.journalNumber ?? '', date: o.asOf } }}
          </div>
          <div class="grid two">
            <div class="card card-pad">
              <dl class="dl">
                <div>
                  <dt>{{ 'admin2.cash' | t }}</dt>
                  <dd>{{ o.cash | money }}</dd>
                </div>
                <div>
                  <dt>{{ 'admin2.bank' | t }}</dt>
                  <dd>{{ o.bank | money }}</dd>
                </div>
                <div>
                  <dt>{{ 'admin2.mobileMoney' | t }}</dt>
                  <dd>{{ o.mobileMoney | money }}</dd>
                </div>
                <div>
                  <dt>{{ 'admin2.inventory' | t }}</dt>
                  <dd>{{ o.inventory | money }}</dd>
                </div>
                <div>
                  <dt>{{ 'admin2.receivables' | t }}</dt>
                  <dd>{{ o.receivables | money }}</dd>
                </div>
                <div>
                  <dt>{{ 'admin2.payables' | t }}</dt>
                  <dd>{{ o.payables | money }}</dd>
                </div>
                <div>
                  <dt>{{ 'admin2.capital' | t }}</dt>
                  <dd>
                    <b>{{ o.capital | money }}</b>
                  </dd>
                </div>
              </dl>
              <p class="muted small">{{ o.createdBy }} · {{ o.createdAt | when }}</p>
            </div>
            <div class="card">
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{{ 'admin2.party' | t }}</th>
                      <th>{{ 'admin2.type' | t }}</th>
                      <th class="right">{{ 'admin2.amount' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of o.parties; track p.uid) {
                      <tr>
                        <td>{{ p.name }}</td>
                        <td>
                          {{ (p.type === 'CUSTOMER' ? 'admin2.owesUs' : 'admin2.weOwe') | t }}
                        </td>
                        <td class="right">{{ p.amount | money }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="3" class="muted">{{ 'admin2.noParties' | t }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        } @else {
          <div class="grid two">
            <div class="card card-pad stack">
              <h3>{{ 'admin2.moneyAndStock' | t }}</h3>
              <div class="form-grid">
                <app-field [label]="'admin2.asOf' | t">
                  <input
                    class="input"
                    type="date"
                    [value]="asOf()"
                    (input)="asOf.set($any($event.target).value)"
                  />
                </app-field>
                <app-field [label]="'admin2.cash' | t">
                  <input
                    class="input"
                    type="number"
                    min="0"
                    step="any"
                    [value]="cash()"
                    (input)="cash.set(+$any($event.target).value)"
                  />
                </app-field>
                <app-field [label]="'admin2.bank' | t">
                  <input
                    class="input"
                    type="number"
                    min="0"
                    step="any"
                    [value]="bank()"
                    (input)="bank.set(+$any($event.target).value)"
                  />
                </app-field>
                <app-field [label]="'admin2.mobileMoney' | t">
                  <input
                    class="input"
                    type="number"
                    min="0"
                    step="any"
                    [value]="mobileMoney()"
                    (input)="mobileMoney.set(+$any($event.target).value)"
                  />
                </app-field>
                <app-field class="full" [label]="'admin2.inventory' | t">
                  <input
                    class="input"
                    type="number"
                    min="0"
                    step="any"
                    [value]="inventory() ?? s.stockAtCost"
                    (input)="inventory.set(+$any($event.target).value)"
                  />
                  <span class="hint">{{
                    'admin2.inventoryHint' | t: { value: (s.stockAtCost | money) }
                  }}</span>
                </app-field>
              </div>
            </div>

            <div class="card card-pad stack">
              <h3>{{ 'admin2.customersOweUs' | t }}</h3>
              <app-lookup
                path="/customers"
                [placeholder]="'admin2.addCustomer' | t"
                [keepText]="false"
                (picked)="addRow(receivables, $event)"
              />
              @for (r of receivables(); track r.uid) {
                <div class="row" style="gap:8px">
                  <span class="grow">{{ r.name }}</span>
                  <input
                    class="input sm"
                    style="width:140px"
                    type="number"
                    min="0"
                    step="any"
                    [value]="r.amount"
                    (input)="setAmount(receivables, r.uid, +$any($event.target).value)"
                  />
                  <button
                    class="icon-btn sm"
                    type="button"
                    (click)="removeRow(receivables, r.uid)"
                    [attr.aria-label]="'admin2.remove' | t"
                  >
                    <app-icon name="x" [size]="14" />
                  </button>
                </div>
              }
              <h3>{{ 'admin2.weOweSuppliers' | t }}</h3>
              <app-lookup
                path="/suppliers"
                [placeholder]="'admin2.addSupplier' | t"
                [keepText]="false"
                (picked)="addRow(payables, $event)"
              />
              @for (r of payables(); track r.uid) {
                <div class="row" style="gap:8px">
                  <span class="grow">{{ r.name }}</span>
                  <input
                    class="input sm"
                    style="width:140px"
                    type="number"
                    min="0"
                    step="any"
                    [value]="r.amount"
                    (input)="setAmount(payables, r.uid, +$any($event.target).value)"
                  />
                  <button
                    class="icon-btn sm"
                    type="button"
                    (click)="removeRow(payables, r.uid)"
                    [attr.aria-label]="'admin2.remove' | t"
                  >
                    <app-icon name="x" [size]="14" />
                  </button>
                </div>
              }
            </div>
          </div>

          <div class="card card-pad row between mt">
            <div>
              <div class="muted small">{{ 'admin2.capital' | t }}</div>
              <b class="capital">{{ capital(s.stockAtCost) | money }}</b>
              <div class="muted small">{{ 'admin2.capitalHint' | t }}</div>
            </div>
            @if (canPost()) {
              <button
                class="btn primary"
                type="button"
                [disabled]="busy()"
                (click)="post(s.stockAtCost)"
              >
                <app-icon name="check" [size]="16" /> {{ 'admin2.postOpening' | t }}
              </button>
            }
          </div>
        }
      } @else {
        <app-empty [loading]="status.loading()" icon="wallet" [title]="''" />
      }
    </div>
  `,
  styles: `
    .capital {
      font-size: 22px;
    }
    .mt {
      margin-top: 18px;
    }
  `,
})
export default class OpeningBalancesPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  protected readonly status = loaded<Status>(() => ({
    path: '/opening-balances',
    options: { noBranch: true },
  }));
  protected readonly busy = signal(false);
  protected readonly asOf = signal(new Date().toISOString().slice(0, 10));
  protected readonly cash = signal(0);
  protected readonly bank = signal(0);
  protected readonly mobileMoney = signal(0);
  protected readonly inventory = signal<number | null>(null);
  protected readonly receivables = signal<Row[]>([]);
  protected readonly payables = signal<Row[]>([]);
  protected readonly canPost = computed(() => this.session.can('finance.manage'));
  /** Amounts typed but not posted: leaving the page asks first (UX-4). */
  private readonly unsaved = guardUnsavedWork(
    () =>
      !!(this.cash() || this.bank() || this.mobileMoney() || this.inventory() !== null) ||
      this.receivables().length > 0 ||
      this.payables().length > 0,
  );

  protected capital(stockAtCost: number): number {
    const sum = (rows: Row[]) => rows.reduce((total, r) => total + (r.amount || 0), 0);
    return (
      (this.cash() || 0) +
      (this.bank() || 0) +
      (this.mobileMoney() || 0) +
      (this.inventory() ?? stockAtCost) +
      sum(this.receivables()) -
      sum(this.payables())
    );
  }

  protected addRow(
    list: typeof this.receivables,
    item: { uid: string; name: string } | null,
  ): void {
    if (!item || list().some((r) => r.uid === item.uid)) {
      return;
    }
    list.update((rows) => [...rows, { uid: item.uid, name: item.name, amount: 0 }]);
  }

  protected setAmount(list: typeof this.receivables, uid: string, amount: number): void {
    list.update((rows) => rows.map((r) => (r.uid === uid ? { ...r, amount } : r)));
  }

  protected removeRow(list: typeof this.receivables, uid: string): void {
    list.update((rows) => rows.filter((r) => r.uid !== uid));
  }

  protected async post(stockAtCost: number): Promise<void> {
    const sure = await this.confirm.ask({
      icon: 'warning',
      title: this.translations.t('common.areYouSure'),
      text: this.translations.t('admin2.confirmOpening'),
      focus: 'cancel',
    });
    if (!sure) {
      return;
    }
    const lines = (rows: Row[]) =>
      rows.filter((r) => r.amount > 0).map((r) => ({ partyUid: r.uid, amount: r.amount }));
    this.busy.set(true);
    try {
      await this.api.post(
        '/opening-balances',
        {
          asOf: this.asOf(),
          cash: this.cash() || 0,
          bank: this.bank() || 0,
          mobileMoney: this.mobileMoney() || 0,
          inventory: this.inventory() ?? stockAtCost,
          receivables: lines(this.receivables()),
          payables: lines(this.payables()),
        },
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('admin2.openingSaved'));
      this.unsaved.done();
      await this.status.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
