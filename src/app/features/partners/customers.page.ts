import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Customer, CustomerInput, CustomerType, PaymentTerms } from '../../core/api/models';
import { debounced, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

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
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'partners.customers' | t }}</h1>
          <p class="sub">{{ 'partners.patientsWholesaleBuyersAndInsuredMembers' | t }}</p>
        </div>
        <div class="actions">
          <app-export [list]="list" />
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
                        <small>{{ c.code }}</small>
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
                  <td class="right">
                    @if (session.can('partners.manage')) {
                      <button class="btn sm" type="button" (click)="edit(c)">
                        <app-icon name="edit" [size]="14" /> {{ 'partners.edit' | t }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9">
                    <app-empty
                      [loading]="list.loading()"
                      icon="users"
                      [title]="'partners.noCustomers' | t"
                    />
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
        <div class="field full">
          <label>{{ 'partners.name' | t }}</label
          ><input class="input" formControlName="name" />
          @if (err('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'partners.phone' | t }}</label
          ><input class="input" formControlName="phone" placeholder="+255…" />
          @if (err('phone'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'partners.email' | t }}</label
          ><input class="input" type="email" formControlName="email" />
          @if (err('email'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'partners.type' | t }}</label
          ><select class="select" formControlName="type">
            @for (t of types; track t) {
              <option [value]="t">{{ t | label }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'partners.creditLimit' | t }}</label
          ><input class="input" type="number" min="0" step="any" formControlName="creditLimit" />
        </div>
        <div class="field">
          <label>{{ 'partners.paymentTerms' | t }}</label
          ><select class="select" formControlName="paymentTerms">
            @for (terms of paymentTerms; track terms) {
              <option [value]="terms">{{ terms | label: 'PaymentTerms' }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'partners.insuranceProvider' | t }}</label
          ><input class="input" formControlName="insuranceProvider" placeholder="NHIF, Jubilee…" />
        </div>
        <div class="field">
          <label>{{ 'partners.membershipNumber' | t }}</label
          ><input class="input" formControlName="insuranceNumber" />
        </div>
        <div class="field full">
          <label>{{ 'partners.address' | t }}</label
          ><textarea class="input" formControlName="address"></textarea>
        </div>
        @if (current()) {
          <label class="check full"
            ><input type="checkbox" formControlName="active" /> {{ 'partners.active' | t }}</label
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
  `,
  styles: `
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
    });
    this.open.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const body: CustomerInput = {
      name: v.name,
      phone: v.phone || null,
      email: v.email || null,
      type: v.type,
      insuranceProvider: v.insuranceProvider || null,
      insuranceNumber: v.insuranceNumber || null,
      creditLimit: Number(v.creditLimit) || 0,
      paymentTerms: v.paymentTerms,
      address: v.address || null,
      active: v.active,
    };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(`/customers/${current.uid}`, body, { silent: true, noBranch: true });
      } else {
        await this.api.post('/customers', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('toast.customerSaved'));
      this.open.set(false);
      await this.list.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
