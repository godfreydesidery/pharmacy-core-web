import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { Branch, BranchRef, Me, Membership, Page, Tenant } from '../../core/api/models';
import { LogoComponent } from '../../core/layout/logo.component';
import { firstAllowedPath } from '../../core/layout/nav';
import { SessionStore, WorkspaceTenant } from '../../core/session/session.store';
import { IconComponent } from '../../core/ui/icon.component';
import { StatusBadgeComponent } from '../../core/ui/widgets';
import { TranslatePipe } from '../../core/i18n/t.pipe';

interface Pending {
  tenant: WorkspaceTenant;
  membership: Membership | null;
  branches: BranchRef[];
  allowAll: boolean;
}

/** Choose the pharmacy (tenant) and branch to work in. */
@Component({
  selector: 'app-workspace',
  imports: [IconComponent, LogoComponent, StatusBadgeComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="panel card">
        <header>
          <app-logo [size]="38" />
          <div class="grow">
            <h1>{{ (pending() ? 'workspace.chooseBranch' : 'workspace.chooseWhere') | t }}</h1>
            <p class="muted">
              {{ 'workspace.signedInAs' | t: { name: session.user()?.name } }} ·
              {{ session.user()?.email }}
            </p>
          </div>
          <button class="btn ghost sm" type="button" (click)="signOut()">
            <app-icon name="logout" [size]="15" /> {{ 'shell.signOut' | t }}
          </button>
        </header>

        @if (pending(); as p) {
          <button class="btn ghost sm back" type="button" (click)="pending.set(null)">
            <app-icon name="arrow-left" [size]="15" /> {{ p.tenant.name }}
          </button>
          <div class="list">
            @if (p.allowAll) {
              <button class="option" type="button" (click)="enter(p, null)">
                <span class="mark tone-purple"><app-icon name="layers" /></span>
                <span class="grow"
                  ><b>{{ 'workspace.allBranches' | t }}</b
                  ><small>{{ 'workspace.allBranchesDetail' | t }}</small></span
                >
                <app-icon name="chevron-right" />
              </button>
            }
            @for (branch of p.branches; track branch.uid) {
              <button class="option" type="button" (click)="enter(p, branch)">
                <span class="mark tone-blue"><app-icon name="building" /></span>
                <span class="grow"
                  ><b>{{ branch.name }}</b
                  ><small>{{ branch.code }}</small></span
                >
                <app-icon name="chevron-right" />
              </button>
            } @empty {
              <div class="empty">{{ 'workspace.noBranch' | t }}</div>
            }
          </div>
        } @else {
          @if (session.isRoot()) {
            <a class="option root" routerLink="/platform">
              <span class="mark tone-purple"><app-icon name="key" /></span>
              <span class="grow"
                ><b>{{ 'workspace.platformAdmin' | t }}</b
                ><small>{{ 'workspace.platformAdminDetail' | t }}</small></span
              >
              <app-icon name="chevron-right" />
            </a>
            <div class="search">
              <app-icon name="search" [size]="16" />
              <input
                [placeholder]="'workspace.searchTenants' | t"
                [value]="query()"
                (input)="search($any($event.target).value)"
              />
            </div>
            <div class="list">
              @for (tenant of tenants(); track tenant.uid) {
                <button class="option" type="button" (click)="pickTenant(tenant)">
                  <span class="mark tone-blue">{{ tenant.code.slice(0, 2) }}</span>
                  <span class="grow"
                    ><b>{{ tenant.name }}</b
                    ><small
                      >{{ tenant.code }} ·
                      {{ 'workspace.branches' | t: { count: tenant.branchCount } }} ·
                      {{ tenant.currency }}</small
                    ></span
                  >
                  <app-status [value]="tenant.status" />
                  <app-icon name="chevron-right" />
                </button>
              } @empty {
                <div class="empty">
                  {{ (loading() ? 'common.loading' : 'workspace.noTenants') | t }}
                </div>
              }
            </div>
          }
          @if (session.memberships().length) {
            @if (session.isRoot()) {
              <div class="section">{{ 'workspace.memberships' | t }}</div>
            }
            <div class="list">
              @for (membership of session.memberships(); track membership.uid) {
                <button
                  class="option"
                  type="button"
                  [disabled]="membership.tenantStatus === 'SUSPENDED'"
                  (click)="pickMembership(membership)"
                >
                  <span class="mark tone-blue">{{ membership.tenantCode.slice(0, 2) }}</span>
                  <span class="grow"
                    ><b>{{ membership.tenantName }}</b
                    ><small
                      >{{ membership.roleName }} ·
                      {{
                        membership.allBranches
                          ? ('workspace.allBranches' | t)
                          : ('workspace.branches' | t: { count: membership.branches.length })
                      }}</small
                    ></span
                  >
                  @if (membership.tenantStatus === 'SUSPENDED') {
                    <app-status value="SUSPENDED" />
                  }
                  <app-icon name="chevron-right" />
                </button>
              }
            </div>
          } @else if (!session.isRoot()) {
            <div class="empty">
              {{ 'workspace.noMemberships' | t }}
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(900px 500px at 10% 0%, var(--primary-soft-2), transparent), var(--bg);
    }
    .panel {
      width: min(640px, 100%);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    header {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    h1 {
      font-size: 20px;
      letter-spacing: -0.01em;
    }
    header p {
      font-size: 12.5px;
    }
    .back {
      align-self: flex-start;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 52vh;
      overflow-y: auto;
    }
    .option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      cursor: pointer;
      text-align: left;
      color: var(--muted);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    .option:hover:not(:disabled) {
      border-color: var(--primary);
      box-shadow: var(--ring);
    }
    .option:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .option b {
      display: block;
      color: var(--text);
      font-size: 14px;
    }
    .option small {
      font-size: 12px;
      color: var(--muted);
    }
    .option.root {
      background: linear-gradient(90deg, var(--purple-soft), transparent);
    }
    .mark {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
    }
    .search {
      min-width: 0;
    }
    .section {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--faint);
      margin-top: 6px;
    }
  `,
})
export default class WorkspacePage implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pending = signal<Pending | null>(null);
  protected readonly tenants = signal<Tenant[]>([]);
  protected readonly loading = signal(false);
  protected readonly query = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly hasChoices = computed(
    () => this.session.isRoot() || this.session.memberships().length > 0,
  );

  async ngOnInit(): Promise<void> {
    try {
      const me = await this.api.get<Me>('/auth/me', undefined, { silent: true });
      this.session.refresh(me.user, me.memberships);
    } catch {
      /* the stored session is used as it is */
    }
    if (this.session.isRoot()) {
      await this.loadTenants();
    } else if (this.session.memberships().length === 1 && !this.session.tenant()) {
      await this.pickMembership(this.session.memberships()[0]);
    }
  }

  protected search(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadTenants(), 250);
  }

  protected async pickMembership(membership: Membership): Promise<void> {
    const tenant: WorkspaceTenant = {
      uid: membership.tenantUid,
      code: membership.tenantCode,
      name: membership.tenantName,
      status: membership.tenantStatus,
    };
    let branches = membership.branches;
    if (membership.allBranches && branches.length === 0) {
      branches = await this.tenantBranches(tenant.uid);
    }
    const pending: Pending = {
      tenant,
      membership,
      branches,
      allowAll: membership.allBranches && branches.length > 1,
    };
    if (branches.length === 1) {
      this.enter(pending, branches[0]);
    } else {
      this.pending.set(pending);
    }
  }

  protected async pickTenant(tenant: Tenant): Promise<void> {
    const branches = await this.tenantBranches(tenant.uid);
    this.pending.set({
      tenant: { uid: tenant.uid, code: tenant.code, name: tenant.name, status: tenant.status },
      membership: null,
      branches,
      allowAll: true,
    });
  }

  protected enter(pending: Pending, branch: BranchRef | null): void {
    if (pending.membership) {
      this.session.enterMembership(pending.membership, pending.branches, branch);
    } else {
      this.session.enterAsRoot(pending.tenant, pending.branches, branch);
    }
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(returnUrl ?? firstAllowedPath((p) => this.session.can(p)));
  }

  protected signOut(): void {
    void this.api.post('/auth/sign-out', {}, { silent: true }).catch(() => undefined);
    this.session.signOut();
    void this.router.navigate(['/sign-in']);
  }

  private async loadTenants(): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.api.get<Page<Tenant>>('/platform/tenants', {
        q: this.query(),
        limit: 50,
      });
      this.tenants.set(page.items);
    } finally {
      this.loading.set(false);
    }
  }

  private async tenantBranches(tenantUid: string): Promise<BranchRef[]> {
    const branches = await this.api.get<Branch[]>('/branches', undefined, {
      headers: { 'X-Tenant-Id': tenantUid },
      noBranch: true,
    });
    return branches.filter((b) => b.active).map(({ uid, code, name }) => ({ uid, code, name }));
  }
}
