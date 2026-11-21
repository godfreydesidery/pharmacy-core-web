import { smoothPath } from './charts';

/** Every y the path names (points and control points), from its M and C commands. */
function ys(path: string): number[] {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]));
}

describe('smoothPath', () => {
  // SVG y grows downwards: the axis (zero sales) is y = 100, the highest day y = 10.
  const days: [number, number][] = [
    [0, 100],
    [10, 100],
    [20, 100],
    [30, 100],
    [40, 60],
    [50, 100],
    [60, 10],
  ];

  it('is a smooth curve through every day', () => {
    const path = smoothPath(days);
    expect(path.startsWith('M0.0,100.0')).toBe(true);
    expect(path.match(/C/g)?.length).toBe(days.length - 1);
    for (const [x, y] of days.slice(1)) {
      expect(path).toContain(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
  });

  it('never dips below the axis or rises above the highest day between days', () => {
    for (const y of ys(smoothPath(days))) {
      expect(y).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(10);
    }
  });

  it('keeps a run of zero days flat on the axis', () => {
    const path = smoothPath(days);
    expect(path).toContain('C3.3,100.0 6.7,100.0 10.0,100.0');
  });

  it('handles no point and a single point', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([[5, 7]])).toBe('M5.0,7.0');
  });
});
