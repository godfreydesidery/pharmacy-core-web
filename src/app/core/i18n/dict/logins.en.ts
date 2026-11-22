/** Staff logins a pharmacy creates directly (managed logins), and choosing one's own password. */
export const LOGINS_EN: Readonly<Record<string, string>> = {
  'logins.create': 'Create login',
  'logins.createTitle': 'Create a staff login',
  'logins.createHint':
    'For staff without email, or who start today. They sign in with the username below and a temporary password, then choose their own.',
  'logins.invite': 'Invite by email',
  'logins.inviteOnlyHint':
    'This pharmacy invites people by email: they set their own password when they accept.',
  'logins.username': 'Username',
  'logins.usernameHint': 'They sign in as {{signIn}}.',
  'logins.contactEmail': 'Contact email (optional)',
  'logins.contactEmailHint': 'Where messages go. It is not used to sign in.',
  'logins.phoneHint': 'Messages to them go here by SMS first.',
  'logins.badge': 'Staff login',
  'logins.badgeTitle': 'A login this pharmacy created; you can reset its password.',
  'logins.awaitingChange': 'Temporary password',
  'logins.reset': 'Reset password',
  'logins.resetConfirmTitle': 'Reset the password of {{name}}?',
  'logins.resetConfirmText':
    'They are signed out everywhere and get a new temporary password, which they change when they sign in.',
  'logins.resetConfirm': 'Yes, reset',
  'logins.passwordTitle': 'Give these to {{name}}',
  'logins.passwordText':
    'This password is shown only now. They must choose their own the first time they sign in.',
  'logins.signIn': 'Sign in as',
  'logins.temporaryPassword': 'Temporary password',
  'logins.copy': 'Copy',
  'logins.copied': 'Copied',
  'logins.done': 'Done',
  'logins.created': 'Login created for {{name}}.',
  'logins.wasReset': 'New temporary password for {{name}}.',
  'logins.directSetting': 'The pharmacy may create staff logins',
  'logins.directSettingHint':
    'On: its admin can create logins (username@{{code}}) for staff without email, and reset them. Off: the admin only invites people by email.',
  'logins.signInLabel': 'Email or username',
  'logins.signInPlaceholder': 'you@example.com or juma@DAWA',
  'logins.chooseTitle': 'Choose your own password',
  'logins.chooseText':
    'Your pharmacy gave you a temporary password. Choose your own now; only you will know it.',
  'logins.temporary': 'Temporary password',
  'logins.newPassword': 'New password',
  'logins.confirmPassword': 'Type it again',
  'logins.mismatch': 'The two passwords are not the same.',
  'logins.newPasswordHint': 'At least 8 characters. Avoid one others could guess.',
  'logins.save': 'Save and continue',
  'logins.chosen': 'Your password is set.',
};
