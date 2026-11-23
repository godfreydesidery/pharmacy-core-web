import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiInterceptor } from '../../core/api/api.interceptor';
import ForgotPasswordPage from './forgot-password.page';
import { staffLoginCode } from './staff-login';

describe('staffLoginCode', () => {
  it('tells a staff login from an email', () => {
    expect(staffLoginCode('juma@dawa')).toBe('DAWA');
    expect(staffLoginCode(' mary.k@AFYA2 ')).toBe('AFYA2');
    expect(staffLoginCode('juma@dawa.co.tz')).toBeNull();
    expect(staffLoginCode('@DAWA')).toBeNull();
    expect(staffLoginCode('juma')).toBeNull();
    expect(staffLoginCode('')).toBeNull();
  });
});

describe('ForgotPasswordPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function typed(value: string) {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#email')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    return element;
  }

  it('sends a staff login to its pharmacy’s manager, not to an email link', async () => {
    const element = await typed('juma@dawa');
    const notice = element.querySelector('[data-testid="staff-reset"]');
    expect(notice?.textContent).toContain('juma@dawa');
    expect(notice?.textContent).toContain('DAWA');
    expect(notice?.textContent).toContain('Reset password');
    expect(element.querySelector('button[type="submit"]')).toBeNull();
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectNone('/api/v1/auth/password-reset');
  });

  it('keeps the email link for a personal account', async () => {
    const element = await typed('amina@afya.co.tz');
    expect(element.querySelector('[data-testid="staff-reset"]')).toBeNull();
    (element.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    const request = http.expectOne('/api/v1/auth/password-reset');
    expect(request.request.body).toEqual({ email: 'amina@afya.co.tz' });
  });
});
