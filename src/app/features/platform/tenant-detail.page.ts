import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { Branch, Tenant } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';
import { TenantEditComponent } from './tenant-edit.component';

import { TenantSubscriptionComponent } from './tenant-subscription.component';
@Component({
  selector: 'app-tenant-detail',
  imports: [...SHARED, TenantEditComponent, TenantSubscriptionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (tenant.value(); as t) {
        <div class="page-head">
          <div>
            <a class="muted row" routerLink="/platform/tenants"
              ><app-icon name="arrow-left" [size]="15" /> {{ 'platform.tenants' | t }}</a
            >
            <h1 class="row" style="margin-top:6px">
              {{ t.name }} <app-status [value]="t.status" />
            </h1>
            <p class="sub">{{ t.code }}{{ t.legalName ? ' · ' + t.legalName : '' }}</p>
          </div>
          <div class="actions">
            <button class="btn" type="button" (click)="editing.set(true)">
              <app-icon name="edit" [size]="16" /> {{ 'common.edit' | t }}
            </button>
            <button class="btn primary" type="button" (click)="enter(t)">
              <app-icon name="transfer" [size]="16" /> {{ 'platform.workInThisPharmacy' | t }}
            </button>
            @if (t.status === 'ACTIVE') {
              <button class="btn danger" type="button" (click)="suspending.set(true)">
                <app-icon name="lock" [size]="16" /> {{ 'platform.suspend' | t }}
              </button>
            } @else {
              <button class="btn success" type="button" [disabled]="busy()" (click)="reactivate(t)">
                <app-icon name="check" [size]="16" /> {{ 'platform.reactivate' | t }}
              </button>
            }
          </div>
        </div>
        <app-tenant-edit
          [tenant]="t"
          [open]="editing()"
          (closed)="editing.set(false)"
          (saved)="tenant.set($event); editing.set(false)"
        />
        @if (t.status === 'SUSPENDED') {
          <div class="notice tone-red mb">
            <app-icon name="alert" /> {{ 'platform.suspended' | t
            }}{{ t.statusReason ? ': ' + t.statusReason : ''
            }}{{ 'platform.itsUsersCannotSignIn' | t }}
          </div>
        }
        <div class="grid two">
          <div class="card card-pad">
            <h3 class="mb">{{ 'common.details' | t }}</h3>
            <dl class="dl">
              <div>
                <dt>{{ 'platform.code' | t }}</dt>
                <dd>{{ t.code }}</dd>
              </div>
              <div>
                <dt>{{ 'platform.country' | t }}</dt>
                <dd>{{ t.country }}</dd>
              </div>
              <div>
                <dt>{{ 'platform.currency' | t }}</dt>
                <dd>{{ t.currency }}</dd>
              </div>
              <div>
                <dt>{{ 'platform.timeZone' | t }}</dt>
                <dd>{{ t.timezone }}</dd>
              </div>
              <div>
                <dt>{{ 'platform.branches' | t }}</dt>
                <dd>{{ t.branchCount }}</dd>
              </div>
              <div>
                <dt>{{ 'platform.registered2' | t }}</dt>
                <dd>{{ t.createdAt | when }}</dd>
              </div>
              <div>
                <dt>{{ 'platform.tenantId' | t }}</dt>
                <dd class="mono">{{ t.uid }}</dd>
              </div>
              <div>
                <dt>{{ 'admin2.contact' | t }}</dt>
                <dd>
                  {{ t.contactName || '—' }}
                  @if (t.contactPhone) {
                    · {{ t.contactPhone }}
                  }
                  @if (t.contactEmail) {
                    · {{ t.contactEmail }}
                  }
                </dd>
              </div>
              <div>
                <dt>{{ 'platform.address' | t }}</dt>
                <dd>{{ t.address || '—' }}</dd>
              </div>
            </dl>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'platform.branches' | t }}</h3>
            </div>
            <div class="table-wrap">
              <table class="table compact">
                <tbody>
                  @for (b of branches.value() ?? []; track b.uid) {
                    <tr>
                      <td>
                        <div class="cell-main">
                          <span class="thumb tone-teal"
                            ><app-icon name="building" [size]="16"
                          /></span>
                          <div>
                            <b>{{ b.name }}</b
                            ><small
                              >{{ b.code
                              }}{{ b.headOffice ? ('ui.l.preHeadOffice' | t) : '' }}</small
                            >
                          </div>
                        </div>
                      </td>
                      <td class="muted">{{ b.address }}</td>
                      <td class="right">
                        <app-status [value]="b.active ? 'ACTIVE' : 'INACTIVE'" />
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td>
                        <app-empty
                          [loading]="branches.loading()"
                          icon="building"
                          [title]="'platform.noBranches' | t"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="mt">
          <app-tenant-subscription [tenantUid]="t.uid" />
        </div>
      } @else {
        <app-empty
          [loading]="tenant.loading()"
          icon="building"
          [title]="'platform.tenantNotFound' | t"
        />
      }
    </div>

    <app-modal
      [open]="suspending()"
      [title]="'platform.suspendPharmacy' | t"
      (closed)="suspending.set(false)"
    >
      <div class="stack">
        <p>
          {{ 'platform.itsUsersWillNoLonger' | t }}
        </p>
        <div class="field">
          <label>{{ 'platform.reason' | t }}</label
          ><textarea
            class="input"
            #reason
            [placeholder]="'platform.unpaidSubscriptionLicenceRevoked' | t"
          ></textarea>
        </div>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="suspending.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn danger"
          type="button"
          [disabled]="busy()"
          (click)="suspend(reason.value)"
        >
          {{ 'platform.suspend' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class TenantDetailPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  readonly uid = input.required<string>();
  protected readonly busy = signal(false);
  protected readonly suspending = signal(false);
  protected readonly editing = signal(false);
  protected readonly tenant = loaded<Tenant>(() => ({
    path: `/platform/tenants/${this.uid()}`,
    options: { noBranch: true },
  }));
  protected readonly branches = loaded<Branch[]>(() => ({
    path: '/branches',
    options: { noBranch: true, silent: true, headers: { 'X-Tenant-Id': this.uid() } },
  }));

  protected enter(t: Tenant): void {
    const branches = (this.branches.value() ?? [])
      .filter((b) => b.active)
      .map(({ uid, code, name }) => ({ uid, code, name }));
    this.session.enterAsRoot(
      { uid: t.uid, code: t.code, name: t.name, status: t.status },
      branches,
      null,
    );
    void this.router.navigate(['/dashboard']);
  }

  protected async suspend(reason: string): Promise<void> {
    await this.change(
      `/platform/tenants/${this.uid()}/suspend`,
      { reason },
      this.translations.t('toast.pharmacySuspended'),
    );
    this.suspending.set(false);
  }

  protected reactivate(_t: Tenant): Promise<void> {
    return this.change(
      `/platform/tenants/${this.uid()}/reactivate`,
      {},
      this.translations.t('toast.pharmacyReactivated'),
    );
  }

  private async change(path: string, body: object, message: string): Promise<void> {
    this.busy.set(true);
    try {
      this.tenant.set(await this.api.post<Tenant>(path, body, { noBranch: true }));
      this.toasts.success(message);
    } finally {
      this.busy.set(false);
    }
  }
}
