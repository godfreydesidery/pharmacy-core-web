import { signInLabel } from './sign-in-label';

describe('signInLabel', () => {
  it('shows a staff login with its pharmacy code in capitals', () => {
    expect(signInLabel('juma@dawa')).toBe('juma@DAWA');
  });

  it('leaves an email as it is', () => {
    expect(signInLabel('rehema.admin@dawabora.test')).toBe('rehema.admin@dawabora.test');
  });

  it('is empty without a sign-in', () => {
    expect(signInLabel(null)).toBe('');
  });
});
