import { SW } from '../i18n/sw';
import { Params, translate } from '../i18n/translations.store';
import { DEFAULT_ACCOUNT_NAMES, accountName } from './accounts';

const sw = {
  t: (key: string, params?: Params, fallback?: string) => translate(SW, key, params, fallback),
};

describe('accountName', () => {
  it('translates a default account that kept its seeded name', () => {
    expect(accountName(sw, 'Cash', '1000')).toBe('Pesa taslimu');
    expect(accountName(sw, 'Stock Losses & Adjustments', '5100')).not.toBe(
      'Stock Losses & Adjustments',
    );
  });

  it('keeps a renamed or custom account as typed', () => {
    expect(accountName(sw, 'Cash at Kariakoo', '1000')).toBe('Cash at Kariakoo');
    expect(accountName(sw, 'Generator fuel', '6200')).toBe('Generator fuel');
  });

  it('has a Swahili name for every default account', () => {
    const missing = Object.keys(DEFAULT_ACCOUNT_NAMES).filter((code) => !SW[`account.${code}`]);
    expect(missing).toEqual([]);
  });
});
