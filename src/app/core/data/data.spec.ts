import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiInterceptor } from '../api/api.interceptor';
import { loaded, pagedList } from './data';

describe('a list that fails to load', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const failure = { status: 0, statusText: 'Unknown Error' };

  it('keeps the failure for the empty widget, and Retry reads it again', async () => {
    const list = runInInjectionContext(TestBed.inject(Injector), () =>
      pagedList<{ uid: string }>(() => ({ path: '/products', options: { silent: true } })),
    );
    TestBed.tick();
    await vi.waitFor(() =>
      http
        .expectOne((r) => r.url === '/api/v1/products')
        .error(new ProgressEvent('error'), failure),
    );
    await vi.waitFor(() => expect(list.loading()).toBe(false));
    expect(list.error()?.reason).toBe('network_error');
    expect(list.items()).toEqual([]);

    const retry = list.reload();
    expect(list.error()).toBeNull();
    http
      .expectOne((r) => r.url === '/api/v1/products')
      .flush({ success: true, data: { items: [{ uid: 'p1' }], nextCursor: null, total: 1 } });
    await retry;
    expect(list.error()).toBeNull();
    expect(list.items()).toEqual([{ uid: 'p1' }]);
  });

  it('does the same for one value', async () => {
    const value = runInInjectionContext(TestBed.inject(Injector), () =>
      loaded<{ name: string }>(() => ({ path: '/settings', options: { silent: true } })),
    );
    TestBed.tick();
    await vi.waitFor(() =>
      http.expectOne('/api/v1/settings').error(new ProgressEvent('error'), failure),
    );
    await vi.waitFor(() => expect(value.loading()).toBe(false));
    expect(value.error()?.reason).toBe('network_error');

    const retry = value.reload();
    http.expectOne('/api/v1/settings').flush({ success: true, data: { name: 'Afya' } });
    await retry;
    expect(value.error()).toBeNull();
    expect(value.value()).toEqual({ name: 'Afya' });
  });
});
