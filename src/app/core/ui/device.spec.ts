import { describeDevice, isMobile } from './device';

/** Echoes the key with its parameters, so the test reads what would be translated. */
const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}(${Object.values(params).join(',')})` : key;

describe('describeDevice', () => {
  it('names the browser and the system', () => {
    const chrome =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
    expect(describeDevice(chrome, t)).toBe('ui.sec.browserOn(Chrome,Windows)');
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
    expect(describeDevice(iphone, t)).toBe('ui.sec.browserOn(Safari,iOS)');
    expect(isMobile(iphone)).toBe(true);
    expect(isMobile(chrome)).toBe(false);
  });

  it('tells apps and unknown devices apart', () => {
    expect(describeDevice('okhttp/4.12', t)).toBe('ui.sec.apiClient(okhttp/4.12)');
    expect(describeDevice(null, t)).toBe('ui.sec.unknownDevice');
  });
});
