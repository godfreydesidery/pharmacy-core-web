import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SecurityEvent } from '../../core/api/security.models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { Translations } from '../../core/i18n/translations.store';

/**
 * The person's own security history: sign-ins, failed attempts and changes to how they sign in.
 * It is the platform's record of the person; no pharmacy sees it.
 */
@Component({
  selector: 'app-security-history',
  imports: [...SHARED, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card history" data-testid="security-history">
      <div class="card-pad">
        <h3>{{ 'acct.historyTitle' | t }}</h3>
        <p class="muted">{{ 'acct.historyHint' | t }}</p>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{{ 'acct.when' | t }}</th>
              <th>{{ 'acct.event' | t }}</th>
              <th>{{ 'acct.from' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of list.items(); track e.uid) {
              <tr>
                <td class="nowrap">{{ e.at | date: 'd MMM y, HH:mm' }}</td>
                <td [class.warn]="warning(e.action)">{{ label(e.action) }}</td>
                <td class="muted small">{{ from(e) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="empty">{{ 'acct.noHistory' | t }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <app-pager [list]="list" />
    </section>
  `,
  styles: `
    .history {
      max-width: 720px;
      margin-top: 18px;
    }
    .nowrap {
      white-space: nowrap;
    }
    .small {
      font-size: 12.5px;
    }
    .warn {
      color: #b45309;
      font-weight: 600;
    }
  `,
})
export class SecurityHistoryComponent {
  private readonly translations = inject(Translations);

  protected readonly list = pagedList<SecurityEvent>(
    () => ({ path: '/auth/security/history', options: { noBranch: true } }),
    10,
  );

  protected label(action: string): string {
    return this.translations.t('acct.ev.' + action, undefined, action);
  }

  protected warning(action: string): boolean {
    return [
      'SIGN_IN_FAILED',
      'ACCOUNT_LOCKED',
      'PHONE_LOST',
      'RECOVERY_STARTED',
      'TWO_FACTOR_DISABLED',
    ].includes(action);
  }

  protected from(e: SecurityEvent): string {
    return [this.device(e.device), e.ip].filter((part) => !!part).join(' · ');
  }

  /** "Chrome on Windows" from a user agent, roughly; the agent itself when unknown. */
  protected device(agent: string | null): string {
    if (!agent) {
      return '';
    }
    const browser = /Edg\//.test(agent)
      ? 'Edge'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Firefox\//.test(agent)
          ? 'Firefox'
          : /Safari\//.test(agent)
            ? 'Safari'
            : null;
    const system = /Android/.test(agent)
      ? 'Android'
      : /iPhone|iPad/.test(agent)
        ? 'iOS'
        : /Windows/.test(agent)
          ? 'Windows'
          : /Mac OS/.test(agent)
            ? 'macOS'
            : /Linux/.test(agent)
              ? 'Linux'
              : null;
    return browser && system ? `${browser} · ${system}` : (browser ?? system ?? agent.slice(0, 40));
  }
}
