import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { LogoComponent } from '../../core/layout/logo.component';
import { IconComponent } from '../../core/ui/icon.component';
import { AUTH_CARD_STYLES } from './auth-card';

/** The link in the notice to the old email or phone: stops a recovery the person did not ask for. */
@Component({
  selector: 'app-cancel-recovery',
  imports: [RouterLink, IconComponent, LogoComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card-page">
      <div class="auth-card">
        <app-logo [size]="40" />
        <h1>{{ 'acct.cancelTitle' | t }}</h1>
        @if (!token) {
          <div class="notice tone-amber">
            <app-icon name="alert" /> {{ 'acct.missingToken' | t }}
          </div>
        } @else if (done()) {
          <div class="notice tone-green" data-testid="recovery-cancelled">
            <app-icon name="check" /> {{ 'acct.cancelled' | t }}
          </div>
        } @else {
          <p class="muted">{{ 'acct.cancelHint' | t }}</p>
          @if (failure()) {
            <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
          }
          <button class="btn danger lg block" type="button" [disabled]="busy()" (click)="cancel()">
            {{ 'acct.cancelRecovery' | t }}
          </button>
        }
        <a class="back" routerLink="/sign-in">{{ 'acct.toSignIn' | t }}</a>
      </div>
    </div>
  `,
  styles: AUTH_CARD_STYLES,
})
export default class CancelRecoveryPage {
  private readonly api = inject(Api);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected async cancel(): Promise<void> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.api.post('/auth/recovery/cancel', { token: this.token }, { silent: true });
      this.done.set(true);
    } catch (failure) {
      this.failure.set(ApiError.from(failure).message);
    } finally {
      this.busy.set(false);
    }
  }
}
