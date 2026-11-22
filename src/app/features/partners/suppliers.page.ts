import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { PaymentTerms, Supplier, SupplierInput } from '../../core/api/models';
import { debounced, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

const TERMS: PaymentTerms[] = ['COD', 'NET_15', 'NET_30', 'NET_45', 'NET_60'];

@Component({
  selector: 'app-suppliers',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'partners.suppliers' | t }}</h1>
          <p class="sub">{{ 'partners.wholesalersAndDistributorsYouBuyFrom' | t }}</p>
        </div>
        <div class="actions">
          <app-export [list]="list" />
          @if (session.can('partners.manage')) {
            <button class="btn primary" type="button" (click)="edit(null)">
              <app-icon name="plus" [size]="16" /> {{ 'partners.addSupplier' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="search"
            ><app-icon name="search" [size]="16" /><input
              [placeholder]="'partners.nameContactPhoneOrCode' | t"
              (input)="q.set($any($event.target).value)"
          /></label>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'partners.supplier' | t }}</th>
                <th>{{ 'partners.contact' | t }}</th>
                <th>{{ 'partners.phone' | t }}</th>
                <th>{{ 'partners.email' | t }}</th>
                <th>TIN</th>
                <th>{{ 'partners.terms' | t }}</th>
                <th>{{ 'partners.status' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of list.items(); track s.uid) {
                <tr>
                  <td>
                    <div class="cell-main">
                      <span class="thumb tone-teal"><app-icon name="truck" [size]="16" /></span>
                      <div>
                        <b>{{ s.name }}</b
                        ><small>{{ s.code }}</small>
                      </div>
                    </div>
                  </td>
                  <td>{{ s.contactPerson ?? '—' }}</td>
                  <td>{{ s.phone ?? '—' }}</td>
                  <td>{{ s.email ?? '—' }}</td>
                  <td class="mono">{{ s.tin ?? '—' }}</td>
                  <td>{{ s.paymentTerms | label }}</td>
                  <td><app-status [value]="s.active ? 'ACTIVE' : 'INACTIVE'" /></td>
                  <td class="right">
                    @if (session.can('partners.manage')) {
                      <button class="btn sm" type="button" (click)="edit(s)">
                        <app-icon name="edit" [size]="14" /> {{ 'partners.edit' | t }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <app-empty
                      [loading]="list.loading()"
                      icon="truck"
                      [title]="'partners.noSuppliers' | t"
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
      [title]="current() ? ('ui.l.editSp' | t) + current()!.name : ('ui.l.addSupplier' | t)"
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'partners.companyName' | t }}</label
          ><input class="input" formControlName="name" />
          @if (err('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'partners.contactPerson' | t }}</label
          ><input class="input" formControlName="contactPerson" />
        </div>
        <div class="field">
          <label>{{ 'partners.phone' | t }}</label
          ><input class="input" formControlName="phone" />
        </div>
        <div class="field">
          <label>{{ 'partners.email' | t }}</label
          ><input class="input" type="email" formControlName="email" />
          @if (err('email'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field"><label>TIN</label><input class="input" formControlName="tin" /></div>
        <div class="field">
          <label>{{ 'partners.paymentTerms' | t }}</label
          ><select class="select" formControlName="paymentTerms">
            @for (t of terms; track t) {
              <option [value]="t">{{ t | label }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="supplier-lead-time">{{ 'partners.leadTimeDays' | t }}</label
          ><input
            id="supplier-lead-time"
            class="input"
            type="number"
            min="0"
            max="365"
            formControlName="leadTimeDays"
          />
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
})
export default class SuppliersPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly terms = TERMS;
  protected readonly q = signal('');
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<Supplier>(() => ({
    path: '/suppliers',
    query: { q: this.query() },
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<Supplier | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    contactPerson: [''],
    phone: [''],
    email: ['', Validators.email],
    tin: [''],
    paymentTerms: ['NET_30' as PaymentTerms],
    address: [''],
    active: [true],
    leadTimeDays: [7, [Validators.min(0), Validators.max(365)]],
  });

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected edit(supplier: Supplier | null): void {
    this.current.set(supplier);
    this.form.reset({
      name: supplier?.name ?? '',
      contactPerson: supplier?.contactPerson ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      tin: supplier?.tin ?? '',
      paymentTerms: supplier?.paymentTerms ?? 'NET_30',
      address: supplier?.address ?? '',
      active: supplier?.active ?? true,
      leadTimeDays: supplier?.leadTimeDays ?? 7,
    });
    this.open.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const body: SupplierInput = {
      name: v.name,
      contactPerson: v.contactPerson || null,
      phone: v.phone || null,
      email: v.email || null,
      tin: v.tin || null,
      paymentTerms: v.paymentTerms,
      address: v.address || null,
      active: v.active,
      leadTimeDays: v.leadTimeDays,
    };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(`/suppliers/${current.uid}`, body, { silent: true, noBranch: true });
      } else {
        await this.api.post('/suppliers', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('toast.supplierSaved'));
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
