import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { SubscriptionStore } from '../../core/subscription/subscription.store';

/**
 * Shown when a page's module is not in the pharmacy's plan (opened by link or bookmark): what is
 * missing, the current plan, and how to upgrade — or whom to ask.
 */
@Component({
  selector: 'app-not-in-plan',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="card card-pad empty not-in-plan">
        <app-icon name="lock" [size]="40" [stroke]="1.4" />
        <h1>{{ 'gate.title' | t }}</h1>
        <span>
          {{
            'gate.body'
              | t
                : {
                    feature: 'plans.feature.' + (feature() ?? '') | t: null : feature() ?? '',
                    plan: subscription.status()?.planName ?? '—',
                  }
          }}
        </span>
        @if (session.can('settings.manage')) {
          <span class="muted">{{ 'gate.howAdmin' | t }}</span>
        } @else {
          <span class="muted">{{ 'gate.howStaff' | t }}</span>
        }
        <div class="row">
          <button class="btn" type="button" (click)="back()">
            <app-icon name="arrow-left" [size]="16" /> {{ 'ui.notFound.back' | t }}
          </button>
          @if (session.can('settings.manage')) {
            <a class="btn primary" routerLink="/admin/subscription">{{ 'gate.seePlans' | t }}</a>
          } @else {
            <a class="btn primary" routerLink="/">{{ 'ui.notFound.home' | t }}</a>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .not-in-plan {
      max-width: 560px;
      margin: 48px auto;
      gap: 10px;
      text-align: center;
    }
    .not-in-plan h1 {
      font-size: 22px;
      margin: 0;
    }
    .not-in-plan .row {
      justify-content: center;
      margin-top: 8px;
    }
  `,
})
export default class NotInPlanPage {
  protected readonly session = inject(SessionStore);
  protected readonly subscription = inject(SubscriptionStore);
  private readonly location = inject(Location);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });
  protected readonly feature = computed(() => this.query().get('feature'));

  protected back(): void {
    this.location.back();
  }
}
