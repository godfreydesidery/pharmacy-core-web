import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../i18n/t.pipe';
import { apiUrl } from '../api/api.service';
import { ApiError } from '../api/api-error';
import { SILENT } from '../api/api.interceptor';

/**
 * "Confirm it's you" before a sensitive change to one's own account (passkeys, two-factor, phone):
 * the API answers 403 `reauthentication_required` when the session has not proved its password in
 * the last few minutes, the interceptor asks here, and the request is sent again once the person
 * has typed their password (and their authenticator code when two-factor is on). OWASP ASVS
 * re-authentication ("sudo mode").
 */
@Injectable({ providedIn: 'root' })
export class ConfirmIdentityService {
  private readonly http = inject(HttpClient);

  /** The open request: resolves true once confirmed, false when cancelled. */
  readonly open = signal<((confirmed: boolean) => void) | null>(null);
  private pending: Promise<boolean> | null = null;

  /** Asks once at a time; several refused requests wait for the same answer. */
  ask(): Promise<boolean> {
    if (!this.pending) {
      this.pending = new Promise<boolean>((resolve) =>
        this.open.set((confirmed) => {
          this.open.set(null);
          this.pending = null;
          resolve(confirmed);
        }),
      );
    }
    return this.pending;
  }

  /** Sends the password (and code); throws the API's refusal (wrong password, code needed...). */
  async confirm(password: string, code: string | null): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          apiUrl('/auth/confirm-identity'),
          { password, code: code || null },
          // The dialog shows the refusal itself (wrong password), not a toast.
          { context: new HttpContext().set(SILENT, true) },
        ),
      );
    } catch (failure) {
      throw ApiError.from(failure);
    }
  }
}

@Component({
  selector: 'app-confirm-identity',
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'service.open() && cancel()' },
  template: `
    @if (service.open()) {
      <div class="backdrop" (click)="cancel()">
        <form
          class="popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-identity-title"
          (click)="$event.stopPropagation()"
          (ngSubmit)="submit()"
        >
          <h2 id="confirm-identity-title">{{ 'identity.title' | t }}</h2>
          <p>{{ 'identity.text' | t }}</p>
          <div class="field">
            <label for="confirm-identity-password">{{ 'identity.password' | t }}</label>
            <input
              #password
              id="confirm-identity-password"
              name="password"
              type="password"
              autocomplete="current-password"
              [(ngModel)]="passwordValue"
              [attr.aria-invalid]="error() ? 'true' : null"
              aria-describedby="confirm-identity-error"
              required
            />
          </div>
          @if (needsCode()) {
            <div class="field">
              <label for="confirm-identity-code">{{ 'identity.code' | t }}</label>
              <input
                id="confirm-identity-code"
                name="code"
                inputmode="numeric"
                autocomplete="one-time-code"
                [(ngModel)]="codeValue"
              />
            </div>
          }
          <p id="confirm-identity-error" class="error" role="alert">{{ error() }}</p>
          <div class="actions">
            <button type="button" class="btn ghost" (click)="cancel()">
              {{ 'common.cancel' | t }}
            </button>
            <button type="submit" class="btn primary" [disabled]="busy() || !passwordValue">
              {{ 'identity.confirm' | t }}
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
      width: min(400px, 100%);
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
export class ConfirmIdentityComponent {
  protected readonly service = inject(ConfirmIdentityService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly needsCode = signal(false);
  protected passwordValue = '';
  protected codeValue = '';
  private readonly password = viewChild<ElementRef<HTMLInputElement>>('password');
  private returnFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.service.open()) {
        this.returnFocus = document.activeElement as HTMLElement | null;
        this.passwordValue = '';
        this.codeValue = '';
        this.error.set('');
        this.needsCode.set(false);
        setTimeout(() => this.password()?.nativeElement.focus());
      }
    });
  }

  protected async submit(): Promise<void> {
    if (this.busy() || !this.passwordValue) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.service.confirm(this.passwordValue, this.needsCode() ? this.codeValue : null);
      this.close(true);
    } catch (failure) {
      const error = failure as ApiError;
      if (error.reason === 'invalid_code' && !this.needsCode()) {
        // Two-factor is on: the code is asked for too.
        this.needsCode.set(true);
      } else {
        this.error.set(error.message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.close(false);
  }

  private close(confirmed: boolean): void {
    const answer = this.service.open();
    this.passwordValue = '';
    this.codeValue = '';
    answer?.(confirmed);
    this.returnFocus?.focus();
  }
}
