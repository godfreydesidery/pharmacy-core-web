import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Plan, PlanFeature, Subscription } from '../../core/api/subscription.models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { PlanUsageComponent } from '../../core/subscription/plan-usage.component';

/**
 * Administration → Subscription: the pharmacy's plan, status, usage against the plan's limits,
 * its invoices, and what each plan includes.
 */
@Component({
  selector: 'app-subscription',
  imports: [...SHARED, PlanUsageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'plans.subscription' | t }}</h1>
          <p class="sub">{{ 'plans.subscriptionSub' | t }}</p>
        </div>
      </div>
      @if (sub.value(); as s) {
        <div class="grid two mb">
          <div class="card card-pad stack">
            <div class="row between">
              <h3>{{ s.plan.name }}</h3>
              <span class="badge" [class]="tone(s.status)">{{
                'plans.status.' + s.status | t
              }}</span>
            </div>
            <div>
              <b>{{ s.plan.priceMonthly | money: s.plan.currency }}</b>
              <span class="muted"> / {{ 'plans.month' | t }}</span>
              <span class="muted"> · {{ 'plans.cycle.' + s.cycle | t }}</span>
            </div>
            <div class="muted">
              {{ 'plans.period' | t }}: {{ s.periodStart }} – {{ s.periodEnd }}
            </div>
            @if (s.trialEnds) {
              <div class="notice tone-blue">
                {{ 'plans.trialEndsOn' | t: { date: s.trialEnds } }}
              </div>
            }
            @if (s.status === 'PAST_DUE') {
              <div class="notice tone-amber">
                {{ 'plans.banner.pastDue' | t: { date: s.graceEnds } }}
              </div>
            }
            <p class="muted small">{{ 'plans.howToPay' | t }}</p>
          </div>
          <div class="card card-pad">
            <h3 class="mb">{{ 'plans.usage' | t }}</h3>
            <app-plan-usage [usage]="s.usage" />
          </div>
        </div>

        <div class="card mb">
          <div class="card-head">
            <h3>{{ 'plans.invoices' | t }}</h3>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'plans.invoice' | t }}</th>
                  <th>{{ 'plans.period' | t }}</th>
                  <th class="right">{{ 'plans.amount' | t }}</th>
                  <th>{{ 'plans.due' | t }}</th>
                  <th>{{ 'plans.statusCol' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (i of s.invoices; track i.uid) {
                  <tr>
                    <td class="mono">{{ i.number }}</td>
                    <td class="muted">{{ i.periodStart }} – {{ i.periodEnd }}</td>
                    <td class="right">{{ i.amount | money: i.currency }}</td>
                    <td>{{ i.dueDate }}</td>
                    <td>
                      {{ 'plans.invoiceStatus.' + i.status | t }}
                      @if (i.paidAt) {
                        <small class="muted block">{{ i.paidAt }}</small>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="empty">{{ 'plans.noInvoices' | t }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <h3 class="mb">{{ 'plans.compare' | t }}</h3>
        <div class="grid plans">
          @for (p of plans.value() ?? []; track p.uid) {
            <div class="card card-pad stack" [class.current]="p.code === s.plan.code">
              <div class="row between">
                <h3>{{ p.name }}</h3>
                @if (p.code === s.plan.code) {
                  <span class="badge blue">{{ 'plans.current' | t }}</span>
                }
              </div>
              <div>
                <b>{{ p.priceMonthly | money: p.currency }}</b>
                <span class="muted"> / {{ 'plans.month' | t }}</span>
              </div>
              <ul class="limits">
                <li>
                  {{ 'plans.limit.BRANCHES' | t }}: <b>{{ cap(p.maxBranches) }}</b>
                </li>
                <li>
                  {{ 'plans.limit.USERS' | t }}: <b>{{ cap(p.maxUsers) }}</b>
                </li>
                <li>
                  {{ 'plans.limit.PRODUCTS' | t }}: <b>{{ cap(p.maxProducts) }}</b>
                </li>
                <li>
                  {{ 'plans.limit.SMS' | t }}: <b>{{ cap(p.smsPerMonth) }}</b>
                </li>
                @for (f of features; track f) {
                  <li [class.off]="!p.features.includes(f)">
                    <app-icon [name]="p.features.includes(f) ? 'check' : 'x'" [size]="14" />
                    {{ 'plans.feature.' + f | t }}
                  </li>
                }
              </ul>
            </div>
          }
        </div>
        <p class="muted small mt">{{ 'plans.upgradeHint' | t }}</p>
      }
    </div>
  `,
  styles: `
    .plans {
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 16px;
    }
    .current {
      outline: 2px solid var(--primary);
    }
    .limits {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 4px;
      font-size: 13px;
    }
    .limits li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .limits li.off {
      color: var(--muted);
      text-decoration: line-through;
    }
  `,
})
export default class SubscriptionPage {
  protected readonly features: PlanFeature[] = [
    'INSURANCE',
    'MULTI_CURRENCY',
    'INTEGRATIONS',
    'ADVANCED_REPORTS',
  ];
  protected readonly sub = loaded<Subscription>(() => ({
    path: '/subscription',
    options: { noBranch: true },
  }));
  protected readonly plans = loaded<Plan[]>(() => ({
    path: '/subscription/plans',
    options: { noBranch: true },
  }));

  protected cap(value: number | null): string {
    return value == null ? '∞' : String(value);
  }

  protected tone(status: string): string {
    return status === 'ACTIVE'
      ? 'green'
      : status === 'TRIAL'
        ? 'blue'
        : status === 'PAST_DUE'
          ? 'amber'
          : 'red';
  }
}
