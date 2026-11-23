import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiInterceptor } from '../api/api.interceptor';
import { SessionStore } from './session.store';
import { SignOutService, returnUrlFor } from './sign-out';

describe('returnUrlFor', () => {
  it('reopens a page kept at sign-out only for the person who was on it', () => {
    expect(returnUrlFor('/sales/42', 'u1', 'u1')).toBe('/sales/42');
    expect(returnUrlFor('/sales/42', 'u1', 'u2')).toBeNull();
  });

  it('opens a link followed while signed out for whoever signs in', () => {
    expect(returnUrlFor('/inventory/stock', null, 'u2')).toBe('/inventory/stock');
  });

  it('still refuses pages not worth returning to', () => {
    expect(returnUrlFor('/workspace', 'u1', 'u1')).toBeNull();
    expect(returnUrlFor('https://evil.example/', null, 'u1')).toBeNull();
  });
});

describe('SignOutService', () => {
  let router: Router;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).signIn({
      token: 'pcs_abc',
      expiresAt: '2099-01-01T00:00:00Z',
      user: { uid: 'u1', name: 'Amina', email: 'a@x.tz', rootAdmin: false },
      memberships: [],
    });
  });

  async function signOut(reason: 'idle' | 'user'): Promise<unknown[]> {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/sales/42');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const ending = TestBed.inject(SignOutService).end(reason);
    await vi.waitFor(() => http.expectOne('/api/v1/auth/sign-out').flush({ success: true }));
    await ending;
    return navigate.mock.calls[0];
  }

  it('names whose page it keeps after an idle sign-out', async () => {
    expect(await signOut('idle')).toEqual([
      ['/sign-in'],
      { queryParams: { idle: 1, returnUrl: '/sales/42', returnFor: 'u1' } },
    ]);
  });

  it('keeps no page when the person signs out', async () => {
    expect(await signOut('user')).toEqual([['/sign-in'], { queryParams: {} }]);
  });
});
