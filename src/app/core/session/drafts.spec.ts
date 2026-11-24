import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmService } from '../ui/confirm';
import { DRAFT_TTL_MS, DraftStore } from './drafts';
import { LeaveGuard, UnsavedWork, guardUnsavedWork } from './leave-guard';
import { SessionStore } from './session.store';

@Component({ template: '' })
class FormPage {
  readonly text = signal('');
  readonly unsaved: UnsavedWork = guardUnsavedWork<{ text: string }>(() => !!this.text(), {
    id: () => 'test.form',
    save: () => ({ text: this.text() }),
    restore: (draft) => this.text.set(draft.text),
  });
}

function signInAs(user: string, branch = 'b1'): void {
  const session = TestBed.inject(SessionStore);
  session.signIn({
    token: 'pcs_' + user,
    expiresAt: '2099-01-01T00:00:00Z',
    user: { uid: user, name: user, email: `${user}@x.tz`, rootAdmin: true },
    memberships: [],
  });
  const b = { uid: branch, code: 'HQ', name: 'Main' };
  session.enterAsRoot(
    { uid: 't1', code: 'AFYA', name: 'Afya', status: 'ACTIVE' } as never,
    [b] as never,
    b as never,
  );
}

describe('drafts kept over a forced sign-out (Batch 8 leftover)', () => {
  let confirm: ConfirmService;

  beforeEach(() => {
    localStorage.clear();
    confirm = TestBed.inject(ConfirmService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function open(): FormPage {
    return TestBed.createComponent(FormPage).componentInstance;
  }

  it('keeps the work when nobody can be asked, and offers it back to the same user', async () => {
    signInAs('u1');
    const page = open();
    page.text.set('12 × Amoxicillin, batch B-77');
    // The inactivity sign-out: the page is not asked, it keeps what it can.
    expect(await TestBed.inject(LeaveGuard).canLeave(false)).toBe(true);
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('pharmacy.draft.'));
    expect(keys).toEqual(['pharmacy.draft.v1.t1.b1.u1.test.form']);

    const ask = vi.spyOn(confirm, 'ask').mockResolvedValue(true);
    const again = open();
    expect(await again.unsaved.offerDraft()).toBe(true);
    expect(ask).toHaveBeenCalledOnce();
    expect(ask.mock.calls[0][0].dismissible).toBe(false);
    expect(again.text()).toBe('12 × Amoxicillin, batch B-77');
    // Offered once: the draft is gone afterwards.
    expect(TestBed.inject(DraftStore).read('test.form')).toBeNull();
  });

  it('keeps nothing when the person chose to leave, or when nothing changed', async () => {
    signInAs('u1');
    const page = open();
    vi.spyOn(confirm, 'ask').mockResolvedValue(true);
    expect(await TestBed.inject(LeaveGuard).canLeave(false)).toBe(true);
    page.text.set('typed');
    expect(await TestBed.inject(LeaveGuard).canLeave(true)).toBe(true);
    expect(Object.keys(localStorage).some((k) => k.startsWith('pharmacy.draft.'))).toBe(false);
  });

  it('is never offered to another user or at another branch', async () => {
    signInAs('u1');
    open().text.set('typed by u1');
    await TestBed.inject(LeaveGuard).canLeave(false);
    const ask = vi.spyOn(confirm, 'ask').mockResolvedValue(true);
    signInAs('u2');
    expect(await open().unsaved.offerDraft()).toBe(false);
    signInAs('u1', 'b2');
    expect(await open().unsaved.offerDraft()).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it('expires, and is dropped when the person starts again or saves', async () => {
    signInAs('u1');
    const drafts = TestBed.inject(DraftStore);
    drafts.keep('test.form', { text: 'old' });
    const key = drafts.keyOf('test.form')!;
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.savedAt = new Date(Date.now() - DRAFT_TTL_MS - 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(stored));
    expect(drafts.read('test.form')).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();

    drafts.keep('test.form', { text: 'kept' });
    vi.spyOn(confirm, 'ask').mockResolvedValue(false);
    const page = open();
    expect(await page.unsaved.offerDraft()).toBe(false);
    expect(page.text()).toBe('');
    expect(drafts.read('test.form')).toBeNull();

    drafts.keep('test.form', { text: 'kept' });
    page.unsaved.done();
    expect(drafts.read('test.form')).toBeNull();
  });

  it('survives storage that throws', () => {
    signInAs('u1');
    const drafts = TestBed.inject(DraftStore);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => drafts.keep('test.form', { text: 'x' })).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(drafts.read('test.form')).toBeNull();
  });
});
