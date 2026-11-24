import { Injectable, computed, effect, signal } from '@angular/core';
import { BranchRef, Membership, Session, SessionUser, TenantStatus, Uid } from '../api/models';
import { signInLabel } from './sign-in-label';

/** The tenant the session works in, from a membership or picked by the root administrator. */
export interface WorkspaceTenant {
  uid: Uid;
  code: string;
  name: string;
  status: TenantStatus;
}

export interface Workspace {
  tenant: WorkspaceTenant;
  /** Null while a root administrator works at tenant level without a branch. */
  branch: BranchRef | null;
  branches: BranchRef[];
  roleName: string;
  permissions: string[];
  allBranches: boolean;
}

export interface StoredSession {
  token: string;
  expiresAt: string;
  user: SessionUser;
  memberships: Membership[];
  workspace: Workspace | null;
  /**
   * The workspace pharmacy uses shared counter PCs (WEB-5): the session is kept in this tab's
   * sessionStorage, so it ends when the browser (or the tab) closes, and never in localStorage.
   */
  sharedPc?: boolean;
}

export const SESSION_STORAGE_KEY = 'pharmacy-core.session';

function parse(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }
  const stored = JSON.parse(raw) as StoredSession;
  return new Date(stored.expiresAt).getTime() > Date.now() ? stored : null;
}

/** The kept session: this tab's sessionStorage first (shared counter PCs), then localStorage. */
function read(): StoredSession | null {
  try {
    return (
      parse(sessionStorage.getItem(SESSION_STORAGE_KEY)) ??
      parse(localStorage.getItem(SESSION_STORAGE_KEY))
    );
  } catch {
    return null;
  }
}

function write(session: StoredSession | null): void {
  for (const [storage, keep] of [
    [localStorage, !!session && !session.sharedPc],
    [sessionStorage, !!session?.sharedPc],
  ] as const) {
    try {
      if (keep) {
        storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        storage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      /* storage unavailable (private mode): the session lives in memory only */
    }
  }
}

/**
 * The signed-in session as signals: the token, the user, their memberships and the workspace
 * (tenant + branch) the app works in. It persists to localStorage so a reload keeps the session;
 * for a pharmacy with shared counter PCs it persists to sessionStorage instead, so closing the
 * browser ends it (the API's inactivity limit applies either way).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly state = signal<StoredSession | null>(read());

  readonly session = this.state.asReadonly();
  readonly token = computed(() => this.state()?.token ?? null);
  readonly user = computed(() => this.state()?.user ?? null);
  /** The user's sign-in as people type it: an email, or a staff login such as juma@DAWA. */
  readonly signInName = computed(() => signInLabel(this.state()?.user?.email));
  readonly memberships = computed(() => this.state()?.memberships ?? []);
  readonly workspace = computed(() => this.state()?.workspace ?? null);
  readonly tenant = computed(() => this.workspace()?.tenant ?? null);
  readonly branch = computed(() => this.workspace()?.branch ?? null);
  readonly branches = computed(() => this.workspace()?.branches ?? []);
  readonly isRoot = computed(() => this.user()?.rootAdmin ?? false);
  readonly signedIn = computed(() => this.token() !== null);
  /** The session is kept for this tab only (the pharmacy's shared counter PCs setting). */
  readonly sharedPc = computed(() => this.state()?.sharedPc ?? false);
  private readonly permissionSet = computed(() => new Set(this.workspace()?.permissions ?? []));

  constructor() {
    effect(() => write(this.state()));
  }

  /** Whether the session may use a permission in its workspace; the root administrator always may. */
  can(permission: string | null | undefined): boolean {
    if (!permission) {
      return true;
    }
    if (this.isRoot()) {
      return true;
    }
    return this.permissionSet().has(permission);
  }

  canAny(permissions: readonly string[]): boolean {
    return permissions.length === 0 || permissions.some((permission) => this.can(permission));
  }

  signIn(session: Session): void {
    this.state.set({
      token: session.token,
      expiresAt: session.expiresAt,
      user: session.user,
      memberships: session.memberships,
      workspace: null,
    });
  }

  /** Replaces the user and memberships from `GET /auth/me`, keeping the workspace if still valid. */
  refresh(user: SessionUser, memberships: Membership[]): void {
    this.state.update((current) => {
      if (!current) {
        return current;
      }
      let workspace = current.workspace;
      if (workspace && !user.rootAdmin) {
        const membership = memberships.find((m) => m.tenantUid === workspace!.tenant.uid);
        workspace = membership
          ? Object.assign({}, workspace, this.fromMembership(membership))
          : null;
      }
      return { ...current, user, memberships, workspace };
    });
  }

  /** Works in a membership's tenant, in the given branch or the first it may use. */
  enterMembership(membership: Membership, branches: BranchRef[], branch: BranchRef | null): void {
    this.setWorkspace({
      ...this.fromMembership(membership),
      branches,
      branch: branch ?? branches[0] ?? null,
    });
  }

  /** The root administrator works in any tenant with every permission. */
  enterAsRoot(tenant: WorkspaceTenant, branches: BranchRef[], branch: BranchRef | null): void {
    this.setWorkspace({
      tenant,
      branches,
      branch,
      roleName: 'Root administrator',
      permissions: [],
      allBranches: true,
    });
  }

  /** Replaces the branches the switcher offers, such as after a branch is added or renamed. */
  setBranches(branches: BranchRef[]): void {
    this.state.update((current) => {
      if (!current?.workspace) {
        return current;
      }
      const chosen = current.workspace.branch;
      const branch = chosen ? (branches.find((b) => b.uid === chosen.uid) ?? chosen) : null;
      return { ...current, workspace: { ...current.workspace, branches, branch } };
    });
  }

  switchBranch(branch: BranchRef | null): void {
    this.state.update((current) =>
      current?.workspace ? { ...current, workspace: { ...current.workspace, branch } } : current,
    );
  }

  /**
   * Follows the workspace pharmacy's "Shared counter PCs" setting: on keeps the session in this
   * tab's sessionStorage (it ends when the browser closes) and takes it out of localStorage; off
   * keeps it in localStorage as before.
   */
  useSharedPc(shared: boolean): void {
    this.state.update((current) =>
      current && !!current.sharedPc !== shared ? { ...current, sharedPc: shared } : current,
    );
  }

  leaveWorkspace(): void {
    this.state.update((current) => (current ? { ...current, workspace: null } : current));
  }

  signOut(): void {
    this.state.set(null);
  }

  private setWorkspace(workspace: Workspace): void {
    this.state.update((current) => (current ? { ...current, workspace } : current));
  }

  private fromMembership(membership: Membership): Omit<Workspace, 'branch' | 'branches'> {
    return {
      tenant: {
        uid: membership.tenantUid,
        code: membership.tenantCode,
        name: membership.tenantName,
        status: membership.tenantStatus,
      },
      roleName: membership.roleName,
      permissions: membership.permissions,
      allBranches: membership.allBranches,
    };
  }
}
