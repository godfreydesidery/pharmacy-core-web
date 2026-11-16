import { Uid } from './models';

/* ---------- subscription plans ---------- */
export type PlanFeature = 'INSURANCE' | 'MULTI_CURRENCY' | 'INTEGRATIONS' | 'ADVANCED_REPORTS';
export type PlanLimit = 'BRANCHES' | 'USERS' | 'PRODUCTS' | 'SMS';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

export const PLAN_FEATURES: PlanFeature[] = [
  'INSURANCE',
  'MULTI_CURRENCY',
  'INTEGRATIONS',
  'ADVANCED_REPORTS',
];

export interface Plan {
  uid: Uid;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number | null;
  maxUsers: number | null;
  maxProducts: number | null;
  smsPerMonth: number | null;
  features: PlanFeature[];
  trialDays: number;
  sortOrder: number;
  active: boolean;
}

export interface PlanInput {
  code?: string;
  name: string;
  description: string | null;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number | null;
  maxUsers: number | null;
  maxProducts: number | null;
  smsPerMonth: number | null;
  insurance: boolean;
  multiCurrency: boolean;
  integrations: boolean;
  advancedReports: boolean;
  trialDays: number;
  sortOrder: number;
  active: boolean;
}

export interface PlanUsage {
  limit: PlanLimit;
  used: number;
  allowed: number | null;
}

export interface SubscriptionInvoice {
  uid: Uid;
  number: string;
  planCode: string;
  planName: string;
  cycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: 'OPEN' | 'PAID' | 'VOID';
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
}

export interface Subscription {
  tenantUid: Uid;
  plan: Plan;
  status: SubscriptionStatus;
  cycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  trialEnds: string | null;
  graceEnds: string | null;
  usage: PlanUsage[];
  invoices: SubscriptionInvoice[];
}

export interface SubscriptionStatusView {
  status: SubscriptionStatus;
  planCode: string;
  planName: string;
  trialEnds: string | null;
  dueDate: string | null;
  graceEnds: string | null;
  features: PlanFeature[];
}

export interface SubscriptionOverview {
  monthlyRecurringRevenue: number;
  currency: string;
  trials: number;
  active: number;
  pastDue: number;
  suspended: number;
  outstanding: number;
}
