import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Permission } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';

/** A built-in role whose permissions differ from today's recommended set. */
export interface RoleRecommendation {
  roleUid: string;
  code: string;
  name: string;
  add: string[];
  remove: string[];
}

/** `GET /roles/recommendations`. */
export interface RoleRecommendations {
  presetsVersion: string;
  /** Show the one-time notice: roles differ and the admin has neither applied nor kept them. */
  showNotice: boolean;
  dismissed: boolean;
  decision: 'APPLIED' | 'DISMISSED' | null;
  roles: RoleRecommendation[];
}

/**
 * "Apply recommended roles" (the owner's decision of 23 Nov 2026): new pharmacies get the split
 * role presets; a pharmacy that existed before keeps its roles, and the person who manages its
 * people sees this notice once, to apply the recommended permissions or keep their own.
 */
@Component({
  selector: 'app-roles-notice',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible() && data.value(); as r) {
      <div class="notice tone-blue mb" role="region" data-testid="roles-notice">
        <div class="grow stack" style="gap:6px">
          <b>{{ 'rolesNotice.title' | t }}</b>
          <span>{{ 'rolesNotice.text' | t }}</span>
          @if (showing()) {
            <ul class="changes">
              @for (role of r.roles; track role.roleUid) {
                <li>
                  <b>{{ role.name }}</b
                  >:
                  @if (role.add.length) {
                    {{ 'rolesNotice.gains' | t }} {{ names(role.add) }}.
                  }
                  @if (role.remove.length) {
                    {{ 'rolesNotice.loses' | t }} {{ names(role.remove) }}.
                  }
                </li>
              }
            </ul>
          }
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button class="btn primary sm" type="button" [disabled]="busy()" (click)="apply()">
              {{ 'rolesNotice.apply' | t }}
            </button>
            <button class="btn sm" type="button" (click)="showing.set(!showing())">
              {{ (showing() ? 'rolesNotice.hide' : 'rolesNotice.show') | t }}
            </button>
            <button class="btn ghost sm" type="button" [disabled]="busy()" (click)="dismiss()">
              {{ 'rolesNotice.keep' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .changes {
      margin: 0;
      padding-left: 18px;
    }
  `,
})
export class RolesNoticeComponent {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly session = inject(SessionStore);
  /** Emitted once the roles were changed, so a page showing them can reload. */
  readonly applied = output<void>();

  protected readonly data = loaded<RoleRecommendations>(() =>
    this.session.can('users.manage')
      ? { path: '/roles/recommendations', options: { noBranch: true, silent: true } }
      : null,
  );
  private readonly catalogue = loaded<Permission[]>(() =>
    this.visible() ? { path: '/permissions', options: { noBranch: true, silent: true } } : null,
  );
  protected readonly busy = signal(false);
  protected readonly showing = signal(false);
  protected readonly visible = computed(() => {
    const r = this.data.value();
    return !!r && r.showNotice && r.roles.length > 0;
  });

  protected names(codes: string[]): string {
    const described = new Map((this.catalogue.value() ?? []).map((p) => [p.code, p.description]));
    return codes.map((c) => described.get(c) ?? c).join('; ');
  }

  protected async apply(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post('/roles/recommendations/apply', {}, { noBranch: true });
      this.toasts.success(this.translations.t('rolesNotice.appliedToast'));
      this.applied.emit();
      await this.data.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async dismiss(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post('/roles/recommendations/dismiss', {}, { noBranch: true });
      await this.data.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
