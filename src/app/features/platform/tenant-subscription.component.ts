import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import {
  BillingCycle,
  Plan,
  Subscription,
  SubscriptionInvoice,
} from '../../core/api/subscription.models';
import { loaded } from '../../core/data/data';
import { Params, Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { PlanUsageComponent } from '../../core/subscription/plan-usage.component';
import { ToastService } from '../../core/ui/toast.service';
import { downgradeLoss, losesAnything } from '../../core/subscription/downgrade';

/**
 * The tenant page's subscription card for the root administrator: plan, status, usage, invoices;
 * change the plan, extend the trial, record a payment.
 */
@Component({
  selector: 'app-tenant-subscription',
  imports: [...SHARED, PlanUsageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sub.value(); as s) {
      <div class="card card-pad stack">
        <div class="row between">
          <h3>{{ 'plans.subscription' | t }}</h3>
          <span class="badge" [class]="tone(s.status)">{{ 'plans.status.' + s.status | t }}</span>
        </div>
        <div class="grid two">
          <div class="stack" style="gap: 6px">
            <div>
              {{ 'plans.plan' | t }}: <b>{{ s.plan.name }}</b>
              <span class="muted">({{ 'plans.cycle.' + s.cycle | t }})</span>
            </div>
            <div class="muted">
              {{ 'plans.period' | t }}: {{ s.periodStart }} – {{ s.periodEnd }}
            </div>
            @if (s.trialEnds) {
              <div class="muted">{{ 'plans.trialEnds' | t }}: {{ s.trialEnds }}</div>
            }
            @if (s.graceEnds) {
              <div class="text-red">{{ 'plans.graceEnds' | t }}: {{ s.graceEnds }}</div>
            }
            <div class="row wrap" style="gap: 8px; margin-top: 8px">
              <select class="select sm" style="width: auto" #planSel>
                @for (p of plans.value() ?? []; track p.uid) {
                  @if (p.active) {
                    <option [value]="p.code" [selected]="p.code === s.plan.code">
                      {{ p.name }}
                    </option>
                  }
                }
              </select>
              <select class="select sm" style="width: auto" #cycleSel>
                <option value="MONTHLY" [selected]="s.cycle === 'MONTHLY'">
                  {{ 'plans.cycle.MONTHLY' | t }}
                </option>
                <option value="YEARLY" [selected]="s.cycle === 'YEARLY'">
                  {{ 'plans.cycle.YEARLY' | t }}
                </option>
              </select>
              <button
                class="btn sm"
                type="button"
                [disabled]="busy()"
                (click)="changePlan(planSel.value, $any(cycleSel.value))"
              >
                {{ 'plans.changePlan' | t }}
              </button>
            </div>
            <div class="row wrap" style="gap: 8px">
              <input
                class="input sm"
                type="number"
                min="1"
                max="365"
                value="14"
                style="width: 90px"
                #days
              />
              <button
                class="btn sm"
                type="button"
                [disabled]="busy()"
                (click)="extendTrial(+days.value)"
              >
                {{ 'plans.extendTrial' | t }}
              </button>
            </div>
          </div>
          <app-plan-usage [usage]="s.usage" />
        </div>
        <h4>{{ 'plans.invoices' | t }}</h4>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'plans.invoice' | t }}</th>
                <th>{{ 'plans.period' | t }}</th>
                <th class="right">{{ 'plans.amount' | t }}</th>
                <th>{{ 'plans.due' | t }}</th>
                <th>{{ 'plans.statusCol' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (i of s.invoices; track i.uid) {
                <tr>
                  <td class="mono">
                    {{ i.number }}<small class="muted block">{{ i.planName }}</small>
                  </td>
                  <td class="muted">{{ i.periodStart }} – {{ i.periodEnd }}</td>
                  <td class="right">{{ i.amount | money: i.currency }}</td>
                  <td>{{ i.dueDate }}</td>
                  <td>
                    {{ 'plans.invoiceStatus.' + i.status | t }}
                    @if (i.paidAt) {
                      <small class="muted block">{{ i.paidAt }} · {{ i.paymentReference }}</small>
                    }
                  </td>
                  <td class="right">
                    @if (i.status === 'OPEN') {
                      <button class="btn sm primary" type="button" (click)="paying.set(i)">
                        {{ 'plans.recordPayment' | t }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty">{{ 'plans.noInvoices' | t }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <app-modal [open]="!!paying()" [title]="'plans.recordPayment' | t" (closed)="paying.set(null)">
      @if (paying(); as i) {
        <p>
          {{ i.number }} · <b>{{ i.amount | money: i.currency }}</b>
        </p>
        <div class="form-grid">
          <div class="field">
            <label>{{ 'plans.method' | t }}</label>
            <select class="select" #method>
              <option value="MOBILE_MONEY">{{ 'enum.MOBILE_MONEY' | t }}</option>
              <option value="BANK_TRANSFER">{{ 'enum.BANK_TRANSFER' | t }}</option>
              <option value="CARD">{{ 'enum.CARD' | t }}</option>
              <option value="CASH">{{ 'enum.CASH' | t }}</option>
            </select>
          </div>
          <div class="field">
            <label>{{ 'plans.reference' | t }}</label>
            <input class="input" #reference />
          </div>
          <div class="field">
            <label>{{ 'plans.paidOn' | t }}</label>
            <input class="input" type="date" #paidOn [value]="today" />
          </div>
        </div>
        <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 12px">
          <button class="btn" type="button" (click)="paying.set(null)">
            {{ 'plans.cancel' | t }}
          </button>
          <button
            class="btn primary"
            type="button"
            [disabled]="busy()"
            (click)="pay(i, method.value, reference.value, paidOn.value)"
          >
            {{ 'plans.recordPayment' | t }}
          </button>
        </div>
      }
    </app-modal>
  `,
})
export class TenantSubscriptionComponent {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  readonly tenantUid = input.required<string>();
  protected readonly busy = signal(false);
  protected readonly paying = signal<SubscriptionInvoice | null>(null);
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly sub = loaded<Subscription>(() => ({
    path: `/platform/tenants/${this.tenantUid()}/subscription`,
    options: { noBranch: true },
  }));
  protected readonly plans = loaded<Plan[]>(() => ({
    path: '/platform/plans',
    options: { noBranch: true },
  }));

  protected tone(status: string): string {
    return status === 'ACTIVE'
      ? 'green'
      : status === 'TRIAL'
        ? 'blue'
        : status === 'PAST_DUE'
          ? 'amber'
          : 'red';
  }

  protected async changePlan(planCode: string, cycle: BillingCycle): Promise<void> {
    if (!this.confirmLosses(planCode)) {
      return;
    }
    await this.act(() =>
      this.api.put(
        `/platform/tenants/${this.tenantUid()}/subscription`,
        { planCode, cycle },
        { noBranch: true },
      ),
    );
  }

  /**
   * Before moving a pharmacy to a plan below what it uses (more branches, users or products than
   * the plan allows, or modules it would lose), says exactly what and asks to go ahead.
   */
  private confirmLosses(planCode: string): boolean {
    const current = this.sub.value();
    const target = (this.plans.value() ?? []).find((p) => p.code === planCode);
    if (!current || !target || target.code === current.plan.code) {
      return true;
    }
    const loss = downgradeLoss(current.usage, current.plan, target);
    if (!losesAnything(loss)) {
      return true;
    }
    const t = (key: string, params?: Params) => this.translations.t(key, params);
    const lines = [
      ...loss.limits.map((l) =>
        t('plans.downgrade.limit', {
          limit: t('plans.limit.' + l.limit),
          used: l.used,
          allowed: l.allowed,
        }),
      ),
      ...loss.features.map((f) =>
        t('plans.downgrade.feature', { feature: t('plans.feature.' + f) }),
      ),
    ];
    return window.confirm(
      t('plans.downgrade.confirm', {
        plan: target.name,
        lines: lines.map((l) => '• ' + l).join('\n'),
      }),
    );
  }

  protected async extendTrial(days: number): Promise<void> {
    await this.act(() =>
      this.api.post(
        `/platform/tenants/${this.tenantUid()}/subscription/extend-trial`,
        { days },
        { noBranch: true },
      ),
    );
  }

  protected async pay(
    invoice: SubscriptionInvoice,
    method: string,
    reference: string,
    paidOn: string,
  ): Promise<void> {
    await this.act(() =>
      this.api.post(
        `/platform/subscriptions/invoices/${invoice.uid}/payments`,
        { method, reference: reference || null, paidOn: paidOn || null },
        { noBranch: true },
      ),
    );
    this.paying.set(null);
  }

  private async act(call: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    try {
      await call();
      this.toasts.success(this.translations.t('plans.saved'));
      void this.sub.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
