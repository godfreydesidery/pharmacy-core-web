import { Plan, PlanFeature, PlanLimit, PlanUsage } from '../api/subscription.models';

/** What a pharmacy would exceed or lose on another plan. */
export interface DowngradeLoss {
  /** Limits its current use is already above on the target plan. */
  limits: { limit: PlanLimit; used: number; allowed: number }[];
  /** Modules its current plan has and the target plan lacks. */
  features: PlanFeature[];
}

const ALLOWED: Record<PlanLimit, (plan: Plan) => number | null> = {
  BRANCHES: (p) => p.maxBranches,
  USERS: (p) => p.maxUsers,
  PRODUCTS: (p) => p.maxProducts,
  SMS: (p) => p.smsPerMonth,
};

/** Compares the pharmacy's usage and modules with a target plan (null limits are unlimited). */
export function downgradeLoss(
  usage: readonly PlanUsage[],
  current: Plan,
  target: Plan,
): DowngradeLoss {
  const limits = usage
    .map((u) => ({ limit: u.limit, used: u.used, allowed: ALLOWED[u.limit]?.(target) ?? null }))
    .filter(
      (u): u is { limit: PlanLimit; used: number; allowed: number } =>
        u.allowed !== null && u.used > u.allowed,
    );
  const features = current.features.filter((f) => !target.features.includes(f));
  return { limits, features };
}

export function losesAnything(loss: DowngradeLoss): boolean {
  return loss.limits.length > 0 || loss.features.length > 0;
}
