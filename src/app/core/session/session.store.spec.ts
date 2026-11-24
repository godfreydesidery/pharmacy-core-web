import { TestBed } from '@angular/core/testing';
import { Membership, Session } from '../api/models';
import { SESSION_STORAGE_KEY, SessionStore } from './session.store';

const membership: Membership = {
  uid: 'm1',
  tenantUid: 't1',
  tenantCode: 'AFYA',
  tenantName: 'Afya Pharmacy',
  tenantStatus: 'ACTIVE',
  roleUid: 'r1',
  roleCode: 'CASHIER',
  roleName: 'Cashier',
  permissions: ['sales.sell', 'sales.view'],
  allBranches: false,
  branches: [{ uid: 'b1', code: 'HQ', name: 'Head Office' }],
};

function session(rootAdmin = false): Session {
  return {
    token: 'pcs_token',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { uid: 'u1', name: 'Ali Salim', email: 'cashier@afya.co.tz', rootAdmin },
    memberships: rootAdmin ? [] : [membership],
  };
}

describe('SessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('grants only the membership permissions in its workspace', () => {
    const store = TestBed.inject(SessionStore);
    store.signIn(session());
    store.enterMembership(membership, membership.branches, null);
    expect(store.tenant()?.code).toBe('AFYA');
    expect(store.branch()?.code).toBe('HQ');
    expect(store.can('sales.sell')).toBe(true);
    expect(store.can('users.manage')).toBe(false);
    expect(store.can(undefined)).toBe(true);
  });

  it('gives the root administrator every permission in any tenant', () => {
    const store = TestBed.inject(SessionStore);
    store.signIn(session(true));
    store.enterAsRoot({ uid: 't9', code: 'X', name: 'Other', status: 'SUSPENDED' }, [], null);
    expect(store.isRoot()).toBe(true);
    expect(store.can('users.manage')).toBe(true);
    expect(store.can('platform.manage')).toBe(true);
    expect(store.branch()).toBeNull();
  });

  it('persists to localStorage and restores on a new instance', () => {
    const store = TestBed.inject(SessionStore);
    store.signIn(session());
    store.enterMembership(membership, membership.branches, membership.branches[0]);
    TestBed.tick();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('pcs_token');

    TestBed.resetTestingModule();
    const restored = TestBed.inject(SessionStore);
    expect(restored.token()).toBe('pcs_token');
    expect(restored.branch()?.uid).toBe('b1');
  });

  it('drops an expired stored session', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        ...session(),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        workspace: null,
      }),
    );
    expect(TestBed.inject(SessionStore).signedIn()).toBe(false);
  });

  it('forgets everything on sign-out', () => {
    const store = TestBed.inject(SessionStore);
    store.signIn(session());
    store.signOut();
    TestBed.tick();
    expect(store.token()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('keeps a shared counter PC session in sessionStorage only, so closing the browser ends it', () => {
    const store = TestBed.inject(SessionStore);
    store.signIn(session());
    store.enterMembership(membership, membership.branches, membership.branches[0]);
    TestBed.tick();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('pcs_token');

    store.useSharedPc(true);
    TestBed.tick();
    expect(store.sharedPc()).toBe(true);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toContain('pcs_token');

    // A reload in the same tab keeps it; a closed browser (empty sessionStorage) does not.
    TestBed.resetTestingModule();
    expect(TestBed.inject(SessionStore).token()).toBe('pcs_token');
    sessionStorage.clear();
    TestBed.resetTestingModule();
    expect(TestBed.inject(SessionStore).signedIn()).toBe(false);
  });

  it('moves the session back to localStorage when the pharmacy turns shared PCs off', () => {
    const store = TestBed.inject(SessionStore);
    store.signIn(session());
    store.useSharedPc(true);
    TestBed.tick();
    store.useSharedPc(false);
    TestBed.tick();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('pcs_token');
    store.signOut();
    TestBed.tick();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
