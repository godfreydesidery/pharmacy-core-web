import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlanFeature } from '../api/subscription.models';
import { NavItem, TENANT_NAV } from '../layout/nav';
import { SessionStore } from '../session/session.store';
import { SubscriptionStore } from './subscription.store';

/**
 * The plan module a page needs, from the sidebar's tags: the most specific link whose path the URL
 * starts with, or the module of the group it belongs to (all of Insurance needs INSURANCE).
 */
export function featureForUrl(
  url: string,
  nav: readonly NavItem[] = TENANT_NAV,
): PlanFeature | null {
  const path = url.split(/[?#]/)[0];
  const within = (prefix: string) => path === prefix || path.startsWith(prefix + '/');
  let best: { length: number; feature: PlanFeature | null } | null = null;
  const consider = (prefix: string | undefined, feature: PlanFeature | undefined) => {
    if (prefix && within(prefix) && (!best || prefix.length > best.length)) {
      best = { length: prefix.length, feature: feature ?? null };
    }
  };
  for (const item of nav) {
    consider(item.path, item.feature);
    for (const link of item.children ?? []) {
      consider(link.path, link.feature ?? item.feature);
    }
  }
  return (best as { feature: PlanFeature | null } | null)?.feature ?? null;
}

/**
 * Opening a page by link or bookmark when the pharmacy's plan lacks its module leads to the
 * "not in your plan" page instead of an empty page and a passing toast. The root administrator is
 * never gated, and an unknown subscription (not loaded) lets the page open, as the API decides.
 */
export const planGuard: CanActivateFn = async (_route, state) => {
  // Everything is injected before the first await: inject() only works synchronously, and calling
  // it after the subscription loads threw, leaving a blank page instead of the redirect.
  const session = inject(SessionStore);
  const subscription = inject(SubscriptionStore);
  const router = inject(Router);
  const tenant = session.tenant();
  const feature = featureForUrl(state.url);
  if (!feature || !tenant || session.isRoot()) {
    return true;
  }
  await subscription.load(tenant.uid);
  if (subscription.allows(feature)) {
    return true;
  }
  return router.createUrlTree(['/not-in-plan'], {
    queryParams: { feature, from: state.url },
  });
};
