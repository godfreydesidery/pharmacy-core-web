import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmService } from '../ui/confirm';
import { ToastService } from '../ui/toast.service';
import { ApiError } from './api-error';
import { apiInterceptor } from './api.interceptor';
import { Api } from './api.service';
import { StaleRecordService, ifMatch, isStaleWrite } from './concurrency';

const PRECONDITION_FAILED = {
  type: 'about:blank',
  title: 'Precondition Failed',
  status: 412,
  detail: 'Someone else changed this record.',
  reason: 'precondition_failed',
  currentVersion: 8,
};

describe('ifMatch', () => {
  it('sends the version as a strong, quoted entity tag', () => {
    expect(ifMatch(7)).toEqual({ 'If-Match': '"7"' });
    expect(ifMatch(0)).toEqual({ 'If-Match': '"0"' });
  });

  it('sends nothing for a record without a version', () => {
    expect(ifMatch(null)).toEqual({});
    expect(ifMatch(undefined)).toEqual({});
    expect(ifMatch(Number.NaN)).toEqual({});
  });
});

describe('isStaleWrite', () => {
  it('is a 412 precondition_failed or a 409 stale_version, nothing else', () => {
    expect(isStaleWrite(new ApiError(412, 'precondition_failed', 'x'))).toBe(true);
    expect(isStaleWrite(new ApiError(409, 'stale_version', 'x'))).toBe(true);
    expect(isStaleWrite(new ApiError(428, 'precondition_required', 'x'))).toBe(false);
    expect(isStaleWrite(new ApiError(409, 'conflict', 'x'))).toBe(false);
    expect(isStaleWrite(new ApiError(422, 'invalid_gtin', 'x', 'gtin'))).toBe(false);
    expect(isStaleWrite(new Error('x'))).toBe(false);
  });
});

describe('a save that crossed someone else’s change', () => {
  let http: HttpTestingController;
  let api: Api;
  let confirm: ConfirmService;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(Api);
    confirm = TestBed.inject(ConfirmService);
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => http.verify());

  it('keeps the problem’s currentVersion, and shows no toast for a request sent with If-Match', async () => {
    const saving = api.put('/roles/r1', { name: 'Cashier' }, { headers: ifMatch(7) });
    const request = http.expectOne('/api/v1/roles/r1');
    expect(request.request.headers.get('If-Match')).toBe('"7"');
    request.flush(PRECONDITION_FAILED, { status: 412, statusText: 'Precondition Failed' });
    const failure = await saving.catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).reason).toBe('precondition_failed');
    expect((failure as ApiError).extras['currentVersion']).toBe(8);
    expect(toasts.toasts()).toEqual([]);
  });

  it('still shows the toast for any other refusal', async () => {
    const saving = api.put('/roles/r1', { name: '' }, { headers: ifMatch(7) });
    http
      .expectOne('/api/v1/roles/r1')
      .flush(
        { status: 422, reason: 'invalid_name', detail: 'name is required.', field: 'name' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await saving.catch(() => undefined);
    expect(toasts.toasts().map((t) => t.message)).toEqual(['name is required.']);
  });

  it('asks in the app dialog: Reload reads the record again, Keep editing leaves it', async () => {
    const stale = TestBed.inject(StaleRecordService);
    const failure = new ApiError(412, 'precondition_failed', 'changed', null, null, null, {
      currentVersion: 8,
    });
    const reload = vi.fn(() => Promise.resolve());

    const kept = stale.handle(failure, reload);
    const question = confirm.current()!;
    expect(question.title).toBe('Someone else changed this');
    expect(question.text).toContain('reload to see their change');
    expect(question.confirmText).toBe('Reload');
    expect(question.cancelText).toBe('Keep editing');
    expect(question.focus).toBe('cancel');
    confirm.settle(false);
    expect(await kept).toBe(true);
    expect(reload).not.toHaveBeenCalled();

    const reloaded = stale.handle(new ApiError(409, 'stale_version', 'changed'), reload);
    confirm.settle(true);
    expect(await reloaded).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('leaves any other failure to the caller, without asking', async () => {
    const stale = TestBed.inject(StaleRecordService);
    const reload = vi.fn();
    expect(await stale.handle(new ApiError(422, 'invalid_gtin', 'x', 'gtin'), reload)).toBe(false);
    expect(confirm.current()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
