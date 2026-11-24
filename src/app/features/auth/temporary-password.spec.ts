import { HANDOFF_MS, TemporaryPasswordHandoff } from './temporary-password';

function handoffAt(time: { now: number }): TemporaryPasswordHandoff {
  const handoff = new TemporaryPasswordHandoff();
  handoff.now = () => time.now;
  return handoff;
}

describe('TemporaryPasswordHandoff', () => {
  it('hands the password over once', () => {
    const handoff = handoffAt({ now: 1_000 });
    handoff.give('Temp#2026');
    expect(handoff.take()).toBe('Temp#2026');
    expect(handoff.take()).toBeNull();
  });

  it('forgets a password nobody took in time', () => {
    const time = { now: 1_000 };
    const handoff = handoffAt(time);
    handoff.give('Temp#2026');
    time.now += HANDOFF_MS + 1;
    expect(handoff.take()).toBeNull();
  });

  it('keeps nothing in the browser history', () => {
    const before = JSON.stringify(history.state ?? null);
    new TemporaryPasswordHandoff().give('Temp#2026');
    expect(JSON.stringify(history.state ?? null)).toBe(before);
    expect(JSON.stringify(history.state ?? null)).not.toContain('Temp#2026');
  });
});
