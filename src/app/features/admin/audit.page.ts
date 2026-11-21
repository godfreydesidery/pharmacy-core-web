import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { AuditLogComponent } from './audit-log.component';

/** The pharmacy's audit trail: every change and security event, newest first. */
@Component({
  selector: 'app-audit',
  imports: [TranslatePipe, AuditLogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'admin.auditLog' | t }}</h1>
          <p class="sub">
            {{ 'admin.whoChangedWhatAndWhen' | t }}
          </p>
        </div>
      </div>
      <app-audit-log path="/audit" [initialAction]="action() ?? ''" />
    </div>
  `,
})
export default class AuditPage {
  /** ?action=SIGN_IN opens the sign-in history (the Users page links to it). */
  readonly action = input<string>();
}
