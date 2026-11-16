import { EN } from '../../core/i18n/en';
import { SW } from '../../core/i18n/sw';
import { Params, translate } from '../../core/i18n/translations.store';
import { retryText } from './retry';

const en = (key: string, params?: Params) => translate(EN, key, params);
const sw = (key: string, params?: Params) => translate(SW, key, params);

describe('retryText', () => {
  it('counts a lockout in minutes from a minute on', () => {
    expect(retryText(900, en)).toBe('Try again in 15 minutes.');
    expect(retryText(61, en)).toBe('Try again in 2 minutes.');
    expect(retryText(60, en)).toBe('Try again in 1 minute.');
    expect(retryText(900, sw)).toBe('Jaribu tena baada ya dakika 15.');
  });

  it('keeps seconds under a minute', () => {
    expect(retryText(42, en)).toBe('Try again in 42 seconds.');
    expect(retryText(42, sw)).toBe('Jaribu tena baada ya sekunde 42.');
  });
});
