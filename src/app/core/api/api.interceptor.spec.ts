import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../session/session.store';
import { ToastService } from '../ui/toast.service';
import { ApiError } from './api-error';
import { Api } from './api.service';
import { apiInterceptor } from './api.interceptor';

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
    expect(session.signedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], { queryParams: { expired: 1 } });
  });
});
