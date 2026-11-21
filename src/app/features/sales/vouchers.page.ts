import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Voucher } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';

/** Sales → Vouchers: sell prepaid vouchers and gift cards, and see their balances. */
@Component({
  selector: 'app-vouchers',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'vouchers.title' | t }}</h1>
          <p class="sub">{{ 'vouchers.sub' | t }}</p>
        </div>
        @if (session.can('sales.sell') && session.branch()) {
          <div class="actions">
            <button class="btn primary" type="button" (click)="open.set(true)">
              <app-icon name="plus" [size]="16" /> {{ 'vouchers.sell' | t }}
            </button>
          </div>
        }
      </div>
      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>{{ 'vouchers.code' | t }}</th>
              <th>{{ 'vouchers.holder' | t }}</th>
              <th class="right">{{ 'vouchers.value' | t }}</th>
              <th class="right">{{ 'vouchers.balance' | t }}</th>
              <th>{{ 'vouchers.expires' | t }}</th>
              <th>{{ 'vouchers.status' | t }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (v of vouchers.value() ?? []; track v.uid) {
              <tr>
                <td class="mono strong">{{ v.code }}</td>
                <td>{{ v.holderName ?? '—' }}</td>
                <td class="right">{{ v.initialValue | money }}</td>
                <td class="right">{{ v.balance | money }}</td>
                <td>{{ v.expiresOn ?? '—' }}</td>
                <td>{{ 'vouchers.status.' + v.status | t }}</td>
                <td class="right">
                  @if (v.status === 'ACTIVE' && session.can('sales.refund')) {
                    <button class="btn sm ghost" type="button" (click)="voidVoucher(v)">
                      {{ 'vouchers.void' | t }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">{{ 'vouchers.none' | t }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [open]="open()" [title]="'vouchers.sell' | t" (closed)="open.set(false)">
      <div class="form-grid">
        <div class="field">
          <label>{{ 'vouchers.value' | t }}</label>
          <input class="input" type="number" min="0" step="any" #value />
        </div>
        <div class="field">
          <label>{{ 'vouchers.paidBy' | t }}</label>
          <select class="select" #paidBy>
            @for (m of paidByOptions; track m) {
              <option [value]="m">{{ 'ui.pay.' + m | t: null : m }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'vouchers.holder' | t }}</label>
          <input class="input" #holder />
        </div>
        <div class="field">
          <label>{{ 'vouchers.expires' | t }}</label>
          <input class="input" type="date" #expires />
        </div>
        <div class="field full">
          <label>{{ 'vouchers.code' | t }}</label>
          <input class="input mono" #code [placeholder]="'vouchers.codeAuto' | t" />
        </div>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'vouchers.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          [disabled]="busy()"
          (click)="issue(+value.value, paidBy.value, holder.value, expires.value, code.value)"
        >
          {{ 'vouchers.sell' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class VouchersPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly confirm = inject(ConfirmService);
  protected readonly paidByOptions = ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'];
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly vouchers = loaded<Voucher[]>(() => ({ path: '/vouchers' }));

  protected async issue(
    value: number,
    paidBy: string,
    holderName: string,
    expiresOn: string,
    code: string,
  ): Promise<void> {
    if (!(value > 0)) {
      this.toasts.error(this.translations.t('vouchers.valueNeeded'));
      return;
    }
    this.busy.set(true);
    try {
      const v = await this.api.post<Voucher>('/vouchers', {
        value,
        paidBy,
        holderName: holderName || null,
        expiresOn: expiresOn || null,
        code: code || null,
      });
      this.toasts.success(this.translations.t('vouchers.issued', { code: v.code }));
      this.open.set(false);
      void this.vouchers.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async voidVoucher(v: Voucher): Promise<void> {
    if (
      !(await this.confirm.ask({
        title: this.translations.t('common.areYouSure'),
        text: this.translations.t('vouchers.confirmVoid', { code: v.code }),
        icon: 'danger',
      }))
    ) {
      return;
    }
    await this.api.post(`/vouchers/${v.uid}/void`, {});
    this.toasts.success(this.translations.t('till.voucherVoided', { code: v.code }));
    void this.vouchers.reload();
  }
}
