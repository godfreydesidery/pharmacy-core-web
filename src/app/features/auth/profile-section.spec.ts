import { PHONE_PATTERN } from './profile-section.component';

describe('PHONE_PATTERN', () => {
  it('takes a phone as people write it, local or international (STD-19)', () => {
    for (const phone of [
      '0754 000 111',
      '0754-000-111',
      '+255754000111',
      '+255 (0)754 000 111',
      '',
    ]) {
      expect(PHONE_PATTERN.test(phone), phone).toBe(true);
    }
  });

  it('refuses what cannot be a phone', () => {
    for (const text of ['call the shop', '12', '+255 754 000 111 ext 4']) {
      expect(PHONE_PATTERN.test(text), text).toBe(false);
    }
  });
});
