import { DEFAULT_PROVISION_BANDS, provisionBandsProblem } from './provision-bands';

describe('provisionBandsProblem', () => {
  it('accepts the default bands', () => {
    expect(provisionBandsProblem(DEFAULT_PROVISION_BANDS, true)).toBeNull();
  });

  it('needs a band while the write-down is on, none when off', () => {
    expect(provisionBandsProblem([], true)).toBe('writedown.needOne');
    expect(provisionBandsProblem([], false)).toBeNull();
  });

  it('refuses more than five bands', () => {
    const six = [0, 10, 20, 30, 40, 50].map((d) => ({ daysToExpiry: d, percent: 10 }));
    expect(provisionBandsProblem(six, true)).toBe('writedown.tooMany');
  });

  it('refuses days that do not rise or leave 0..730', () => {
    expect(
      provisionBandsProblem(
        [
          { daysToExpiry: 30, percent: 50 },
          { daysToExpiry: 30, percent: 20 },
        ],
        true,
      ),
    ).toBe('writedown.daysOrder');
    expect(provisionBandsProblem([{ daysToExpiry: 731, percent: 5 }], true)).toBe(
      'writedown.daysOrder',
    );
    expect(provisionBandsProblem([{ daysToExpiry: 1.5, percent: 5 }], true)).toBe(
      'writedown.daysOrder',
    );
  });

  it('refuses a percentage out of 0..100 or rising with the days', () => {
    expect(provisionBandsProblem([{ daysToExpiry: 0, percent: 101 }], true)).toBe(
      'writedown.percentRange',
    );
    expect(
      provisionBandsProblem(
        [
          { daysToExpiry: 0, percent: 50 },
          { daysToExpiry: 30, percent: 60 },
        ],
        true,
      ),
    ).toBe('writedown.percentOrder');
  });
});
