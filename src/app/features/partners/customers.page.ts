import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { StaleRecordService, ifMatch } from '../../core/api/concurrency';
import {
  ConsentChoices,
  ConsentPurpose,
  Customer,
  CustomerConsents,
  CustomerInput,
  CustomerType,
  PaymentTerms,
} from '../../core/api/models';
import { debounced, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { CONSENT_PURPOSES, CustomerPrivacyComponent } from './customer-privacy.component';

/** The consent checkboxes of the customer form, by purpose. */
const CONSENT_CONTROLS = {
  SMS_RECEIPTS: 'smsReceipts',
  MARKETING: 'marketing',
  INSURER_SHARING: 'insurerSharing',
} as const satisfies Record<ConsentPurpose, string>;

/** Before anything is recorded: SMS receipts are part of the sale; the others need a yes. */
const DEFAULT_CONSENTS: Record<ConsentPurpose, boolean> = {
  SMS_RECEIPTS: true,
  MARKETING: false,
  INSURER_SHARING: false,
};

const TYPES: CustomerType[] = [
  'RETAIL',
  'WHOLESALE',
  'INSURANCE',
  'CORPORATE',
  'STAFF',
  'NGO',
  'GOVERNMENT',
];

@Component({
  selector: 'app-customers',
  imports: [TranslatePipe, ...SHARED, CustomerPrivacyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'partners.customers' | t }}</h1>
          <p class="sub">{{ 'partners.patientsWholesaleBuyersAndInsuredMembers' | t }}</p>
        </div>
        <div class="actions">
          @if (session.can('data.export')) {
            <!-- Customers' phones and insurance numbers: bulk export is its own permission (ISO-10). -->
            <app-export [list]="list" />
          }
          <app-import
            path="/customers/import"
            permission="partners.manage"
            title="ui.import.customers"
            (imported)="list.reload()"
          />
          @if (session.can('partners.manage')) {
            <button class="btn primary" type="button" (click)="edit(null)">
              <app-icon name="plus" [size]="16" /> {{ 'partners.addCustomer' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="search"
            ><app-icon name="search" [size]="16" /><input
              [placeholder]="'partners.namePhoneEmailOrCode' | t"
              (input)="q.set($any($event.target).value)"
          /></label>
          <div class="chips">
            <button type="button" class="chip" [class.active]="!type()" (click)="type.set('')">
              {{ 'partners.all' | t }}
            </button>
            @for (t of types; track t) {
              <button
                type="button"
                class="chip"
                [class.active]="type() === t"
                (click)="type.set(t)"
              >
                {{ t | label }}
              </button>
            }
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'partners.customer' | t }}</th>
                <th>{{ 'partners.phone' | t }}</th>
                <th>{{ 'partners.email' | t }}</th>
                <th>{{ 'partners.type' | t }}</th>
                <th>{{ 'partners.insurance' | t }}</th>
                <th class="right">{{ 'partners.creditLimit' | t }}</th>
                <th>{{ 'partners.paymentTerms' | t }}</th>
                <th>{{ 'partners.status' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of list.items(); track c.uid) {
                <tr>
                  <td>
                    <div class="cell-main">
                      <span class="avatar">{{ initials(c.name) }}</span>
                      <div>
                        @if (session.can('finance.view')) {
                          <a
                            [routerLink]="['/receivables', c.uid]"
                            [title]="'partners.accountAndStatement' | t"
                            ><b>{{ c.name }}</b></a
                          >
                        } @else {
                          <b>{{ c.name }}</b>
                        }
                        <small
                          >{{ c.code }}
                          @if (c.anonymisedAt) {
                            <span class="badge gray" data-testid="anonymised-badge">{{
                              'privacy.anonymisedBadge' | t
                            }}</span>
                          }
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{{ c.phone ?? '—' }}</td>
                  <td>{{ c.email ?? '—' }}</td>
                  <td>
                    <span
                      class="badge"
                      [class]="
                        c.type === 'INSURANCE'
                          ? 'badge purple'
                          : c.type === 'WHOLESALE'
                            ? 'badge blue'
                            : 'badge gray'
                      "
                      >{{ c.type | label }}</span
                    >
                  </td>
                  <td class="muted">
                    {{
                      c.insuranceProvider
                        ? c.insuranceProvider + (c.insuranceNumber ? ' · ' + c.insuranceNumber : '')
                        : '—'
                    }}
                  </td>
                  <td class="right">{{ c.creditLimit | money }}</td>
                  <td class="muted">{{ c.paymentTerms | label: 'PaymentTerms' }}</td>
                  <td><app-status [value]="c.active ? 'ACTIVE' : 'INACTIVE'" /></td>
                  <td class="right nowrap">
                    @if (session.can('partners.manage') && !c.anonymisedAt) {
                      <button class="btn sm" type="button" data-testid="edit" (click)="edit(c)">
                        <app-icon name="edit" [size]="14" /> {{ 'partners.edit' | t }}
                      </button>
                    }
                    <button
                      class="btn sm"
                      type="button"
                      data-testid="privacy"
                      [attr.aria-label]="'privacy.openFor' | t: { name: c.name }"
                      (click)="privacy.set(c)"
                    >
                      <app-icon name="shield" [size]="14" /> {{ 'privacy.title' | t }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9">
                    <app-empty [for]="list" icon="users" [title]="'partners.noCustomers' | t" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="list" />
      </div>
    </div>
    <app-modal
      [open]="open()"
      [title]="current() ? ('ui.l.editSp' | t) + current()!.name : ('ui.l.addCustomer' | t)"
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <app-field class="full" [label]="'partners.name' | t" [error]="err('name')">
          <input class="input" formControlName="name" />
        </app-field>
        <app-field [label]="'partners.phone' | t" [error]="err('phone')">
          <input class="input" formControlName="phone" placeholder="+255…" />
        </app-field>
        <app-field [label]="'partners.email' | t" [error]="err('email')">
          <input class="input" type="email" formControlName="email" />
        </app-field>
        <app-field [label]="'partners.type' | t">
          <select class="select" formControlName="type">
            @for (t of types; track t) {
              <option [value]="t">{{ t | label }}</option>
            }
          </select>
        </app-field>
        <app-field [label]="'partners.creditLimit' | t" [hint]="'creditLimit.notAllowed' | t">
          <input class="input" type="number" min="0" step="any" formControlName="creditLimit" />
          @if (!canSetLimit()) {}
        </app-field>
        <app-field [label]="'partners.paymentTerms' | t">
          <select class="select" formControlName="paymentTerms">
            @for (terms of paymentTerms; track terms) {
              <option [value]="terms">{{ terms | label: 'PaymentTerms' }}</option>
            }
          </select>
        </app-field>
        <app-field [label]="'partners.insuranceProvider' | t">
          <input class="input" formControlName="insuranceProvider" placeholder="NHIF, Jubilee…" />
        </app-field>
        <app-field [label]="'partners.membershipNumber' | t">
          <input class="input" formControlName="insuranceNumber" />
        </app-field>
        <app-field class="full" [label]="'partners.address' | t">
          <textarea class="input" formControlName="address"></textarea>
        </app-field>
        @if (current()) {
          <label class="check full"
            ><input type="checkbox" formControlName="active" /> {{ 'partners.active' | t }}</label
          >
        }
        @if (consentsReady()) {
          <fieldset class="full consents" data-testid="consent-toggles">
            <legend>{{ 'privacy.consents' | t }}</legend>
            <label class="check"
              ><input type="checkbox" formControlName="smsReceipts" />
              {{ 'privacy.purpose.SMS_RECEIPTS' | t }}</label
            >
            <label class="check"
              ><input type="checkbox" formControlName="marketing" />
              {{ 'privacy.purpose.MARKETING' | t }}</label
            >
            <label class="check"
              ><input type="checkbox" formControlName="insurerSharing" />
              {{ 'privacy.purpose.INSURER_SHARING' | t }}</label
            >
          </fieldset>
        }
        @if (current()) {
          <label class="check full"
            ><input
              type="checkbox"
              formControlName="dataSubjectRequest"
              data-testid="correction-request"
            />
            {{ 'privacy.correctionRequest' | t }}</label
          >
        }
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'partners.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'partners.save' | t }}
        </button>
      </ng-container>
    </app-modal>
    <app-drawer
      [open]="!!privacy()"
      [title]="'privacy.title' | t"
      [subtitle]="privacy() ? privacy()!.name + ' · ' + privacy()!.code : ''"
      (closed)="privacy.set(null)"
    >
      @if (privacy(); as p) {
        <app-customer-privacy [customer]="p" (changed)="privacyChanged(p.uid)" />
      }
    </app-drawer>
  `,
  styles: `
    .nowrap {
      white-space: nowrap;
    }
    .nowrap .btn + .btn {
      margin-left: 6px;
    }
    .consents {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
    }
    .consents legend {
      padding: 0 4px;
      font-size: 12.5px;
      color: var(--muted);
    }
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--teal));
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 650;
      font-size: 12px;
      flex-shrink: 0;
    }
  `,
})
export default class CustomersPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly stale = inject(StaleRecordService);
  protected readonly types = TYPES;
  protected readonly paymentTerms: readonly PaymentTerms[] = [
    'COD',
    'NET_15',
    'NET_30',
    'NET_45',
    'NET_60',
  ];
  protected readonly q = signal('');
  protected readonly type = signal('');
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<Customer>(() => ({
    path: '/customers',
    query: { q: this.query(), type: this.type() },
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<Customer | null>(null);
  /** The customer whose privacy drawer is open. */
  protected readonly privacy = signal<Customer | null>(null);
  /** The consent checkboxes show once the customer's consents are known (always for a new one). */
  protected readonly consentsReady = signal(false);
  /** The consents as they were when the form opened: only the ones changed are sent. */
  private consentsBefore: Record<ConsentPurpose, boolean> = { ...DEFAULT_CONSENTS };
  private opening = 0;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    email: ['', Validators.email],
    type: ['RETAIL' as CustomerType],
    insuranceProvider: [''],
    insuranceNumber: [''],
    creditLimit: [0, Validators.min(0)],
    paymentTerms: ['NET_30' as PaymentTerms],
    address: [''],
    active: [true],
    smsReceipts: [true],
    marketing: [false],
    insurerSharing: [false],
    /** Logs the change as the customer's own correction request (STD-5). */
    dataSubjectRequest: [false],
  });

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected canSetLimit(): boolean {
    return this.session.can('partners.credit_limit');
  }

  protected edit(customer: Customer | null): void {
    this.current.set(customer);
    this.form.reset({
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      type: customer?.type ?? 'RETAIL',
      insuranceProvider: customer?.insuranceProvider ?? '',
      insuranceNumber: customer?.insuranceNumber ?? '',
      creditLimit: customer?.creditLimit ?? 0,
      paymentTerms: customer?.paymentTerms ?? 'NET_30',
      address: customer?.address ?? '',
      active: customer?.active ?? true,
      dataSubjectRequest: false,
    });
    this.setConsents({ ...DEFAULT_CONSENTS });
    this.consentsReady.set(!customer);
    const opening = ++this.opening;
    if (customer) {
      void this.loadConsents(customer, opening);
    }
    // Setting a limit is its own permission (accountants and managers): shown, not editable.
    if (this.canSetLimit()) {
      this.form.controls.creditLimit.enable();
    } else {
      this.form.controls.creditLimit.disable();
    }
    this.open.set(true);
  }

  /** Someone else changed the customer: it is read again into the form, their change shown. */
  private async reload(uid: string): Promise<void> {
    const fresh = await this.api.get<Customer>(`/customers/${uid}`, undefined, { noBranch: true });
    this.edit(fresh);
    void this.list.reload();
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const body: CustomerInput & { consents?: ConsentChoices } = {
      name: v.name,
      phone: v.phone || null,
      email: v.email || null,
      type: v.type,
      insuranceProvider: v.insuranceProvider || null,
      insuranceNumber: v.insuranceNumber || null,
      // Left out without the permission: the API keeps the current limit.
      creditLimit: this.canSetLimit() ? Number(v.creditLimit) || 0 : undefined,
      paymentTerms: v.paymentTerms,
      address: v.address || null,
      active: v.active,
    };
    const consents = this.changedConsents();
    if (consents) {
      body.consents = consents;
    }
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        // A correction the customer asked for is logged as their data-subject request (STD-5).
        const path = v.dataSubjectRequest
          ? `/customers/${current.uid}?dataSubjectRequest=true`
          : `/customers/${current.uid}`;
        await this.api.put(path, body, {
          silent: true,
          noBranch: true,
          headers: ifMatch(current.version),
        });
      } else {
        await this.api.post('/customers', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('toast.customerSaved'));
      this.open.set(false);
      await this.list.reload();
    } catch (failure) {
      if (current && (await this.stale.handle(failure, () => this.reload(current.uid)))) {
        return;
      }
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** The edited customer's consents, as the checkboxes start from; hidden if they cannot be read. */
  private async loadConsents(customer: Customer, opening: number): Promise<void> {
    try {
      const consents = await this.api.get<CustomerConsents>(
        `/customers/${customer.uid}/consents`,
        undefined,
        { silent: true, noBranch: true },
      );
      if (opening !== this.opening) {
        return;
      }
      const state = { ...DEFAULT_CONSENTS };
      for (const c of consents.current) {
        state[c.purpose] = c.effective;
      }
      this.setConsents(state);
      this.consentsReady.set(true);
    } catch {
      // Without them the form still saves the customer; its consents are left as they are.
    }
  }

  private setConsents(state: Record<ConsentPurpose, boolean>): void {
    this.consentsBefore = state;
    for (const purpose of CONSENT_PURPOSES) {
      this.form.controls[CONSENT_CONTROLS[purpose]].setValue(state[purpose]);
    }
  }

  /** The purposes whose checkbox changed since the form opened; null when none did. */
  private changedConsents(): ConsentChoices | null {
    if (!this.consentsReady()) {
      return null;
    }
    const v = this.form.getRawValue();
    const changed: ConsentChoices = {};
    for (const purpose of CONSENT_PURPOSES) {
      const now = v[CONSENT_CONTROLS[purpose]];
      if (now !== this.consentsBefore[purpose]) {
        changed[purpose] = now;
      }
    }
    return Object.keys(changed).length ? changed : null;
  }

  /** After an anonymisation or a consent change: the list, and the drawer's customer, read again. */
  protected async privacyChanged(uid: string): Promise<void> {
    await this.list.reload();
    const fresh = this.list.items().find((c) => c.uid === uid);
    if (fresh) {
      this.privacy.set(fresh);
    }
  }
}
