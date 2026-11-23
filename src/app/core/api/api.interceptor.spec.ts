import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../session/session.store';
import { ToastService } from '../ui/toast.service';
import { ApiError } from './api-error';
import { Api } from './api.service';
import { apiInterceptor } from './api.interceptor';
import { ConfirmIdentityService } from '../session/confirm-identity';
import { ManagerApprovalService } from '../session/manager-approval';

describe('apiInterceptor', () => {
  let api: Api;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(Api);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.signIn({
      token: 'pcs_abc',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { uid: 'u1', name: 'Amina', email: 'a@x.tz', rootAdmin: true },
      memberships: [],
    });
    session.enterAsRoot(
      { uid: 'tenant-1', code: 'AFYA', name: 'Afya', status: 'ACTIVE' },
      [{ uid: 'branch-1', code: 'HQ', name: 'HQ' }],
      {
        uid: 'branch-1',
        code: 'HQ',
        name: 'HQ',
      },
    );
  });

  afterEach(() => http.verify());

  it('adds the session headers and unwraps the envelope', async () => {
    const result = api.get<{ name: string }>('/settings');
    const request = http.expectOne('/api/v1/settings');
    expect(request.request.headers.get('Authorization')).toBe('Bearer pcs_abc');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant-1');
    expect(request.request.headers.get('X-Branch-Id')).toBe('branch-1');
    expect(request.request.headers.get('X-Correlation-Id')).toMatch(/[0-9a-f-]{36}/);
    request.flush({
      success: true,
      code: 'OK',
      message: 'ok',
      timestamp: '',
      data: { name: 'Afya' },
    });
    expect(await result).toEqual({ name: 'Afya' });
  });

  it('asks for the password on reauthentication_required, then sends the request again', async () => {
    const identity = TestBed.inject(ConfirmIdentityService);
    const asked = vi.spyOn(identity, 'ask').mockResolvedValue(true);
    const result = api.post<{ ok: boolean }>('/auth/passkeys/register/options', {});
    http
      .expectOne('/api/v1/auth/passkeys/register/options')
      .flush(
        { status: 403, reason: 'reauthentication_required', detail: 'Confirm your password.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await Promise.resolve();
    await Promise.resolve();
    expect(asked).toHaveBeenCalledOnce();
    http
      .expectOne('/api/v1/auth/passkeys/register/options')
      .flush({ success: true, data: { ok: true } });
    expect(await result).toEqual({ ok: true });
  });

  it('gives up when the person cancels the password prompt', async () => {
    const identity = TestBed.inject(ConfirmIdentityService);
    vi.spyOn(identity, 'ask').mockResolvedValue(false);
    const result = api.post('/auth/2fa/setup', {});
    http
      .expectOne('/api/v1/auth/2fa/setup')
      .flush(
        { status: 403, reason: 'reauthentication_required', detail: 'Confirm your password.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await expect(result).rejects.toMatchObject({ reason: 'reauthentication_required' });
  });

  it('asks a manager on approval_required, then sends it again with the approval', async () => {
    const approvals = TestBed.inject(ManagerApprovalService);
    const asked = vi.spyOn(approvals, 'ask').mockResolvedValue('pap_token');
    const result = api.post<{ code: string }>('/vouchers', { value: 80000 });
    const first = http.expectOne('/api/v1/vouchers');
    const key = first.request.headers.get('Idempotency-Key');
    first.flush(
      {
        status: 403,
        reason: 'approval_required',
        detail: 'A manager must approve this.',
        action: 'VOUCHER',
        amount: 80000,
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await vi.waitFor(() =>
      expect(asked).toHaveBeenCalledWith({ action: 'VOUCHER', amount: 80000 }),
    );
    const again = await vi.waitFor(() => http.expectOne('/api/v1/vouchers'));
    expect(again.request.headers.get('X-Approval')).toBe('pap_token');
    // The same attempt: the refusal was not recorded, so the same key goes again.
    expect(again.request.headers.get('Idempotency-Key')).toBe(key);
    again.flush({ success: true, data: { code: 'V1' } });
    expect(await result).toEqual({ code: 'V1' });
  });

  it('toasts a refusal of the approved attempt, and does not ask twice', async () => {
    const approvals = TestBed.inject(ManagerApprovalService);
    const asked = vi.spyOn(approvals, 'ask').mockResolvedValue('pap_old');
    const toasts = TestBed.inject(ToastService);
    const result = api.post('/vouchers', {});
    http
      .expectOne('/api/v1/vouchers')
      .flush(
        { status: 403, reason: 'approval_required', action: 'VOUCHER', amount: 1 },
        { status: 403, statusText: 'Forbidden' },
      );
    const again = await vi.waitFor(() => http.expectOne('/api/v1/vouchers'));
    again.flush(
      { status: 403, reason: 'approval_invalid', detail: 'That approval has expired.' },
      { status: 403, statusText: 'Forbidden' },
    );
    await expect(result).rejects.toMatchObject({ reason: 'approval_invalid' });
    expect(asked).toHaveBeenCalledOnce();
    expect(toasts.toasts().at(-1)?.message).toBe('That approval has expired.');
  });

  it('gives up when the manager approval is cancelled', async () => {
    vi.spyOn(TestBed.inject(ManagerApprovalService), 'ask').mockResolvedValue(null);
    const result = api.post('/vouchers', {});
    http
      .expectOne('/api/v1/vouchers')
      .flush(
        { status: 403, reason: 'approval_required', action: 'VOUCHER', amount: 1 },
        { status: 403, statusText: 'Forbidden' },
      );
    await expect(result).rejects.toMatchObject({ reason: 'approval_required' });
  });

  it('sends an Idempotency-Key on money-moving POSTs, not on sales or reads', () => {
    void api.post('/expenses', {});
    void api.post('/sales/s1/returns', {});
    void api.post('/sales', {});
    void api.get('/expenses');
    const expense = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/expenses');
    const ret = http.expectOne('/api/v1/sales/s1/returns');
    const sale = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/sales');
    const read = http.expectOne((r) => r.method === 'GET' && r.url === '/api/v1/expenses');
    expect(expense.request.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    expect(ret.request.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    expect(sale.request.headers.has('Idempotency-Key')).toBe(false);
    expect(read.request.headers.has('Idempotency-Key')).toBe(false);
    for (const r of [expense, ret, sale, read]) r.flush({ success: true, data: {} });
  });

  it('leaves the branch out when asked', () => {
    void api.get('/dashboard', undefined, { noBranch: true });
    const request = http.expectOne('/api/v1/dashboard');
    expect(request.request.headers.has('X-Branch-Id')).toBe(false);
    request.flush({ success: true, data: {} });
  });

  it('turns a problem into an ApiError naming the field, and toasts it', async () => {
    const toasts = TestBed.inject(ToastService);
    const result = api.post('/sales', {});
    http.expectOne('/api/v1/sales').flush(
      {
        status: 422,
        reason: 'insufficient_stock',
        detail: 'Only 2 left',
        field: 'lines[0].quantity',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    const error = (await result.catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.reason).toBe('insufficient_stock');
    expect(error.controlPath).toBe('lines.0.quantity');
    expect(toasts.toasts().at(-1)?.message).toBe('Only 2 left');
  });

  it('signs out and goes to sign-in on 401', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const result = api.get('/auth/me', undefined, { silent: true });
    http
      .expectOne('/api/v1/auth/me')
      .flush(
        { status: 401, reason: 'session_expired' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await result.catch(() => undefined);
    await vi.waitFor(() => expect(session.signedIn()).toBe(false));
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], { queryParams: { expired: 1 } });
  });

  it('says why on 401 session_idle, and records the idle sign-out', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const result = api.get('/settings', undefined, { silent: true });
    http
      .expectOne('/api/v1/settings')
      .flush({ status: 401, reason: 'session_idle' }, { status: 401, statusText: 'Unauthorized' });
    await result.catch(() => undefined);
    await vi
      .waitFor(() => http.expectOne('/api/v1/auth/sign-out'), { interval: 5 })
      .then((req) => {
        expect(req.request.body).toEqual({ reason: 'IDLE' });
        req.flush({ status: 401 }, { status: 401, statusText: 'Unauthorized' });
      });
    await vi.waitFor(() => expect(session.signedIn()).toBe(false));
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], { queryParams: { idle: 1 } });
  });
});
