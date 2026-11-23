import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Expense, ExpenseCategory } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';
import { OverdrawWarningComponent } from './overdraw-warning.component';

const CATEGORIES: ExpenseCategory[] = [
  'RENT',
  'UTILITIES',
  'SALARIES',
  'TRANSPORT',
  'MAINTENANCE',
  'MARKETING',
  'SUPPLIES',
  'LICENCES',
  'OTHER',
];
const METHODS = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD'];

@Component({
  selector: 'app-expenses',
  imports: [...SHARED, OverdrawWarningComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'finance.expenses' | t }}</h1>
          <p class="sub">{{ 'finance.runningCostsEachOnePosts' | t }}</p>
        </div>
        <div class="actions">
          @if (session.can('finance.manage')) {
            <button
              class="btn primary"
              type="button"
              [disabled]="!session.branch()"
              (click)="openForm()"
              [title]="session.branch() ? '' : ('ui.l.chooseABranchToRecordAn' | t)"
            >
              <app-icon name="plus" [size]="16" /> {{ 'finance.recordExpense' | t }}
            </button>
          }
        </div>
      </div>
      <div class="grid kpis mb">
        <app-stat
          [label]="'finance.shownTotal' | t"
          [value]="shownTotal() | compactMoney"
          [hint]="shownTotal() | money"
          icon="wallet"
          tone="red"
          [caption]="list.items().length + ('ui.l.preExpenses' | t)"
        />
      </div>
      <div class="card">
        <div class="toolbar">
          <select
            class="select"
            style="width:auto"
            (change)="category.set($any($event.target).value)"
          >
            <option value="">{{ 'finance.allCategories' | t }}</option>
            @for (c of categories; track c) {
              <option [value]="c">{{ c | label }}</option>
            }
          </select>
          <input
            class="input"
            style="width:auto"
            type="date"
            (change)="from.set($any($event.target).value)"
            [attr.aria-label]="'finance.from' | t"
          />
          <input
            class="input"
            style="width:auto"
            type="date"
            (change)="to.set($any($event.target).value)"
            [attr.aria-label]="'finance.to' | t"
          />
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'finance.date' | t }}</th>
                <th>{{ 'finance.category' | t }}</th>
                <th>{{ 'finance.description' | t }}</th>
                <th>{{ 'finance.method' | t }}</th>
                <th>{{ 'finance.reference' | t }}</th>
                <th class="right">{{ 'finance.amount' | t }}</th>
                <th>{{ 'finance.by' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (e of list.items(); track e.uid) {
                <tr>
                  <td class="muted">{{ e.expenseDate | day }}</td>
                  <td>
                    <span class="badge gray">{{ e.category | label }}</span>
                  </td>
                  <td style="white-space:normal">{{ e.description }}</td>
                  <td>{{ e.paymentMethod | label }}</td>
                  <td class="mono">{{ e.reference ?? '—' }}</td>
                  <td class="right strong">{{ e.amount | money }}</td>
                  <td>{{ e.createdBy ?? '—' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <app-empty [for]="list" icon="wallet" [title]="'finance.noExpenses' | t" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="list" />
      </div>
    </div>
    <app-modal [open]="open()" [title]="'finance.recordExpense' | t" (closed)="open.set(false)">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <div class="field">
          <label>{{ 'finance.category' | t }}</label
          ><select class="select" formControlName="category">
            @for (c of categories; track c) {
              <option [value]="c">{{ c | label }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ 'finance.amount' | t }}</label
          ><input class="input" type="number" min="0" step="any" formControlName="amount" />
          @if (err('amount'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'finance.date' | t }}</label
          ><input class="input" type="date" formControlName="expenseDate" [max]="today" />
        </div>
        <div class="field">
          <label>{{ 'finance.paidBy' | t }}</label
          ><select class="select" formControlName="paymentMethod">
            @for (m of methods; track m) {
              <option [value]="m">{{ m | label }}</option>
            }
          </select>
        </div>
        <app-overdraw-warning
          class="full"
          [amount]="+form.controls.amount.value"
          [method]="form.controls.paymentMethod.value"
        />
        <div class="field full">
          <label>{{ 'finance.description' | t }}</label
          ><input class="input" formControlName="description" />
          @if (err('description'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field full">
          <label>{{ 'finance.reference' | t }}</label
          ><input
            class="input"
            formControlName="reference"
            [placeholder]="'finance.receiptOrTransactionNumber' | t"
          />
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class ExpensesPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly categories = CATEGORIES;
  protected readonly methods = METHODS;
  protected readonly today = isoDay();
  protected readonly category = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly list = pagedList<Expense>(() => ({
    path: '/expenses',
    query: { category: this.category(), from: this.from(), to: this.to() },
  }));
  protected readonly shownTotal = computed(() =>
    this.list.items().reduce((sum, e) => sum + e.amount, 0),
  );
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    category: ['RENT' as ExpenseCategory],
    description: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    expenseDate: [isoDay(), Validators.required],
    paymentMethod: ['CASH'],
    reference: [''],
  });

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected openForm(): void {
    this.form.reset({
      category: 'RENT',
      description: '',
      amount: 0,
      expenseDate: isoDay(),
      paymentMethod: 'CASH',
      reference: '',
    });
    this.open.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      await this.api.post(
        '/expenses',
        { ...v, amount: Number(v.amount), reference: v.reference || null },
        { silent: true },
      );
      this.toasts.success(this.translations.t('toast.expenseRecorded'));
      this.open.set(false);
      await this.list.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
