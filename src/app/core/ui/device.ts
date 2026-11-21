import { Translations } from '../i18n/translations.store';

type Translate = Translations['t'];

/** True for a phone or tablet browser. */
export function isMobile(agent: string | null | undefined): boolean {
  return !!agent && /android|iphone|ipad|mobile/i.test(agent);
}

/** A browser's user agent in words, such as "Chrome on Windows". */
export function describeDevice(agent: string | null | undefined, t: Translate): string {
  if (!agent) {
    return t('ui.sec.unknownDevice');
  }
  if (!/mozilla\//i.test(agent)) {
    // Not a browser: an app, script or integration (e.g. "okhttp/4.12", "curl/8.4").
    return t('ui.sec.apiClient', { name: agent.split(/[\s(]/)[0] });
  }
  const browser = /edg\//i.test(agent)
    ? 'Edge'
    : /chrome\//i.test(agent)
      ? 'Chrome'
      : /firefox\//i.test(agent)
        ? 'Firefox'
        : /safari\//i.test(agent)
          ? 'Safari'
          : t('ui.sec.browser');
  const system = /windows/i.test(agent)
    ? 'Windows'
    : /android/i.test(agent)
      ? 'Android'
      : /iphone|ipad/i.test(agent)
        ? 'iOS'
        : /mac os/i.test(agent)
          ? 'macOS'
          : /linux/i.test(agent)
            ? 'Linux'
            : t('ui.sec.unknownSystem');
  return t('ui.sec.browserOn', { browser, system });
}
