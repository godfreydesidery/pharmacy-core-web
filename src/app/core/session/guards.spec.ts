import { usableReturnUrl } from './guards';

describe('usableReturnUrl', () => {
  it('keeps a page inside the app', () => {
    expect(usableReturnUrl('/sales/history?page=2')).toBe('/sales/history?page=2');
    expect(usableReturnUrl('/dashboard')).toBe('/dashboard');
  });

  it('drops the workspace chooser, so signing in never returns to it and stalls', () => {
    expect(usableReturnUrl('/workspace')).toBeNull();
    expect(usableReturnUrl('/workspace?returnUrl=%2Fworkspace')).toBeNull();
  });

  it('drops the sign-in pages, the root and anything not a path in the app', () => {
    expect(usableReturnUrl('/')).toBeNull();
    expect(usableReturnUrl('/sign-in?expired=1')).toBeNull();
    expect(usableReturnUrl('/reset-password?token=x')).toBeNull();
    expect(usableReturnUrl('https://example.com')).toBeNull();
    expect(usableReturnUrl(null)).toBeNull();
    expect(usableReturnUrl('')).toBeNull();
  });
});
