import type { FollowPages } from '../data/data';
/** Customer accounts (receivables) and insurance: the shapes of /receivables and /insurance. */

export type EntryType =
  'CHARGE' | 'PAYMENT' | 'CREDIT_NOTE' | 'WRITE_OFF' | 'ADJUSTMENT' | 'CREDIT_APPLIED';

export interface AccountView {
  customerUid: string;
  customerName: string;
  creditLimit: number;
  /** What the customer owes; negative when they hold credit. */
  balance: number;
  available: number;
  overdue: number;
  oldestOpenDate: string | null;
  onHold: boolean;
  holdReason: string | null;
  unallocatedCredit: number;
  termsDays: number;
}

export interface AllocationView {
  entryUid: string;
  reference: string | null;
  saleUid: string | null;
  amount: number;
}

export interface EntryView {
  uid: string;
  type: EntryType;
  reference: string | null;
  saleUid: string | null;
  /** Signed, in the base currency: debits positive. */
  amount: number;
  openAmount: number;
  date: string;
  dueDate: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string;
  method: string | null;
  currency: string | null;
  foreignAmount: number | null;
  exchangeRate: number | null;
  allocations: AllocationView[];
  runningBalance: number | null;
}

export interface Statement {
  account: AccountView;
  from: string | null;
  to: string | null;
  openingBalance: number;
  entries: { items: EntryView[]; nextCursor: string | null; total: number | null };
}

export interface AgeingRow {
  customerUid: string;
  customerName: string;
  current: number;
  d31to60: number;
  d61to90: number;
  over90: number;
  total: number;
}

export interface ReceivableTotals {
  outstanding: number;
  overdue: number;
  unallocatedCredit: number;
  accountsWithBalance: number;
}

export interface ReceivePaymentInput {
  customerUid: string;
  amount: number;
  method: string;
  reference: string | null;
  date: string | null;
  allocateTo: string[];
  currency: string | null;
  exchangeRate: number | null;
}

export type CopayType = 'NONE' | 'PERCENT' | 'FIXED';
export type ClaimStatus =
  'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'PAID' | 'VOIDED';

export interface PayerView {
  uid: string;
  code: string;
  name: string;
  contact: string | null;
  email: string | null;
  paymentTermsDays: number;
  requiresPreauth: boolean;
  active: boolean;
}

export interface SchemeView {
  uid: string;
  payerUid: string;
  payerName: string | null;
  name: string;
  copayType: CopayType;
  copayValue: number;
  annualLimit: number | null;
  excludedProductTypes: string[];
  excludedProductUids: string[];
  active: boolean;
}

export interface MemberView {
  uid: string;
  customerUid: string;
  customerName: string;
  schemeUid: string;
  schemeName: string | null;
  payerName: string | null;
  memberNumber: string;
  principalName: string | null;
  validFrom: string | null;
  validUntil: string | null;
  usedThisYear: number;
  active: boolean;
  payerUid: string | null;
  requiresPreauth: boolean;
  copayType: CopayType;
  copayValue: number;
  annualLimit: number | null;
}

export interface CoverageLineQuote {
  productUid: string;
  lineTotal: number;
  covered: number;
  copay: number;
  notCovered: number;
  excluded: boolean;
}

export interface CoverageQuote {
  memberUid: string;
  covered: number;
  copay: number;
  notCovered: number;
  notes: string[];
  lines: CoverageLineQuote[];
  patientPays: number;
}

export interface ClaimLineView {
  productUid: string | null;
  productName: string | null;
  quantity: number;
  amount: number;
  approvedAmount: number | null;
  rejectionReason: string | null;
}

export interface ClaimView {
  uid: string;
  number: string;
  payerUid: string;
  payerName: string | null;
  memberUid: string;
  memberNumber: string | null;
  patientName: string | null;
  saleUid: string | null;
  saleNumber: string | null;
  preauthNumber: string | null;
  diagnosisCode: string | null;
  claimed: number;
  approved: number | null;
  paid: number;
  status: ClaimStatus;
  batchUid: string | null;
  lines: ClaimLineView[];
  createdAt: string;
  customerUid: string | null;
  batchNumber: string | null;
  note: string | null;
}

export interface ClaimBatchView {
  uid: string;
  number: string;
  payerUid: string;
  payerName: string | null;
  periodFrom: string;
  periodTo: string;
  claimCount: number;
  claimed: number;
  approved: number;
  paid: number;
  status: string;
  submittedAt: string | null;
}

export interface RemittanceView {
  uid: string;
  number: string;
  payerUid: string;
  payerName: string | null;
  amount: number;
  reference: string | null;
  date: string;
  allocations: Record<string, number>;
  createdAt: string;
}

export interface ClaimTotals {
  pendingClaims: number;
  pendingAmount: number;
  draftClaims: number;
  approvedUnpaid: number;
}

/** Labels of entry types on statements. */
export const ENTRY_LABELS: Record<EntryType, string> = {
  CHARGE: 'Invoice on account',
  PAYMENT: 'Payment',
  CREDIT_NOTE: 'Credit note',
  WRITE_OFF: 'Written off',
  ADJUSTMENT: 'Adjustment',
  CREDIT_APPLIED: 'Account credit used',
};

export const CLAIM_TONES: Record<ClaimStatus, string> = {
  DRAFT: 'gray',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  PARTIALLY_APPROVED: 'amber',
  REJECTED: 'red',
  PAID: 'green',
  VOIDED: 'gray',
};

/** A statement is read whole for its period: every page of entries, joined in order. */
export const WHOLE_STATEMENT: FollowPages<Statement> = {
  next: (s) => s.entries.nextCursor,
  join: (sofar, page) => ({
    ...sofar,
    entries: {
      ...page.entries,
      items: [...sofar.entries.items, ...page.entries.items],
    },
  }),
  maxPages: 50,
};
