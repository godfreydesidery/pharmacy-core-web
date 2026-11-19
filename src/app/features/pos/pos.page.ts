import { LatestRate, PaymentRequest, PricedLine, TillMethod } from '../../core/api/models';
import { formatMoney, minorUnits } from '../../core/format/format';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  untracked,
  effect,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
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
  SellableProduct,
} from '../../core/api/models';
import { debounced, loaded } from '../../core/data/data';
import { SettingsStore } from '../../core/format/settings.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { controlError, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
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
  round2,
  setQuantity,
  splitPayment,
  withSerials,
} from './cart';
import { SerialPickerComponent } from './serial-picker.component';
import { ShiftBarComponent } from './shift-bar.component';
import { productTypeOf } from '../../core/ui/product-types';
import { ReceiptComponent } from './receipt.component';
import { FilesService } from '../../core/files/files.service';
import { UploadComponent } from '../../core/files/upload.component';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { AccountView, CoverageQuote, MemberView } from '../../core/api/credit.models';
import { Translations } from '../../core/i18n/translations.store';
import { SubscriptionStore } from '../../core/subscription/subscription.store';
import { LineBatch, nextBatch } from './fefo';
import { ParkedSale, park, parkedKey, readParked, unpark, writeParked } from './parked';

/** How many suggestions the entry row offers under the search box. */
const SUGGESTIONS = 8;

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
  host: { '(document:keydown)': 'shortcut($event)' },
})
export default class PosPage {
  protected readonly session = inject(SessionStore);
  protected readonly settings = inject(SettingsStore);
  private readonly subscription = inject(SubscriptionStore);
  private readonly api = inject(Api);
  private readonly files = inject(FilesService);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly methods = METHODS;
  /** The methods this pharmacy accepts at the till, from the payment registry. */
  protected readonly tillMethods = loaded<TillMethod[]>(() =>
    this.session.branch() ? { path: '/pos/payment-methods' } : null,
  );
  /** Methods only the system books (insurance, on account, account credit). */
  protected readonly internalMethods = METHODS.filter((m) =>
    ['INSURANCE', 'CREDIT', 'ACCOUNT_CREDIT'].includes(m.method),
  );
  /** The phone number and pending request of each payment row pushed to a phone. */
  protected readonly push = signal<
    Record<number, { phone: string; request: PaymentRequest | null; busy: boolean }>
  >({});

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
    const till = (this.tillMethods.value() ?? []).find((m) => m.code === value);
    this.payments.update((list) =>
      list.map((p, i) =>
        i === index
          ? till
            ? { ...p, method: till.kind as PaymentMethod, channel: till.code, reference: null }
            : { ...p, method: value as PaymentMethod, channel: null, reference: null }
          : p,
      ),
    );
    this.push.update((all) => ({ ...all, [index]: { phone: '', request: null, busy: false } }));
  }

  protected setPhone(index: number, phone: string): void {
    this.push.update((all) => ({
      ...all,
      [index]: { ...(all[index] ?? { request: null, busy: false }), phone },
    }));
  }

  /** Sends a payment request to the customer's phone and waits for the provider's answer. */
  protected async sendToPhone(index: number): Promise<void> {
    const payment = this.payments()[index];
    const state = this.push()[index];
    if (!payment?.channel || !state?.phone) {
      this.toasts.error(this.translations.t('pos.phoneNeeded'));
      return;
    }
    this.push.update((all) => ({ ...all, [index]: { ...state, busy: true } }));
    try {
      let request = await this.api.post<PaymentRequest>('/pos/payment-requests', {
        methodCode: payment.channel,
        amount: payment.amount,
        currency: payment.currency ?? this.base(),
        phone: state.phone,
      });
      for (let i = 0; i < 60 && request.status === 'PENDING'; i++) {
        this.push.update((all) => ({ ...all, [index]: { ...state, request, busy: true } }));
        await new Promise((r) => setTimeout(r, 2000));
        request = await this.api.get<PaymentRequest>(`/pos/payment-requests/${request.uid}`);
      }
      this.push.update((all) => ({ ...all, [index]: { ...state, request, busy: false } }));
      if (request.status === 'CONFIRMED') {
        this.setReference(index, request.uid);
        this.toasts.success(this.translations.t('pos.paymentConfirmed'));
      } else {
        this.toasts.error(
          this.translations.t('pos.paymentNotConfirmed', { status: request.status }),
        );
      }
    } catch {
      this.push.update((all) => ({ ...all, [index]: { ...state, busy: false } }));
    }
  }
  protected readonly baseValue = baseValue;
  private readonly customerLookup = viewChild<LookupComponent>('customerLookup');
  private readonly shiftBar = viewChild(ShiftBarComponent);

  protected readonly q = signal('');
  private readonly query = debounced(this.q, 200);
  protected readonly categoryUid = signal<string | null>(null);
  protected readonly categories = loaded<Category[]>(() =>
    this.session.can('catalogue.view') ? { path: '/categories', options: { silent: true } } : null,
  );
  protected readonly products = loaded<Page<SellableProduct>>(() =>
    this.session.branch()
      ? {
          path: '/pos/products',
          query: { q: this.query(), categoryUid: this.categoryUid(), limit: 60 },
        }
      : null,
  );

  protected readonly lines = signal<CartLine[]>([]);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly discountPercent = signal(0);
  protected readonly payments = signal<SalePayment[]>([
    { method: 'CASH', amount: 0, reference: null },
  ]);
  protected readonly prescription = signal<Prescription | null>(null);
  /** A photo or scan of the prescription, uploaded once the sale exists. */
  protected readonly prescriptionFile = signal<File | null>(null);
  private idempotencyKey = crypto.randomUUID();

  /** Prices the server quoted for this basket and customer (lists, branch prices, promotions). */
  protected readonly quoted = signal<Record<string, PricedLine>>({});
  protected readonly priceOf = (line: CartLine): number =>
    this.quoted()[line.product.productUid]?.unitPrice ?? line.product.sellingPrice;
  protected readonly totals = computed(() =>
    cartTotals(this.lines(), this.discountPercent(), this.priceOf),
  );
  private quoteSeq = 0;
  /** Re-prices the basket whenever its products, quantities or customer change. */
  private readonly priceWatch = effect(() => {
    const lines = this.lines().map((l) => ({
      productUid: l.product.productUid,
      quantity: l.quantity,
    }));
    const customerUid = this.customer()?.uid ?? null;
    const seq = ++this.quoteSeq;
    if (!lines.length) {
      untracked(() => this.quoted.set({}));
      return;
    }
    void this.api
      .post<PricedLine[]>('/pos/prices', { customerUid, lines }, { silent: true })
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
    this.session.branch();
    const seq = ++this.cardSeq;
    if (!items.length) {
      untracked(() => this.cardPrices.set({}));
      return;
    }
    const lines = items.map((p) => ({ productUid: p.productUid, quantity: 1 }));
    void this.api
      .post<PricedLine[]>('/pos/prices', { customerUid, lines }, { silent: true })
      .then((priced) => {
        if (seq === this.cardSeq) {
          this.cardPrices.set(Object.fromEntries(priced.map((p) => [p.productUid, p])));
        }
      })
      .catch(() => {
        if (seq === this.cardSeq) this.cardPrices.set({});
      });
  });

  protected readonly paid = computed(() => paidTotal(this.payments()));
  protected readonly change = computed(() => changeDue(this.payments(), this.totals().total));
  protected readonly balance = computed(() => round2(this.totals().total - this.paid()));
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
    const over = round2(this.paid() - this.totals().total);
    const cash = paidTotal(this.payments().filter((p) => p.method === 'CASH'));
    return Math.max(0, round2(over - cash));
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
  });

  /** The message under a prescription field once it was touched or the form was submitted. */
  protected rxErr(
    name: 'prescriberName' | 'prescriberRegistration' | 'reference' | 'patientName',
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

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  /** The suggestions under the search box, and the one Enter will add. */
  protected readonly suggestions = computed(() =>
    (this.products.value()?.items ?? []).slice(0, SUGGESTIONS),
  );
  protected readonly suggestOpen = signal(false);
  protected readonly highlight = signal(0);
  protected readonly entryQty = signal(1);
  /** The item Enter will add: none until the cashier searches or opens the suggestions. */
  protected readonly entryProduct = computed<SellableProduct | null>(() =>
    this.q().trim() || this.suggestOpen()
      ? (this.suggestions()[Math.min(this.highlight(), this.suggestions().length - 1)] ?? null)
      : null,
  );
  protected readonly entryPrice = computed(() => {
    const product = this.entryProduct();
    return product ? (this.cardPrices()[product.productUid]?.unitPrice ?? product.sellingPrice) : 0;
  });
  /** When the sale on screen began (shown in the banner; the API numbers it once it is paid). */
  protected readonly startedAt = signal(new Date());

  protected search(value: string): void {
    this.q.set(value);
    this.highlight.set(0);
    this.suggestOpen.set(true);
  }

  /** Arrows move through the suggestions, Enter adds the highlighted one, Escape closes them. */
  protected searchKey(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.suggestOpen.set(true);
      this.highlight.set(count ? (this.highlight() + 1) % count : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlight.set(count ? (this.highlight() - 1 + count) % count : 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.addFromEntry();
    } else if (event.key === 'Escape') {
      this.suggestOpen.set(false);
    }
  }

  protected setEntryQty(value: number): void {
    this.entryQty.set(Math.max(1, Math.floor(Number(value) || 1)));
  }

  /** Adds the highlighted suggestion at the entry quantity, then readies the box for the next. */
  protected addFromEntry(product: SellableProduct | null = this.entryProduct()): void {
    if (!product) {
      return;
    }
    this.add(product, this.entryQty());
    this.q.set('');
    this.entryQty.set(1);
    this.highlight.set(0);
    this.suggestOpen.set(false);
    this.focusSearch();
  }

  protected focusSearch(): void {
    this.searchBox()?.nativeElement.focus();
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
  protected readonly parkedOpen = signal(false);
  private readonly parkedWatch = effect(() => {
    const key = this.parkedStore();
    untracked(() => this.parked.set(key ? readParked(this.storage(), key) : []));
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

  /** Puts the sale on screen aside and starts a fresh one. */
  protected parkSale(): void {
    if (!this.lines().length) {
      this.toasts.error(this.translations.t('toast.addItem'));
      return;
    }
    this.saveParked(
      park(this.parked(), {
        id: crypto.randomUUID(),
        parkedAt: new Date().toISOString(),
        lines: this.lines(),
        customer: this.customer(),
        discountPercent: this.discountPercent(),
        total: this.totals().total,
      }),
    );
    this.clear();
    this.toasts.success(this.translations.t('pos.saleParked'));
    this.focusSearch();
  }

  /** Brings a parked sale back; one already on screen is parked in its place. */
  protected resume(id: string): void {
    const { sale, rest } = unpark(this.parked(), id);
    if (!sale) {
      return;
    }
    this.saveParked(rest);
    if (this.lines().length) {
      this.parkSale();
    }
    this.clear();
    this.lines.set(sale.lines);
    this.discountPercent.set(sale.discountPercent);
    if (sale.customer) {
      this.pickCustomer(sale.customer);
      this.customerLookup()?.setText(sale.customer.name);
    }
    sale.lines.forEach((l) => this.loadBatches(l.product.productUid));
    this.syncCash();
    this.parkedOpen.set(false);
    this.focusSearch();
  }

  protected discard(id: string): void {
    this.saveParked(unpark(this.parked(), id).rest);
  }

  /** A new sale: what is on screen is parked, not lost. */
  protected newSale(): void {
    if (this.lines().length) {
      this.parkSale();
    } else {
      this.clear();
      this.focusSearch();
    }
  }

  protected cancelSale(): void {
    if (this.lines().length && !window.confirm(this.translations.t('pos.confirmCancelSale'))) {
      return;
    }
    this.clear();
    this.focusSearch();
  }

  // ---------------------------------------------------------------- shortcuts

  private modalOpen(): boolean {
    return this.rxOpen() || !!this.receipt() || !!this.serialFor() || this.parkedOpen();
  }

  /** F2 search, F4 park, F9 complete the sale. */
  protected shortcut(event: KeyboardEvent): void {
    if (!this.session.branch() || this.modalOpen()) {
      return;
    }
    if (event.key === 'F2') {
      event.preventDefault();
      this.focusSearch();
    } else if (event.key === 'F4') {
      event.preventDefault();
      this.parkSale();
    } else if (event.key === 'F9') {
      event.preventDefault();
      void this.checkout();
    }
  }

  protected add(product: SellableProduct, quantity = 1): void {
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
    if (product) {
      this.lines.set(withSerials(this.lines(), product, serials));
      this.loadBatches(product.productUid);
      this.syncCash();
    }
    this.serialFor.set(null);
  }

  protected setQty(line: CartLine, quantity: number): void {
    if (line.serials) {
      this.serialFor.set(line.product);
      return;
    }
    this.lines.set(setQuantity(this.lines(), line.product.productUid, quantity));
    this.syncCash();
  }

  protected pickCustomer(customer: Customer | null): void {
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
    const others = this.payments().filter((p) => p.method !== 'INSURANCE');
    const first = others[0] ?? { method: 'CASH' as PaymentMethod, amount: 0, reference: null };
    const insurance: SalePayment[] =
      quote.covered > 0 ? [{ method: 'INSURANCE', amount: quote.covered, reference: null }] : [];
    this.payments.set([
      ...insurance,
      { ...first, amount: round2(quote.patientPays) },
      ...others.slice(1),
    ]);
  }

  protected toggleInsurance(on: boolean): void {
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

  protected setDiscount(value: number): void {
    const max = this.maxDiscount();
    this.discountPercent.set(Math.min(Math.max(Number(value) || 0, 0), max));
    this.syncCash();
  }

  protected setMethod(index: number, method: PaymentMethod): void {
    this.payments.update((list) => list.map((p, i) => (i === index ? { ...p, method } : p)));
  }

  protected setAmount(index: number, amount: number): void {
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

  /**
   * Switches a payment to another accepted currency at today's rate, keeping its base value. With
   * no rate the payment stays as it was, and so does the select: a native select keeps showing the
   * picked option unless it is put back, which once let TZS show while USD was recorded.
   */
  protected async setCurrency(index: number, select: HTMLSelectElement): Promise<void> {
    const currency = select.value;
    const payment = this.payments()[index];
    const baseNow = baseValue(payment);
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
      const digits = minorUnits(currency);
      const amount = Math.ceil((baseNow / latest.rate) * 10 ** digits) / 10 ** digits;
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
    const due = Math.max(this.totals().total - paidTotal(this.payments().slice(1)), 0) / rate;
    const notes = NOTES[currency] ?? [1, 5, 10, 20, 50, 100];
    const amounts = new Set<number>();
    for (const note of notes) {
      const amount = Math.max(Math.ceil(due / note), 1) * note;
      if (amount > due + 1e-9) amounts.add(amount);
      if (amounts.size === 4) break;
    }
    return [...amounts].sort((a, b) => a - b);
  });

  private patchPayment(index: number, patch: Partial<SalePayment>): void {
    this.payments.update((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  protected setReference(index: number, reference: string): void {
    this.payments.update((list) =>
      list.map((p, i) => (i === index ? { ...p, reference: reference || null } : p)),
    );
  }

  protected addPayment(): void {
    const remaining = Math.max(this.balance(), 0);
    this.payments.update((list) => [...list, splitPayment(this.tillMethods.value(), remaining)]);
  }

  protected removePayment(index: number): void {
    this.payments.update((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  protected quickCash(amount: number): void {
    this.payments.update((list) =>
      list.map((p, i) =>
        i === 0
          ? { ...p, method: 'CASH', channel: this.cashChannel(), reference: null, amount }
          : p,
      ),
    );
  }

  protected exact(): void {
    const others = paidTotal(this.payments().slice(1));
    const due = Math.max(round2(this.totals().total - others), 0);
    const first = this.payments()[0];
    const rate = first?.exchangeRate ?? 1;
    const digits = minorUnits(first?.currency ?? this.base());
    this.setAmount(0, Math.ceil((due / rate) * 10 ** digits) / 10 ** digits);
  }

  protected clear(): void {
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

  protected async checkout(): Promise<void> {
    if (this.busy()) {
      return; // a second click before the first one's request has come back
    }
    const lines = this.lines();
    if (!lines.length) {
      this.toasts.error(this.translations.t('toast.addItem'));
      return;
    }
    if (this.rxNeeded() && !this.prescription()) {
      this.rxOpen.set(true);
      return;
    }
    const payments = this.payments().filter((p) => p.amount > 0);
    if (needsCustomer(payments.map((p) => p.method)) && !this.customer()) {
      this.toasts.error(this.translations.t('toast.customerNeeded'));
      return;
    }
    const short = round2(this.totals().total - paidTotal(payments));
    if (short > 0 && !this.balanceToAccount()) {
      this.toasts.error(this.translations.t('toast.paymentsShort'));
      return;
    }
    const account = this.account();
    if (short > 0 && this.balanceToAccount() && account && short > account.available) {
      this.toasts.error(
        this.translations.t('toast.creditAvailable', {
          amount: formatMoney(account.available, this.base()),
        }),
      );
      return;
    }
    if (this.member()?.requiresPreauth && this.useInsurance() && !this.preauthNumber()) {
      this.toasts.error(this.translations.t('toast.preauthNeeded'));
      return;
    }
    const tendered = paidTotal(payments.map((p) => ({ ...p, amount: baseValue(p) })));
    if (
      this.change() > 0 &&
      tendered > Math.max(this.totals().total * 5, this.totals().total + 100) &&
      !window.confirm(
        this.translations.t('confirm.largeChange', {
          tendered: formatMoney(tendered, this.base()),
          change: formatMoney(this.change(), this.base()),
        }),
      )
    ) {
      return;
    }
    const request: CheckoutRequest = {
      idempotencyKey: this.idempotencyKey,
      customerUid: this.customer()?.uid ?? null,
      discountPercent: this.discountPercent(),
      lines: lines.map((l) => ({
        productUid: l.product.productUid,
        quantity: l.quantity,
        serialNumbers: l.serials,
      })),
      payments,
      prescription: this.rxNeeded() ? this.prescription() : null,
      memberUid: this.useInsurance() ? (this.member()?.uid ?? null) : null,
      preauthNumber: this.preauthNumber() || null,
      diagnosisCode: this.diagnosisCode() || null,
      balanceToAccount: this.balanceToAccount(),
      excessToAccount: this.excessToAccount(),
    };
    this.busy.set(true);
    try {
      const sale = await this.api.post<Sale>('/sales', request, {
        headers: { 'Idempotency-Key': this.idempotencyKey },
      });
      this.receipt.set(sale);
      void this.attachPrescription(sale.uid, this.prescriptionFile());
      this.toasts.success(this.translations.t('toast.saleCompleted', { number: sale.number }));
      this.clear();
      void this.products.reload();
      this.shiftBar()?.refresh();
    } finally {
      this.busy.set(false);
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
    const list = this.payments();
    if (list.length === 1 && list[0].method === 'CASH') {
      this.payments.set([{ ...list[0], amount: this.totals().total }]);
    }
  }
}
