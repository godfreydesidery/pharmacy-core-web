import { ChangeDetectionStrategy, Component } from '@angular/core';
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
      <app-audit-log path="/audit" />
    </div>
  `,
})
export default class AuditPage {}
