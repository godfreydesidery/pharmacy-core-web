import { Params } from '../../core/i18n/translations.store';

type T = (key: string, params?: Params) => string;

/**
 * When the user may try again after a lockout or throttle: whole minutes (rounded up) from a minute
 * on, so a 15-minute lock reads "15 minutes", not "900 seconds"; seconds below that.
 */
export function retryText(seconds: number, t: T): string {
  if (seconds < 60) {
    return t('security.retryIn', { seconds: Math.max(1, Math.ceil(seconds)) });
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? t('security.retryInMinute') : t('security.retryInMinutes', { minutes });
}
