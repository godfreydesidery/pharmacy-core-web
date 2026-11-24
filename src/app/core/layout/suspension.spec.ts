import { ApiError } from '../api/api-error';
import { EN } from '../i18n/en';
import { SW } from '../i18n/sw';
import { KnownSuspension, suspensionFromProbe, suspensionView } from './suspension';

describe('suspensionView', () => {
  it('lets an unpaid pharmacy’s admins pay and take their data, and tells staff who can', () => {
    const admin = suspensionView('SUSPENDED', 'UNPAID', true);
    expect(admin).toMatchObject({ state: 'unpaid', canPay: true, canExport: true, hint: null });
    expect(EN[admin.body]).toContain('download');
    const staff = suspensionView('SUSPENDED', 'UNPAID', false);
    expect(staff).toMatchObject({ state: 'unpaid', canPay: false, canExport: false });
    expect(EN[staff.body]).not.toBe(EN[admin.body]);
    expect(EN[staff.hint!]).toContain('administrator');
  });

  it('explains a legal hold, a suspension by the platform, a closed and an erased pharmacy', () => {
    expect(suspensionView('SUSPENDED', 'DISPUTE', true)).toMatchObject({
      state: 'legal-hold',
      canPay: false,
      canExport: false,
    });
    expect(EN[suspensionView('SUSPENDED', 'DISPUTE', true).body]).toContain('legal order');
    for (const kind of ['ABUSE', 'OTHER', 'PLATFORM'] as const) {
      expect(suspensionView('SUSPENDED', kind, true).state).toBe('platform');
    }
    expect(suspensionView('CLOSED', null, true)).toMatchObject({
      state: 'closed',
      canExport: true,
    });
    expect(suspensionView('CLOSED', null, false).canExport).toBe(false);
    expect(suspensionView('ERASED', null, true)).toMatchObject({
      state: 'erased',
      canExport: false,
    });
  });

  it('stays general while the kind is unknown', () => {
    expect(suspensionView('SUSPENDED', null, false)).toMatchObject({
      state: 'suspended',
      canPay: false,
      canExport: false,
    });
  });

  it('has every text in English and Swahili', () => {
    const kinds: KnownSuspension[] = ['UNPAID', 'DISPUTE', 'ABUSE', 'OTHER', 'PLATFORM', null];
    const views = [
      ...kinds.flatMap((kind) => [true, false].map((a) => suspensionView('SUSPENDED', kind, a))),
      suspensionView('CLOSED', null, true),
      suspensionView('ERASED', null, true),
    ];
    const keys = views.flatMap((v) => [v.title, v.body, ...(v.hint ? [v.hint] : [])]);
    expect(keys.filter((key) => !EN[key] || !SW[key])).toEqual([]);
    expect(SW['state.suspended.unpaid.body.admin']).toContain('{{pharmacy}}');
  });
});

describe('suspensionFromProbe', () => {
  const refused = (reason: string, extras: Record<string, unknown> = {}) =>
    new ApiError(403, reason, 'refused', null, null, null, extras);

  it('reads an answer, or the read-only refusal, as unpaid', () => {
    expect(suspensionFromProbe(null, true)).toBe('UNPAID');
    expect(suspensionFromProbe(refused('tenant_suspended_read_only'), true)).toBe('UNPAID');
  });

  it('knows only "not unpaid" when an admin is refused', () => {
    expect(suspensionFromProbe(refused('tenant_suspended'), true)).toBe('PLATFORM');
    expect(suspensionFromProbe(refused('tenant_suspended'), false)).toBeNull();
  });

  it('takes the kind the problem names', () => {
    const named = refused('tenant_suspended', { suspensionKind: 'DISPUTE' });
    expect(suspensionFromProbe(named, false)).toBe('DISPUTE');
  });
});
