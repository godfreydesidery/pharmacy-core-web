import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../core/api/api.service';
import { RootApproval } from '../../core/api/models';
import { SessionStore } from '../../core/session/session.store';
import { ConfirmService } from '../../core/ui/confirm';
import { RootApprovalsComponent } from './root-approvals.component';

function approval(uid: string, requestedByUid: string): RootApproval {
  return {
    uid,
    action: 'LIFT_LEGAL_HOLD',
    tenantUid: 't1',
    tenantCode: 'AFYA',
    tenantName: 'Afya Pharmacy',
    reason: 'Dispute settled',
    status: 'PENDING',
    requestedByUid,
    requestedByName: requestedByUid === 'me' ? 'Me' : 'Neema',
    requestedAt: '2026-11-24T08:00:00Z',
    expiresAt: '2026-11-25T08:00:00Z',
    approvedByUid: null,
    approvedByName: null,
    approvedAt: null,
    cancelledAt: null,
  };
}

class FakeApi {
  pending: RootApproval[] = [approval('a1', 'other'), approval('a2', 'me')];
  readonly posts: { path: string; body: Record<string, unknown> }[] = [];

  get(path: string): Promise<unknown> {
    return Promise.resolve(path === '/platform/approvals' ? [...this.pending] : []);
  }

  post(path: string, body: Record<string, unknown>): Promise<unknown> {
    this.posts.push({ path, body });
    const uid = path.split('/')[3];
    this.pending = this.pending.filter((a) => a.uid !== uid);
    return Promise.resolve({ ...approval(uid, 'other'), status: 'EXECUTED' });
  }
}

describe('RootApprovalsComponent (FRD-18)', () => {
  let api: FakeApi;

  beforeEach(() => {
    localStorage.clear();
    api = new FakeApi();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Api, useValue: api },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(true) } },
      ],
    });
    TestBed.inject(SessionStore).signIn({
      token: 'pcs_x',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { uid: 'me', name: 'Me', email: 'root@pharmacy.local', rootAdmin: true },
      memberships: [],
    });
  });

  async function settle(fixture: { whenStable(): Promise<unknown> }) {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
    await fixture.whenStable();
  }

  it('lets another root administrator approve with their password, never the one who asked', async () => {
    const fixture = TestBed.createComponent(RootApprovalsComponent);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const mine = element.querySelector('[data-testid="root-approval-a2"]')!;
    expect(mine.querySelector('[data-testid="root-approve"]')).toBeNull();
    expect(mine.textContent).toContain('another root administrator approves it');

    const theirs = element.querySelector('[data-testid="root-approval-a1"]')!;
    theirs.querySelector<HTMLButtonElement>('[data-testid="root-approve"]')!.click();
    await settle(fixture);
    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-testid="root-approve-confirm"]',
    )!;
    expect(confirm.disabled).toBe(true);
    const password = document.querySelector<HTMLInputElement>(
      '[data-testid="root-approve-password"]',
    )!;
    password.value = 'Root#2026-long-pass';
    password.dispatchEvent(new Event('input'));
    await settle(fixture);
    confirm.click();
    await settle(fixture);
    expect(api.posts).toEqual([
      {
        path: '/platform/approvals/a1/approve',
        body: { password: 'Root#2026-long-pass', code: null },
      },
    ]);
    expect(element.querySelector('[data-testid="root-approval-a1"]')).toBeNull();
  });

  it('cancels a request after the in-app question', async () => {
    const fixture = TestBed.createComponent(RootApprovalsComponent);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    element
      .querySelector('[data-testid="root-approval-a2"]')!
      .querySelector<HTMLButtonElement>('[data-testid="root-cancel"]')!
      .click();
    await settle(fixture);
    expect(api.posts[0].path).toBe('/platform/approvals/a2/cancel');
  });
});
