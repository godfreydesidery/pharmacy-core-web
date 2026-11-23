import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { loaded, pagedList } from '../../core/data/data';
import { PlatformOverview, Tenant } from '../../core/api/models';
import { SubscriptionOverview } from '../../core/api/subscription.models';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { DonutSegment } from '../../core/ui/charts';

@Component({
  selector: 'app-platform-overview',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'platform.platformOverview' | t }}</h1>
          <p class="sub">{{ 'platform.everyPharmacyOnThePlatform' | t }}</p>
        </div>
        <div class="actions">
          <a class="btn primary" routerLink="/platform/tenants" [queryParams]="{ create: 1 }"
            ><app-icon name="plus" [size]="16" /> {{ 'platform.registerPharmacy' | t }}</a
          >
        </div>
      </div>
      @if (overview.value(); as o) {
        <div class="grid kpis mb">
          <app-stat
            [label]="'platform.pharmacies' | t"
            [value]="o.tenants"
            icon="building"
            tone="blue"
            [caption]="'platform.registered' | t"
          />
          <app-stat
            [label]="'platform.active' | t"
            [value]="o.activeTenants"
            icon="check"
            tone="green"
            [caption]="'platform.trading' | t"
          />
          <app-stat
            [label]="'platform.suspended' | t"
            [value]="o.suspendedTenants"
            icon="alert"
            tone="red"
            [caption]="'platform.blocked' | t"
          />
          <app-stat
            [label]="'platform.branches' | t"
            [value]="o.branches"
            icon="layers"
            tone="teal"
            [caption]="'platform.acrossAllPharmacies' | t"
          />
          <app-stat
            [label]="'platform.users' | t"
            [value]="o.users"
            icon="users"
            tone="purple"
            [caption]="'platform.withSignIn' | t"
          />
        </div>
        @if (subscriptions.value(); as so) {
          <div class="grid kpis mb">
            <app-stat
              [label]="'plans.mrr' | t"
              [value]="so.monthlyRecurringRevenue | compactMoney: so.currency"
              [hint]="so.monthlyRecurringRevenue | money: so.currency"
              icon="wallet"
              tone="green"
              [caption]="'plans.mrrCaption' | t"
            />
            <app-stat
              [label]="'plans.trials' | t"
              [value]="so.trials"
              icon="clock"
              tone="blue"
              [caption]="'plans.onTrial' | t"
            />
            <app-stat
              [label]="'plans.pastDue' | t"
              [value]="so.pastDue"
              icon="alert"
              tone="orange"
              [caption]="'plans.inGrace' | t"
            />
            <app-stat
              [label]="'plans.outstanding' | t"
              [value]="so.outstanding | compactMoney: so.currency"
              [hint]="so.outstanding | money: so.currency"
              icon="receipt"
              tone="purple"
              [caption]="'plans.openInvoices' | t"
            />
          </div>
        }
        <div class="grid two">
          <div class="card">
            <div class="card-head">
              <h3>{{ 'platform.tenantStatus' | t }}</h3>
            </div>
            <div class="card-pad">
              <app-donut
                [segments]="segments()"
                centerLabel="Pharmacies"
                [centerValue]="'' + o.tenants"
              />
            </div>
          </div>
          <div class="card">
            <div class="card-head">
              <h3>{{ 'platform.newestPharmacies' | t }}</h3>
              <a class="link" routerLink="/platform/tenants">{{ 'common.viewAll' | t }}</a>
            </div>
            <div class="table-wrap">
              <table class="table compact">
                <tbody>
                  @for (tenant of tenants.items(); track tenant.uid) {
                    <tr class="clickable" appRowLink>
                      <td>
                        <div class="cell-main">
                          <span class="thumb tone-blue strong">{{ tenant.code.slice(0, 2) }}</span>
                          <div>
                            <a class="row-link" [routerLink]="['/platform/tenants', tenant.uid]"
                              ><b>{{ tenant.name }}</b></a
                            ><small>{{ tenant.code }} · {{ tenant.country }}</small>
                          </div>
                        </div>
                      </td>
                      <td class="muted">{{ tenant.createdAt | day }}</td>
                      <td class="right"><app-status [value]="tenant.status" /></td>
                    </tr>
                  } @empty {
                    <tr>
                      <td>
                        <app-empty
                          [loading]="tenants.loading()"
                          icon="building"
                          [title]="'platform.noPharmaciesYet' | t"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      } @else {
        <app-empty
          [loading]="overview.loading()"
          icon="globe"
          [title]="'platform.overviewUnavailable' | t"
        />
      }
    </div>
  `,
})
export default class OverviewPage {
  private readonly translations = inject(Translations);
  protected readonly subscriptions = loaded<SubscriptionOverview>(() => ({
    path: '/platform/subscriptions/overview',
    options: { noBranch: true },
  }));
  protected readonly overview = loaded<PlatformOverview>(() => ({
    path: '/platform/overview',
    options: { noBranch: true },
  }));
  protected readonly tenants = pagedList<Tenant>(
    () => ({ path: '/platform/tenants', options: { noBranch: true } }),
    6,
  );
  protected readonly segments = computed<DonutSegment[]>(() => {
    const o = this.overview.value();
    return o
      ? [
          { label: this.translations.t('enum.ACTIVE'), value: o.activeTenants, color: '#16a34a' },
          {
            label: this.translations.t('enum.SUSPENDED'),
            value: o.suspendedTenants,
            color: '#ef4444',
          },
        ]
      : [];
  });
}
