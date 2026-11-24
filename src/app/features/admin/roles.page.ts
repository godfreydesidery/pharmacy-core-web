import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Api } from '../../core/api/api.service';
import { StaleRecordService, ifMatch } from '../../core/api/concurrency';
import { Permission, Role } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';
import { RolesNoticeComponent } from './roles-notice.component';

@Component({
  selector: 'app-roles',
  imports: [...SHARED, RolesNoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'admin.rolesAmpPermissions' | t }}</h1>
          <p class="sub">
            {{ 'admin.whatEachRoleMayDo' | t }}
          </p>
        </div>
        <div class="actions">
          <button class="btn" type="button" (click)="creating.set(true)">
            <app-icon name="plus" [size]="16" /> {{ 'admin.newRole' | t }}
          </button>
        </div>
      </div>
      <app-roles-notice (applied)="roles.reload()" />
      <div class="grid" style="grid-template-columns:280px minmax(0,1fr)">
        <div class="card" style="padding:8px">
          @for (r of roles.value() ?? []; track r.uid) {
            <button
              type="button"
              class="role"
              [class.active]="selected()?.uid === r.uid"
              (click)="select(r)"
            >
              <span class="grow"
                ><b>{{ r.name }}</b
                ><small
                  >{{ r.code }} · {{ r.permissions.length }} {{ 'admin.permissions' | t }}</small
                ></span
              >
              @if (r.system) {
                <span class="badge gray">{{ 'admin.system' | t }}</span>
              }
            </button>
          } @empty {
            <app-empty [for]="roles" icon="shield" [title]="'admin.noRoles' | t" />
          }
        </div>
        @if (selected(); as role) {
          <div class="card">
            <div class="card-head">
              <div>
                <h3>{{ role.name }}</h3>
                <p class="muted" style="font-size:12.5px">{{ role.description }}</p>
              </div>
              <button
                class="btn primary"
                type="button"
                [disabled]="busy() || !dirty()"
                (click)="save(role)"
              >
                <app-icon name="check" [size]="16" /> {{ 'admin.savePermissions' | t }}
              </button>
            </div>
            @for (area of areas(); track area.name) {
              <div class="area">
                <div class="row" style="justify-content:space-between">
                  <h4>{{ area.name | label }}</h4>
                  <button class="btn ghost sm" type="button" (click)="toggleArea(area.codes)">
                    {{ allIn(area.codes) ? ('ui.l.clear' | t) : ('ui.l.grantAll' | t) }}
                  </button>
                </div>
                <div class="perms">
                  @for (p of area.permissions; track p.code) {
                    <label class="check perm"
                      ><input
                        type="checkbox"
                        [checked]="granted().has(p.code)"
                        (change)="toggle(p.code)"
                      />
                      <span
                        ><b class="mono">{{ p.code }}</b
                        ><small>{{ 'perm.' + p.code | t: null : p.description }}</small></span
                      ></label
                    >
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="card">
            <app-empty
              icon="shield"
              [title]="'admin.chooseARole' | t"
              [text]="'ui.empty.pickRole' | t"
            />
          </div>
        }
      </div>
    </div>
    <app-modal [open]="creating()" [title]="'admin.newRole' | t" (closed)="creating.set(false)">
      <div class="form-grid">
        <div class="field">
          <label>{{ 'admin.code' | t }}</label
          ><input class="input" #code placeholder="DISPENSER" style="text-transform:uppercase" />
        </div>
        <div class="field">
          <label>{{ 'admin.name' | t }}</label
          ><input class="input" #name placeholder="Dispenser" />
        </div>
        <div class="field full">
          <label>{{ 'admin.description' | t }}</label
          ><input class="input" #description />
        </div>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="creating.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          [disabled]="busy()"
          (click)="create(code.value, name.value, description.value)"
        >
          {{ 'admin.create' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .role {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      border: 0;
      background: none;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
    }
    .role:hover {
      background: var(--surface-hover);
    }
    .role.active {
      background: var(--primary-soft);
    }
    .role b {
      display: block;
      font-size: 13.5px;
    }
    .role small {
      color: var(--muted);
      font-size: 11.5px;
    }
    .area {
      padding: 14px 18px;
      border-top: 1px solid var(--border);
    }
    .area h4 {
      font-size: 13px;
    }
    .perms {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    .perm {
      align-items: flex-start;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
    }
    .perm b {
      display: block;
      font-size: 12px;
    }
    .perm small {
      color: var(--muted);
      font-size: 11.5px;
    }
  `,
})
export default class RolesPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly stale = inject(StaleRecordService);
  protected readonly roles = loaded<Role[]>(() => ({
    path: '/roles',
    options: { noBranch: true },
  }));
  protected readonly permissions = loaded<Permission[]>(() => ({
    path: '/permissions',
    options: { noBranch: true },
  }));
  protected readonly selected = signal<Role | null>(null);
  protected readonly granted = signal<Set<string>>(new Set());
  protected readonly busy = signal(false);
  protected readonly creating = signal(false);
  protected readonly areas = computed(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of this.permissions.value() ?? []) {
      if (p.code.startsWith('platform.')) {
        continue;
      }
      groups.set(p.area, [...(groups.get(p.area) ?? []), p]);
    }
    return [...groups.entries()].map(([name, permissions]) => ({
      name,
      permissions,
      codes: permissions.map((p) => p.code),
    }));
  });
  protected readonly dirty = computed(() => {
    const role = this.selected();
    const granted = this.granted();
    return (
      !!role &&
      (role.permissions.length !== granted.size || role.permissions.some((p) => !granted.has(p)))
    );
  });

  constructor() {
    effect(() => {
      const roles = this.roles.value();
      if (roles?.length && !this.selected()) {
        this.select(roles[0]);
      }
    });
  }

  protected select(role: Role): void {
    this.selected.set(role);
    this.granted.set(new Set(role.permissions));
  }

  protected toggle(code: string): void {
    this.granted.update((set) => {
      const next = new Set(set);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  protected allIn(codes: string[]): boolean {
    return codes.every((c) => this.granted().has(c));
  }

  protected toggleArea(codes: string[]): void {
    const grant = !this.allIn(codes);
    this.granted.update((set) => {
      const next = new Set(set);
      codes.forEach((c) => (grant ? next.add(c) : next.delete(c)));
      return next;
    });
  }

  protected async save(role: Role): Promise<void> {
    this.busy.set(true);
    try {
      const saved = await this.api.put<Role>(
        `/roles/${role.uid}`,
        { name: role.name, description: role.description, permissions: [...this.granted()] },
        { noBranch: true, headers: ifMatch(role.version) },
      );
      this.toasts.success(this.translations.t('toast.roleUpdated', { name: saved.name }));
      await this.roles.reload();
      this.select(saved);
    } catch (failure) {
      // Someone else changed the role: Reload shows its permissions as they are now. Any other
      // refusal the interceptor has already shown.
      if (!(await this.stale.handle(failure, () => this.reload(role.uid)))) {
        throw failure;
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Reads the role again, as someone else left it, and shows its permissions. */
  private async reload(uid: string): Promise<void> {
    const fresh = await this.api.get<Role>(`/roles/${uid}`, undefined, { noBranch: true });
    this.select(fresh);
    void this.roles.reload();
  }

  protected async create(code: string, name: string, description: string): Promise<void> {
    if (!code.trim() || !name.trim()) {
      this.toasts.error(this.translations.t('toast.codeAndNameRequired'));
      return;
    }
    this.busy.set(true);
    try {
      const role = await this.api.post<Role>(
        '/roles',
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description || null,
          permissions: [],
        },
        { noBranch: true },
      );
      this.toasts.success(this.translations.t('toast.roleCreated', { name: role.name }));
      this.creating.set(false);
      await this.roles.reload();
      this.select(role);
    } finally {
      this.busy.set(false);
    }
  }
}
