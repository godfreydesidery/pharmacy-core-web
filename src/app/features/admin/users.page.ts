import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Branch, Member, Role } from '../../core/api/models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { InvitationsPanelComponent } from './invitations-panel.component';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-users',
  imports: [...SHARED, InvitationsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Users</h1>
          <p class="sub">
            People who work in this pharmacy, their role and the branches they may use.
          </p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/admin/roles"><app-icon name="shield" [size]="16" /> Roles</a>
          <button class="btn primary" type="button" (click)="edit(null)">
            <app-icon name="plus" [size]="16" /> Add user
          </button>
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="search"
            ><app-icon name="search" [size]="16" /><input
              placeholder="Name or email…"
              (input)="q.set($any($event.target).value)"
          /></label>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Branches</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (m of list.items(); track m.membershipUid) {
                <tr>
                  <td>
                    <div class="cell-main">
                      <span class="avatar">{{ initials(m.name) }}</span>
                      <div>
                        <b>{{ m.name }}</b
                        ><small>{{ m.email }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge blue">{{ m.roleName }}</span>
                  </td>
                  <td>{{ m.allBranches ? 'All branches' : branchNames(m.branchUids) }}</td>
                  <td class="muted">{{ m.lastSignInAt | when }}</td>
                  <td><app-status [value]="m.active ? 'ACTIVE' : 'INACTIVE'" /></td>
                  <td class="right">
                    <button class="btn sm" type="button" (click)="edit(m)">
                      <app-icon name="edit" [size]="14" /> Edit
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <app-empty [loading]="list.loading()" icon="users" title="No users" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager
          [count]="list.items().length"
          [total]="list.total()"
          [hasMore]="list.hasMore()"
          [loading]="list.loading()"
          (more)="list.more()"
        />
      </div>
      <app-invitations-panel />
    </div>
    <app-modal
      [open]="open()"
      [title]="current() ? 'Edit ' + current()!.name : 'Add user'"
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        @if (!current()) {
          <div class="field">
            <label>Name</label><input class="input" formControlName="name" />
            @if (err('name'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>Email</label><input class="input" type="email" formControlName="email" />
            @if (err('email'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field full">
            <label>Password</label
            ><input
              class="input"
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            <span class="hint"
              >Ignored if this email already has an account; it keeps its password.</span
            >
            @if (err('password'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        <div class="field full">
          <label>Role</label>
          <select class="select" formControlName="roleUid">
            <option value="" disabled>Choose a role</option>
            @for (r of roles.value() ?? []; track r.uid) {
              <option [value]="r.uid">{{ r.name }}</option>
            }
          </select>
          @if (err('roleUid'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <label class="check full"
          ><input type="checkbox" formControlName="allBranches" /> Can work in every branch</label
        >
        @if (!form.controls.allBranches.value) {
          <div class="field full">
            <label>Branches</label>
            <div class="chips">
              @for (b of branches.value() ?? []; track b.uid) {
                <button
                  type="button"
                  class="chip"
                  [class.active]="selectedBranches().includes(b.uid)"
                  (click)="toggleBranch(b.uid)"
                >
                  {{ b.name }}
                </button>
              }
            </div>
          </div>
        }
        @if (current()) {
          <label class="check full"
            ><input type="checkbox" formControlName="active" /> Active — can sign in to this
            pharmacy</label
          >
        }
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">Cancel</button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">Save</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--green));
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 650;
      font-size: 12px;
      flex-shrink: 0;
    }
  `,
})
export default class UsersPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly q = signal('');
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<Member>(() => ({
    path: '/users',
    query: { q: this.query() },
    options: { noBranch: true },
  }));
  protected readonly roles = loaded<Role[]>(() => ({
    path: '/roles',
    options: { noBranch: true },
  }));
  protected readonly branches = loaded<Branch[]>(() => ({
    path: '/branches',
    options: { noBranch: true },
  }));
  private readonly branchIndex = computed(
    () => new Map((this.branches.value() ?? []).map((b) => [b.uid, b.name])),
  );
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<Member | null>(null);
  protected readonly selectedBranches = signal<string[]>([]);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    roleUid: ['', Validators.required],
    allBranches: [true],
    active: [true],
  });

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected branchNames(uids: string[]): string {
    return uids.map((uid) => this.branchIndex().get(uid) ?? '?').join(', ') || 'None';
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected edit(member: Member | null): void {
    this.current.set(member);
    this.form.reset({
      name: member?.name ?? '',
      email: member?.email ?? '',
      password: '',
      roleUid: member?.roleUid ?? '',
      allBranches: member?.allBranches ?? true,
      active: member?.active ?? true,
    });
    for (const name of ['name', 'email', 'password'] as const) {
      if (member) {
        this.form.controls[name].disable();
      } else {
        this.form.controls[name].enable();
      }
    }
    this.selectedBranches.set(member?.branchUids ?? []);
    this.open.set(true);
  }

  protected toggleBranch(uid: string): void {
    this.selectedBranches.update((list) =>
      list.includes(uid) ? list.filter((u) => u !== uid) : [...list, uid],
    );
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    if (!v.allBranches && !this.selectedBranches().length) {
      this.toasts.error(this.translations.t('toast.chooseBranchOrAll'));
      return;
    }
    const access = {
      roleUid: v.roleUid,
      allBranches: v.allBranches,
      branchUids: v.allBranches ? [] : this.selectedBranches(),
    };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(
          `/users/${current.membershipUid}`,
          { ...access, active: v.active },
          { silent: true, noBranch: true },
        );
      } else {
        await this.api.post(
          '/users',
          { name: v.name, email: v.email, password: v.password, ...access },
          { silent: true, noBranch: true },
        );
      }
      this.toasts.success(this.translations.t('toast.userSaved'));
      this.open.set(false);
      await this.list.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
