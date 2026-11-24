import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ConfirmService } from '../../core/ui/confirm';
import { downloadFrom } from '../../core/ui/export.component';
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
            @if (t.status !== 'ERASED') {
              <button class="btn" type="button" (click)="editing.set(true)">
                <app-icon name="edit" [size]="16" /> {{ 'common.edit' | t }}
              </button>
              <button
                class="btn"
                type="button"
                data-testid="tenant-export"
                [disabled]="exporting()"
                (click)="exportData()"
              >
                <app-icon name="download" [size]="16" /> {{ 'close.export' | t }}
              </button>
              @if (t.legalHold) {
                <button class="btn" type="button" [disabled]="busy()" (click)="liftHold()">
                  <app-icon name="lock" [size]="16" /> {{ 'close.liftHold' | t }}
                </button>
              } @else {
                <button class="btn" type="button" (click)="holding.set(true)">
                  <app-icon name="shield" [size]="16" /> {{ 'close.hold' | t }}
                </button>
              }
            }
            @if (t.status === 'ACTIVE' || t.status === 'SUSPENDED') {
              <button class="btn primary" type="button" (click)="enter(t)">
                <app-icon name="transfer" [size]="16" /> {{ 'platform.workInThisPharmacy' | t }}
              </button>
            }
            @if (t.status === 'ACTIVE') {
              <button class="btn danger" type="button" (click)="suspending.set(true)">
                <app-icon name="lock" [size]="16" /> {{ 'platform.suspend' | t }}
              </button>
            } @else if (t.status === 'SUSPENDED') {
              <button class="btn success" type="button" [disabled]="busy()" (click)="reactivate(t)">
                <app-icon name="check" [size]="16" /> {{ 'platform.reactivate' | t }}
              </button>
            }
            @if (t.status === 'ACTIVE' || t.status === 'SUSPENDED') {
              <button class="btn danger" type="button" (click)="closing.set(true)">
                <app-icon name="x" [size]="16" /> {{ 'close.close' | t }}
              </button>
            }
            @if (t.status === 'CLOSED') {
              <button class="btn success" type="button" [disabled]="busy()" (click)="reopen()">
                <app-icon name="check" [size]="16" /> {{ 'close.reopen' | t }}
              </button>
              <button
                class="btn danger"
                type="button"
                data-testid="tenant-erase"
                [disabled]="!erasable(t)"
                [title]="eraseBlocker(t)"
                (click)="erasing.set(true)"
              >
                <app-icon name="trash" [size]="16" /> {{ 'close.erase' | t }}
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
            <app-icon name="alert" /> {{ 'platform.suspended' | t }}
            @if (t.suspensionKind) {
              <b>({{ 'susp.kind.' + t.suspensionKind | t }})</b>
            }
            {{ t.statusReason ? ': ' + t.statusReason : ''
            }}{{
              (t.suspensionKind === 'UNPAID'
                ? 'susp.unpaidEffect'
                : 'platform.itsUsersCannotSignIn'
              ) | t
            }}
          </div>
        }
        @if (t.status === 'CLOSED') {
          <div class="notice tone-amber mb" data-testid="closed-notice">
            <app-icon name="alert" />
            {{
              'close.closedNotice'
                | t
                  : {
                      reason: t.statusReason ? ': ' + t.statusReason : '',
                      date: (t.eraseAfter | when) ?? '—',
                    }
            }}
          </div>
        }
        @if (t.status === 'ERASED') {
          <div class="notice tone-gray mb" data-testid="erased-notice">
            <app-icon name="trash" />
            {{ 'close.erasedNotice' | t: { date: (t.erasedAt | when) ?? '—' } }}
          </div>
        }
        @if (t.legalHold) {
          <div class="notice tone-red mb" data-testid="hold-notice">
            <app-icon name="shield" />
            {{
              'close.holdNotice'
                | t: { reason: t.legalHoldReason ? ' (' + t.legalHoldReason + ')' : '' }
            }}
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
                            <b>{{ b.name }}</b><small
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
                          [for]="branches"
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
        <app-empty [for]="tenant" icon="building" [title]="'platform.tenantNotFound' | t" />
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
          <label>{{ 'susp.kind' | t }}</label>
          <select class="select" #kind data-testid="suspension-kind">
            @for (k of kinds; track k) {
              <option [value]="k">{{ 'susp.kind.' + k | t }}</option>
            }
          </select>
          <span class="hint">{{ 'susp.kindHint' | t }}</span>
        </div>
        <app-field [label]="'platform.reason' | t">
          <textarea
            class="input"
            #reason
            [placeholder]="'platform.unpaidSubscriptionLicenceRevoked' | t"
          ></textarea>
        </app-field>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="suspending.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn danger"
          type="button"
          [disabled]="busy()"
          (click)="suspend(reason.value, kind.value)"
        >
          {{ 'platform.suspend' | t }}
        </button>
      </ng-container>
    </app-modal>

    <app-modal [open]="closing()" [title]="'close.closeTitle' | t" (closed)="closing.set(false)">
      <div class="stack">
        <p>{{ 'close.closeText' | t }}</p>
        <app-field [label]="'platform.reason' | t">
          <textarea
            class="input"
            #closeReason
            data-testid="close-reason"
            [placeholder]="'close.reasonPlaceholder' | t"
          ></textarea>
        </app-field>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="closing.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn danger"
          type="button"
          data-testid="close-confirm"
          [disabled]="busy()"
          (click)="close(closeReason.value)"
        >
          {{ 'close.close' | t }}
        </button>
      </ng-container>
    </app-modal>

    <app-modal [open]="holding()" [title]="'close.holdTitle' | t" (closed)="holding.set(false)">
      <div class="stack">
        <p>{{ 'close.holdText' | t }}</p>
        <app-field [label]="'platform.reason' | t">
          <textarea
            class="input"
            #holdReason
            data-testid="hold-reason"
            [placeholder]="'close.holdPlaceholder' | t"
          ></textarea>
        </app-field>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="holding.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn danger"
          type="button"
          data-testid="hold-confirm"
          [disabled]="busy()"
          (click)="hold(holdReason.value)"
        >
          {{ 'close.hold' | t }}
        </button>
      </ng-container>
    </app-modal>

    @if (tenant.value(); as t) {
      <app-modal [open]="erasing()" [title]="'close.eraseTitle' | t" (closed)="erasing.set(false)">
        <div class="stack">
          <div class="notice tone-red">
            <app-icon name="alert" /> {{ 'close.eraseText' | t: { name: t.name } }}
          </div>
          <app-field [label]="'close.eraseConfirm' | t: { code: t.code }">
            <input
              class="input mono"
              data-testid="erase-code"
              autocomplete="off"
              [value]="eraseCode()"
              (input)="eraseCode.set($any($event.target).value)"
            />
          </app-field>
        </div>
        <ng-container footer>
          <button class="btn" type="button" (click)="erasing.set(false)">
            {{ 'common.cancel' | t }}
          </button>
          <button
            class="btn danger"
            type="button"
            data-testid="erase-confirm"
            [disabled]="busy() || eraseCode().trim().toUpperCase() !== t.code.toUpperCase()"
            (click)="erase()"
          >
            {{ 'close.erase' | t }}
          </button>
        </ng-container>
      </app-modal>
    }
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
  protected readonly closing = signal(false);
  protected readonly holding = signal(false);
  protected readonly erasing = signal(false);
  protected readonly exporting = signal(false);
  protected readonly eraseCode = signal('');
  private readonly http = inject(HttpClient);
  private readonly confirm = inject(ConfirmService);
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

  /** Why a pharmacy is suspended: unpaid keeps its admins read-only, a dispute is a legal hold. */
  protected readonly kinds = ['OTHER', 'DISPUTE', 'ABUSE', 'UNPAID'] as const;

  protected async suspend(reason: string, kind: string): Promise<void> {
    await this.change(
      `/platform/tenants/${this.uid()}/suspend`,
      { reason, kind },
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

  protected async close(reason: string): Promise<void> {
    await this.change(
      `/platform/tenants/${this.uid()}/close`,
      { reason },
      this.translations.t('toast.pharmacyClosed'),
    );
    this.closing.set(false);
  }

  protected reopen(): Promise<void> {
    return this.change(
      `/platform/tenants/${this.uid()}/reopen`,
      {},
      this.translations.t('toast.pharmacyReopened'),
    );
  }

  protected async hold(reason: string): Promise<void> {
    await this.change(
      `/platform/tenants/${this.uid()}/legal-hold`,
      { reason },
      this.translations.t('toast.holdPlaced'),
    );
    this.holding.set(false);
  }

  protected async liftHold(): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translations.t('close.liftHold'),
      text: this.translations.t('close.liftHoldText'),
      icon: 'warning',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    try {
      this.tenant.set(
        await this.api.delete<Tenant>(`/platform/tenants/${this.uid()}/legal-hold`, {
          noBranch: true,
        }),
      );
      this.toasts.success(this.translations.t('toast.holdLifted'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async erase(): Promise<void> {
    this.busy.set(true);
    try {
      const erased = await this.api.post<{ tenant: Tenant }>(
        `/platform/tenants/${this.uid()}/erase`,
        { confirmCode: this.eraseCode().trim() },
        { noBranch: true },
      );
      this.tenant.set(erased.tenant);
      this.erasing.set(false);
      this.eraseCode.set('');
      this.toasts.success(this.translations.t('toast.pharmacyErased'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async exportData(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadFrom(
        this.http,
        `/platform/tenants/${this.uid()}/export`,
        this.toasts,
        this.translations.t('close.exportFailed'),
      );
    } finally {
      this.exporting.set(false);
    }
  }

  /** Closed, its cooling-off over and no legal hold: the erasure may go ahead. */
  protected erasable(t: Tenant): boolean {
    return (
      t.status === 'CLOSED' &&
      !t.legalHold &&
      !!t.eraseAfter &&
      new Date(t.eraseAfter).getTime() <= Date.now()
    );
  }

  protected eraseBlocker(t: Tenant): string {
    if (t.legalHold) {
      return this.translations.t('close.eraseHeld');
    }
    if (!this.erasable(t) && t.eraseAfter) {
      return this.translations.t('close.eraseWaiting', {
        date: new Date(t.eraseAfter).toLocaleString(),
      });
    }
    return '';
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
