import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiInterceptor } from '../api/api.interceptor';
import { ConfirmService } from '../ui/confirm';
import { ACTIVITY_STORAGE_KEY, IdleWatch } from './idle';
import { SessionStore } from './session.store';

describe('IdleWatch', () => {
  let http: HttpTestingController;
  let session: SessionStore;
  let confirm: ConfirmService;

  /** Answers the pending activity report with a limit of {@code minutes}. */
  function answerActivity(minutes: number): void {
    http.expectOne('/api/v1/auth/activity').flush({
      success: true,
      data: { idleMinutes: minutes, idleEndsAt: null, expiresAt: '2099-01-01T00:00:00Z' },
    });
  }

  async function passSeconds(seconds: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
  }

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'Date'] });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    confirm = TestBed.inject(ConfirmService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    session.signIn({
      token: 'pcs_abc',
      expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
      user: { uid: 'u1', name: 'Amina', email: 'a@x.tz', rootAdmin: false },
      memberships: [],
    });
    TestBed.inject(IdleWatch);
    TestBed.tick();
    answerActivity(2);
    await passSeconds(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports use at most every half minute, and not without input', async () => {
    await passSeconds(10);
    document.dispatchEvent(new KeyboardEvent('keydown'));
    http.expectNone('/api/v1/auth/activity');
    await passSeconds(25);
    document.dispatchEvent(new PointerEvent('pointerdown'));
    answerActivity(2);
    await passSeconds(20);
    // A mouse merely moving is not use.
    document.dispatchEvent(new MouseEvent('mousemove'));
    http.expectNone('/api/v1/auth/activity');
  });

  it('warns a minute before the end, then signs out as idle', async () => {
    await passSeconds(59);
    expect(confirm.current()).toBeNull();
    await passSeconds(2);
    expect(confirm.current()?.key).toBe('idle');
    expect(confirm.current()?.dismissible).toBe(false);

    // While the warning shows, typing does not answer it; only its buttons do.
    document.dispatchEvent(new KeyboardEvent('keydown'));
    http.expectNone('/api/v1/auth/activity');

    await passSeconds(60);
    const signOut = http.expectOne('/api/v1/auth/sign-out');
    expect(signOut.request.body).toEqual({ reason: 'IDLE' });
    signOut.flush({ success: true, data: null });
    await passSeconds(0);
    expect(session.signedIn()).toBe(false);
    expect(confirm.current()).toBeNull();
  });

  it('"Stay signed in" reports use and keeps the session', async () => {
    await passSeconds(61);
    confirm.settle(true);
    await passSeconds(0);
    answerActivity(2);
    // The two minutes start again: 50 seconds on, 70 are left, so no warning yet.
    await passSeconds(50);
    expect(confirm.current()).toBeNull();
    expect(session.signedIn()).toBe(true);
    await passSeconds(15);
    expect(confirm.current()?.key).toBe('idle');
  });

  it("entering a pharmacy while a report is on its way still applies the pharmacy's limit", async () => {
    session.signOut();
    TestBed.tick();
    session.signIn({
      token: 'pcs_def',
      expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
      user: { uid: 'u1', name: 'Amina', email: 'a@x.tz', rootAdmin: false },
      memberships: [],
    });
    TestBed.tick();
    const first = http.expectOne('/api/v1/auth/activity');
    expect(first.request.headers.has('X-Tenant-Id')).toBe(false);
    session.enterAsRoot(
      { uid: 'tenant-1', code: 'AFYA', name: 'Afya', status: 'ACTIVE' },
      [{ uid: 'branch-1', code: 'HQ', name: 'HQ' }],
      null,
    );
    TestBed.tick();
    http.expectNone('/api/v1/auth/activity');
    first.flush({ success: true, data: { idleMinutes: 2, idleEndsAt: null, expiresAt: null } });
    await passSeconds(0);
    const second = http.expectOne('/api/v1/auth/activity');
    expect(second.request.headers.get('X-Tenant-Id')).toBe('tenant-1');
    second.flush({ success: true, data: { idleMinutes: 5, idleEndsAt: null, expiresAt: null } });
    await passSeconds(0);
    // Five minutes, not two: no warning until four have passed.
    await passSeconds(230);
    expect(confirm.current()).toBeNull();
    await passSeconds(15);
    expect(confirm.current()?.key).toBe('idle');
  });

  it('use in another tab closes the warning', async () => {
    await passSeconds(61);
    expect(confirm.current()?.key).toBe('idle');
    const reported = JSON.stringify({ at: Date.now(), idleMinutes: 2 });
    localStorage.setItem(ACTIVITY_STORAGE_KEY, reported);
    window.dispatchEvent(
      new StorageEvent('storage', { key: ACTIVITY_STORAGE_KEY, newValue: reported }),
    );
    expect(confirm.current()).toBeNull();
    await passSeconds(30);
    expect(session.signedIn()).toBe(true);
  });
});
