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
import { Branch, ManagedLoginPassword, Member, Role } from '../../core/api/models';
import { LockedMember } from '../../core/api/security.models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { ConfirmService } from '../../core/ui/confirm';
import { InvitationsPanelComponent } from './invitations-panel.component';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { signInLabel } from '../../core/session/sign-in-label';

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
          @if (session.can('settings.manage')) {
            <a class="btn" routerLink="/admin/audit" [queryParams]="{ action: 'SIGN_IN' }"
              ><app-icon name="clock" [size]="16" /> {{ 'ui.users.signInHistory' | t }}</a
            >
          }
          <a class="btn" routerLink="/admin/roles"
            ><app-icon name="shield" [size]="16" /> {{ 'ui.users.roles' | t }}</a
          >
          @if (canCreateLogins()) {
            <button class="btn" type="button" (click)="edit(null)">
              <app-icon name="plus" [size]="16" /> {{ 'ui.users.add' | t }}
            </button>
            <button class="btn primary" type="button" (click)="createLogin()">
              <app-icon name="plus" [size]="16" /> {{ 'logins.create' | t }}
            </button>
          } @else {
            <button class="btn primary" type="button" (click)="edit(null)">
              <app-icon name="plus" [size]="16" /> {{ 'logins.invite' | t }}
            </button>
          }
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
                        ><small>{{ m.managed ? signInOf(m.email) : m.email }}</small>
                        @if (m.managed) {
                          <span class="badge purple" [title]="'logins.badgeTitle' | t">{{
                            'logins.badge' | t
                          }}</span>
                          @if (m.passwordChangeRequired) {
                            <span class="badge amber">{{ 'logins.awaitingChange' | t }}</span>
                          }
                        }
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
                    @if (m.managed) {
                      <button class="btn sm" type="button" [disabled]="busy()" (click)="reset(m)">
                        <app-icon name="lock" [size]="14" /> {{ 'logins.reset' | t }}
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
        current()
          ? ('ui.users.editTitle' | t: { name: current()!.name })
          : managedMode()
            ? ('logins.createTitle' | t)
            : canCreateLogins()
              ? ('ui.users.add' | t)
              : ('logins.invite' | t)
      "
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        @if (managedMode() && !current()) {
          <p class="hint full">{{ 'logins.createHint' | t }}</p>
        }
        @if (!current() && !managedMode() && !canCreateLogins()) {
          <p class="hint full">{{ 'logins.inviteOnlyHint' | t }}</p>
        }
        @if (!current() || current()!.managed) {
          <div class="field">
            <label>{{ 'ui.users.name' | t }}</label
            ><input class="input" formControlName="name" />
            @if (err('name'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        @if (managedMode() && !current()) {
          <div class="field">
            <label>{{ 'logins.username' | t }}</label>
            <div class="suffixed">
              <input
                class="input"
                formControlName="username"
                autocapitalize="none"
                spellcheck="false"
                placeholder="juma"
              /><span class="suffix">&#64;{{ tenantCode() }}</span>
            </div>
            <span class="hint">{{
              'logins.usernameHint'
                | t: { signIn: (form.controls.username.value || 'juma') + '@' + tenantCode() }
            }}</span>
            @if (err('username'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        @if (!current() && !managedMode()) {
          <div class="field">
            <label>{{ 'ui.users.email' | t }}</label
            ><input class="input" type="email" formControlName="email" />
            @if (err('email'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        @if (managedMode() || current()?.managed) {
          <div class="field">
            <label>{{ 'logins.contactEmail' | t }}</label
            ><input class="input" type="email" formControlName="contactEmail" />
            <span class="hint">{{ 'logins.contactEmailHint' | t }}</span>
            @if (err('contactEmail'); as m) {
              <span class="error">{{ m }}</span>
            }
          </div>
        }
        <div class="field">
          <label>{{ 'admin2.phone' | t }}</label
          ><input class="input" type="tel" formControlName="phone" placeholder="+255754000111" />
          <span class="hint">{{
            (managedMode() || current()?.managed ? 'logins.phoneHint' : 'admin2.phoneAdminHint') | t
          }}</span>
          @if (err('phone'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        @if (!current() && !managedMode() && canCreateLogins()) {
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
          {{ (managedMode() && !current() ? 'logins.create' : 'common.save') | t }}
        </button>
      </ng-container>
    </app-modal>
    <app-modal
      [open]="!!issued()"
      [title]="'logins.passwordTitle' | t: { name: issued()?.member?.name ?? '' }"
      (closed)="issued.set(null)"
    >
      @if (issued(); as given) {
        <p class="muted">{{ 'logins.passwordText' | t }}</p>
        <div class="issued">
          <div>
            <small>{{ 'logins.signIn' | t }}</small>
            <b class="mono">{{ signInOf(given.signIn) }}</b>
          </div>
          <button class="btn sm" type="button" (click)="copy(signInOf(given.signIn))">
            <app-icon name="copy" [size]="14" /> {{ 'logins.copy' | t }}
          </button>
          <div>
            <small>{{ 'logins.temporaryPassword' | t }}</small>
            <b class="mono big">{{ given.temporaryPassword }}</b>
          </div>
          <button class="btn sm" type="button" (click)="copy(given.temporaryPassword)">
            <app-icon name="copy" [size]="14" /> {{ 'logins.copy' | t }}
          </button>
        </div>
      }
      <ng-container footer>
        <button class="btn primary" type="button" (click)="issued.set(null)">
          {{ 'logins.done' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .suffixed {
      display: flex;
      align-items: stretch;
    }
    .suffixed .input {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      min-width: 0;
    }
    .suffix {
      display: grid;
      place-items: center;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-left: 0;
      border-radius: 0 8px 8px 0;
      background: var(--surface-2, var(--bg));
      color: var(--muted);
      font-weight: 600;
    }
    .issued {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px 12px;
      align-items: center;
      margin-top: 12px;
      padding: 14px;
      border: 1px dashed var(--border);
      border-radius: 10px;
    }
    .issued small {
      display: block;
      color: var(--muted);
    }
    .mono {
      font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
      letter-spacing: 0.04em;
    }
    .mono.big {
      font-size: 22px;
    }
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
  private readonly confirm = inject(ConfirmService);
  protected readonly session = inject(SessionStore);
  /** The root administrator lets this pharmacy create staff logins (username@CODE). */
  protected readonly canCreateLogins = computed(() => {
    const tenant = this.session.tenant();
    const membership = this.session.memberships().find((m) => m.tenantUid === tenant?.uid);
    return membership ? membership.directUserCreation !== false : this.session.isRoot();
  });
  protected readonly tenantCode = computed(() => this.session.tenant()?.code ?? '');
  /** Creating a staff login rather than adding someone by email. */
  protected readonly managedMode = signal(false);
  /** A temporary password just issued, shown once. */
  protected readonly issued = signal<ManagedLoginPassword | null>(null);
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
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/)]],
    contactEmail: ['', Validators.email],
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

  /** A staff login, username@CODE, for someone without email or starting today. */
  protected createLogin(): void {
    this.managedMode.set(true);
    this.prepare(null);
  }

  protected edit(member: Member | null): void {
    this.managedMode.set(false);
    this.prepare(member);
  }

  private prepare(member: Member | null): void {
    this.current.set(member);
    this.form.reset({
      name: member?.name ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
      password: '',
      username: '',
      contactEmail: member?.contactEmail ?? '',
      roleUid: member?.roleUid ?? '',
      allBranches: member?.allBranches ?? true,
      active: member?.active ?? true,
    });
    const managed = this.managedMode();
    const enabled = {
      // A managed login's name is the pharmacy's to keep; a person's own is theirs.
      name: !member || !!member.managed,
      email: !member && !managed,
      // Where the pharmacy may only invite, an admin never sets an email account's password.
      password: !member && !managed && this.canCreateLogins(),
      username: !member && managed,
      contactEmail: managed || !!member?.managed,
      // A person who has a phone edits it on their own account; a managed login's is the pharmacy's.
      phone: !member?.phone || !!member.managed,
    };
    for (const [name, on] of Object.entries(enabled)) {
      const control = this.form.get(name)!;
      if (on) {
        control.enable();
      } else {
        control.disable();
      }
    }
    this.selectedBranches.set(member?.branchUids ?? []);
    this.open.set(true);
  }

  /** A managed login's sign-in as people type it: juma@DAWA. */
  protected signInOf(signIn: string): string {
    return signInLabel(signIn);
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.success(this.translations.t('logins.copied'));
    } catch {
      // No clipboard (a page not served securely): the text is on screen to read out.
    }
  }

  protected async reset(member: Member): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translations.t('logins.resetConfirmTitle', { name: member.name }),
      text: this.translations.t('logins.resetConfirmText'),
      icon: 'warning',
      confirmText: this.translations.t('logins.resetConfirm'),
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    try {
      const given = await this.api.post<ManagedLoginPassword>(
        `/users/${member.membershipUid}/reset-password`,
        {},
        { noBranch: true },
      );
      this.issued.set(given);
      this.toasts.success(this.translations.t('logins.wasReset', { name: member.name }));
      await this.list.reload();
    } finally {
      this.busy.set(false);
    }
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
          current.managed
            ? {
                ...access,
                active: v.active,
                name: v.name.trim(),
                contactEmail: v.contactEmail.trim() || null,
              }
            : { ...access, active: v.active },
          { silent: true, noBranch: true },
        );
      } else if (this.managedMode()) {
        const created = await this.api.post<ManagedLoginPassword>(
          '/users/managed',
          {
            username: v.username.trim(),
            name: v.name.trim(),
            contactEmail: v.contactEmail.trim() || null,
            ...access,
          },
          { silent: true, noBranch: true },
        );
        this.open.set(false);
        this.issued.set(created);
        this.toasts.success(this.translations.t('logins.created', { name: created.member.name }));
        await this.list.reload();
        return;
      } else {
        const added = await this.api.post<{ invited?: boolean }>(
          '/users',
          {
            name: v.name,
            email: v.email,
            password: this.canCreateLogins() ? v.password : null,
            ...access,
          },
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
