import { ExpiryProvisionBand } from '../../core/api/models';

/** At most this many write-down bands (the API's limit). */
export const MAX_PROVISION_BANDS = 5;

/** The furthest from expiry a band may reach, in days (the API's limit). */
export const MAX_PROVISION_DAYS = 730;

/** The write-down the platform proposes: expired 100%, within 30 days 50%, within 90 days 25%. */
export const DEFAULT_PROVISION_BANDS: readonly ExpiryProvisionBand[] = [
  { daysToExpiry: 0, percent: 100 },
  { daysToExpiry: 30, percent: 50 },
  { daysToExpiry: 90, percent: 25 },
];

/**
 * Why the bands would be refused, as a translation key, or null when the API will take them. The
 * same rule as the API (STD-3): 1 to 5 bands while the write-down is on, days to expiry whole
 * numbers rising from 0 to 730, each percentage 0 to 100 and not rising as expiry gets further.
 */
export function provisionBandsProblem(
  bands: readonly ExpiryProvisionBand[],
  enabled: boolean,
): string | null {
  if (!bands.length) {
    return enabled ? 'writedown.needOne' : null;
  }
  if (bands.length > MAX_PROVISION_BANDS) {
    return 'writedown.tooMany';
  }
  let lastDays = -1;
  let lastPercent = Infinity;
  for (const band of bands) {
    const days = Number(band.daysToExpiry);
    const percent = Number(band.percent);
    if (!Number.isInteger(days) || days <= lastDays || days < 0 || days > MAX_PROVISION_DAYS) {
      return 'writedown.daysOrder';
    }
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return 'writedown.percentRange';
    }
    if (percent > lastPercent) {
      return 'writedown.percentOrder';
    }
    lastDays = days;
    lastPercent = percent;
  }
  return null;
}
