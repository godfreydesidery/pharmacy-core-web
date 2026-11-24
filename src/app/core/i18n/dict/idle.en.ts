/** Signing out after a period without use. */
export const IDLE_EN: Readonly<Record<string, string>> = {
  'idle.title': 'Are you still there?',
  'idle.text':
    'For safety you will be signed out in {{seconds}} seconds, as the app has not been used.',
  'idle.stay': 'Stay signed in',
  'idle.signOut': 'Sign out',
  'idle.signedOut':
    'You were signed out because the app was not used for a while. Sign in again to carry on where you were.',
  'idle.audit': 'After {minutes, plural, one {# minute} other {# minutes}} without use',
  'idle.setting': 'Sign out after inactivity (minutes)',
  'idle.settingHint':
    'Anyone who leaves the app untouched this long is signed out, so nobody else can use their account at a shared computer. 5 to 60 minutes; 15 is recommended.',
  'idle.security': 'Security',
};
