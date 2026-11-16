import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api.service';
import { PlanFeature, SubscriptionStatusView } from '../api/subscription.models';

/**
 * The current pharmacy's subscription status, loaded once per workspace: the shell's trial and
 * payment banners, and which plan modules the menus may show.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionStore {
  private readonly api = inject(Api);
  private readonly state = signal<SubscriptionStatusView | null>(null);
  private loadedFor: string | null = null;

  readonly status = this.state.asReadonly();

  /** Days until the trial ends, when on trial. */
  readonly trialDaysLeft = computed(() => {
    const s = this.state();
    if (s?.status !== 'TRIAL' || !s.trialEnds) {
      return null;
    }
    const ms = new Date(s.trialEnds + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0);
    return Math.max(Math.round(ms / 86_400_000), 0);
  });

  async load(tenantUid: string, force = false): Promise<void> {
    if (!force && this.loadedFor === tenantUid && this.state()) {
      return;
    }
    this.loadedFor = tenantUid;
    try {
      this.state.set(
        await this.api.get<SubscriptionStatusView>('/subscription/status', undefined, {
          silent: true,
          noBranch: true,
        }),
      );
    } catch {
      this.state.set(null);
    }
  }

  clear(): void {
    this.loadedFor = null;
    this.state.set(null);
  }

  /** Whether the plan includes the module; unknown (not loaded) counts as included. */
  allows(feature: PlanFeature | undefined): boolean {
    if (!feature) {
      return true;
    }
    const s = this.state();
    return !s || s.features.includes(feature);
  }
}
