import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { TillMethod } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

/**
 * Administration → Payment methods: which of the platform's methods this pharmacy accepts at the
 * till, the label cashiers see, and the merchant details (paybill, till number, bank account).
 */
@Component({
  selector: 'app-payment-methods',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'payments.title' | t }}</h1>
          <p class="sub">{{ 'payments.sub' | t }}</p>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'payments.method' | t }}</th>
                <th>{{ 'payments.kind' | t }}</th>
                <th>{{ 'payments.label' | t }}</th>
                <th>{{ 'payments.account' | t }}</th>
                <th>{{ 'payments.connection' | t }}</th>
                <th class="right">{{ 'payments.accepted' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (m of methods.value() ?? []; track m.code) {
                <tr>
                  <td>
                    <b>{{ m.name }}</b
                    ><small class="muted block mono">{{ m.code }}</small>
                  </td>
                  <td>{{ 'payments.kind.' + m.kind | t }}</td>
                  <td>
                    <input
                      class="input sm"
                      [value]="m.label"
                      (change)="save(m, { label: $any($event.target).value })"
                    />
                  </td>
                  <td>
                    <input
                      class="input sm"
                      [value]="m.accountReference ?? ''"
                      [placeholder]="'payments.accountHint' | t"
                      (change)="save(m, { accountReference: $any($event.target).value })"
                    />
                  </td>
                  <td>
                    @if (m.push) {
                      <span class="badge green">{{ 'payments.pushReady' | t }}</span>
                    } @else if (m.adapter !== 'NONE' && m.adapter !== 'MANUAL') {
                      <span class="badge amber" [title]="'payments.notConnectedHint' | t">{{
                        'payments.notConnected' | t
                      }}</span>
                    } @else {
                      <span class="muted">{{
                        (m.requiresReference ? 'payments.byReference' : 'payments.manual') | t
                      }}</span>
                    }
                  </td>
                  <td class="right">
                    <label class="switch">
                      <input
                        type="checkbox"
                        [checked]="m.enabled"
                        (change)="save(m, { enabled: $any($event.target).checked })"
                      /><span></span>
                    </label>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export default class PaymentMethodsPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly methods = loaded<TillMethod[]>(() => ({
    path: '/payment-methods',
    options: { noBranch: true },
  }));

  protected async save(
    m: TillMethod,
    change: Partial<{ label: string; accountReference: string; enabled: boolean }>,
  ): Promise<void> {
    await this.api.put(
      '/payment-methods',
      {
        methodCode: m.code,
        label: change.label ?? (m.label === m.name ? null : m.label),
        accountReference: change.accountReference ?? m.accountReference,
        enabled: change.enabled ?? m.enabled,
      },
      { noBranch: true },
    );
    this.toasts.success(this.translations.t('payments.saved'));
    void this.methods.reload();
  }
}
