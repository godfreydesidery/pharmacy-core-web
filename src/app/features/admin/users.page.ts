import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Branch, Member, Role } from '../../core/api/models';
import { LockedMember } from '../../core/api/security.models';
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
          <h1>{{ 'ui.users.title' | t }}</h1>
          <p class="sub">{{ 'ui.users.subtitle' | t }}</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/admin/roles"
            ><app-icon name="shield" [size]="16" /> {{ 'ui.users.roles' | t }}</a
          >
          <button class="btn primary" type="button" (click)="edit(null)">
            <app-icon name="plus" [size]="16" /> {{ 'ui.users.add' | t }}
          </button>
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="search"
            ><app-icon name="search" [size]="16" /><input
              [placeholder]="'ui.users.search' | t"
              (input)="q.set($any($event.target).value)"
          /></label>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'ui.users.user' | t }}</th>
                <th>{{ 'ui.users.role' | t }}</th>
                <th>{{ 'ui.users.branches' | t }}</th>
                <th>{{ 'ui.users.lastSignIn' | t }}</th>
                <th>{{ 'ui.users.status' | t }}</th>
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
                  <td>
                    {{ m.allBranches ? ('common.allBranches' | t) : branchNames(m.branchUids) }}
                  </td>
                  <td class="muted">{{ m.lastSignInAt | when }}</td>
                  <td>
                    <app-status [value]="m.active ? 'ACTIVE' : 'INACTIVE'" />
                    @if (lockedUntil(m.membershipUid); as until) {
                      <span
                        class="badge red locked"
                        [title]="'security2.lockedUntil' | t: { time: (until | when) }"
                        ><app-icon name="lock" [size]="12" /> {{ 'security2.locked' | t }}</span
                      >
                    }
                  </td>
                  <td class="right">
                    @if (lockedUntil(m.membershipUid)) {
                      <button class="btn sm" type="button" [disabled]="busy()" (click)="unlock(m)">
                        <app-icon name="lock" [size]="14" /> {{ 'security2.unlock' | t }}
                      </button>
                    }
                    <button class="btn sm" type="button" (click)="edit(m)">
                      <app-icon name="edit" [size]="14" /> {{ 'common.edit' | t }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <app-empty
                      [loading]="list.loading()"
                      icon="users"
                      [title]="'ui.empty.noUsers' | t"
                    />
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
      [title]="
        current() ? ('ui.users.editTitle' | t: { name: current()!.name }) : ('ui.users.add' | t)
      "
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        @if (!current()) {
          <div class="field">
            <label>{{ 'ui.users.name' | t }}</label
            ><input class="input" formControlName="name" />
            @if (err('name'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'ui.users.email' | t }}</label
            ><input class="input" type="email" formControlName="email" />
            @if (err('email'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field">
            <label>{{ 'admin2.phone' | t }}</label
            ><input class="input" type="tel" formControlName="phone" placeholder="+255754000111" />
            <span class="hint">{{ 'admin2.phoneAdminHint' | t }}</span>
            @if (err('phone'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
          <div class="field full">
            <label>{{ 'ui.users.password' | t }}</label
            ><input
              class="input"
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            <span class="hint">{{ 'ui.users.passwordHint' | t }}</span>
            @if (err('password'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        <div class="field full">
          <label>{{ 'ui.users.role' | t }}</label>
          <select class="select" formControlName="roleUid">
            <option value="" disabled>{{ 'ui.users.chooseRole' | t }}</option>
            @for (r of roles.value() ?? []; track r.uid) {
              <option [value]="r.uid">{{ r.name }}</option>
            }
          </select>
          @if (err('roleUid'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <label class="check full"
          ><input type="checkbox" formControlName="allBranches" />
          {{ 'ui.users.everyBranch' | t }}</label
        >
        @if (!form.controls.allBranches.value) {
          <div class="field full">
            <label>{{ 'ui.users.branches' | t }}</label>
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
            ><input type="checkbox" formControlName="active" /> {{ 'ui.users.active' | t }}</label
          >
        }
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'common.save' | t }}
        </button>
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
  /** Members locked out after failed sign-ins, by membership uid. */
  protected readonly locked = loaded<LockedMember[]>(() => ({
    path: '/users/locked',
    options: { noBranch: true, silent: true },
  }));
  private readonly lockedIndex = computed(
    () => new Map((this.locked.value() ?? []).map((l) => [l.membershipUid, l.lockedUntil])),
  );
  private readonly invitationsPanel = viewChild(InvitationsPanelComponent);
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
    phone: [''],
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
    return (
      uids.map((uid) => this.branchIndex().get(uid) ?? '?').join(', ') ||
      this.translations.t('common.none')
    );
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected edit(member: Member | null): void {
    this.current.set(member);
    this.form.reset({
      name: member?.name ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
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
    // A person who has a phone edits it on their own account.
    if (member?.phone) {
      this.form.controls.phone.disable();
    } else {
      this.form.controls.phone.enable();
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
      phone: v.phone.trim() || null,
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
        const added = await this.api.post<{ invited?: boolean }>(
          '/users',
          { name: v.name, email: v.email, password: v.password, ...access },
          { silent: true, noBranch: true },
        );
        if (added?.invited) {
          // The email already has an account: they join only by accepting the invitation.
          this.toasts.success(this.translations.t('security2.invitationSentInstead'));
          this.open.set(false);
          await this.invitationsPanel()?.reload();
          return;
        }
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

  /** When the member's account unlocks by itself, or null when it is not locked. */
  protected lockedUntil(membershipUid: string): string | null {
    return this.lockedIndex().get(membershipUid) ?? null;
  }

  protected async unlock(member: Member): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post(`/users/${member.membershipUid}/unlock`, {}, { noBranch: true });
      this.toasts.success(this.translations.t('security2.unlocked', { name: member.name }));
      await this.locked.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
