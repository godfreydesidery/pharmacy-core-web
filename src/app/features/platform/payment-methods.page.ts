import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { PaymentKind, PaymentMethodType } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

const KINDS: PaymentKind[] = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'VOUCHER'];
const ADAPTERS = ['NONE', 'MANUAL', 'SIMULATOR', 'MPESA', 'MIXX', 'AIRTEL', 'SELCOM', 'AZAMPAY'];

/**
 * Platform → Payment methods: the registry every pharmacy chooses from, each method's kind (how it
 * is booked) and adapter (none, a typed reference, or a provider that pushes to the phone).
 */
@Component({
  selector: 'app-platform-payment-methods',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'payments.registryTitle' | t }}</h1>
          <p class="sub">{{ 'payments.registrySub' | t }}</p>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" (click)="edit(null)">
            <app-icon name="plus" [size]="16" /> {{ 'payments.newMethod' | t }}
          </button>
        </div>
      </div>
      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>{{ 'payments.method' | t }}</th>
              <th>{{ 'payments.kind' | t }}</th>
              <th>{{ 'payments.adapter' | t }}</th>
              <th>{{ 'payments.connection' | t }}</th>
              <th class="right">{{ 'payments.enabled' | t }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (m of registry.value() ?? []; track m.code) {
              <tr>
                <td>
                  <b>{{ m.name }}</b
                  ><small class="muted block mono">{{ m.code }}</small>
                </td>
                <td>{{ 'payments.kind.' + m.kind | t }}</td>
                <td class="mono">{{ m.adapter }}</td>
                <td>
                  @if (m.pushAvailable) {
                    <span class="badge green">{{ 'payments.pushReady' | t }}</span>
                  } @else if (m.adapter !== 'NONE' && m.adapter !== 'MANUAL') {
                    <span class="badge amber">{{ 'payments.notConnected' | t }}</span>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
                <td class="right">{{ (m.enabled ? 'payments.yes' : 'payments.no') | t }}</td>
                <td class="right">
                  <button class="btn sm" type="button" (click)="edit(m)">
                    {{ 'payments.edit' | t }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="muted mt">{{ 'payments.notConnectedHint' | t }}</p>
    </div>

    <app-modal [open]="!!draft()" [title]="'payments.method' | t" (closed)="draft.set(null)">
      @if (draft(); as d) {
        <div class="form-grid">
          <div class="field">
            <label>{{ 'payments.code' | t }}</label>
            <input
              class="input mono"
              [value]="d.code"
              [readOnly]="!!d.uid"
              (input)="d.code = $any($event.target).value"
            />
          </div>
          <div class="field">
            <label>{{ 'payments.name' | t }}</label>
            <input class="input" [value]="d.name" (input)="d.name = $any($event.target).value" />
          </div>
          <div class="field">
            <label>{{ 'payments.kind' | t }}</label>
            <select class="select" [value]="d.kind" (change)="d.kind = $any($event.target).value">
              @for (k of kinds; track k) {
                <option [value]="k" [selected]="k === d.kind">
                  {{ 'payments.kind.' + k | t }}
                </option>
              }
            </select>
          </div>
          <div class="field">
            <label>{{ 'payments.adapter' | t }}</label>
            <select
              class="select"
              [value]="d.adapter"
              (change)="d.adapter = $any($event.target).value"
            >
              @for (a of adapters; track a) {
                <option [value]="a" [selected]="a === d.adapter">{{ a }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>{{ 'payments.order' | t }}</label>
            <input
              class="input"
              type="number"
              [value]="d.sortOrder"
              (input)="d.sortOrder = +$any($event.target).value"
            />
          </div>
          <label class="check">
            <input
              type="checkbox"
              [checked]="d.requiresReference"
              (change)="d.requiresReference = $any($event.target).checked"
            />
            {{ 'payments.requiresReference' | t }}
          </label>
          <label class="check">
            <input
              type="checkbox"
              [checked]="d.enabled"
              (change)="d.enabled = $any($event.target).checked"
            />
            {{ 'payments.enabled' | t }}
          </label>
        </div>
      }
      <ng-container footer>
        <button class="btn" type="button" (click)="draft.set(null)">
          {{ 'payments.cancel' | t }}
        </button>
        <button class="btn primary" type="button" (click)="save()">
          {{ 'payments.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class PlatformPaymentMethodsPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly kinds = KINDS;
  protected readonly adapters = ADAPTERS;
  protected readonly registry = loaded<PaymentMethodType[]>(() => ({
    path: '/platform/payment-methods',
    options: { noBranch: true },
  }));
  protected readonly draft = signal<
    (Omit<PaymentMethodType, 'uid' | 'pushAvailable'> & { uid: string | null }) | null
  >(null);

  protected edit(m: PaymentMethodType | null): void {
    this.draft.set({
      uid: m?.uid ?? null,
      code: m?.code ?? '',
      name: m?.name ?? '',
      kind: m?.kind ?? 'MOBILE_MONEY',
      adapter: m?.adapter ?? 'MANUAL',
      requiresReference: m?.requiresReference ?? true,
      enabled: m?.enabled ?? true,
      sortOrder: m?.sortOrder ?? 100,
    });
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (!d) {
      return;
    }
    await this.api.put('/platform/payment-methods', d, { noBranch: true });
    this.toasts.success(this.translations.t('payments.saved'));
    this.draft.set(null);
    void this.registry.reload();
  }
}
