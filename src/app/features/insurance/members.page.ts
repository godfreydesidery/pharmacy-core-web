import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { MemberView, SchemeView } from '../../core/api/credit.models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { LookupComponent } from '../../core/ui/lookup.component';
import { applyApiError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

/** Customers enrolled in insurance schemes, with what their scheme has paid this year. */
@Component({
  selector: 'app-members',
  imports: [...SHARED, RouterLink, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'insurance.insuredMembers' | t }}</h1>
          <p class="sub">
            {{ 'insurance.whoIsCoveredByWhich' | t }}
          </p>
        </div>
        <div class="actions">
          @if (session.can('partners.manage')) {
            <button class="btn primary" type="button" (click)="edit(null)">
              <app-icon name="plus" [size]="16" /> {{ 'insurance.enrolMember' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="search"
            ><app-icon name="search" [size]="16" /><input
              [placeholder]="'insurance.memberNumberOrName' | t"
              (input)="q.set($any($event.target).value)"
          /></label>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'insurance.member' | t }}</th>
                <th>{{ 'insurance.payerScheme' | t }}</th>
                <th>{{ 'insurance.number' | t }}</th>
                <th>{{ 'insurance.valid' | t }}</th>
                <th class="right">{{ 'insurance.usedThisYear' | t }}</th>
                <th>{{ 'insurance.status' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (m of list.items(); track m.uid) {
                <tr>
                  <td>
                    <a [routerLink]="['/receivables', m.customerUid]"
                      ><b>{{ m.customerName }}</b></a
                    >
                    @if (m.principalName) {
                      <small class="muted block"
                        >{{ 'insurance.dependantOf' | t }} {{ m.principalName }}</small
                      >
                    }
                  </td>
                  <td>{{ m.payerName }} · {{ m.schemeName }}</td>
                  <td class="mono">{{ m.memberNumber }}</td>
                  <td class="muted">
                    {{ m.validFrom ? (m.validFrom | day) : '—' }} –
                    {{ m.validUntil ? (m.validUntil | day) : 'open' }}
                  </td>
                  <td class="right">
                    {{ m.usedThisYear | money }}
                    @if (m.annualLimit) {
                      <div class="meter"><span [style.width.%]="usage(m)"></span></div>
                    }
                  </td>
                  <td><app-status [value]="m.active ? 'ACTIVE' : 'INACTIVE'" /></td>
                  <td class="right">
                    @if (session.can('partners.manage')) {
                      <button class="btn sm" type="button" (click)="edit(m)">
                        <app-icon name="edit" [size]="14" /> {{ 'common.edit' | t }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <app-empty
                      [for]="list"
                      icon="shield"
                      [title]="'insurance.noInsuredMembers' | t"
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
      [title]="current() ? ('ui.l.editMembership' | t) : ('ui.l.enrolMember' | t)"
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form">
        <div class="field full">
          <label>{{ 'insurance.customer' | t }}</label>
          @if (current()) {
            <input class="input" [value]="current()!.customerName" readonly />
          } @else {
            <app-lookup
              path="/customers"
              [placeholder]="'insurance.searchCustomers' | t"
              (picked)="form.controls.customerUid.setValue($event.uid)"
            />
          }
        </div>
        <div class="field full">
          <label>{{ 'insurance.scheme' | t }}</label>
          <select class="select" formControlName="schemeUid">
            <option value="">{{ 'insurance.choose' | t }}</option>
            @for (s of schemes.value() ?? []; track s.uid) {
              <option [value]="s.uid">{{ s.payerName }} · {{ s.name }}</option>
            }
          </select>
        </div>
        <app-field [label]="'insurance.memberNumber' | t">
          <input class="input mono" formControlName="memberNumber" />
        </app-field>
        <app-field [label]="'insurance.principalMember' | t">
          <input
            class="input"
            formControlName="principalName"
            [placeholder]="'insurance.ifADependant' | t"
          />
        </app-field>
        <app-field [label]="'insurance.validFrom' | t">
          <input class="input" type="date" formControlName="validFrom" />
        </app-field>
        <app-field [label]="'insurance.validUntil' | t">
          <input class="input" type="date" formControlName="validUntil" />
        </app-field>
        <label class="check"
          ><input type="checkbox" formControlName="active" /> {{ 'insurance.active' | t }}</label
        >
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .block {
      display: block;
    }
    .meter {
      height: 5px;
      border-radius: 999px;
      background: var(--border);
      margin-top: 4px;
      overflow: hidden;
    }
    .meter span {
      display: block;
      height: 100%;
      background: var(--primary);
    }
  `,
})
export default class MembersPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly q = signal('');
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<MemberView>(() => ({
    path: '/insurance/members',
    query: { q: this.query() },
    options: { noBranch: true },
  }));
  protected readonly schemes = loaded<SchemeView[]>(() => ({
    path: '/insurance/schemes',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<MemberView | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    customerUid: ['', Validators.required],
    schemeUid: ['', Validators.required],
    memberNumber: ['', Validators.required],
    principalName: [''],
    validFrom: [''],
    validUntil: [''],
    active: [true],
  });

  protected usage(m: MemberView): number {
    return m.annualLimit ? Math.min(100, Math.round((m.usedThisYear / m.annualLimit) * 100)) : 0;
  }

  protected edit(m: MemberView | null): void {
    this.current.set(m);
    this.form.reset({
      customerUid: m?.customerUid ?? '',
      schemeUid: m?.schemeUid ?? '',
      memberNumber: m?.memberNumber ?? '',
      principalName: m?.principalName ?? '',
      validFrom: m?.validFrom ?? '',
      validUntil: m?.validUntil ?? '',
      active: m?.active ?? true,
    });
    this.open.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      ...v,
      principalName: v.principalName || null,
      validFrom: v.validFrom || null,
      validUntil: v.validUntil || null,
    };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(`/insurance/members/${current.uid}`, body, {
          silent: true,
          noBranch: true,
        });
      } else {
        await this.api.post('/insurance/members', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('toast.membershipSaved'));
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
