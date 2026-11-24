import {
  LatestRate,
  PaymentRequest,
  PricedLine,
  TillMethod,
  TillPlans,
} from '../../core/api/models';
import { formatMoney, isoDay, minorUnits, roundHalfUp } from '../../core/format/format';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
  untracked,
  effect,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import type { ApiError } from '../../core/api/api-error';
import {
  Batch,
  Category,
  CheckoutRequest,
  Customer,
  Page,
  PaymentMethod,
  Prescription,
  Sale,
  SalePayment,
  SaleSummary,
  SellableProduct,
} from '../../core/api/models';
import { debounced, loaded } from '../../core/data/data';
import { SettingsStore } from '../../core/format/settings.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, notAfterToday, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { LeaveGuard } from '../../core/session/leave-guard';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';
import {
  CartLine,
  addToCart,
  available,
  cartTotals,
  changeDue,
  needsCustomer,
  needsPrescription,
  paidTotal,
  baseValue,
  coveringAmount,
  exactTender,
  percentOf,
  setQuantity,
  splitPayment,
  withSerials,
} from './cart';
import {
  CHECKOUT_TIMEOUT_MS,
  CheckoutTimeout,
  PushState,
  TillPayment,
  applyPush,
  forApi,
  pushWanted,
  uncertain,
} from './checkout';
import { SerialPickerComponent } from './serial-picker.component';
import { ShiftBarComponent } from './shift-bar.component';
import { QUICK_CASH_AMOUNTS_ENABLED, TILL_SHIFTS_ENABLED } from '../../core/features';
import { productTypeOf } from '../../core/ui/product-types';
import { ReceiptComponent } from './receipt.component';
import { FilesService } from '../../core/files/files.service';
import { UploadComponent } from '../../core/files/upload.component';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { AccountView, CoverageQuote, MemberView } from '../../core/api/credit.models';
import { Translations } from '../../core/i18n/translations.store';
import { SubscriptionStore } from '../../core/subscription/subscription.store';
import { LineBatch, nextBatch } from './fefo';
import {
  ParkedExpiry,
  ParkedLine,
  ParkedSale,
  park,
  parkedKey,
  readParked,
  unpark,
  writeParked,
} from './parked';

/** How many suggestions the entry row offers under the search box. */
const SUGGESTIONS = 8;
/** Letters typed before the item list opens, so it does not pop up on every key. */
const MIN_SEARCH = 2;
/** The item dropdown's height: the search field and about seven items. */
const DROPDOWN_HEIGHT = 360;
/** "Look it up" lists the sales made from this many minutes before an unconfirmed checkout. */
const LOOKUP_MINUTES = 10;

const METHODS: { method: PaymentMethod; label: string; icon: string }[] = [
  { method: 'CASH', label: 'Cash', icon: 'cash' },
  { method: 'MOBILE_MONEY', label: 'Mobile money', icon: 'phone' },
  { method: 'CARD', label: 'Card', icon: 'card' },
  { method: 'INSURANCE', label: 'Insurance', icon: 'shield' },
  { method: 'CREDIT', label: 'On account', icon: 'wallet' },
  { method: 'ACCOUNT_CREDIT', label: 'Account credit', icon: 'cash' },
];

/** Common notes per currency, smallest first, for the quick-cash chips. */
const NOTES: Readonly<Record<string, number[]>> = {
  TZS: [1000, 2000, 5000, 10000],
  KES: [50, 100, 200, 500, 1000],
  UGX: [1000, 2000, 5000, 10000, 20000, 50000],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100],
  GBP: [5, 10, 20, 50],
};

@Component({
  selector: 'app-pos',
  imports: [
    ...SHARED,
    LookupComponent,
    ReceiptComponent,
    UploadComponent,
    TranslatePipe,
    SerialPickerComponent,
    ShiftBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos.page.html',
  styleUrl: './pos.page.scss',
  host: {
    '(document:keydown)': 'shortcut($event)',
    '(window:beforeunload)': 'parkBeforeUnload()',
    '(window:pagehide)': 'parkBeforeUnload()',
  },
})
export default class PosPage {
  protected readonly session = inject(SessionStore);
  protected readonly settings = inject(SettingsStore);
  /** The base currency's minor units (2 for TZS, 0 for UGX): every till amount is rounded to them. */
  private readonly baseDigits = computed(() => minorUnits(this.settings.currency()));
  private readonly subscription = inject(SubscriptionStore);
  private readonly api = inject(Api);
  private readonly files = inject(FilesService);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly confirm = inject(ConfirmService);
  protected readonly methods = METHODS;
  /** The methods this pharmacy accepts at the till, from the payment registry. */
  protected readonly tillMethods = loaded<TillMethod[]>(() =>
    this.session.branch() ? { path: '/pos/payment-methods' } : null,
  );
  /** Methods only the system books (insurance, on account, account credit). */
  protected readonly internalMethods = METHODS.filter((m) =>
    ['INSURANCE', 'CREDIT', 'ACCOUNT_CREDIT'].includes(m.method),
  );
  /**
   * The phone number and request of each payment row pushed to a phone, by the row's id (not its
   * position, which changes when a row above is removed), with the sale it was sent for.
   */
  protected readonly push = signal<Record<string, PushState>>({});

  /** The push state of a payment row, if it has one. */
  protected pushOf(payment: TillPayment): PushState | undefined {
    return payment.row ? this.push()[payment.row] : undefined;
  }

  /** The row's id, given to it the first time a push needs one. */
  private rowOf(index: number): string | null {
    const payment = this.payments()[index];
    if (!payment) {
      return null;
    }
    if (payment.row) {
      return payment.row;
    }
    const row = crypto.randomUUID();
    this.patchPayment(index, { row });
    return row;
  }

  /** The registered method of a payment row, if it was picked from the registry. */
  protected tillMethodOf(payment: SalePayment): TillMethod | undefined {
    return (this.tillMethods.value() ?? []).find((m) => m.code === payment.channel);
  }

  /**
   * The option a payment row's select shows: its channel, else the registry method matching how it
   * is booked (a plain cash row shows the pharmacy's cash method), else the internal method.
   */
  protected selectedCode(payment: SalePayment): string {
    if (payment.channel) {
      return payment.channel;
    }
    const till = this.tillMethods.value() ?? [];
    return (
      till.find((m) => m.code === payment.method)?.code ??
      till.find((m) => m.kind === payment.method)?.code ??
      payment.method
    );
  }

  /** The pharmacy's cash method code, for rows the till turns into cash. */
  private cashChannel(): string | null {
    return (this.tillMethods.value() ?? []).find((m) => m.kind === 'CASH')?.code ?? null;
  }

  /** Picks a registry method (sets how it is booked and its channel) or an internal one. */
  protected choose(index: number, value: string): void {
    if (this.locked()) {
      return;
    }
    const till = (this.tillMethods.value() ?? []).find((m) => m.code === value);
    const row = this.payments()[index]?.row;
    this.payments.update((list) =>
      list.map((p, i) =>
        i === index
          ? till
            ? { ...p, method: till.kind as PaymentMethod, channel: till.code, reference: null }
            : { ...p, method: value as PaymentMethod, channel: null, reference: null }
          : p,
      ),
    );
    if (row) {
      // Another method: a push sent for the old one no longer belongs to this row.
      this.push.update((all) => Object.fromEntries(Object.entries(all).filter(([r]) => r !== row)));
    }
  }

  protected setPhone(index: number, phone: string): void {
    const row = this.rowOf(index);
    if (!row || this.locked()) {
      return;
    }
    this.push.update((all) => ({
      ...all,
      [row]: { ...(all[row] ?? { request: null, busy: false, sale: null }), phone },
    }));
  }

  /** Waits between polls of a push; resolves at once when the page closes. */
  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.sleepers.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, ms);
      this.sleepers.add(wake);
    });
  }

  /** The page has closed: polls stop and late answers are dropped. */
  private closed = false;
  private readonly sleepers = new Set<() => void>();
  private readonly closeWatch = inject(DestroyRef).onDestroy(() => {
    this.closed = true;
    [...this.sleepers].forEach((wake) => wake());
  });

  /**
   * Sends a payment request to the customer's phone and waits for the provider's answer. The
   * request is bound to this sale (its cart token, also sent as `saleKey`: the sale's idempotency
   * key) and to the row it was sent from. Polling stops when the page closes, the sale on screen
   * changes, or the row is removed or given another method; a late answer is then dropped.
   */
  protected async sendToPhone(index: number): Promise<void> {
    if (this.locked()) {
      return;
    }
    const payment = this.payments()[index];
    const row = this.rowOf(index);
    const state = row ? this.push()[row] : undefined;
    if (!row || !payment?.channel || !state?.phone) {
      this.problem.set(this.translations.t('pos.phoneNeeded'));
      return;
    }
    const sale = this.cartId();
    const methodCode = payment.channel;
    const wanted = () =>
      !this.closed && pushWanted(this.payments(), this.cartId(), sale, row, methodCode);
    const set = (patch: Partial<PushState>) =>
      this.push.update((all) => (all[row] ? { ...all, [row]: { ...all[row], ...patch } } : all));
    this.push.update((all) => ({ ...all, [row]: { ...state, busy: true, sale, request: null } }));
    try {
      let request = await this.api.post<PaymentRequest>('/pos/payment-requests', {
        methodCode,
        amount: payment.amount,
        currency: payment.currency ?? this.base(),
        phone: state.phone,
        saleKey: this.idempotencyKey,
      });
      for (let i = 0; i < 60 && request.status === 'PENDING' && wanted(); i++) {
        set({ request, busy: true });
        await this.pause(2000);
        if (!wanted()) {
          break;
        }
        request = await this.api.get<PaymentRequest>(`/pos/payment-requests/${request.uid}`);
      }
      if (!wanted()) {
        return; // the sale or the row is gone: the answer belongs to nothing on screen
      }
      set({ request, busy: false });
      const applied =
        request.status === 'CONFIRMED'
          ? applyPush(this.payments(), this.cartId(), sale, row, request)
          : null;
      if (applied) {
        this.payments.set(applied);
        this.toasts.success(this.translations.t('pos.paymentConfirmed'));
      } else {
        this.problem.set(
          this.translations.t('pos.paymentNotConfirmed', { status: request.status }),
        );
      }
    } catch {
      set({ busy: false });
    }
  }
  /** A payment's value in the base currency, rounded to the base's minor units. */
  protected readonly baseValue = (payment: SalePayment): number =>
    baseValue(payment, this.baseDigits());
  private readonly customerLookup = viewChild<LookupComponent>('customerLookup');
  private readonly shiftBar = viewChild(ShiftBarComponent);
  /** The shift strip shows only when till shifts are switched on. */
  protected readonly tillShifts = TILL_SHIFTS_ENABLED;
  /** The quick cash amounts show only when switched on; Exact always shows. */
  protected readonly quickCashEnabled = QUICK_CASH_AMOUNTS_ENABLED;

  protected readonly q = signal('');
  protected readonly query = debounced(this.q, 200);
  protected readonly categoryUid = signal<string | null>(null);
  protected readonly categories = loaded<Category[]>(() =>
    this.session.can('catalogue.view') ? { path: '/categories', options: { silent: true } } : null,
  );
  protected readonly products = loaded<Page<SellableProduct>>(() =>
    this.session.branch() && this.query().trim().length >= MIN_SEARCH
      ? {
          path: '/pos/products',
          query: { q: this.query(), categoryUid: this.categoryUid(), limit: 60 },
        }
      : null,
  );

  protected readonly lines = signal<CartLine[]>([]);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly discountPercent = signal(0);
  protected readonly payments = signal<TillPayment[]>([
    { method: 'CASH', amount: 0, reference: null },
  ]);
  protected readonly prescription = signal<Prescription | null>(null);
  /** A photo or scan of the prescription, uploaded once the sale exists. */
  protected readonly prescriptionFile = signal<File | null>(null);

  /**
   * The sale on screen: its token (the parked sale's id; a mobile-money push is bound to it) and
   * its idempotency key. Both stay with the cart when it is parked and resumed, and across a
   * reload; only a new sale gets new ones.
   */
  protected readonly cartId = signal<string>(crypto.randomUUID());
  private idempotencyKey: string = crypto.randomUUID();

  /**
   * A checkout that got no clear answer (see {@link uncertain}): the exact request sent, to send
   * again byte for byte with the same key. While it is set the cart is locked: no edits, no
   * parking, no leaving the till, until the API answers or the cashier clears the till.
   */
  protected readonly pending = signal<CheckoutRequest | null>(null);
  /** When that checkout was first sent. */
  protected readonly pendingAt = signal<string | null>(null);
  /** Why the answer is unknown (no connection, no answer in time, a server error). */
  protected readonly pendingWhy = signal<string | null>(null);
  protected readonly locked = computed(() => this.pending() !== null);
  /** A problem with the last checkout, shown in the Payment card until dismissed or retried. */
  protected readonly problem = signal<string | null>(null);
  /** Sales made at this branch around the unconfirmed checkout ("Look it up"). */
  protected readonly lookup = signal<SaleSummary[] | null>(null);
  protected readonly lookupBusy = signal(false);
  protected readonly lookupMinutes = LOOKUP_MINUTES;
  private readonly pendingPanel = viewChild<ElementRef<HTMLElement>>('pendingPanel');
  /** Which checkout attempt is the latest, so an older one's answer does not settle it. */
  private attempt = 0;

  /**
   * The pricing plans for this customer: the one the sale takes by default (the insurer's, the
   * customer's or Normal Sale), every plan, and whether this person may switch.
   */
  protected readonly tillPlans = signal<TillPlans | null>(null);
  /** The plan picked by someone allowed to switch; null keeps the default. */
  protected readonly planPick = signal<string | null>(null);
  protected readonly planValue = computed(
    () => this.planPick() ?? this.tillPlans()?.defaultPlan.uid ?? 'NORMAL',
  );
  protected readonly planName = computed(() => {
    const plans = this.tillPlans();
    const value = this.planValue();
    const plan = plans?.plans.find((p) => (p.uid ?? 'NORMAL') === value);
    return !plan || !plan.uid ? this.translations.t('plans.normal') : plan.name;
  });
  private plansSeq = 0;
  private readonly plansWatch = effect(() => {
    const customerUid = this.customer()?.uid ?? null;
    const memberUid = this.useInsurance() ? (this.member()?.uid ?? null) : null;
    this.session.branch();
    const seq = ++this.plansSeq;
    untracked(() => this.planPick.set(null));
    const query: Record<string, string> = {};
    if (customerUid) query['customerUid'] = customerUid;
    if (memberUid) query['memberUid'] = memberUid;
    void this.api
      .get<TillPlans>('/pos/price-plans', query, { silent: true })
      .then((plans) => {
        if (seq === this.plansSeq) this.tillPlans.set(plans);
      })
      .catch(() => {
        if (seq === this.plansSeq) this.tillPlans.set(null);
      });
  });

  protected pickPlan(value: string): void {
    if (this.locked()) {
      return;
    }
    const fallback = this.tillPlans()?.defaultPlan.uid ?? 'NORMAL';
    this.planPick.set(value === fallback ? null : value);
  }

  /** A line the chosen plan has no price for: the sale will be refused. */
  protected unpriced(line: CartLine): boolean {
    return !!this.quoted()[line.product.productUid]?.unpriced;
  }

  /** The lines the chosen plan has no price for: Complete sale waits until they are dealt with. */
  protected readonly unpricedLines = computed(() =>
    this.lines().filter((line) => this.quoted()[line.product.productUid]?.unpriced),
  );

  /** "Change plan" beside the unpriced lines: puts the cursor on the plan select. */
  protected focusPlan(): void {
    const select = document.getElementById('pos-price-plan') as HTMLSelectElement | null;
    select?.focus();
    select?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }

  /** Prices the server quoted for this basket and customer (lists, branch prices, promotions). */
  protected readonly quoted = signal<Record<string, PricedLine>>({});
  protected readonly priceOf = (line: CartLine): number =>
    this.quoted()[line.product.productUid]?.unitPrice ?? line.product.sellingPrice;
  /** The pharmacy's prices include VAT: the till charges the shelf price and shows the VAT in it. */
  protected readonly taxIncluded = computed(
    () => this.settings.settings()?.pricesIncludeTax ?? false,
  );
  /** A line's share of the sale-wide discount, as cartTotals() works it out. */
  protected lineDiscount(line: CartLine): number {
    const rate = Math.min(Math.max(this.discountPercent() || 0, 0), 100);
    const digits = this.baseDigits();
    return percentOf(roundHalfUp(this.priceOf(line) * line.quantity, digits), rate, digits);
  }
  protected readonly totals = computed(() =>
    cartTotals(
      this.lines(),
      this.discountPercent(),
      this.priceOf,
      this.taxIncluded(),
      this.baseDigits(),
    ),
  );
  private quoteSeq = 0;
  /** Re-prices the basket whenever its products, quantities or customer change. */
  private readonly priceWatch = effect(() => {
    const lines = this.lines().map((l) => ({
      productUid: l.product.productUid,
      quantity: l.quantity,
    }));
    const customerUid = this.customer()?.uid ?? null;
    const memberUid = this.useInsurance() ? (this.member()?.uid ?? null) : null;
    const pricePlan = this.planPick();
    const seq = ++this.quoteSeq;
    if (!lines.length) {
      untracked(() => this.quoted.set({}));
      return;
    }
    void this.api
      .post<PricedLine[]>(
        '/pos/prices',
        { customerUid, memberUid, pricePlan, lines },
        { silent: true },
      )
      .then((priced) => {
        if (seq === this.quoteSeq) {
          this.quoted.set(Object.fromEntries(priced.map((p) => [p.productUid, p])));
          this.syncCash();
        }
      })
      .catch(() => {
        if (seq === this.quoteSeq) this.quoted.set({});
      });
  });
  /**
   * One unit's price of each product on screen for this customer at this branch (lists, branch
   * prices, promotions), so a card shows what the cart will charge. Re-quoted when the products
   * shown, the customer or the branch change; a failed quote just leaves the shelf price.
   */
  protected readonly cardPrices = signal<Record<string, PricedLine>>({});
  private cardSeq = 0;
  private readonly cardPriceWatch = effect(() => {
    const items = this.products.value()?.items ?? [];
    const customerUid = this.customer()?.uid ?? null;
    const memberUid = this.useInsurance() ? (this.member()?.uid ?? null) : null;
    const pricePlan = this.planPick();
    this.session.branch();
    const seq = ++this.cardSeq;
    if (!items.length) {
      untracked(() => this.cardPrices.set({}));
      return;
    }
    const lines = items.map((p) => ({ productUid: p.productUid, quantity: 1 }));
    void this.api
      .post<PricedLine[]>(
        '/pos/prices',
        { customerUid, memberUid, pricePlan, lines },
        { silent: true },
      )
      .then((priced) => {
        if (seq === this.cardSeq) {
          this.cardPrices.set(Object.fromEntries(priced.map((p) => [p.productUid, p])));
        }
      })
      .catch(() => {
        if (seq === this.cardSeq) this.cardPrices.set({});
      });
  });

  protected readonly paid = computed(() => paidTotal(this.payments(), this.baseDigits()));
  protected readonly change = computed(() =>
    changeDue(this.payments(), this.totals().total, this.baseDigits()),
  );
  protected readonly balance = computed(() => this.roundBase(this.totals().total - this.paid()));
  protected readonly rxNeeded = computed(() => needsPrescription(this.lines()));
  protected readonly maxDiscount = computed(
    () => this.settings.settings()?.maxDiscountPercent ?? 0,
  );

  protected readonly busy = signal(false);
  protected readonly rxOpen = signal(false);

  /** The chosen customer's account (credit available, deposits) and insurance cover today. */
  protected readonly account = signal<AccountView | null>(null);
  protected readonly member = signal<MemberView | null>(null);
  protected readonly coverage = signal<CoverageQuote | null>(null);
  protected readonly coverageError = signal<string | null>(null);
  protected readonly useInsurance = signal(true);
  protected readonly preauthNumber = signal('');
  protected readonly diagnosisCode = signal('');
  protected readonly balanceToAccount = signal(false);
  protected readonly excessToAccount = signal(false);
  protected readonly canCredit = computed(
    () => !!this.customer() && this.session.can('sales.credit'),
  );
  /** A card or mobile money overpayment beyond what cash can give back as change. */
  protected readonly nonCashExcess = computed(() => {
    const over = this.roundBase(this.paid() - this.totals().total);
    const cash = paidTotal(
      this.payments().filter((p) => p.method === 'CASH'),
      this.baseDigits(),
    );
    return Math.max(0, this.roundBase(over - cash));
  });
  private coverageTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly coverageWatch = effect(() => {
    const member = this.member();
    const lines = this.lines();
    const preauth = this.preauthNumber();
    clearTimeout(this.coverageTimer);
    if (!member || !this.useInsurance() || !lines.length) {
      this.coverage.set(null);
      return;
    }
    this.coverageTimer = setTimeout(() => void this.quote(member, preauth), 250);
  });
  protected readonly receipt = signal<Sale | null>(null);

  protected readonly rxForm = inject(FormBuilder).nonNullable.group({
    prescriberName: ['', Validators.required],
    prescriberRegistration: ['', Validators.required],
    reference: ['', Validators.required],
    patientName: ['', Validators.required],
    /** The day it was written: not in the future, and valid 6 months (STD-7, checked by the API). */
    prescriptionDate: ['', [Validators.required, notAfterToday]],
  });
  /** The latest prescription date the date picker offers. */
  protected readonly today = isoDay;

  /** The message under a prescription field once it was touched or the form was submitted. */
  protected rxErr(
    name:
      | 'prescriberName'
      | 'prescriberRegistration'
      | 'reference'
      | 'patientName'
      | 'prescriptionDate',
  ): string | null {
    return controlError(this.rxForm.controls[name]);
  }

  /** A controlled drug is in the cart: every prescription detail goes into the register. */
  protected readonly controlledInCart = computed(() =>
    this.lines().some((l) => l.product.schedule === 'CONTROLLED'),
  );

  protected readonly customerName = (c: Customer) => c.name;
  protected readonly customerDetail = (c: Customer) =>
    [c.code, c.phone, c.type].filter(Boolean).join(' · ');

  /** The serial-tracked product whose units are being chosen, if any. */
  protected readonly serialFor = signal<SellableProduct | null>(null);
  protected readonly serialsOnSale = computed(
    () =>
      this.lines().find((l) => l.product.productUid === this.serialFor()?.productUid)?.serials ??
      [],
  );

  /** Units the till can sell of a product: loose ones plus those in linked packs. */
  protected readonly available = available;

  // ---------------------------------------------------------------- entry row

  /**
   * The item picker works like select2: a box showing the chosen item; opening it drops down a
   * search field, and from the second letter the matching items. Choosing one fills the box and
   * moves to the quantity; Enter there (or Add) puts it in the cart.
   */
  private readonly pickerBox = viewChild<ElementRef<HTMLButtonElement>>('pickerBox');
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly qtyBox = viewChild<ElementRef<HTMLInputElement>>('qtyBox');
  /** Enough letters typed to search (and show the items). */
  protected readonly searching = computed(() => this.q().trim().length >= MIN_SEARCH);
  protected readonly suggestions = computed(() =>
    this.searching() ? (this.products.value()?.items ?? []).slice(0, SUGGESTIONS) : [],
  );
  protected readonly suggestOpen = signal(false);
  protected readonly highlight = signal(0);
  /** New results highlight the first item in stock (out-of-stock ones cannot be chosen). */
  private readonly highlightWatch = effect(() => {
    const list = this.suggestions();
    untracked(() =>
      this.highlight.set(
        Math.max(
          0,
          list.findIndex((p) => available(p) > 0),
        ),
      ),
    );
  });
  protected readonly entryQty = signal(1);
  /** The item chosen in the picker: what Add puts in the cart. */
  protected readonly chosen = signal<SellableProduct | null>(null);
  protected readonly entryProduct = this.chosen.asReadonly();
  protected readonly entryPrice = computed(() => {
    const product = this.entryProduct();
    return product ? (this.cardPrices()[product.productUid]?.unitPrice ?? product.sellingPrice) : 0;
  });
  /** When the sale on screen began (shown in the banner; the API numbers it once it is paid). */
  protected readonly startedAt = signal(new Date());

  protected search(value: string): void {
    this.q.set(value);
    this.highlight.set(0);
  }

  /** How tall the dropdown may grow. */
  protected readonly suggestMax = signal(DROPDOWN_HEIGHT);
  /**
   * Blank space under the till so the page can scroll the entry row up (an empty cart is short).
   * It only grows, so the page never jumps back when the dropdown closes.
   */
  protected readonly roomBelow = signal(0);

  /**
   * Opens the dropdown with the cursor in its search field, starting it with `typed` (a key pressed
   * on the closed box, or a scanner's first digit). Like select2 it always drops down under the
   * box, inside the entry; when the box sits low (the cards above push it down on a laptop) the
   * page first scrolls up so the whole dropdown is in view.
   */
  protected openPicker(typed = ''): void {
    if (!this.suggestOpen()) {
      this.q.set(typed);
      this.highlight.set(0);
      this.makeRoomBelow();
      this.suggestOpen.set(true);
    } else if (typed) {
      this.q.set(this.q() + typed);
    }
    setTimeout(() => this.searchBox()?.nativeElement.focus({ preventScroll: true }));
  }

  /** Scrolls the page so the box has a full dropdown's height under it. */
  private makeRoomBelow(): void {
    const box = this.pickerBox()?.nativeElement.getBoundingClientRect();
    if (!box) {
      return;
    }
    const short = box.bottom + DROPDOWN_HEIGHT + 16 - window.innerHeight;
    if (short <= 0) {
      return;
    }
    const scrollable = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    if (scrollable < short) {
      this.roomBelow.update((room) => room + short - scrollable);
    }
    setTimeout(() => window.scrollBy({ top: short, behavior: 'smooth' }));
  }

  /** Closes the dropdown; `refocus` puts the cursor back on the box (not when leaving it). */
  protected closePicker(refocus = true): void {
    if (!this.suggestOpen()) {
      return;
    }
    this.suggestOpen.set(false);
    this.q.set('');
    if (refocus) {
      setTimeout(() => this.pickerBox()?.nativeElement.focus());
    }
  }

  protected togglePicker(): void {
    if (this.suggestOpen()) {
      this.closePicker();
    } else {
      this.openPicker();
    }
  }

  /** On the closed box: typing opens the search with that letter; Enter adds the chosen item. */
  protected boxKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key.length === 1 && event.key !== ' ') {
      event.preventDefault();
      this.openPicker(event.key);
    } else if (event.key === 'Enter' && this.chosen()) {
      event.preventDefault();
      this.addFromEntry();
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.openPicker();
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      this.chosen.set(null);
    }
  }

  /** In the search field: arrows move, Enter chooses, Escape closes. */
  protected searchKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.step(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.step(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void this.pickFromSearch();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closePicker();
    } else if (event.key === 'Tab') {
      this.closePicker(false);
    }
  }

  /**
   * The mouse highlights the item under it, but only when it really moves: when the page scrolls
   * the dropdown under a still pointer, the highlight stays where the keyboard put it.
   */
  private pointer = { x: -1, y: -1 };
  protected notePointer(event: MouseEvent): void {
    this.pointer = { x: event.clientX, y: event.clientY };
  }
  protected hover(index: number, event: MouseEvent): void {
    if (event.clientX === this.pointer.x && event.clientY === this.pointer.y) {
      return;
    }
    this.pointer = { x: event.clientX, y: event.clientY };
    if (available(this.suggestions()[index]) > 0) {
      this.highlight.set(index);
    }
  }

  /** Moves the highlight to the next (or previous) item in stock. */
  private step(direction: 1 | -1): void {
    const list = this.suggestions();
    const count = list.length;
    let i = this.highlight();
    for (let tried = 0; tried < count; tried++) {
      i = (i + direction + count) % count;
      if (available(list[i]) > 0) {
        this.highlight.set(i);
        return;
      }
    }
  }

  /**
   * Enter in the search field. A scanned barcode or SKU that matches exactly goes straight into
   * the cart; otherwise the highlighted item is chosen. A scanner presses Enter before the list
   * has caught up, so then the API is asked directly.
   */
  private async pickFromSearch(): Promise<void> {
    const typed = this.q().trim();
    if (typed.length < MIN_SEARCH) {
      return;
    }
    let list = this.suggestions();
    if (this.q() !== this.query() || this.products.loading()) {
      const page = await this.api
        .get<Page<SellableProduct>>(
          '/pos/products',
          { q: typed, limit: SUGGESTIONS },
          { silent: true },
        )
        .catch(() => null);
      if (this.q().trim() !== typed) {
        return;
      }
      list = page?.items ?? [];
    }
    const code = typed.toLowerCase();
    const exact = list.find((p) => p.gtin === typed || (p.sku ?? '').toLowerCase() === code);
    if (exact) {
      if (available(exact) > 0) {
        this.chosen.set(exact);
        this.addFromEntry();
      }
      return;
    }
    const highlighted = list[Math.min(this.highlight(), list.length - 1)];
    const pick =
      highlighted && available(highlighted) > 0 ? highlighted : list.find((p) => available(p) > 0);
    if (pick) {
      this.chooseItem(pick);
    }
  }

  /** Fills the box with the item and moves to the quantity. */
  protected chooseItem(product: SellableProduct): void {
    this.chosen.set(product);
    this.suggestOpen.set(false);
    this.q.set('');
    setTimeout(() => {
      const qty = this.qtyBox()?.nativeElement;
      qty?.focus();
      qty?.select();
    });
  }

  protected setEntryQty(value: number): void {
    this.entryQty.set(Math.max(1, Math.floor(Number(value) || 1)));
  }

  /**
   * While the quantity is typed: keeps the price and line total current. A blank or zero box is
   * left alone (the change event settles it), so the box is not rewritten under the cashier.
   */
  protected typeEntryQty(value: string): void {
    const quantity = Math.floor(Number(value));
    if (quantity >= 1) {
      this.entryQty.set(quantity);
    }
  }

  /** Puts the chosen item in the cart at the entry quantity, then readies the box for the next. */
  protected addFromEntry(product: SellableProduct | null = this.entryProduct()): void {
    if (!product) {
      return;
    }
    this.add(product, this.entryQty());
    this.resetEntry();
  }

  /** The ✕ beside Add: drops the chosen item and quantity without adding anything. */
  protected clearEntry(): void {
    this.resetEntry();
  }

  /**
   * Empties the entry row and puts the cursor back on the item box. The quantity box is reset
   * directly too: after Enter the browser still fires its change event with the old number.
   */
  private resetEntry(): void {
    this.chosen.set(null);
    this.q.set('');
    this.entryQty.set(1);
    const qty = this.qtyBox()?.nativeElement;
    if (qty) {
      qty.value = '1';
    }
    this.highlight.set(0);
    this.suggestOpen.set(false);
    this.focusSearch();
  }

  /**
   * Puts the cursor on the item box, ready to type (or scan) the next item: on opening the till,
   * after each item and after the till's own dialogs close (UX-6). Not while a dialog is open, and
   * not when the cashier has meanwhile moved to another field.
   */
  protected focusSearch(): void {
    const before = document.activeElement;
    const attempt = (left: number) => {
      const box = this.pickerBox()?.nativeElement;
      const active = document.activeElement;
      const moved =
        active instanceof HTMLElement &&
        active !== before &&
        active !== document.body &&
        !!active.closest('input, select, textarea');
      if (!box || moved || this.closed) {
        return;
      }
      // A dialog just answered leaves the page at the next render; one still open keeps the focus.
      if (this.modalOpen() || document.querySelector('[aria-modal="true"]')) {
        if (left > 0) setTimeout(() => attempt(left - 1), 60);
        return;
      }
      box.focus({ preventScroll: true });
    };
    setTimeout(() => attempt(5));
  }

  /** Opening the till (by a link, the menu or a reload) puts the cursor on the item box (UX-6). */
  private readonly focusOnOpen = afterNextRender(() => this.focusSearch());

  /** One of the till's dialogs closed: the cursor goes back to the item box (UX-6). */
  protected closeParked(): void {
    this.parkedOpen.set(false);
    this.focusSearch();
  }

  protected closeRx(): void {
    this.rxOpen.set(false);
    this.focusSearch();
  }

  protected closeReceipt(): void {
    this.receipt.set(null);
    this.focusSearch();
  }

  /** Units at or below this show amber: running low at this branch. */
  protected readonly lowStock = 10;

  /** A time of day as the till shows it (10:42). */
  protected clock(at: Date): string {
    return at.toLocaleTimeString(this.translations.locale(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** An expiry as month and year (Aug 2029). */
  protected monthYear(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(this.translations.locale(), { month: 'short', year: 'numeric' });
  }

  protected walkIn(): void {
    this.pickCustomer(null);
    this.customerLookup()?.setText('');
  }

  // ---------------------------------------------------------------- quick new customer (UX-11)

  /** "New customer" at the till: a name and, if given, a phone; then attached to the sale. */
  protected readonly newCustomerOpen = signal(false);
  protected readonly newCustomerBusy = signal(false);
  protected readonly newCustomerForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    phone: ['', [Validators.pattern(/^\+?[0-9 ()-]{6,20}$/)]],
  });

  protected newCustomerErr(name: 'name' | 'phone'): string | null {
    return controlError(this.newCustomerForm.controls[name]);
  }

  protected openNewCustomer(): void {
    if (this.locked()) {
      return;
    }
    // What was typed in the search becomes the name: the cashier looked for them first.
    const typed = this.customer() ? '' : (this.customerLookup()?.typed() ?? '');
    this.newCustomerForm.reset({ name: typed.trim(), phone: '' });
    this.newCustomerOpen.set(true);
  }

  protected closeNewCustomer(): void {
    this.newCustomerOpen.set(false);
    this.focusSearch();
  }

  /** Creates the customer (`POST /customers`, a retail customer) and puts them on the sale. */
  protected async saveNewCustomer(): Promise<void> {
    if (this.newCustomerBusy() || this.locked() || !validate(this.newCustomerForm)) {
      return;
    }
    const value = this.newCustomerForm.getRawValue();
    this.newCustomerBusy.set(true);
    try {
      const customer = await this.api.post<Customer>(
        '/customers',
        {
          name: value.name.trim(),
          phone: value.phone.trim() || null,
          type: 'RETAIL',
          active: true,
        },
        { silent: true, noBranch: true },
      );
      this.pickCustomer(customer);
      this.customerLookup()?.setText(customer.name);
      this.toasts.success(this.translations.t('pos.customerCreated', { name: customer.name }));
      this.closeNewCustomer();
    } catch (failure) {
      if (!applyApiError(this.newCustomerForm, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.newCustomerBusy.set(false);
    }
  }

  // ---------------------------------------------------------------- announcements (A11Y-5)

  /**
   * What a screen reader hears when the sale changes (a polite live region): the total and the
   * number of lines and units, once the figures settle.
   */
  protected readonly totalAnnouncement = computed(() => {
    const totals = this.totals();
    if (!this.lines().length) {
      return this.translations.t('pos.cartIsEmpty');
    }
    return this.translations.t('pos.totalAnnounce', {
      total: formatMoney(totals.total, this.base()),
      lines: this.lines().length,
      units: totals.items,
    });
  });

  /** The id of an item in the picker's list, for aria-activedescendant. */
  protected optionId(index: number): string {
    return `till-option-${index}`;
  }

  /** The highlighted item's id while the list shows items, for the search field (combobox). */
  protected readonly activeOption = computed(() => {
    const list = this.suggestions();
    const index = this.highlight();
    return this.suggestOpen() && list.length && index < list.length ? this.optionId(index) : null;
  });

  // ---------------------------------------------------------------- batches

  /** Each product's batches at this branch, to show the one a line is sold from. */
  protected readonly batches = signal<Record<string, Batch[]>>({});

  private loadBatches(productUid: string): void {
    if (!this.session.can('inventory.view') || this.batches()[productUid]) {
      return;
    }
    void this.api
      .get<Batch[]>(`/stock/${productUid}/batches`, {}, { silent: true })
      .then((list) => this.batches.update((all) => ({ ...all, [productUid]: list })))
      .catch(() => undefined);
  }

  protected lineBatch(line: CartLine): LineBatch | null {
    return nextBatch(this.batches()[line.product.productUid] ?? [], line.quantity);
  }

  // ---------------------------------------------------------------- parked sales

  private readonly parkedStore = computed(() => {
    const tenant = this.session.tenant()?.uid;
    const branch = this.session.branch()?.uid;
    const user = this.session.user()?.uid;
    return tenant && branch && user ? parkedKey(tenant, branch, user) : null;
  });
  protected readonly parked = signal<ParkedSale[]>([]);
  /** The Sale list: every parked sale but the one on screen (an unconfirmed one stays stored). */
  protected readonly parkedList = computed(() =>
    this.parked().filter((p) => p.id !== this.cartId()),
  );
  protected readonly parkedOpen = signal(false);
  /**
   * Shared counter PCs (WEB-5): parked sales last until the end of the pharmacy's business day;
   * otherwise 12 hours. Read again when the setting or the time zone arrives.
   */
  private readonly parkedExpiry = computed<ParkedExpiry>(
    () => ({
      sharedPc: this.settings.settings()?.sharedCounterPcs ?? false,
      timeZone: this.settings.settings()?.timezone ?? null,
    }),
    { equal: (a, b) => a.sharedPc === b.sharedPc && a.timeZone === b.timeZone },
  );
  /**
   * Reads this cashier's parked sales at this branch, dropping expired ones and any personal data
   * an older version stored. An unconfirmed checkout comes back on screen, still locked.
   */
  private readonly parkedWatch = effect(() => {
    const key = this.parkedStore();
    const expiry = this.parkedExpiry();
    untracked(() => {
      const list = key ? readParked(this.storage(), key, Date.now(), expiry) : [];
      if (key) writeParked(this.storage(), key, list);
      this.parked.set(list);
      const waiting = list.find((p) => p.pending);
      if (waiting && !this.lines().length && !this.locked()) {
        void this.restore(waiting);
      }
    });
  });

  /** Customers' names for the Sale list, read from the API (storage keeps only their uids). */
  protected readonly parkedNames = signal<Record<string, string | undefined>>({});
  private readonly parkedNamesWatch = effect(() => {
    if (!this.parkedOpen() || !this.session.can('partners.view')) {
      return;
    }
    const known = untracked(this.parkedNames);
    const uids = [
      ...new Set(this.parkedList().flatMap((p) => (p.customerUid ? [p.customerUid] : []))),
    ].filter((uid) => !(uid in known));
    for (const uid of uids) {
      void this.api
        .get<Customer>(`/customers/${uid}`, {}, { silent: true, noBranch: true })
        .then((c) => this.parkedNames.update((all) => ({ ...all, [uid]: c.name })))
        .catch(() => undefined);
    }
  });

  private storage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private saveParked(list: ParkedSale[]): void {
    this.parked.set(list);
    const key = this.parkedStore();
    if (key) writeParked(this.storage(), key, list);
  }

  /**
   * Leaving the POS (another page, sign-out, another branch) never loses an unfinished sale: it is
   * parked in the Sale list, and the cashier picks it up from there on return. An unconfirmed
   * checkout keeps the cashier at the till instead: it is already stored with its key, and the
   * panel in the Payment card says what to do. (A sign-out the app forces, after the idle limit,
   * still goes ahead; the sale is back on screen after the next sign-in.)
   */
  private readonly leaveCheck = inject(DestroyRef).onDestroy(
    inject(LeaveGuard).register(async () => {
      if (this.locked()) {
        this.storePending();
        this.toasts.info(this.translations.t('pos.uncertain.stay'));
        this.showPending();
        return false;
      }
      if (this.parkCurrent()) {
        this.toasts.success(this.translations.t('pos.saleParked'));
      }
      return true;
    }),
  );

  /** Reloading or closing the tab parks the sale too (storage writes finish before the page goes). */
  protected parkBeforeUnload(): void {
    if (this.locked()) {
      this.storePending();
    } else {
      this.parkCurrent();
    }
  }

  /** Puts the sale on screen aside and starts a fresh one. */
  protected parkSale(): void {
    if (this.locked()) {
      this.showPending();
      return;
    }
    if (!this.parkCurrent()) {
      this.problem.set(this.translations.t('toast.addItem'));
      return;
    }
    this.toasts.success(this.translations.t('pos.saleParked'));
    this.focusSearch();
  }

  /** The sale on screen as storage keeps it: uids, codes and quantities, no names. */
  private snapshot(): ParkedSale {
    const pending = this.pending();
    return {
      id: this.cartId(),
      parkedAt: new Date().toISOString(),
      lines: this.lines().map((l): ParkedLine => ({
        productUid: l.product.productUid,
        sku: l.product.sku,
        quantity: l.quantity,
        ...(l.serials?.length ? { serials: [...l.serials] } : {}),
      })),
      customerUid: this.customer()?.uid ?? null,
      discountPercent: this.discountPercent(),
      total: this.totals().total,
      idempotencyKey: this.idempotencyKey,
      ...(pending ? { pending, pendingAt: this.pendingAt() } : {}),
    };
  }

  /** Moves the sale on screen to the Sale list and clears the screen; false when it is empty. */
  private parkCurrent(): boolean {
    if (!this.lines().length || this.locked()) {
      return false;
    }
    this.saveParked(park(this.parked(), this.snapshot()));
    this.clear();
    return true;
  }

  /**
   * Keeps the unconfirmed checkout on screen in storage too (as a parked sale with its request),
   * so a reload, a closed tab or a forced sign-out does not lose its key.
   */
  private storePending(): void {
    if (this.locked()) {
      const existing = this.parked().find((p) => p.id === this.cartId());
      this.saveParked(
        park(this.parked(), {
          ...this.snapshot(),
          parkedAt: existing?.parkedAt ?? new Date().toISOString(),
        }),
      );
    }
  }

  /** The checkout is settled (a sale came back, or a clear refusal): its stored copy goes. */
  private settlePending(): void {
    if (this.pending()) {
      this.saveParked(unpark(this.parked(), this.cartId()).rest);
    }
    this.pending.set(null);
    this.pendingAt.set(null);
    this.pendingWhy.set(null);
    this.lookup.set(null);
  }

  /** Brings the panel of the unconfirmed checkout into view and to the screen reader's attention. */
  private showPending(): void {
    setTimeout(() => {
      const panel = this.pendingPanel()?.nativeElement;
      panel?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      panel?.focus({ preventScroll: true });
    });
  }

  /** Brings a parked sale back; one already on screen is parked in its place. */
  protected async resume(id: string): Promise<void> {
    const sale = this.parked().find((p) => p.id === id);
    if (!sale || this.locked()) {
      if (this.locked()) this.showPending();
      return;
    }
    if (this.lines().length) {
      this.parkSale();
    }
    this.parkedOpen.set(false);
    await this.restore(sale);
  }

  /**
   * Puts a parked sale on screen: its key, and its products and customer read again from the API
   * (storage has only their uids). Products that can no longer be found are left out and said so.
   * An unconfirmed checkout comes back locked, showing what was sent.
   */
  private async restore(sale: ParkedSale): Promise<void> {
    const { found, failed } = await this.findProducts(sale.lines);
    let customerFailed = false;
    const customer = sale.customerUid
      ? await this.api
          .get<Customer>(`/customers/${sale.customerUid}`, {}, { silent: true, noBranch: true })
          .catch((failure: unknown) => {
            customerFailed = unreachable(failure);
            return null;
          })
      : null;
    if (this.closed || this.locked() || this.lines().length) {
      return; // something else came on screen meanwhile; the sale stays in the list
    }
    if (!sale.pending && (failed || customerFailed)) {
      // Nothing is dropped for want of a connection: the sale stays in the list for another try.
      this.problem.set(this.translations.t('pos.parkedNotLoaded'));
      return;
    }
    this.clear();
    this.cartId.set(sale.id);
    this.idempotencyKey = sale.idempotencyKey;
    const lines: CartLine[] = [];
    let missing = 0;
    for (const line of sale.lines) {
      const product = found.get(line.productUid);
      if (product) {
        lines.push({
          product,
          quantity: line.quantity,
          ...(line.serials ? { serials: line.serials } : {}),
        });
      } else if (sale.pending) {
        // Shown as sent; the request itself is what goes again, not this screen.
        lines.push({
          product: placeholder(line),
          quantity: line.quantity,
          ...(line.serials ? { serials: line.serials } : {}),
        });
      } else {
        missing++;
      }
    }
    this.discountPercent.set(sale.discountPercent);
    if (sale.pending) {
      this.pending.set(sale.pending);
      this.pendingAt.set(sale.pendingAt ?? sale.parkedAt);
      this.pendingWhy.set(null);
      this.payments.set(sale.pending.payments.map((p) => ({ ...p })));
      this.prescription.set(sale.pending.prescription);
      this.lines.set(lines);
      if (customer) {
        this.customer.set(customer);
        this.customerLookup()?.setText(customer.name);
      }
      this.showPending();
    } else {
      this.saveParked(unpark(this.parked(), sale.id).rest);
      this.lines.set(lines);
      if (customer) {
        this.pickCustomer(customer);
        this.customerLookup()?.setText(customer.name);
      } else if (sale.customerUid) {
        this.problem.set(this.translations.t('pos.parkedCustomerGone'));
      }
      if (missing) {
        this.problem.set(this.translations.t('pos.parkedItemsGone', { count: missing }));
      }
      this.syncCash();
      this.focusSearch();
    }
    lines.forEach((l) => this.loadBatches(l.product.productUid));
  }

  /**
   * The products of parked lines, read again by their uids at this branch (with today's stock),
   * 100 at a time (`GET /pos/products?uids=`, Batch 8). `failed` when the API could not be asked
   * (no connection, a server error), as opposed to a product it no longer sells here.
   */
  private async findProducts(
    lines: readonly ParkedLine[],
  ): Promise<{ found: Map<string, SellableProduct>; failed: boolean }> {
    const found = new Map<string, SellableProduct>();
    let failed = false;
    const uids = [...new Set(lines.map((l) => l.productUid))];
    for (let i = 0; i < uids.length; i += 100) {
      const page = await this.api
        .get<Page<SellableProduct>>(
          '/pos/products',
          { uids: uids.slice(i, i + 100).join(',') },
          { silent: true },
        )
        .catch((failure: unknown) => {
          failed ||= unreachable(failure);
          return null;
        });
      for (const product of page?.items ?? []) {
        found.set(product.productUid, product);
      }
    }
    return { found, failed };
  }

  protected async discard(id: string): Promise<void> {
    const sale = this.parked().find((p) => p.id === id);
    const ok = await this.confirm.ask({
      title: this.translations.t('pos.confirmDiscardParked'),
      text: this.translations.t(
        sale?.pending ? 'pos.uncertain.discardText' : 'pos.discardParkedText',
      ),
      icon: 'danger',
      confirmText: this.translations.t('pos.discard'),
    });
    if (ok) {
      if (sale && !sale.pending) {
        this.reportTillEvent('PARKED_DISCARDED', sale.lines.length, sale.total);
      }
      this.saveParked(unpark(this.parked(), id).rest);
    }
  }

  /**
   * FRD-20: tells the server about a sale that did not happen (a cart cancelled with lines on it, a
   * parked sale thrown away), for the managers' no-sale report. Best effort: the till never waits
   * for it, and a failure (offline, no permission) changes nothing on screen.
   */
  private reportTillEvent(
    kind: 'CART_CANCELLED' | 'CART_CLEARED' | 'PARKED_DISCARDED' | 'NO_SALE',
    lines: number,
    value: number,
  ): void {
    if (!this.session.branch()) {
      return;
    }
    void this.api
      .post('/till-events', { kind, lines, value: Math.max(value, 0) }, { silent: true })
      .catch(() => undefined);
  }

  /** A new sale: what is on screen is parked, not lost. */
  protected newSale(): void {
    if (this.locked()) {
      this.showPending();
    } else if (this.lines().length) {
      this.parkSale();
    } else {
      this.clear();
      this.focusSearch();
    }
  }

  protected async cancelSale(): Promise<void> {
    if (this.locked()) {
      await this.clearPending();
      return;
    }
    if (
      this.lines().length &&
      !(await this.confirm.ask({
        title: this.translations.t('pos.confirmCancelSale'),
        text: this.translations.t('pos.cancelSaleText'),
        icon: 'danger',
        confirmText: this.translations.t('pos.cancelSale'),
        cancelText: this.translations.t('pos.keepSale'),
      }))
    ) {
      return;
    }
    if (this.lines().length) {
      this.reportTillEvent('CART_CANCELLED', this.lines().length, this.totals().total);
    }
    this.clear();
    this.focusSearch();
  }

  // ---------------------------------------------------------------- shortcuts

  private modalOpen(): boolean {
    return (
      this.rxOpen() ||
      !!this.receipt() ||
      !!this.serialFor() ||
      this.parkedOpen() ||
      this.newCustomerOpen() ||
      !!this.confirm.current()
    );
  }

  /** F2 search, F4 park, F9 complete the sale. */
  protected shortcut(event: KeyboardEvent): void {
    if (!this.session.branch() || this.modalOpen()) {
      return;
    }
    if (event.key === 'F2') {
      event.preventDefault();
      this.openPicker();
    } else if (event.key === 'F4') {
      event.preventDefault();
      this.parkSale();
    } else if (event.key === 'F9') {
      event.preventDefault();
      void (this.locked() ? this.checkAgain() : this.checkout());
    }
  }

  protected add(product: SellableProduct, quantity = 1): void {
    if (this.locked()) {
      this.showPending();
      return;
    }
    if (available(product) <= 0) {
      this.toasts.error(this.translations.t('toast.outOfStock', { name: product.name }));
      return;
    }
    if (product.requiresSerialAtSale) {
      this.serialFor.set(product);
      return;
    }
    const before =
      this.lines().find((l) => l.product.productUid === product.productUid)?.quantity ?? 0;
    const wanted = before + Math.max(1, quantity);
    let lines = addToCart(this.lines(), product);
    if (wanted > before + 1) {
      lines = setQuantity(lines, product.productUid, wanted);
    }
    this.lines.set(lines);
    if (wanted > available(product)) {
      this.toasts.info(
        this.translations.t('toast.onlyOnHand', {
          count: available(product),
          name: product.name,
        }),
      );
    }
    this.loadBatches(product.productUid);
    this.syncCash();
  }

  protected typeOf(product: SellableProduct) {
    return productTypeOf(product.productType);
  }

  protected pickedSerials(serials: string[]): void {
    const product = this.serialFor();
    if (product && !this.locked()) {
      this.lines.set(withSerials(this.lines(), product, serials));
      this.loadBatches(product.productUid);
      this.syncCash();
    }
    this.closeSerials();
  }

  protected closeSerials(): void {
    this.serialFor.set(null);
    this.focusSearch();
  }

  /**
   * A line's quantity as typed or stepped. It is clamped to what the till can sell, and the box
   * then shows the quantity kept (not the rejected number), with a note under it saying why
   * (UX-5). A blank box puts the quantity back; zero removes the line.
   */
  protected setQty(line: CartLine, quantity: number | string, input?: HTMLInputElement): void {
    if (this.locked()) {
      return;
    }
    if (line.serials) {
      this.serialFor.set(line.product);
      return;
    }
    const uid = line.product.productUid;
    const typed = typeof quantity === 'string' ? quantity.trim() : String(quantity);
    const wanted = Math.floor(Number(typed));
    if (typed === '' || !Number.isFinite(wanted)) {
      if (input) input.value = String(line.quantity);
      return;
    }
    const lines = setQuantity(this.lines(), uid, wanted);
    const kept = lines.find((l) => l.product.productUid === uid)?.quantity ?? 0;
    this.lines.set(lines);
    if (input && kept > 0) {
      input.value = String(kept);
    }
    this.qtyNote.set(
      kept > 0 && wanted > kept
        ? {
            productUid: uid,
            text: this.translations.t('pos.qtyClamped', { count: kept, name: line.product.name }),
          }
        : null,
    );
    this.syncCash();
  }

  /** Why a line's quantity is not what was typed (UX-5), shown under its box until the next edit. */
  protected readonly qtyNote = signal<{ productUid: string; text: string } | null>(null);
  /** Why the discount is not what was typed (UX-5). */
  protected readonly discountNote = signal<string | null>(null);

  protected pickCustomer(customer: Customer | null): void {
    if (this.locked()) {
      return;
    }
    this.customer.set(customer);
    this.account.set(null);
    this.member.set(null);
    this.coverage.set(null);
    this.balanceToAccount.set(false);
    this.excessToAccount.set(false);
    if (customer) {
      void this.loadCredit(customer.uid);
    }
  }

  /** The customer's account and insurance; either may be missing, which is not an error. */
  private async loadCredit(customerUid: string): Promise<void> {
    const [account, member] = await Promise.allSettled([
      this.api.get<AccountView>(
        `/receivables/accounts/${customerUid}`,
        {},
        { silent: true, noBranch: true },
      ),
      this.api.get<MemberView>(
        '/insurance/members/current',
        { customerUid },
        { silent: true, noBranch: true },
      ),
    ]);
    if (this.customer()?.uid !== customerUid) {
      return;
    }
    this.account.set(account.status === 'fulfilled' ? account.value : null);
    this.member.set(member.status === 'fulfilled' ? member.value : null);
    this.useInsurance.set(true);
  }

  private async quote(member: MemberView, preauth: string): Promise<void> {
    try {
      const quote = await this.api.post<CoverageQuote>(
        '/pos/coverage-quote',
        {
          memberUid: member.uid,
          lines: this.lines().map((l) => ({
            productUid: l.product.productUid,
            quantity: l.quantity,
          })),
          preauthNumber: preauth || null,
        },
        { silent: true },
      );
      this.coverage.set(quote);
      this.coverageError.set(null);
      this.applyCoverage(quote);
    } catch (failure) {
      this.coverage.set(null);
      this.coverageError.set((failure as Error).message);
    }
  }

  /** The insurer's share as an INSURANCE payment, and the patient's share on the first tender. */
  private applyCoverage(quote: CoverageQuote): void {
    if (this.locked()) {
      return; // what was sent is what is shown
    }
    const others = this.payments().filter((p) => p.method !== 'INSURANCE');
    const first = others[0] ?? { method: 'CASH' as PaymentMethod, amount: 0, reference: null };
    const insurance: SalePayment[] =
      quote.covered > 0 ? [{ method: 'INSURANCE', amount: quote.covered, reference: null }] : [];
    this.payments.set([
      ...insurance,
      { ...first, amount: this.roundBase(quote.patientPays) },
      ...others.slice(1),
    ]);
  }

  protected toggleInsurance(on: boolean): void {
    if (this.locked()) {
      return;
    }
    this.useInsurance.set(on);
    if (!on) {
      this.payments.update((list) => {
        const rest = list.filter((p) => p.method !== 'INSURANCE');
        return rest.length
          ? rest
          : [{ method: 'CASH', amount: this.totals().total, reference: null }];
      });
      this.syncCash();
    }
  }

  /**
   * The sale-wide discount, from 0 to 100 %. A number outside is clamped, the box shows the
   * percentage kept and a note says so (UX-5). Above the pharmacy's maximum a manager approves
   * when the sale is completed (Batch 4).
   */
  protected setDiscount(value: number | string, input?: HTMLInputElement): void {
    if (this.locked()) {
      return;
    }
    const typed = Number(typeof value === 'string' ? value.trim() || 0 : value);
    const wanted = Number.isFinite(typed) ? typed : 0;
    const kept = Math.min(Math.max(wanted, 0), 100);
    this.discountPercent.set(kept);
    if (input) {
      input.value = String(kept);
    }
    this.discountNote.set(
      kept !== wanted ? this.translations.t('pos.discountClamped', { value: kept }) : null,
    );
    this.syncCash();
  }

  protected setMethod(index: number, method: PaymentMethod): void {
    if (this.locked()) {
      return;
    }
    this.payments.update((list) => list.map((p, i) => (i === index ? { ...p, method } : p)));
  }

  protected setAmount(index: number, amount: number): void {
    if (this.locked()) {
      return;
    }
    this.payments.update((list) =>
      list.map((p, i) => (i === index ? { ...p, amount: Number(amount) || 0 } : p)),
    );
  }

  /**
   * The currencies a payment may be in: the base first. On a plan without multiple currencies only
   * the base is offered, even while the settings still list others (the API refuses foreign
   * tenders there, and offering them led to a sale that could not complete).
   */
  protected readonly accepted = computed(() => {
    const all = this.settings.settings()?.acceptedCurrencies ?? [this.settings.currency()];
    return this.subscription.allows('MULTI_CURRENCY') || this.session.isRoot()
      ? all
      : all.filter((c) => c === this.settings.currency());
  });
  protected readonly base = this.settings.currency;

  /** An amount in the base currency, rounded half-up to its minor units, as the API rounds it. */
  private roundBase(value: number): number {
    return roundHalfUp(value, this.baseDigits());
  }

  /**
   * Switches a payment to another accepted currency at today's rate, keeping its base value. With
   * no rate the payment stays as it was, and so does the select: a native select keeps showing the
   * picked option unless it is put back, which once let TZS show while USD was recorded.
   */
  protected async setCurrency(index: number, select: HTMLSelectElement): Promise<void> {
    const currency = select.value;
    const payment = this.payments()[index];
    if (this.locked() || !payment) {
      select.value = payment?.currency ?? this.base();
      return;
    }
    const baseNow = this.baseValue(payment);
    if (currency === this.base()) {
      this.patchPayment(index, { currency: null, exchangeRate: null, amount: baseNow });
      return;
    }
    try {
      const latest = await this.api.get<LatestRate>(
        '/fx/rates/latest',
        { base: currency, quote: this.base() },
        { silent: true, noBranch: true },
      );
      if (latest.stale) {
        this.toasts.info(
          this.translations.t('toast.staleRate', { currency, date: latest.effectiveOn }),
        );
      }
      const amount = coveringAmount(baseNow, latest.rate, minorUnits(currency), this.baseDigits());
      this.patchPayment(index, { currency, exchangeRate: latest.rate, amount });
    } catch {
      select.value = this.payments()[index]?.currency ?? this.base();
      this.toasts.error(this.translations.t('toast.noRate', { currency }));
    }
  }

  /**
   * Quick-cash amounts in the first payment's currency: for each common note, the smallest
   * multiple of it that covers what is still due, so the chips fit USD, KES and TZS alike.
   */
  protected readonly quickAmounts = computed(() => {
    const first = this.payments()[0];
    const currency = first?.currency ?? this.base();
    const rate = first?.exchangeRate ?? 1;
    const due =
      Math.max(this.totals().total - paidTotal(this.payments().slice(1), this.baseDigits()), 0) /
      rate;
    const notes = NOTES[currency] ?? [1, 5, 10, 20, 50, 100];
    const amounts = new Set<number>();
    for (const note of notes) {
      const amount = Math.max(Math.ceil(due / note), 1) * note;
      if (amount > due + 1e-9) amounts.add(amount);
      if (amounts.size === 4) break;
    }
    return [...amounts].sort((a, b) => a - b);
  });

  private patchPayment(index: number, patch: Partial<TillPayment>): void {
    this.payments.update((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  protected setReference(index: number, reference: string): void {
    if (this.locked()) {
      return;
    }
    this.payments.update((list) =>
      list.map((p, i) => (i === index ? { ...p, reference: reference || null } : p)),
    );
  }

  protected addPayment(): void {
    if (this.locked()) {
      return;
    }
    const remaining = Math.max(this.balance(), 0);
    this.payments.update((list) => [...list, splitPayment(this.tillMethods.value(), remaining)]);
  }

  protected removePayment(index: number): void {
    if (this.locked()) {
      return;
    }
    this.payments.update((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  protected quickCash(amount: number): void {
    if (this.locked()) {
      return;
    }
    this.payments.update((list) =>
      list.map((p, i) =>
        i === 0
          ? { ...p, method: 'CASH', channel: this.cashChannel(), reference: null, amount }
          : p,
      ),
    );
  }

  /** The first payment set to exactly what is still due, worked in whole minor units. */
  protected exact(): void {
    const payments = this.payments();
    const digits = minorUnits(payments[0]?.currency ?? this.base());
    this.setAmount(0, exactTender(this.totals().total, payments, digits, this.baseDigits()));
  }

  /** Empties the screen for a new sale, with a new token and key; never while one is unconfirmed. */
  protected clear(): void {
    if (this.locked()) {
      return;
    }
    this.cartId.set(crypto.randomUUID());
    this.push.set({});
    this.problem.set(null);
    this.lines.set([]);
    this.customer.set(null);
    this.customerLookup()?.setText('');
    this.discountPercent.set(0);
    this.prescription.set(null);
    this.prescriptionFile.set(null);
    this.rxForm.reset();
    this.payments.set([{ method: 'CASH', amount: 0, reference: null }]);
    this.idempotencyKey = crypto.randomUUID();
    this.account.set(null);
    this.member.set(null);
    this.coverage.set(null);
    this.coverageError.set(null);
    this.preauthNumber.set('');
    this.diagnosisCode.set('');
    this.balanceToAccount.set(false);
    this.excessToAccount.set(false);
    this.startedAt.set(new Date());
    this.entryQty.set(1);
    this.chosen.set(null);
    this.qtyNote.set(null);
    this.discountNote.set(null);
  }

  protected savePrescription(): void {
    if (!validate(this.rxForm)) {
      this.toasts.error(
        this.translations.t(
          this.controlledInCart() ? 'pos.controlledRxIncomplete' : 'till.rxIncomplete',
        ),
      );
      return;
    }
    const rx = this.rxForm.getRawValue();
    const controlled = this.lines().some((l) => l.product.schedule === 'CONTROLLED');
    if (
      controlled &&
      ![rx.prescriberName, rx.prescriberRegistration, rx.reference, rx.patientName].every((v) =>
        String(v ?? '').trim(),
      )
    ) {
      this.toasts.error(this.translations.t('pos.controlledRxIncomplete'));
      return;
    }
    this.prescription.set(rx);
    this.rxOpen.set(false);
    void this.checkout();
  }

  /**
   * Completes the sale: checks it, asks for confirmation with its figures, then sends it. A
   * problem is shown in the Payment card (and stays there), not in a passing toast.
   */
  protected async checkout(): Promise<void> {
    if (this.busy()) {
      return; // a second click before the first one's request has come back
    }
    if (this.locked()) {
      return this.checkAgain();
    }
    const t = (key: string, params?: Parameters<Translations['t']>[1]) =>
      this.translations.t(key, params);
    const refuse = (message: string) => {
      this.problem.set(message);
    };
    this.problem.set(null);
    const lines = this.lines();
    if (!lines.length) {
      return refuse(t('toast.addItem'));
    }
    if (this.unpricedLines().length) {
      return refuse(t('pos.unpricedBlock', { plan: this.planName() }));
    }
    if (this.rxNeeded() && !this.prescription()) {
      this.rxOpen.set(true);
      return;
    }
    const payments = this.payments().filter((p) => p.amount > 0);
    if (needsCustomer(payments.map((p) => p.method)) && !this.customer()) {
      return refuse(t('toast.customerNeeded'));
    }
    const short = this.roundBase(this.totals().total - paidTotal(payments, this.baseDigits()));
    if (short > 0 && !this.balanceToAccount()) {
      return refuse(t('toast.paymentsShort'));
    }
    const account = this.account();
    if (short > 0 && this.balanceToAccount() && account && short > account.available) {
      return refuse(
        t('toast.creditAvailable', { amount: formatMoney(account.available, this.base()) }),
      );
    }
    if (this.member()?.requiresPreauth && this.useInsurance() && !this.preauthNumber()) {
      return refuse(t('toast.preauthNeeded'));
    }
    // Each payment at its base value (paidTotal converts the foreign ones once).
    const tendered = paidTotal(payments, this.baseDigits());
    if (
      this.change() > 0 &&
      tendered > Math.max(this.totals().total * 5, this.totals().total + 100) &&
      !(await this.confirm.ask({
        title: t('pos.checkChange'),
        text: t('confirm.largeChange', {
          tendered: formatMoney(tendered, this.base()),
          change: formatMoney(this.change(), this.base()),
        }),
        icon: 'warning',
        confirmText: t('pos.changeIsRight'),
      }))
    ) {
      return;
    }
    const money = (value: number) => formatMoney(value, this.base());
    const sure = await this.confirm.ask({
      title: t('pos.confirmComplete'),
      text: t('pos.confirmCompleteText'),
      details: [
        {
          label: t('pos.items'),
          value: t('pos.linesAndUnits', { lines: lines.length, units: this.totals().items }),
        },
        { label: t('pos.total'), value: money(this.totals().total) },
        { label: t('pos.paid'), value: money(this.paid()) },
        ...(this.change() > 0 ? [{ label: t('pos.change'), value: money(this.change()) }] : []),
      ],
      icon: 'question',
      confirmText: t('ui.l.completeSale'),
    });
    if (!sure || this.busy() || this.locked()) {
      return;
    }
    const request: CheckoutRequest = {
      idempotencyKey: this.idempotencyKey,
      customerUid: this.customer()?.uid ?? null,
      pricePlan: this.planPick(),
      discountPercent: this.discountPercent(),
      lines: lines.map((l) => ({
        productUid: l.product.productUid,
        quantity: l.quantity,
        serialNumbers: l.serials,
      })),
      payments: forApi(payments),
      prescription: this.rxNeeded() ? this.prescription() : null,
      memberUid: this.useInsurance() ? (this.member()?.uid ?? null) : null,
      preauthNumber: this.preauthNumber() || null,
      diagnosisCode: this.diagnosisCode() || null,
      balanceToAccount: this.balanceToAccount(),
      excessToAccount: this.excessToAccount(),
    };
    await this.send(request);
  }

  /** "Check again": the unconfirmed checkout sent again, the same key and the same body. */
  protected async checkAgain(): Promise<void> {
    const request = this.pending();
    if (request && !this.busy()) {
      await this.send(request);
    }
  }

  /**
   * Sends a checkout and settles what came back. A sale: the receipt. A clear refusal: the
   * message in the Payment card, and the cart can be changed (nothing was recorded, so the key may
   * be used again). No clear answer: the cart locks on this exact request, which is stored with
   * the sale so a reload or a parked copy sends the very same thing. The till stops waiting after
   * {@link CHECKOUT_TIMEOUT_MS}, but an answer that comes later still completes the sale.
   */
  private async send(request: CheckoutRequest): Promise<void> {
    const attempt = ++this.attempt;
    const cart = this.cartId();
    let late = false;
    this.busy.set(true);
    this.problem.set(null);
    const call = this.api.post<Sale>('/sales', request, {
      headers: { 'Idempotency-Key': request.idempotencyKey },
      silent: true,
    });
    call.then(
      (sale) => {
        if (late && !this.closed && this.pending()?.idempotencyKey === request.idempotencyKey) {
          this.completed(sale);
        }
      },
      () => undefined,
    );
    try {
      const sale = await new Promise<Sale>((resolve, reject) => {
        // While a dialog the request opened is waiting for the person (a manager's approval,
        // "Open your shift", "Confirm it is you"), the request has not gone yet: keep waiting.
        const arm = (): ReturnType<typeof setTimeout> =>
          setTimeout(() => {
            if (document.querySelector('[aria-modal="true"]')) {
              timer = arm();
              return;
            }
            late = true;
            reject(new CheckoutTimeout());
          }, CHECKOUT_TIMEOUT_MS);
        let timer = arm();
        call.then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (failure: unknown) => {
            clearTimeout(timer);
            reject(failure);
          },
        );
      });
      if (!this.closed && cart === this.cartId()) {
        this.completed(sale);
      }
    } catch (failure) {
      if (this.closed || cart !== this.cartId() || attempt !== this.attempt) {
        return;
      }
      const error = failure as Partial<ApiError>;
      if (uncertain(failure)) {
        this.pending.set(request);
        this.pendingAt.update((at) => at ?? new Date().toISOString());
        this.pendingWhy.set(
          this.translations.t(
            failure instanceof CheckoutTimeout
              ? 'pos.uncertain.timeout'
              : error.status === 0 || error.reason === 'network_error'
                ? 'pos.uncertain.network'
                : 'pos.uncertain.server',
          ),
        );
        this.storePending();
        this.showPending();
      } else {
        this.settlePending();
        this.problem.set(
          error.reason === 'dispense_not_allowed'
            ? this.translations.t('pos.dispenseNotAllowed')
            : error.message || this.translations.t('pos.checkoutFailed'),
        );
        // A prescription detail refused (incomplete, dated ahead, older than 6 months): its field
        // shows why, and the prescription opens again to correct it.
        if (error.field?.startsWith('prescription') && applyApiError(this.rxForm, failure)) {
          this.prescription.set(null);
          this.rxOpen.set(true);
        }
      }
    } finally {
      if (attempt === this.attempt) {
        this.busy.set(false);
      }
    }
  }

  /** The sale exists: its receipt, and a fresh till. */
  private completed(sale: Sale): void {
    this.settlePending();
    this.receipt.set(sale);
    void this.attachPrescription(sale.uid, this.prescriptionFile());
    this.toasts.success(this.translations.t('toast.saleCompleted', { number: sale.number }));
    this.clear();
    void this.products.reload();
    this.shiftBar()?.refresh();
  }

  /**
   * "Look it up": the sales made at this branch from a few minutes before the unconfirmed checkout
   * was first sent, newest first, to see whether it went through. Each opens in a new tab, so the
   * till (which may not be left meanwhile) stays as it is.
   */
  protected async lookUp(): Promise<void> {
    if (!this.session.can('sales.view')) {
      this.problem.set(this.translations.t('pos.uncertain.noSalesView'));
      return;
    }
    const at = Date.parse(this.pendingAt() ?? '') || Date.now();
    this.lookupBusy.set(true);
    try {
      // The exact sale first: the API finds a sale by the key it was sent with (Batch 8).
      const key = this.pending()?.idempotencyKey;
      const exact = key
        ? await this.api
            .get<Page<SaleSummary>>('/sales', { idempotencyKey: key }, { silent: true })
            .catch(() => null)
        : null;
      if (exact?.items.length) {
        this.lookup.set(exact.items);
        return;
      }
      const page = await this.api.get<Page<SaleSummary>>(
        '/sales',
        { since: new Date(at - LOOKUP_MINUTES * 60_000).toISOString(), limit: 20 },
        { silent: true },
      );
      this.lookup.set(page.items);
    } catch (failure) {
      this.problem.set((failure as Error).message);
    } finally {
      this.lookupBusy.set(false);
    }
  }

  /** A sale in the lookup with the same total as the unconfirmed one: likely the same sale. */
  protected likelyMatch(sale: SaleSummary): boolean {
    return this.roundBase(sale.total) === this.totals().total;
  }

  /**
   * "Clear the till": gives up on the unconfirmed checkout, once the cashier has found the sale in
   * the history or is sure it was not recorded. Its key goes with it.
   */
  protected async clearPending(): Promise<void> {
    if (!this.locked()) {
      return;
    }
    const ok = await this.confirm.ask({
      title: this.translations.t('pos.uncertain.clearTitle'),
      text: this.translations.t('pos.uncertain.clearText'),
      icon: 'danger',
      confirmText: this.translations.t('pos.uncertain.clearConfirm'),
      cancelText: this.translations.t('pos.keepSale'),
    });
    if (ok && this.locked() && !this.busy()) {
      this.settlePending();
      this.clear();
      this.focusSearch();
    }
  }

  /** Attaches the prescription image to the sale; the sale stands even if this fails. */
  private async attachPrescription(saleUid: string, file: File | null): Promise<void> {
    if (!file) {
      return;
    }
    try {
      await this.files.upload(file, {
        ownerType: 'SALE',
        ownerUid: saleUid,
        purpose: 'PRESCRIPTION',
      });
    } catch {
      this.toasts.error(this.translations.t('toast.prescriptionNotAttached'));
    }
  }

  protected print(): void {
    window.print();
  }

  /** Keeps the single cash row equal to the total until the cashier types an amount. */
  private syncCash(): void {
    if (this.locked()) {
      return;
    }
    const list = this.payments();
    if (list.length === 1 && list[0].method === 'CASH') {
      this.payments.set([{ ...list[0], amount: this.totals().total }]);
    }
  }
}

/**
 * A product of an unconfirmed checkout that could not be read again (no connection after a
 * reload): shown by its code, as it was sent. The locked cart never changes it.
 */
function placeholder(line: ParkedLine): SellableProduct {
  return {
    productUid: line.productUid,
    name: line.sku ?? '—',
    genericName: null,
    sku: line.sku,
    gtin: null,
    dosageForm: null,
    strength: null,
    categoryUid: null,
    categoryName: null,
    schedule: 'OTC',
    sellingPrice: 0,
    taxRatePercent: 0,
    quantityOnHand: line.quantity,
    productType: 'MEDICINE',
    trackingMode: 'QUANTITY',
    unitOfMeasure: 'PIECE',
    requiresSerialAtSale: false,
  };
}

/** A failure that says nothing about the record: no connection, or the server failed. */
function unreachable(failure: unknown): boolean {
  const status = (failure as { status?: unknown } | null)?.status;
  return typeof status !== 'number' || status <= 0 || status >= 500;
}
