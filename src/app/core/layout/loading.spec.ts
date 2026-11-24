import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SILENT } from '../api/api.interceptor';
import { LOADING_DELAY_MS, LoadingBarComponent, LoadingState, loadingInterceptor } from './loading';

describe('the loading bar (UX-14)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('counts the requests a page waits on, not the silent background ones', () => {
    const http = TestBed.inject(HttpClient);
    const state = TestBed.inject(LoadingState);
    const backend = TestBed.inject(HttpTestingController);
    http.get('/api/v1/stock').subscribe();
    http.get('/api/v1/pos/prices', { context: new HttpContext().set(SILENT, true) }).subscribe();
    expect(state.requests()).toBe(1);
    expect(state.busy()).toBe(true);
    backend.expectOne('/api/v1/stock').flush({});
    backend.expectOne('/api/v1/pos/prices').flush({});
    expect(state.requests()).toBe(0);
    expect(state.busy()).toBe(false);
  });

  it('shows only after a short wait, and hides when nothing is left to wait for', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(LoadingBarComponent);
    const state = TestBed.inject(LoadingState);
    const bar = () => {
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="loading-bar"]');
    };
    fixture.detectChanges();
    state.started();
    TestBed.tick();
    vi.advanceTimersByTime(LOADING_DELAY_MS - 50);
    expect(bar()).toBeNull();
    vi.advanceTimersByTime(100);
    expect(bar()?.getAttribute('role')).toBe('progressbar');
    state.finished();
    TestBed.tick();
    expect(bar()).toBeNull();
    // A quick answer never shows it.
    state.started();
    TestBed.tick();
    state.finished();
    TestBed.tick();
    vi.advanceTimersByTime(LOADING_DELAY_MS * 2);
    expect(bar()).toBeNull();
  });
});
