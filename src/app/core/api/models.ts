/** DTOs of the Pharmacy Core API v1 (pharmacy-core-docs/contracts/api-v1.md). */

export type Uid = string;
export type IsoDate = string;
export type IsoDateTime = string;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total: number | null;
  /** The total was capped (more rows than {@link total}, which is then 10,000): show "10,000+". */
  totalCapped?: boolean | null;
}

/* ---------- auth ---------- */
export interface BranchRef {
  uid: Uid;
  code: string;
  name: string;
}

export interface Membership {
  uid: Uid;
  tenantUid: Uid;
  tenantCode: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  roleUid: Uid;
  roleCode: string;
  roleName: string;
  permissions: string[];
  allBranches: boolean;
  branches: BranchRef[];
  /** The pharmacy's admin may create staff logins directly (set by the root administrator). */
  directUserCreation?: boolean;
  /** Why a SUSPENDED pharmacy is suspended, once the API sends it (the shell asks otherwise). */
  suspensionKind?: SuspensionKind | null;
}

export interface SessionUser {
  uid: Uid;
  name: string;
  email: string;
  rootAdmin: boolean;
  /** A root administrator must set up two-factor first (when the platform requires it). */
  twoFactorSetupRequired?: boolean;
  /** A managed login on a temporary password must choose its own before working. */
  passwordChangeRequired?: boolean;
}

export interface Session {
  token: string;
  expiresAt: IsoDateTime;
  user: SessionUser;
  memberships: Membership[];
}

export type Me = Omit<Session, 'token' | 'expiresAt'>;

/* ---------- platform ---------- */
/** CLOSED: nobody works in it, its admins may read and export; ERASED: only a tombstone is left. */
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ERASED';
/** Why a pharmacy is suspended (tenancy SuspensionKind): DISPUTE is a legal hold. */
export type SuspensionKind = 'UNPAID' | 'DISPUTE' | 'ABUSE' | 'OTHER';

export interface Tenant {
  uid: Uid;
  code: string;
  name: string;
  legalName: string | null;
  country: string;
  currency: string;
  timezone: string;
  status: TenantStatus;
  statusReason: string | null;
  /** Why it is suspended: UNPAID (admins read-only), DISPUTE (legal hold), ABUSE, OTHER. */
  suspensionKind?: SuspensionKind | null;
  /** A dispute, a regulator's or a court's order: its data may not be erased while it holds. */
  legalHold?: boolean;
  legalHoldReason?: string | null;
  closedAt?: IsoDateTime | null;
  /** When a closed pharmacy's cooling-off ends and it may be erased. */
  eraseAfter?: IsoDateTime | null;
  erasedAt?: IsoDateTime | null;
  branchCount: number;
  createdAt: IsoDateTime;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  /** The pharmacy's admin may create staff logins directly, not only invite by email. */
  directUserCreation?: boolean;
}

export interface RegisterTenant {
  code: string;
  name: string;
  legalName: string;
  country: string;
  currency: string;
  timezone: string;
  headOffice: { code: string; name: string; address: string; phone: string };
  admin: { name: string; email: string; password: string };
}

export interface PlatformOverview {
  tenants: number;
  activeTenants: number;
  suspendedTenants: number;
  branches: number;
  users: number;
}

export interface User {
  uid: Uid;
  name: string;
  email: string;
  rootAdmin: boolean;
  createdAt?: IsoDateTime;
  active?: boolean;
  phone?: string | null;
  lastSignInAt?: IsoDateTime | null;
  /** A staff login a pharmacy created (signs in as username@CODE). */
  managed?: boolean;
  phoneVerified?: boolean;
}

/* ---------- tenant administration ---------- */
export interface Branch {
  uid: Uid;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  licenceNumber: string | null;
  headOffice: boolean;
  active: boolean;
  /** Optimistic concurrency (STD-10): sent back as `If-Match: "<version>"` on a save. */
  version: number;
  createdAt: IsoDateTime;
}

export interface Settings {
  currency: string;
  timezone: string;
  /** The standard VAT rate: what a STANDARD product is sold at while the pharmacy is registered. */
  defaultTaxRatePercent: number;
  invoicePrefix: string;
  receiptFooter: string | null;
  maxDiscountPercent: number;
  expiryAlertDays: number;
  lowStockAlerts: boolean;
  /** Send the receipt by SMS to a customer with a phone number. */
  smsReceipts: boolean;
  /** The base currency first, then the accepted foreign currencies. */
  acceptedCurrencies: string[];
  /** Selling prices include VAT (taken out of the price) rather than have it added on top. */
  pricesIncludeTax: boolean;
  /** How the app looks for everyone in the pharmacy. */
  look: 'PREMIUM' | 'CLASSIC';
  /** Minutes without use that sign a person out of this pharmacy (5 to 60). */
  idleMinutes: number;
  /** Everyone who works here needs an authenticator app or a passkey (G16). */
  requireTwoFactor?: boolean;
  /** Above this amount (base currency) a refund, write-off, voucher or shift difference needs a manager. */
  approvalLimit: number;
  /** Days after a sale its goods may come back without a manager (0 to 365). */
  returnWindowDays: number;
  /** A cashier opens a till shift before selling, refunding or issuing a voucher. */
  requireOpenShift: boolean;
  /** Registered for VAT with TRA: false charges no VAT on any sale and books no input VAT. */
  vatRegistered?: boolean;
  /** Taxpayer Identification Number (9 digits, kept without dashes) and VAT Registration Number. */
  tin?: string | null;
  vrn?: string | null;
  /**
   * Shared counter PCs (WEB-5): the session ends when the browser closes, and parked sales expire
   * at the end of the pharmacy's day. Off by default.
   */
  sharedCounterPcs?: boolean;
  /** The monthly expiry write-down (STD-3) of stock near or past its expiry date. */
  expiryProvisionEnabled?: boolean;
  /** The write-down bands, days to expiry ascending (0 = already expired). */
  expiryProvisionBands?: ExpiryProvisionBand[];
  /** How input VAT serving both taxable and exempt sales is split (STD-2). */
  vatApportionmentMethod?: VatApportionmentMethod;
  /** The recoverable share agreed with TRA or the accountant, when the method is FIXED. */
  vatFixedRecoverablePercent?: number | null;
  /** The month the financial year ends (1 to 12): the yearly true-up is made then. */
  vatYearEndMonth?: number;
  /** Round the automatic ratio up to the next whole percent. */
  vatRatioRoundUp?: boolean;
  /** Optimistic concurrency (STD-10): sent back as `If-Match: "<version>"` on a save. */
  version: number;
}

/** One expiry write-down band: stock expiring within `daysToExpiry` is written down by `percent`. */
export interface ExpiryProvisionBand {
  daysToExpiry: number;
  percent: number;
}

export type VatApportionmentMethod = 'AUTOMATIC' | 'FIXED';

/** `POST /auth/activity`: the session's inactivity limit after the person used the app. */
export interface SessionActivity {
  /** Null when the server has no inactivity limit (the simulated world). */
  idleMinutes: number | null;
  idleEndsAt: IsoDateTime | null;
  expiresAt: IsoDateTime;
}

export interface Member {
  membershipUid: Uid;
  userUid: Uid;
  name: string;
  email: string;
  roleUid: Uid;
  roleCode: string;
  roleName: string;
  allBranches: boolean;
  branchUids: Uid[];
  active: boolean;
  /** When they last worked in this pharmacy (activity elsewhere is never shown). */
  lastActiveAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  phone?: string | null;
  /** A login the pharmacy created: `email` is then its sign-in, username@code. */
  managed?: boolean;
  /** Where mail to a managed login goes. */
  contactEmail?: string | null;
  /** Still on the temporary password the pharmacy gave. */
  passwordChangeRequired?: boolean;
  /** What this pharmacy keeps about the person (G15); no other pharmacy sees it. */
  staff?: StaffDetails | null;
}

export interface StaffDetails {
  staffNumber: string | null;
  jobTitle: string | null;
  workPhone: string | null;
  workEmail: string | null;
}

/** A managed login just created or reset: the temporary password is shown this once. */
export interface ManagedLoginPassword {
  member: Member;
  signIn: string;
  temporaryPassword: string;
}

export interface Role {
  uid: Uid;
  code: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
  /** Optimistic concurrency (STD-10): sent back as `If-Match: "<version>"` on a save. */
  version: number;
}

export interface Permission {
  code: string;
  area: string;
  description: string;
}

/* ---------- catalogue ---------- */
export interface Category {
  uid: Uid;
  name: string;
  description: string | null;
  /** Null for a top-level category; categories nest at most three deep. */
  parentUid: Uid | null;
  /** The names from the top of the tree down, such as "Medical Equipment › Mobility Aids". */
  path: string;
}

export type ProductType =
  | 'MEDICINE'
  | 'MEDICAL_EQUIPMENT'
  | 'MEDICAL_SUPPLY'
  | 'COSMETIC'
  | 'SUPPLEMENT'
  | 'BABY_CARE'
  | 'OTHER';

/** How stock is tracked: by batch and expiry (FEFO), batch only (FIFO), unit by serial, or quantity. */
export type TrackingMode = 'BATCH_EXPIRY' | 'BATCH' | 'SERIAL' | 'QUANTITY';

export type UnitOfMeasure =
  | 'PIECE'
  | 'BOX'
  | 'PACK'
  | 'STRIP'
  | 'BOTTLE'
  | 'TUBE'
  | 'SACHET'
  | 'VIAL'
  | 'PAIR'
  | 'SET'
  | 'KIT'
  | 'ROLL';

export interface ProductTypeOption {
  code: ProductType;
  defaultTrackingMode: TrackingMode;
}

export interface Manufacturer {
  uid: Uid;
  name: string;
  country: string | null;
}

export type Schedule = 'OTC' | 'PRESCRIPTION' | 'CONTROLLED';
/** STD-2: STANDARD at the standard rate; ZERO_RATED at 0% (input VAT recoverable); EXEMPT outside VAT. */
export type TaxCategory = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT';
export const TAX_CATEGORIES: readonly TaxCategory[] = ['STANDARD', 'ZERO_RATED', 'EXEMPT'];
export type Storage = 'ROOM_TEMPERATURE' | 'COOL_DRY' | 'REFRIGERATED';

export interface ProductInput {
  name: string;
  genericName: string | null;
  sku: string | null;
  gtin: string | null;
  atcCode: string | null;
  categoryUid: Uid | null;
  manufacturerUid: Uid | null;
  /** Required for a MEDICINE only; null for equipment and other products. */
  dosageForm: string | null;
  strength: string | null;
  packSize: string | null;
  schedule: Schedule;
  sellingPrice: number;
  costPrice: number;
  /** Derived from `taxCategory` by the API: the standard rate for STANDARD, else 0. */
  taxRatePercent: number;
  /** How VAT treats it; most medicines are EXEMPT in Tanzania (verify each with the accountant). */
  taxCategory?: TaxCategory;
  reorderLevel: number;
  storage: Storage;
  productType: ProductType;
  /** Null on input means the type's default tracking. */
  trackingMode: TrackingMode | null;
  unitOfMeasure: UnitOfMeasure;
  brand: string | null;
  model: string | null;
  warrantyMonths: number | null;
  /** SERIAL products only: the POS asks for each unit's serial number. */
  requiresSerialAtSale: boolean | null;
  /** The product's TMDA (Tanzania Medicines and Medical Devices Authority) registration number. */
  tmdaRegistrationNumber?: string | null;
}

export interface Product extends ProductInput {
  uid: Uid;
  categoryName: string | null;
  manufacturerName: string | null;
  active: boolean;
  version: number;
  createdAt: IsoDateTime;
}

/* ---------- partners ---------- */
export type CustomerType =
  'RETAIL' | 'WHOLESALE' | 'INSURANCE' | 'CORPORATE' | 'STAFF' | 'NGO' | 'GOVERNMENT';
export type PaymentTerms = 'COD' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60';

export interface CustomerInput {
  name: string;
  phone: string | null;
  email: string | null;
  type: CustomerType;
  insuranceProvider: string | null;
  insuranceNumber: string | null;
  /** Left out by someone without `partners.credit_limit`: the current limit is kept. */
  creditLimit?: number | null;
  address: string | null;
  active: boolean;
  /** How long the customer has to pay an amount put on account; NET_30 by default. */
  paymentTerms: PaymentTerms;
}

export interface Customer extends CustomerInput {
  uid: Uid;
  code: string;
  /** Optimistic concurrency (STD-10): sent back as `If-Match: "<version>"` on a save. */
  version: number;
  createdAt: IsoDateTime;
  /** When the person's details were erased (STD-5): the record stays, nameless and inactive. */
  anonymisedAt?: IsoDateTime | null;
}

/** What a customer may agree to (STD-5). */
export type ConsentPurpose = 'SMS_RECEIPTS' | 'MARKETING' | 'INSURER_SHARING';
export type ConsentStatus = 'GIVEN' | 'WITHDRAWN' | 'NONE';

/** Sent with a customer's create or update: only the purposes present, and changed, are recorded. */
export type ConsentChoices = Partial<Record<ConsentPurpose, boolean>>;

export interface ConsentState {
  purpose: ConsentPurpose;
  status: ConsentStatus;
  since: IsoDateTime | null;
  /** SMS receipts unless WITHDRAWN; marketing and insurer sharing only when GIVEN. */
  effective: boolean;
}

export interface ConsentRecord {
  uid: Uid;
  purpose: ConsentPurpose;
  givenAt: IsoDateTime | null;
  givenBy: string | null;
  withdrawnAt: IsoDateTime | null;
  withdrawnBy: string | null;
  note: string | null;
  inForce: boolean;
}

/** GET/POST /customers/{uid}/consents: the state of each purpose, and the history newest first. */
export interface CustomerConsents {
  current: ConsentState[];
  history: ConsentRecord[];
}

export type DataSubjectRequestKind =
  'ACCESS' | 'CORRECTION' | 'ERASURE' | 'OBJECTION' | 'RESTRICTION';
export type DataSubjectRequestStatus = 'OPEN' | 'COMPLETED' | 'REFUSED';

/** A data-subject request (Administration → Data requests). */
export interface DataSubjectRequest {
  uid: Uid;
  number: string;
  kind: DataSubjectRequestKind;
  status: DataSubjectRequestStatus;
  customerUid: Uid;
  customerCode: string | null;
  customerName: string | null;
  receivedAt: IsoDateTime;
  /** Received + 30 days. */
  dueOn: IsoDate;
  completedAt: IsoDateTime | null;
  completedBy: string | null;
  outcome: string | null;
  note: string | null;
  overdue: boolean;
  createdAt: IsoDateTime;
  createdBy: string | null;
}

export interface SupplierInput {
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  tin: string | null;
  paymentTerms: PaymentTerms;
  address: string | null;
  active: boolean;
  /** Days from order to delivery; reorder suggestions cover them. */
  leadTimeDays?: number;
}

export interface Supplier extends SupplierInput {
  uid: Uid;
  code: string;
  /** Optimistic concurrency (STD-10): sent back as `If-Match: "<version>"` on a save. */
  version: number;
  createdAt: IsoDateTime;
}

/* ---------- inventory ---------- */
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface StockItem {
  productUid: Uid;
  productName: string;
  genericName: string | null;
  sku: string | null;
  dosageForm: string | null;
  strength: string | null;
  categoryName: string | null;
  quantity: number;
  reorderLevel: number;
  status: StockStatus;
  nearestExpiry: IsoDate | null;
  batchCount: number;
  sellingPrice: number;
  costValue: number;
  productType: ProductType;
  unitOfMeasure: UnitOfMeasure;
  trackingMode: TrackingMode;
}

export type SerialStatus = 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'IN_TRANSIT' | 'WRITTEN_OFF';

/** One serial-tracked unit, such as wheelchair WCH-0001. */
export interface SerialUnit {
  uid: Uid;
  productUid: Uid;
  serialNumber: string;
  batchUid: Uid;
  batchNumber: string;
  branchUid: Uid;
  status: SerialStatus;
  saleReference: string | null;
  soldAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface StockSummary {
  products: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expired: number;
  costValue: number;
  retailValue: number;
}

export interface Batch {
  uid: Uid;
  productUid: Uid;
  batchNumber: string;
  /** Null for a product without expiry (sold first in, first out). */
  expiryDate: IsoDate | null;
  quantity: number;
  unitCost: number;
  daysLeft: number | null;
  expired: boolean;
  /** Recalled: on hand but not sold or moved until released. */
  quarantined?: boolean;
}

export interface ExpiringBatch {
  batchUid: Uid;
  productUid: Uid;
  productName: string;
  batchNumber: string;
  expiryDate: IsoDate;
  daysLeft: number;
  quantity: number;
  costValue: number;
}

export type MovementType =
  | 'OPENING'
  | 'RECEIPT'
  | 'SALE'
  | 'SALE_RETURN'
  | 'ADJUSTMENT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFORM_OUT'
  | 'TRANSFORM_IN'
  | 'SUPPLIER_RETURN';

export interface Movement {
  uid: Uid;
  productUid: Uid;
  productName: string;
  batchUid: Uid;
  batchNumber: string;
  type: MovementType;
  quantityChange: number;
  balanceAfter: number;
  reference: string | null;
  reasonCode: string | null;
  note: string | null;
  createdAt: IsoDateTime;
  createdBy: string;
  serialNumbers: string[];
}

export type AdjustmentReason =
  'DAMAGE' | 'THEFT_LOSS' | 'COUNT_CORRECTION' | 'EXPIRED_WRITE_OFF' | 'SAMPLE' | 'OTHER';

export interface TransferLine {
  productUid: Uid;
  productName: string;
  batchUid: Uid;
  batchNumber: string;
  expiryDate: IsoDate | null;
  quantity: number;
  serialNumbers: string[];
  /** Units that arrived (null while in transit, and on transfers received before Batch 4). */
  receivedQuantity?: number | null;
}

export interface Transfer {
  uid: Uid;
  number: string;
  fromBranchUid: Uid;
  fromBranchName: string;
  toBranchUid: Uid;
  toBranchName: string;
  status: 'IN_TRANSIT' | 'RECEIVED';
  note: string | null;
  lines: TransferLine[];
  createdAt: IsoDateTime;
  receivedAt: IsoDateTime | null;
  dispatchedBy?: string | null;
  /** The sender, who may not also receive it. */
  dispatchedByUid?: Uid | null;
  receivedBy?: string | null;
  /** Whole days since it was sent, while in transit. */
  daysInTransit?: number | null;
}

/* ---------- purchasing ---------- */
export type PurchaseOrderStatus = 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLine {
  uid: Uid;
  productUid: Uid;
  productName: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  uid: Uid;
  number: string;
  branchUid: Uid;
  supplierUid: Uid;
  supplierName: string;
  status: PurchaseOrderStatus;
  expectedDate: IsoDate | null;
  note: string | null;
  total: number;
  lines: PurchaseOrderLine[];
  createdAt: IsoDateTime;
  createdBy: string;
  /** The order's currency; total and line costs are in it. */
  currency: string;
  /** Base units per 1 order unit, locked when the order was made. */
  exchangeRate: number;
  baseTotal: number;
}

export interface GoodsReceiptLine {
  productUid: Uid;
  productName: string;
  batchNumber: string;
  expiryDate: IsoDate | null;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  /** unitCost in the base currency at the receipt's rate. */
  baseUnitCost: number;
  serialNumbers: string[];
}

export interface GoodsReceipt {
  uid: Uid;
  number: string;
  branchUid: Uid;
  purchaseOrderUid: Uid | null;
  purchaseOrderNumber: string | null;
  supplierUid: Uid;
  supplierName: string;
  supplierInvoiceNumber: string | null;
  note: string | null;
  total: number;
  lines: GoodsReceiptLine[];
  createdAt: IsoDateTime;
  createdBy: string;
  currency: string;
  exchangeRate: number;
  baseTotal: number;
  /** The invoice's input VAT, on top of the lines (in the receipt currency, and in the base). */
  vatTotal?: number;
  baseVatTotal?: number;
}

/* ---------- sales ---------- */
export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'MOBILE_MONEY'
  | 'INSURANCE'
  | 'CREDIT'
  | 'ACCOUNT_CREDIT'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'VOUCHER';
export type SaleStatus = 'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED';

export interface SellableProduct {
  productUid: Uid;
  name: string;
  genericName: string | null;
  sku: string | null;
  gtin: string | null;
  dosageForm: string | null;
  strength: string | null;
  categoryUid: Uid | null;
  categoryName: string | null;
  schedule: Schedule;
  sellingPrice: number;
  taxRatePercent: number;
  quantityOnHand: number;
  /** Units the till can get by opening linked packs here (break bulk); absent means none. */
  openableUnits?: number;
  /** Units here in recalled (quarantined) batches: not sellable until released. */
  quarantinedUnits?: number;
  productType: ProductType;
  trackingMode: TrackingMode;
  unitOfMeasure: UnitOfMeasure;
  /** The POS asks for (or scans) each unit's serial number. */
  requiresSerialAtSale: boolean;
  /** Its VAT category; `taxRatePercent` is already 0 when the pharmacy is not VAT-registered. */
  taxCategory?: TaxCategory;
}

export interface Prescription {
  prescriberName: string;
  prescriberRegistration: string;
  reference: string;
  patientName: string;
  /** The day the prescriber wrote it ("YYYY-MM-DD"); valid for 6 months (STD-7). */
  prescriptionDate?: IsoDate | null;
}

export interface CheckoutRequest {
  idempotencyKey: string;
  customerUid: Uid | null;
  /** NORMAL or a pricing plan's uid; null for the customer's own plan. */
  pricePlan?: string | null;
  discountPercent: number;
  lines: { productUid: Uid; quantity: number; serialNumbers?: string[] }[];
  payments: SalePayment[];
  prescription: Prescription | null;
  /** An insured sale: the member, and the payer's pre-authorisation and ICD-10 diagnosis. */
  memberUid?: Uid | null;
  preauthNumber?: string | null;
  diagnosisCode?: string | null;
  /** Put what the payments leave unpaid on the customer's account (needs sales.credit). */
  balanceToAccount?: boolean;
  /** Keep a card or mobile money overpayment on the customer's account as credit. */
  excessToAccount?: boolean;
}

export interface SalePayment {
  method: PaymentMethod;
  /** In `currency`; null currency means the base. */
  amount: number;
  reference: string | null;
  currency?: string | null;
  /** Base units per 1 unit of `currency`, locked at the sale. */
  exchangeRate?: number | null;
  /** The payment's value in the base currency (in responses). */
  baseAmount?: number;
  /** The registered method used (MPESA, BANK_TRANSFER, …), for reconciliation. */
  channel?: string | null;
}

export interface SaleLine {
  uid: Uid;
  productUid: Uid;
  productName: string;
  batchUid: Uid;
  batchNumber: string;
  expiryDate: IsoDate;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
  serialNumbers: string[];
  /** The last day of the warranty of what the line sold, or null. */
  warrantyEndsOn: IsoDate | null;
  returnedSerialNumbers: string[];
  /** The medicine's dispensing class when it was sold (null on sales before Batch 4). */
  schedule?: 'OTC' | 'PRESCRIPTION' | 'CONTROLLED' | null;
  /** The VAT it was sold under. */
  taxCategory?: TaxCategory;
  taxRatePercent?: number;
}

export type FiscalStatus = 'PENDING' | 'ISSUED' | 'FAILED';
export type FiscalDocumentKind = 'RECEIPT' | 'CREDIT_NOTE' | 'Z_REPORT';

/** A document the tax authority (TRA VFD) issues: a sale's receipt, a credit note, a Z report. */
export interface FiscalDocument {
  uid: Uid;
  kind: FiscalDocumentKind;
  status: FiscalStatus;
  provider: string;
  branchUid: Uid;
  sourceUid: Uid;
  /** The sale's or return's number, or the Z report's (Z-HQ-20261124). */
  sourceNumber: string;
  saleUid: Uid | null;
  businessDate: IsoDate;
  sellerTin: string | null;
  sellerVrn: string | null;
  total: number;
  taxTotal: number;
  /** The authority's number, verification code and QR payload, once ISSUED. */
  receiptNumber: string | null;
  verificationCode: string | null;
  qrPayload: string | null;
  /** The branch's counters (the VFD's GC and DC). */
  globalCounter: number | null;
  dailyCounter: number | null;
  issuedAt: IsoDateTime | null;
  attempts: number;
  lastError: string | null;
  createdAt: IsoDateTime;
  /** A Z report's figures. */
  z: {
    receipts: number;
    receiptsTotal: number;
    receiptsTax: number;
    creditNotes: number;
    creditNotesTotal: number;
    creditNotesTax: number;
    standardNet: number;
    zeroRatedNet: number;
    exemptNet: number;
  } | null;
}

export interface Sale {
  uid: Uid;
  number: string;
  /** The pricing plan it was priced under, as named then (null before pricing plans). */
  priceListName?: string | null;
  branchUid: Uid;
  branchName: string;
  customerUid: Uid | null;
  customerName: string | null;
  status: SaleStatus;
  discountPercent: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paidTotal: number;
  changeDue: number;
  lines: SaleLine[];
  payments: SalePayment[];
  prescription: Prescription | null;
  /** The seller who dispensed its prescription lines; null when it has none. */
  dispensedBy?: string | null;
  /** The sale has a prescription the caller may not see (no `health.view`): `prescription` is null. */
  prescriptionWithheld?: boolean;
  cashierName: string;
  createdAt: IsoDateTime;
  /** The authority's receipt number, once issued. */
  fiscalReference?: string | null;
  /** The fiscal receipt is still to be issued. */
  fiscalDue?: boolean;
  /** Its fiscal receipt's status; null without one (no fiscal integration). */
  fiscalStatus?: FiscalStatus | null;
  /** The receipt, then the credit notes of its returns (read with the sale). */
  fiscalDocuments?: FiscalDocument[];
}

export interface SaleSummary {
  uid: Uid;
  number: string;
  customerName: string | null;
  itemCount: number;
  total: number;
  paidTotal: number;
  paymentMethods: PaymentMethod[];
  status: SaleStatus;
  cashierName: string;
  createdAt: IsoDateTime;
  fiscalStatus?: FiscalStatus | null;
}

export interface SaleReturn {
  uid: Uid;
  number: string;
  saleUid: Uid;
  saleNumber: string;
  reason: string;
  refundMethod: PaymentMethod;
  /** How the refund went back: the way the sale was paid, one share per method. */
  refunds?: { method: PaymentMethod; amount: number; reference: string | null }[];
  /** The base value booked at the sale. */
  refundTotal: number;
  /** A refund paid back in a foreign currency the sale was tendered in; null for the base. */
  refundCurrency?: string | null;
  refundForeignAmount?: number | null;
  saleExchangeRate?: number | null;
  refundExchangeRate?: number | null;
  /** Base paid out − refundTotal: positive a realised exchange loss, negative a gain. */
  fxDifference?: number;
  lines: SaleReturnLine[];
  createdAt: IsoDateTime;
  createdBy: string;
  /** Its credit note's status (null: the sale had no fiscal receipt) and number. */
  fiscalStatus?: FiscalStatus | null;
  fiscalReference?: string | null;
}

export interface SaleReturnLine {
  /** The return line's own uid (to release what is held). */
  uid: Uid;
  saleLineUid: Uid;
  productName: string;
  batchNumber: string;
  quantity: number;
  serialNumbers: string[];
  refund: number;
  /** Where its units went: back on the shelf, held aside, or written off as damaged. */
  disposition?: 'SHELF' | 'QUARANTINE' | 'DAMAGED';
  /** Units still held aside (0 once released). */
  heldQuantity?: number;
  releasedOutcome?: 'SHELF' | 'DAMAGED' | null;
  releasedAt?: IsoDateTime | null;
  releasedBy?: string | null;
}

/* ---------- finance ---------- */
export type ExpenseCategory =
  | 'RENT'
  | 'UTILITIES'
  | 'SALARIES'
  | 'TRANSPORT'
  | 'MAINTENANCE'
  | 'MARKETING'
  | 'SUPPLIES'
  | 'LICENCES'
  | 'OTHER';

export interface Expense {
  uid: Uid;
  number?: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: IsoDate;
  paymentMethod: string;
  reference: string | null;
  branchUid?: Uid | null;
  createdAt?: IsoDateTime;
  createdBy?: string;
  /** The input VAT in the amount (VAT-registered pharmacies). */
  vatAmount?: number;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  code: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface JournalEntry {
  uid: Uid;
  number: string;
  entryDate: IsoDate;
  sourceType: string;
  sourceReference: string | null;
  description: string;
  branchUid: Uid | null;
  lines: {
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    /** The foreign currency and amount behind the line, for reference. */
    currency?: string | null;
    foreignAmount?: number | null;
  }[];
  createdAt: IsoDateTime;
}

/* ---------- currencies ---------- */
export interface CurrencyInfo {
  code: string;
  name: string;
  minorUnits: number;
  symbol: string;
}

/** Units of `quote` per 1 `base`. */
export interface ExchangeRate {
  uid: Uid;
  base: string;
  quote: string;
  rate: number;
  effectiveOn: IsoDate;
  source: string;
  createdAt: IsoDateTime;
}

export interface LatestRate {
  base: string;
  quote: string;
  rate: number;
  effectiveOn: IsoDate;
  source: string;
  /** Older than 7 days: show a warning. */
  stale: boolean;
}

export interface SupplierPayment {
  uid: Uid;
  number: string;
  supplierUid: Uid;
  supplierName: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  bookedBaseAmount: number;
  /** baseAmount − bookedBaseAmount: positive is a realised loss, negative a gain. */
  fxDifference: number;
  paymentMethod: string;
  reference: string | null;
  goodsReceiptUids: Uid[];
  paidOn: IsoDate;
  createdAt: IsoDateTime;
  createdBy: string;
}

/* ---------- reports ---------- */
export interface Kpi {
  value: number;
  previous: number;
  changePercent: number | null;
}

export interface Dashboard {
  currency: string;
  periodDays: number;
  sales: Kpi;
  purchases: Kpi;
  grossProfit: Kpi;
  transactions: Kpi;
  customers: number;
  stock: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
    expired: number;
  };
  salesTrend: { date: IsoDate; total: number }[];
  topProducts: { productUid: Uid; productName: string; quantity: number; net: number }[];
  paymentMix: { method: PaymentMethod; amount: number; count: number }[];
  expiringBatches: ExpiringBatch[];
  recentSales: SaleSummary[];
  /** Money owed to the pharmacy: receivables (tenant-wide) and pending insurance claims. */
  credit?: {
    receivables: number;
    overdue: number;
    customerCredit: number;
    accountsWithBalance: number;
    pendingClaims: number;
    pendingClaimsAmount: number;
  } | null;
}

export interface SalesReportRow {
  date: IsoDate;
  invoices: number;
  gross: number;
  discount: number;
  tax: number;
  net: number;
  cost: number;
  profit: number;
}

export interface SalesReport {
  rows: SalesReportRow[];
  totals: Omit<SalesReportRow, 'date'>;
}

export interface ProductReportRow {
  productUid: Uid;
  productName: string;
  quantity: number;
  net: number;
  cost: number;
  profit: number;
}

export interface ProfitLoss {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  expenses: { category: string; amount: number }[];
  totalExpenses: number;
  netProfit: number;
}

export interface PaymentReportRow {
  method: PaymentMethod;
  amount: number;
  count: number;
}

/* ---------- integrations ---------- */
export interface Webhook {
  uid: Uid;
  name: string;
  url: string;
  eventTypes: string[];
  active: boolean;
  secret?: string | null;
  createdAt?: IsoDateTime;
  /** While an old secret also signs after a rotation (24 hours). */
  previousSecretUntil?: IsoDateTime | null;
}

export interface WebhookDelivery {
  uid: Uid;
  eventType: string;
  eventId: string;
  status: string;
  responseStatus: number | null;
  attempts: number;
  lastError: string | null;
  createdAt: IsoDateTime;
  deliveredAt: IsoDateTime | null;
}

/* ---------- pricing ---------- */
export type PriceSource = 'RETAIL' | 'BRANCH' | 'LIST' | 'PROMOTION';

/** A basket line priced for the customer at the branch, as checkout will charge it. */
export interface PricedLine {
  productUid: Uid;
  quantity: number;
  unitPrice: number;
  retailPrice: number;
  source: PriceSource;
  label: string | null;
  belowCost: boolean;
  /** The chosen plan has no price and no rule for it: the sale is refused. */
  unpriced?: boolean;
}

export interface PriceListItem {
  productUid: Uid;
  productName: string | null;
  minQuantity: number;
  price: number;
}

export interface PriceList {
  uid: Uid;
  name: string;
  customerType: CustomerType | null;
  customerUid: Uid | null;
  customerName: string | null;
  /** For a medicine the plan has no price for: null blocks it, 0 is Normal Sale, else ±%. */
  adjustmentPercent: number | null;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  /** Null in the list of plans (Batch 7): read one plan, `GET /price-lists/{uid}`, for its items. */
  items: PriceListItem[] | null;
  /** How many prices the plan has. */
  itemCount?: number;
  /** An insurer's plan: the default for its members' sales. */
  payerUid?: Uid | null;
  payerName?: string | null;
  /** Optimistic concurrency (STD-10): sent back as `If-Match: "<version>"` on a save. */
  version: number;
}

/** A pricing plan; uid null is Normal Sale. rulePercent null: no rule (blocks). */
export interface PricingPlan {
  uid: Uid | null;
  name: string;
  rulePercent: number | null;
  customerType: string | null;
  customerUid: Uid | null;
  customerName: string | null;
  payerUid: Uid | null;
  payerName: string | null;
}

/** A plan's card: who it is for, its rule and how many medicines it prices; uid null is Normal Sale. */
export interface PlanCard {
  uid: Uid | null;
  name: string;
  customerType: string | null;
  customerUid: Uid | null;
  customerName: string | null;
  payerUid: Uid | null;
  payerName: string | null;
  rulePercent: number | null;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  priced: number;
  /**
   * The plan's version, when the cards carry it; otherwise the plan is read
   * (`GET /price-lists/{uid}`) for it before a save.
   */
  version?: number;
}

/** One row of a plan's page; price null: not priced in the plan. */
export interface PlanItemRow {
  productUid: Uid;
  code: string;
  name: string;
  barcode: string | null;
  category: string | null;
  costPrice: number | null;
  normalPrice: number;
  minQuantity: number;
  price: number | null;
}

/** A medicine's price in one plan: set (PRICE), by its rule (RULE) or not sold (BLOCKED). */
export interface PlanPriceView {
  planUid: Uid | null;
  planName: string;
  price: number | null;
  basis: 'PRICE' | 'RULE' | 'BLOCKED';
  breaks: { minQuantity: number; price: number }[];
  active: boolean;
}

export interface PricingGridRow {
  productUid: Uid;
  code: string;
  name: string;
  barcode: string | null;
  category: string | null;
  costPrice: number | null;
  normalPrice: number;
  /** Plan uid → its price from quantity 1, where set. */
  prices: Record<string, number>;
}

export interface PriceChange {
  planUid: Uid | null;
  planName: string;
  minQuantity: number;
  oldPrice: number | null;
  newPrice: number | null;
  source: 'MANUAL' | 'IMPORT' | 'PRODUCT' | 'BULK';
  changedBy: string;
  changedAt: string;
}

export interface TillPlans {
  defaultPlan: PricingPlan;
  plans: PricingPlan[];
  canChange: boolean;
}

export interface BulkResult {
  planName: string;
  lines: {
    productUid: Uid;
    code: string;
    name: string;
    oldPrice: number | null;
    newPrice: number;
  }[];
  applied: boolean;
}

export interface PlanSales {
  plan: string;
  sales: number;
  total: number;
  normalTotal: number | null;
  belowNormal: number | null;
}

export interface BranchPrice {
  productUid: Uid;
  productName: string | null;
  branchUid: Uid;
  price: number;
}

export interface Promotion {
  uid: Uid;
  name: string;
  percentOff: number;
  productUid: Uid | null;
  productName: string | null;
  categoryUid: Uid | null;
  categoryName: string | null;
  branchUid: Uid | null;
  validFrom: string;
  validTo: string;
  active: boolean;
}

/* ---------- payment methods ---------- */
export type PaymentKind = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'VOUCHER';

/** A method the till offers: how it is booked (kind) and whether it can push to a phone. */
export interface TillMethod {
  code: string;
  name: string;
  label: string;
  kind: PaymentKind;
  adapter: string;
  requiresReference: boolean;
  push: boolean;
  accountReference: string | null;
  enabled: boolean;
}

export interface PaymentMethodType {
  uid: Uid;
  code: string;
  name: string;
  kind: PaymentKind;
  adapter: string;
  requiresReference: boolean;
  enabled: boolean;
  sortOrder: number;
  pushAvailable: boolean;
}

export interface PaymentRequest {
  uid: Uid;
  methodCode: string;
  amount: number;
  currency: string;
  phone: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED' | 'USED';
  providerReference: string | null;
  failureReason: string | null;
  expiresAt: string;
}

export interface Voucher {
  uid: Uid;
  code: string;
  initialValue: number;
  balance: number;
  expiresOn: string | null;
  holderName: string | null;
  paidBy: string;
  status: 'ACTIVE' | 'SPENT' | 'VOID';
  createdAt: string;
  createdBy: string;
}

/* ---------- controlled drugs ---------- */
/** GET /controlled-drugs: a Page of these, by name. */
export interface ControlledProduct {
  productUid: Uid;
  name: string;
  strength: string | null;
  dosageForm: string | null;
  onHand: number;
  schedule?: Schedule;
  /** False for a product that was controlled once and is not now: its register stays. */
  controlledNow?: boolean;
}

/** One line of a controlled drug's register. Without `health.view` the patient details are null. */
export interface ControlledRegisterLine {
  uid: Uid;
  at: IsoDateTime;
  type: string;
  reference: string | null;
  batchNumber: string | null;
  quantityIn: number;
  quantityOut: number;
  balance: number;
  patientName: string | null;
  prescriberName: string | null;
  prescriberRegistration: string | null;
  prescriptionReference: string | null;
  prescriptionDate?: IsoDate | null;
  dispensedBy?: string | null;
  /** The prescription details are hidden from this caller (no `health.view`). */
  withheld?: boolean;
  note: string | null;
  recordedBy: string;
}

/* ---------- adverse drug reactions (STD-8) ---------- */
export type AdrSeriousness = 'SERIOUS' | 'NOT_SERIOUS';
export type AdrSeriousReason =
  | 'DEATH'
  | 'LIFE_THREATENING'
  | 'HOSPITALISATION'
  | 'DISABILITY'
  | 'CONGENITAL_ANOMALY'
  | 'OTHER_MEDICALLY_IMPORTANT';
export type AdrOutcome =
  'RECOVERED' | 'RECOVERING' | 'NOT_RECOVERED' | 'RECOVERED_WITH_SEQUELAE' | 'FATAL' | 'UNKNOWN';
export type PatientSex = 'FEMALE' | 'MALE';

/** POST /adverse-reactions: the report's editable fields. */
export interface AdverseReactionInput {
  customerUid: Uid | null;
  patientName: string | null;
  patientAge: number | null;
  patientSex: PatientSex | null;
  patientWeightKg: number | null;
  productUid: Uid;
  batchNumber: string | null;
  dose: string | null;
  route: string | null;
  indication: string | null;
  therapyStarted: IsoDate | null;
  therapyStopped: IsoDate | null;
  reaction: string;
  onsetDate: IsoDate;
  seriousness: AdrSeriousness;
  seriousReason: AdrSeriousReason | null;
  outcome: AdrOutcome;
  /** Left out: the signed-in user's name. */
  reporterName: string | null;
  reporterProfession: string | null;
  reporterPhone: string | null;
  note: string | null;
}

export interface AdverseReaction extends AdverseReactionInput {
  uid: Uid;
  number: string;
  branchUid: Uid | null;
  productName: string;
  createdAt: IsoDateTime;
  createdBy: string | null;
}

/** A root administrator's request that a second one must approve (FRD-18). */
export type RootApprovalAction = 'LIFT_LEGAL_HOLD' | 'ERASE_TENANT';
export type RootApprovalStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';

export interface RootApproval {
  uid: Uid;
  action: RootApprovalAction;
  tenantUid: Uid;
  tenantCode: string;
  tenantName: string;
  reason: string;
  status: RootApprovalStatus;
  requestedByUid: Uid;
  requestedByName: string;
  requestedAt: IsoDateTime;
  expiresAt: IsoDateTime;
  approvedByUid: Uid | null;
  approvedByName: string | null;
  approvedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
}

/** One month's expiry write-down (STD-3), `GET /reports/expiry-provision`. */
export interface ExpiryProvisionRun {
  uid: Uid;
  /** The month measured, such as 2026-11. */
  period: string;
  measuredOn: IsoDate;
  enabled: boolean;
  bands: ExpiryProvisionBand[];
  stockAtCost: number;
  provision: number;
  previousProvision: number;
  adjustment: number;
  journalNumber: string | null;
  branches: {
    branchUid: Uid;
    stockAtCost: number;
    provision: number;
    bands: (ExpiryProvisionBand & { costAtRisk: number; provision: number })[];
  }[];
  createdAt: IsoDateTime;
}

/** One VAT apportionment run (STD-2): a month's provisional split or the year's true-up. */
export interface VatApportionmentRun {
  uid: Uid;
  period: string;
  kind: 'MONTHLY' | 'ANNUAL';
  method: VatApportionmentMethod;
  ratioPercent: number;
  taxableSales: number;
  exemptSales: number;
  directTaxableVat: number;
  directExemptVat: number;
  residualVat: number;
  nonReclaimable: number;
  adjustment: number;
  journalNumber: string | null;
  createdAt: IsoDateTime;
}
