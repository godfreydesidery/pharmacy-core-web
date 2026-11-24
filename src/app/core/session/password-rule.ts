import { Validators } from '@angular/forms';
import { SecurityOverview } from '../api/security.models';

/**
 * The password minimum (NIST SP 800-63B, owner's decision of 24 Nov 2026, STD-21): 15 characters
 * when the password is the account's only factor, 8 once it has a second factor (an authenticator
 * app or a passkey). The API decides; the forms show and check the same minimum.
 */
export const SINGLE_FACTOR_MIN_PASSWORD = 15;
export const TWO_FACTOR_MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

/** The minimum for the signed-in person's own new password, from `GET /auth/security`. */
export function minPasswordLength(overview: Partial<SecurityOverview> | null | undefined): number {
  if (overview?.minPasswordLength) {
    return overview.minPasswordLength;
  }
  return overview?.twoFactorEnabled || (overview?.passkeys ?? 0) > 0
    ? TWO_FACTOR_MIN_PASSWORD
    : SINGLE_FACTOR_MIN_PASSWORD;
}

/** The validators of a new password of at least `min` characters. */
export function passwordValidators(min: number) {
  return [Validators.required, Validators.minLength(min), Validators.maxLength(MAX_PASSWORD)];
}
