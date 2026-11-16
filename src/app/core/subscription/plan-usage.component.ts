import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PlanUsage } from '../api/subscription.models';
import { TranslatePipe } from '../i18n/t.pipe';

/** Usage of each capped quantity against the plan, as bars. */
@Component({
  selector: 'app-plan-usage',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="usage">
      @for (u of usage(); track u.limit) {
        <div class="row-usage">
          <div class="row between">
            <span>{{ 'plans.limit.' + u.limit | t }}</span>
            <span class="muted">
              {{ u.used }} / {{ u.allowed === null ? ('plans.unlimited' | t) : u.allowed }}
            </span>
          </div>
          <div class="bar" [attr.aria-label]="'plans.limit.' + u.limit | t">
            <span
              [style.width.%]="percent(u)"
              [class.full]="percent(u) >= 100"
              [class.near]="percent(u) >= 80"
            ></span>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .usage {
      display: grid;
      gap: 12px;
    }
    .bar {
      height: 8px;
      border-radius: 99px;
      background: var(--surface-hover);
      overflow: hidden;
      margin-top: 4px;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--primary);
    }
    .bar span.near {
      background: var(--amber, #d97706);
    }
    .bar span.full {
      background: var(--red, #dc2626);
    }
  `,
})
export class PlanUsageComponent {
  readonly usage = input.required<PlanUsage[]>();

  protected percent(u: PlanUsage): number {
    if (u.allowed === null) {
      return u.used > 0 ? 8 : 0;
    }
    return Math.min(100, Math.round((u.used / Math.max(u.allowed, 1)) * 100));
  }
}
