import { FormControl } from '@angular/forms';
import {
  SINGLE_FACTOR_MIN_PASSWORD,
  TWO_FACTOR_MIN_PASSWORD,
  minPasswordLength,
  passwordValidators,
} from './password-rule';

describe('the password minimum (STD-21)', () => {
  it('is 15 without a second factor and 8 with one', () => {
    expect(SINGLE_FACTOR_MIN_PASSWORD).toBe(15);
    expect(TWO_FACTOR_MIN_PASSWORD).toBe(8);
    expect(minPasswordLength(null)).toBe(15);
    expect(minPasswordLength({ twoFactorEnabled: false, passkeys: 0 })).toBe(15);
    expect(minPasswordLength({ twoFactorEnabled: true, passkeys: 0 })).toBe(8);
    expect(minPasswordLength({ twoFactorEnabled: false, passkeys: 1 })).toBe(8);
  });

  it('takes the API answer when it gives one', () => {
    expect(minPasswordLength({ twoFactorEnabled: true, minPasswordLength: 15 })).toBe(15);
  });

  it('refuses a shorter password and accepts one of the minimum', () => {
    const control = new FormControl('a'.repeat(14), passwordValidators(15));
    expect(control.errors?.['minlength']?.requiredLength).toBe(15);
    control.setValue('correct horse b');
    expect(control.valid).toBe(true);
    control.setValue('x'.repeat(129));
    expect(control.errors?.['maxlength']).toBeTruthy();
  });
});
