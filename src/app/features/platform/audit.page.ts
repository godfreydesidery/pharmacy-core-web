import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { AuditLogComponent } from '../admin/audit-log.component';

/** The platform's audit trail: tenants, users, root administrators and their sign-ins. */
@Component({
  selector: 'app-platform-audit',
  imports: [TranslatePipe, AuditLogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'platform.platformAudit' | t }}</h1>
          <p class="sub">
            {{ 'platform.changesMadeAtPlatformScope' | t }}
          </p>
        </div>
      </div>
      <app-audit-log path="/platform/audit" />
    </div>
  `,
})
export default class PlatformAuditPage {}
