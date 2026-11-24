import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SHARED } from '../../core/shared';
import { RootApprovalsComponent } from './root-approvals.component';

/** Requests waiting for a second root administrator (FRD-18). */
@Component({
  selector: 'app-platform-approvals',
  imports: [...SHARED, RootApprovalsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'rootApproval.title' | t }}</h1>
          <p class="sub">{{ 'rootApproval.sub' | t }}</p>
        </div>
      </div>
      <div class="card card-pad">
        <app-root-approvals />
      </div>
    </div>
  `,
})
export default class PlatformApprovalsPage {}
