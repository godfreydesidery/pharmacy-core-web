import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api/api.service';
import {
  AccountView,
  ENTRY_LABELS,
  EntryView,
  MemberView,
  ReceivePaymentInput,
  SchemeView,
  Statement,
} from '../../core/api/credit.models';
import { loaded } from '../../core/data/data';
import { SettingsStore } from '../../core/format/settings.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { CurrencyRateComponent } from '../../core/ui/currency-rate.component';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

const METHODS = ['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CHEQUE'];

/** One customer's account: balance, statement, payments on account, holds, write-offs, insurance. */
@Component({
  selector: 'app-customer-account',
  imports: [...SHARED, RouterLink, CurrencyRateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (account.value(); as a) {
      <div class="page">
        <div class="page-head">
          <div>
            <a class="back" routerLink="/receivables"
              ><app-icon name="arrow-left" [size]="14" /> {{ 'receivables.receivables' | t }}</a
            >
            <h1>{{ a.customerName }}</h1>
            <p class="sub">
              {{ 'receivables.creditLimit' | t }} {{ a.creditLimit | money }} · {{ a.termsDays
              }}{{ 'receivables.dayTerms' | t }}
              @if (a.onHold) {
                · <span class="badge red dot">{{ 'receivables.onHold' | t }}</span>
                <span class="muted">{{ a.holdReason }}</span>
              }
            </p>
          </div>
          <div class="actions">
            <a
              class="btn"
              [routerLink]="['/receivables', a.customerUid, 'statement']"
              [queryParams]="{ from: from(), to: to() }"
            >
              <app-icon name="printer" [size]="16" /> {{ 'receivables.statement' | t }}
            </a>
            @if (session.can('finance.manage')) {
              <button class="btn" type="button" (click)="openHold()">
                <app-icon name="lock" [size]="16" />
                {{ a.onHold ? ('ui.l.releaseHold' | t) : ('ui.l.putOnHold' | t) }}
              </button>
            }
            @if (session.can('finance.write_off')) {
              <button
                class="btn"
                type="button"
                (click)="openWriteOff()"
                [disabled]="a.balance <= 0"
              >
                <app-icon name="trash" [size]="16" /> {{ 'receivables.writeOff' | t }}
              </button>
            }
            @if (session.can('finance.manage')) {
              <button class="btn primary" type="button" (click)="openPayment()">
                <app-icon name="cash" [size]="16" /> {{ 'receivables.receivePayment' | t }}
              </button>
            }
          </div>
        </div>

        <div class="grid kpis">
          <app-stat
            [label]="a.balance < 0 ? ('ui.l.inCredit' | t) : ('ui.l.balanceOwed' | t)"
            [value]="(a.balance < 0 ? -a.balance : a.balance) | money"
            icon="wallet"
            [tone]="a.balance > 0 ? 'blue' : 'green'"
            [caption]="
              a.balance < 0
                ? ('ui.l.usableAtTheTillAsAccount' | t)
                : ('ui.l.acrossOpenInvoices' | t)
            "
          />
          <app-stat
            [label]="'receivables.overdue' | t"
            [value]="a.overdue | money"
            icon="clock"
            [tone]="a.overdue > 0 ? 'red' : 'green'"
            [caption]="
              a.oldestOpenDate
                ? ('ui.l.oldestOpenSp' | t) + (a.oldestOpenDate | day)
                : ('ui.l.nothingOpen' | t)
            "
          />
          <app-stat
            [label]="'receivables.availableCredit' | t"
            [value]="a.available | money"
            icon="card"
            tone="purple"
            [caption]="usedPercent() + ('ui.l.ofTheLimitUsed' | t)"
          />
          <app-stat
            [label]="'receivables.unallocatedCredit' | t"
            [value]="a.unallocatedCredit | money"
            icon="cash"
            tone="teal"
            [caption]="'receivables.depositsOverpaymentsAndCreditNotes' | t"
          />
        </div>

        <div class="grid two">
          <div class="card span">
            <div class="card-head">
              <h3>{{ 'receivables.statement' | t }}</h3>
              <div class="range">
                <input
                  class="input sm"
                  type="date"
                  [value]="from()"
                  (change)="from.set($any($event.target).value)"
                />
                <span class="muted">{{ 'receivables.to' | t }}</span>
                <input
                  class="input sm"
                  type="date"
                  [value]="to()"
                  (change)="to.set($any($event.target).value)"
                />
              </div>
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'receivables.date' | t }}</th>
                    <th>{{ 'receivables.entry' | t }}</th>
                    <th>{{ 'receivables.reference' | t }}</th>
                    <th class="right">{{ 'receivables.debit' | t }}</th>
                    <th class="right">{{ 'receivables.credit' | t }}</th>
                    <th class="right">{{ 'receivables.balance' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @if (statement.value(); as s) {
                    <tr class="opening">
                      <td>{{ s.from ? (s.from | day) : '' }}</td>
                      <td colspan="4">{{ 'receivables.openingBalance' | t }}</td>
                      <td class="right">{{ s.openingBalance | money }}</td>
                    </tr>
                    @for (e of s.entries.items; track e.uid) {
                      <tr>
                        <td>{{ e.date | day }}</td>
                        <td>
                          <span class="badge" [class]="tone(e)">{{ labels[e.type] }}</span>
                          @if (e.dueDate && e.openAmount > 0 && e.amount > 0) {
                            <small class="due" [class.late]="isLate(e)"
                              >{{ 'receivables.due' | t }} {{ e.dueDate | day }}</small
                            >
                          }
                        </td>
                        <td>
                          <b class="mono">{{ e.reference ?? '—' }}</b>
                          @if (e.currency) {
                            <small class="muted">
                              {{ e.foreignAmount | num }} {{ e.currency }} @
                              {{ e.exchangeRate }}</small
                            >
                          }
                          @if (e.allocations.length) {
                            <small class="muted alloc">
                              {{ e.amount > 0 ? ('ui.l.settledBy' | t) : 'settled' }}
                              @for (al of e.allocations; track al.entryUid; let last = $last) {
                                {{ al.reference }} ({{ al.amount | money }}){{ last ? '' : ', ' }}
                              }
                            </small>
                          }
                          @if (e.note) {
                            <small class="muted">{{ e.note }}</small>
                          }
                        </td>
                        <td class="right">{{ e.amount > 0 ? (e.amount | money) : '' }}</td>
                        <td class="right">{{ e.amount < 0 ? (-e.amount | money) : '' }}</td>
                        <td class="right strong">{{ e.runningBalance | money }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6">
                          <app-empty
                            icon="receipt"
                            [title]="'receivables.noEntriesInThisPeriod' | t"
                          />
                        </td>
                      </tr>
                    }
                  } @else {
                    <tr>
                      <td colspan="6">
                        <app-empty
                          [loading]="true"
                          icon="receipt"
                          [title]="'receivables.loading' | t"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <h3>{{ 'receivables.insuranceMemberships' | t }}</h3>
              @if (session.can('partners.manage')) {
                <button class="btn sm" type="button" (click)="openEnrol()">
                  <app-icon name="plus" [size]="14" /> {{ 'receivables.enrol' | t }}
                </button>
              }
            </div>
            <div class="list">
              @for (m of members.value()?.items ?? []; track m.uid) {
                <div class="member">
                  <span class="thumb tone-purple"><app-icon name="shield" [size]="16" /></span>
                  <div class="grow">
                    <b>{{ m.payerName }} · {{ m.schemeName }}</b>
                    <small class="muted"
                      >{{ m.memberNumber }} {{ 'receivables.valid' | t }}
                      {{ m.validFrom ? (m.validFrom | day) : ('ui.l.anyTime' | t) }} –
                      {{ m.validUntil ? (m.validUntil | day) : 'open' }}</small
                    >
                    <small class="muted"
                      >{{ 'receivables.coPay' | t }}
                      {{
                        m.copayType === 'PERCENT'
                          ? m.copayValue + '%'
                          : m.copayType === 'FIXED'
                            ? (m.copayValue | money)
                            : 'none'
                      }}
                      {{ 'receivables.usedThisYear' | t }} {{ m.usedThisYear | money }}
                      {{ m.annualLimit ? ('ui.l.ofSp' | t) + (m.annualLimit | money) : '' }}</small
                    >
                  </div>
                  <app-status [value]="m.active ? 'ACTIVE' : 'INACTIVE'" />
                </div>
              } @empty {
                <app-empty
                  icon="shield"
                  [title]="'receivables.notInsured' | t"
                  [text]="'ui.empty.insurance' | t"
                />
              }
            </div>
          </div>
        </div>
      </div>

      <app-modal
        [open]="paying()"
        [title]="'receivables.receivePayment' | t"
        (closed)="paying.set(false)"
      >
        <form class="form-grid" [formGroup]="payment" (ngSubmit)="receive()">
          <div class="field">
            <label>{{ 'receivables.amount' | t }}</label>
            <input class="input" type="number" min="0" step="any" formControlName="amount" />
            @if (err('amount'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'receivables.method' | t }}</label>
            <select class="select" formControlName="method">
              @for (m of methods; track m) {
                <option [value]="m">{{ m | label }}</option>
              }
            </select>
          </div>
          <div class="field full">
            <label>{{ 'receivables.currency' | t }}</label>
            <app-currency-rate [(currency)]="currency" [(rate)]="rate" [compact]="true" />
            @if (foreign()) {
              <small class="muted"
                >{{ 'receivables.credits' | t }} {{ baseValue() | money }}
                {{ 'receivables.toTheAccountAtThis' | t }}</small
              >
            }
          </div>
          <div class="field">
            <label>{{ 'receivables.reference' | t }}</label
            ><input
              class="input"
              formControlName="reference"
              [placeholder]="'receivables.mPesaCodeCheque' | t"
            />
          </div>
          <div class="field">
            <label>{{ 'receivables.date' | t }}</label
            ><input class="input" type="date" formControlName="date" />
          </div>
          <div class="field full">
            <label>{{ 'receivables.allocateTo' | t }}</label>
            <div class="alloc-list">
              <label class="check"
                ><input
                  type="radio"
                  name="mode"
                  [checked]="!chosen().length"
                  (change)="chosen.set([])"
                />
                {{ 'receivables.oldestInvoicesFirst' | t }}</label
              >
              @for (c of openCharges(); track c.uid) {
                <label class="check">
                  <input
                    type="checkbox"
                    [checked]="chosen().includes(c.uid)"
                    (change)="toggle(c.uid)"
                  />
                  <span class="mono">{{ c.reference }}</span>
                  <span class="muted">{{ c.date | day }}</span>
                  <span class="grow"></span>
                  <b>{{ c.openAmount | money }}</b>
                </label>
              }
            </div>
            @if (overpay() > 0) {
              <small class="note"
                >{{ overpay() | money }} {{ 'receivables.moreThanIsOwedStays' | t }}</small
              >
            }
          </div>
        </form>
        <ng-container footer>
          <button class="btn" type="button" (click)="paying.set(false)">
            {{ 'common.cancel' | t }}
          </button>
          <button class="btn primary" type="button" [disabled]="busy()" (click)="receive()">
            {{ 'receivables.receive' | t }}
          </button>
        </ng-container>
      </app-modal>

      <app-modal
        [open]="writingOff()"
        [title]="'receivables.writeOffBadDebt' | t"
        (closed)="writingOff.set(false)"
      >
        <form class="form-grid" [formGroup]="writeOffForm">
          <div class="field">
            <label>{{ 'receivables.amount' | t }}</label
            ><input class="input" type="number" min="0" step="any" formControlName="amount" />
          </div>
          <div class="field full">
            <label>{{ 'receivables.reason' | t }}</label
            ><textarea
              class="input"
              formControlName="reason"
              [placeholder]="'receivables.whyTheDebtCannotBe' | t"
            ></textarea>
          </div>
          <p class="muted full">
            {{ 'receivables.postsDrBadDebtsCr' | t }}
          </p>
        </form>
        <ng-container footer>
          <button class="btn" type="button" (click)="writingOff.set(false)">
            {{ 'common.cancel' | t }}
          </button>
          <button class="btn danger" type="button" [disabled]="busy()" (click)="writeOff()">
            {{ 'receivables.writeOff' | t }}
          </button>
        </ng-container>
      </app-modal>

      <app-modal
        [open]="holding()"
        [title]="a.onHold ? ('ui.l.releaseHold' | t) : ('ui.l.putAccountOnHold' | t)"
        (closed)="holding.set(false)"
      >
        @if (!a.onHold) {
          <div class="field">
            <label>{{ 'receivables.reason' | t }}</label
            ><input
              class="input"
              [value]="holdReason()"
              (input)="holdReason.set($any($event.target).value)"
              [placeholder]="'receivables.overdueOver60Days' | t"
            />
          </div>
          <p class="muted">{{ 'receivables.noNewCreditSalesWhile' | t }}</p>
        } @else {
          <p>{{ 'receivables.newCreditSalesWillBe' | t }}</p>
        }
        <ng-container footer>
          <button class="btn" type="button" (click)="holding.set(false)">
            {{ 'common.cancel' | t }}
          </button>
          <button class="btn primary" type="button" [disabled]="busy()" (click)="hold(!a.onHold)">
            {{ 'receivables.confirm' | t }}
          </button>
        </ng-container>
      </app-modal>

      <app-modal
        [open]="enrolling()"
        [title]="'receivables.enrolInAnInsuranceScheme' | t"
        (closed)="enrolling.set(false)"
      >
        <form class="form-grid" [formGroup]="enrolForm">
          <div class="field full">
            <label>{{ 'receivables.scheme' | t }}</label>
            <select class="select" formControlName="schemeUid">
              <option value="">{{ 'receivables.choose' | t }}</option>
              @for (s of schemes.value() ?? []; track s.uid) {
                <option [value]="s.uid">{{ s.payerName }} · {{ s.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>{{ 'receivables.memberNumber' | t }}</label
            ><input class="input" formControlName="memberNumber" />
          </div>
          <div class="field">
            <label>{{ 'receivables.principalMember' | t }}</label
            ><input
              class="input"
              formControlName="principalName"
              [placeholder]="'receivables.ifADependant' | t"
            />
          </div>
          <div class="field">
            <label>{{ 'receivables.validFrom' | t }}</label
            ><input class="input" type="date" formControlName="validFrom" />
          </div>
          <div class="field">
            <label>{{ 'receivables.validUntil' | t }}</label
            ><input class="input" type="date" formControlName="validUntil" />
          </div>
        </form>
        <ng-container footer>
          <button class="btn" type="button" (click)="enrolling.set(false)">
            {{ 'common.cancel' | t }}
          </button>
          <button class="btn primary" type="button" [disabled]="busy()" (click)="enrol()">
            {{ 'receivables.enrol' | t }}
          </button>
        </ng-container>
      </app-modal>
    } @else {
      <div class="page">
        <app-empty
          [loading]="account.loading()"
          icon="wallet"
          [title]="'receivables.noSuchAccount' | t"
        />
      </div>
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 4px;
    }
    .span {
      grid-column: span 1;
    }
    .range {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .opening td {
      color: var(--muted);
      font-style: italic;
    }
    td small {
      display: block;
      font-size: 11.5px;
    }
    .alloc {
      max-width: 340px;
      white-space: normal;
    }
    .due {
      color: var(--muted);
    }
    .due.late {
      color: var(--red);
    }
    .strong {
      font-weight: 650;
    }
    .list {
      padding: 4px 18px 18px;
      display: grid;
      gap: 12px;
    }
    .member {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .member small {
      display: block;
    }
    .grow {
      flex: 1;
    }
    .thumb {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: grid;
      place-items: center;
    }
    .alloc-list {
      display: grid;
      gap: 6px;
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
    }
    .alloc-list .check {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .note {
      color: var(--green);
    }
  `,
})
export default class CustomerAccountPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly settings = inject(SettingsStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly labels = ENTRY_LABELS;
  protected readonly methods = METHODS;
  private readonly customerUid = inject(ActivatedRoute).snapshot.paramMap.get('customerUid')!;

  protected readonly from = signal(firstOfYear());
  protected readonly to = signal(today());

  protected readonly account = loaded<AccountView>(() => ({
    path: `/receivables/accounts/${this.customerUid}`,
    options: { noBranch: true },
  }));
  protected readonly statement = loaded<Statement>(() => ({
    path: `/receivables/accounts/${this.customerUid}/statement`,
    query: { from: this.from(), to: this.to(), limit: 100 },
    options: { noBranch: true },
  }));
  protected readonly members = loaded<{ items: MemberView[] }>(() =>
    this.session.can('partners.view')
      ? {
          path: '/insurance/members',
          query: { customerUid: this.customerUid },
          options: { noBranch: true },
        }
      : null,
  );
  protected readonly schemes = loaded<SchemeView[]>(() =>
    this.enrolling() ? { path: '/insurance/schemes', options: { noBranch: true } } : null,
  );

  protected readonly paying = signal(false);
  protected readonly writingOff = signal(false);
  protected readonly holding = signal(false);
  protected readonly enrolling = signal(false);
  protected readonly busy = signal(false);
  protected readonly holdReason = signal('');
  protected readonly chosen = signal<string[]>([]);
  protected readonly currency = signal('');
  protected readonly rate = signal(1);

  protected readonly payment = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['CASH'],
    reference: [''],
    date: [today()],
  });
  protected readonly writeOffForm = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    reason: ['', Validators.required],
  });
  protected readonly enrolForm = this.fb.group({
    schemeUid: ['', Validators.required],
    memberNumber: ['', Validators.required],
    principalName: [''],
    validFrom: [''],
    validUntil: [''],
  });
  private readonly amount = signal(0);

  protected readonly openCharges = computed(() =>
    (this.statement.value()?.entries.items ?? []).filter((e) => e.amount > 0 && e.openAmount > 0),
  );
  protected readonly foreign = computed(
    () => !!this.currency() && this.currency() !== this.settings.currency(),
  );
  protected readonly baseValue = computed(() =>
    this.foreign() ? Math.round(this.amount() * this.rate() * 100) / 100 : this.amount(),
  );
  protected readonly overpay = computed(() => {
    const owed = Math.max(0, this.account.value()?.balance ?? 0);
    return Math.max(0, Math.round((this.baseValue() - owed) * 100) / 100);
  });
  protected readonly usedPercent = computed(() => {
    const a = this.account.value();
    if (!a || !a.creditLimit) {
      return 0;
    }
    return Math.max(0, Math.round((Math.max(a.balance, 0) / a.creditLimit) * 100));
  });

  constructor() {
    this.payment.controls.amount.valueChanges.subscribe((v) => this.amount.set(Number(v) || 0));
  }

  protected err(name: string): string | null {
    return controlError(this.payment.get(name));
  }

  protected tone(e: EntryView): string {
    switch (e.type) {
      case 'CHARGE':
      case 'CREDIT_APPLIED':
        return 'badge blue';
      case 'PAYMENT':
        return 'badge green';
      case 'CREDIT_NOTE':
        return 'badge purple';
      case 'WRITE_OFF':
        return 'badge red';
      default:
        return 'badge gray';
    }
  }

  protected isLate(e: EntryView): boolean {
    return !!e.dueDate && e.dueDate < today();
  }

  protected toggle(uid: string): void {
    const now = this.chosen();
    this.chosen.set(now.includes(uid) ? now.filter((u) => u !== uid) : [...now, uid]);
  }

  protected openPayment(): void {
    const owed = Math.max(0, this.account.value()?.balance ?? 0);
    this.payment.reset({ amount: owed, method: 'CASH', reference: '', date: today() });
    this.amount.set(owed);
    this.chosen.set([]);
    this.currency.set(this.settings.currency());
    this.rate.set(1);
    this.paying.set(true);
  }

  protected openWriteOff(): void {
    this.writeOffForm.reset({
      amount: Math.max(0, this.account.value()?.balance ?? 0),
      reason: '',
    });
    this.writingOff.set(true);
  }

  protected openHold(): void {
    this.holdReason.set('');
    this.holding.set(true);
  }

  protected openEnrol(): void {
    this.enrolForm.reset({
      schemeUid: '',
      memberNumber: '',
      principalName: '',
      validFrom: '',
      validUntil: '',
    });
    this.enrolling.set(true);
  }

  protected async receive(): Promise<void> {
    if (!validate(this.payment)) {
      return;
    }
    const v = this.payment.getRawValue();
    const body: ReceivePaymentInput = {
      customerUid: this.customerUid,
      amount: Number(v.amount),
      method: v.method,
      reference: v.reference || null,
      date: v.date || null,
      allocateTo: this.chosen(),
      currency: this.foreign() ? this.currency() : null,
      exchangeRate: this.foreign() ? this.rate() : null,
    };
    await this.run(async () => {
      const entry = await this.api.post<EntryView>('/receivables/payments', body, {
        silent: true,
        noBranch: true,
      });
      const settled = entry.allocations.map((a) => a.reference).join(', ');
      this.toasts.success(
        settled
          ? this.translations.t('toast.paymentReceivedSettled', {
              reference: entry.reference,
              settled,
            })
          : this.translations.t('toast.paymentReceived', { reference: entry.reference }),
      );
      this.paying.set(false);
    }, this.payment);
  }

  protected async writeOff(): Promise<void> {
    if (!validate(this.writeOffForm)) {
      return;
    }
    const v = this.writeOffForm.getRawValue();
    await this.run(async () => {
      await this.api.post(
        '/receivables/write-offs',
        { customerUid: this.customerUid, amount: Number(v.amount), reason: v.reason },
        { silent: true, noBranch: true },
      );
      this.toasts.success(this.translations.t('toast.badDebtWrittenOff'));
      this.writingOff.set(false);
    }, this.writeOffForm);
  }

  protected async hold(onHold: boolean): Promise<void> {
    await this.run(async () => {
      await this.api.post(
        `/receivables/accounts/${this.customerUid}/hold`,
        { onHold, reason: this.holdReason() || 'Held by finance' },
        { silent: true, noBranch: true },
      );
      this.toasts.success(
        this.translations.t(onHold ? 'toast.accountOnHold' : 'toast.holdReleased'),
      );
      this.holding.set(false);
    });
  }

  protected async enrol(): Promise<void> {
    if (!validate(this.enrolForm)) {
      return;
    }
    const v = this.enrolForm.getRawValue();
    await this.run(async () => {
      await this.api.post(
        '/insurance/members',
        {
          customerUid: this.customerUid,
          schemeUid: v.schemeUid,
          memberNumber: v.memberNumber,
          principalName: v.principalName || null,
          validFrom: v.validFrom || null,
          validUntil: v.validUntil || null,
          active: true,
        },
        { silent: true, noBranch: true },
      );
      this.toasts.success(this.translations.t('toast.memberEnrolled'));
      this.enrolling.set(false);
      await this.members.reload();
    }, this.enrolForm);
  }

  private async run(
    work: () => Promise<void>,
    form?: Parameters<typeof applyApiError>[0],
  ): Promise<void> {
    this.busy.set(true);
    try {
      await work();
      await Promise.all([this.account.reload(), this.statement.reload()]);
    } catch (failure) {
      if (!form || !applyApiError(form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
