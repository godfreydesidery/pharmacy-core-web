import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { apiUrl } from '../api/api.service';
import { ApiError } from '../api/api-error';
import { SILENT } from '../api/api.interceptor';
import { SettingsStore } from '../format/settings.store';
import { formatMoney } from '../format/format';
import { DialogDirective } from '../ui/dialog';

/** What needs approving: the API's `approval_required` problem members. */
export interface ApprovalRequest {
  action: string;
  amount: number;
}

/** Actions whose amount is a percent off, not money. */
const PERCENT_ACTIONS = new Set(['DEEP_DISCOUNT', 'DEEP_PROMOTION']);

interface Granted {
  token: string;
  approvedBy: string;
}

/**
 * A manager's approval on the same screen (segregation of duties; the owner's rules of 23 Nov
 * 2026). Above the pharmacy's approval limit, and always for some actions, the API refuses with 403
 * `approval_required` naming the `action` and `amount`; the interceptor asks here, a manager (never
 * the person asking) types their sign-in and password, `POST /approvals` hands back a single-use
 * approval, and the request is sent again with it as `X-Approval`.
 */
@Injectable({ providedIn: 'root' })
export class ManagerApprovalService {
  private readonly http = inject(HttpClient);

  /** The open request and how to answer it: the approval's token, or null when cancelled. */
  readonly open = signal<{
    request: ApprovalRequest;
    answer: (token: string | null) => void;
  } | null>(null);
  private pending: Promise<string | null> | null = null;

  /** Asks once at a time; another refused request waits for the dialog to close, then asks. */
  async ask(request: ApprovalRequest): Promise<string | null> {
    while (this.pending) {
      await this.pending;
    }
    this.pending = new Promise<string | null>((resolve) =>
      this.open.set({
        request,
        answer: (token) => {
          this.open.set(null);
          this.pending = null;
          resolve(token);
        },
      }),
    );
    return this.pending;
  }

  /** Checks the manager's sign-in and password; throws the API's refusal. */
  async approve(request: ApprovalRequest, login: string, password: string): Promise<Granted> {
    try {
      return await firstValueFrom(
        this.http.post<Granted>(
          apiUrl('/approvals'),
          { action: request.action, amount: request.amount, login, password },
          // The dialog shows the refusal itself (wrong password, not a manager), not a toast.
          { context: new HttpContext().set(SILENT, true) },
        ),
      );
    } catch (failure) {
      throw ApiError.from(failure);
    }
  }
}

@Component({
  selector: 'app-manager-approval',
  imports: [FormsModule, TranslatePipe, DialogDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.open(); as open) {
      <div class="backdrop" (click)="cancel()">
        <form
          class="popup"
          role="dialog"
          appDialog
          appDialogFocus="#manager-approval-login"
          (dialogEscape)="cancel()"
          aria-labelledby="manager-approval-title"
          aria-describedby="manager-approval-text"
          data-testid="manager-approval"
          (click)="$event.stopPropagation()"
          (ngSubmit)="submit()"
          autocomplete="off"
        >
          <h2 id="manager-approval-title">{{ 'approval.title' | t }}</h2>
          <p id="manager-approval-text">
            {{ 'approval.text' | t: { action: actionLabel() } }}
          </p>
          @if (amountLabel(); as amount) {
            <p class="amount">
              {{ 'approval.amount' | t }}: <b>{{ amount }}</b>
            </p>
          }
          <div class="field">
            <label for="manager-approval-login">{{ 'approval.login' | t }}</label>
            <input
              id="manager-approval-login"
              name="login"
              class="input"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              [(ngModel)]="loginValue"
              required
            />
          </div>
          <div class="field">
            <label for="manager-approval-password">{{ 'approval.password' | t }}</label>
            <input
              id="manager-approval-password"
              name="password"
              class="input"
              type="password"
              autocomplete="off"
              [(ngModel)]="passwordValue"
              [attr.aria-invalid]="error() ? 'true' : null"
              aria-describedby="manager-approval-error"
              required
            />
          </div>
          <p class="hint">{{ 'approval.hint' | t }}</p>
          <p id="manager-approval-error" class="error" role="alert">{{ error() }}</p>
          <div class="actions">
            <button type="button" class="btn ghost" (click)="cancel()">
              {{ 'common.cancel' | t }}
            </button>
            <button
              type="submit"
              class="btn primary"
              [disabled]="busy() || !loginValue || !passwordValue"
            >
              {{ 'approval.approve' | t }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 310;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.45);
    }
    .popup {
      width: min(420px, 100%);
      padding: 24px;
      border-radius: 14px;
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-lg);
    }
    h2 {
      margin: 0 0 6px;
      font-size: 1.15rem;
    }
    p {
      margin: 0 0 14px;
      color: var(--muted);
    }
    .amount {
      color: var(--text);
    }
    .hint {
      font-size: 0.85rem;
      margin-bottom: 6px;
    }
    .field {
      display: grid;
      gap: 6px;
      margin-bottom: 12px;
    }
    .error {
      min-height: 1.2em;
      margin: 0 0 8px;
      color: var(--red);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class ManagerApprovalComponent {
  protected readonly service = inject(ManagerApprovalService);
  private readonly translations = inject(Translations);
  private readonly settings = inject(SettingsStore);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected loginValue = '';
  protected passwordValue = '';

  protected readonly actionLabel = computed(() => {
    const action = this.service.open()?.request.action ?? '';
    return this.translations.t(
      `approval.action.${action}`,
      undefined,
      action.toLowerCase().replace(/_/g, ' '),
    );
  });

  protected readonly amountLabel = computed(() => {
    const request = this.service.open()?.request;
    const amount = request?.amount ?? 0;
    if (amount <= 0) {
      return '';
    }
    // A deep discount or promotion is approved as a percent, the rest as money.
    return PERCENT_ACTIONS.has(request?.action ?? '')
      ? `${amount}%`
      : formatMoney(amount, this.settings.currency());
  });

  constructor() {
    effect(() => {
      if (this.service.open()) {
        this.loginValue = '';
        this.passwordValue = '';
        this.error.set('');
      }
    });
  }

  protected async submit(): Promise<void> {
    const open = this.service.open();
    if (!open || this.busy() || !this.loginValue || !this.passwordValue) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const granted = await this.service.approve(
        open.request,
        this.loginValue.trim(),
        this.passwordValue,
      );
      this.close(granted.token);
    } catch (failure) {
      const error = failure as ApiError;
      this.error.set(
        this.translations.t(`errors.${error.reason}`, undefined, error.message) || error.message,
      );
      this.passwordValue = '';
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.close(null);
  }

  private close(token: string | null): void {
    const open = this.service.open();
    this.loginValue = '';
    this.passwordValue = '';
    open?.answer(token);
  }
}
