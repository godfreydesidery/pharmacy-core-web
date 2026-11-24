/** Account locks, signing out other devices, invitations instead of silent membership, audit labels. */
export const SECURITY2_EN: Readonly<Record<string, string>> = {
  'security2.locked': 'Locked',
  'security2.lockedUntil': 'Locked after failed sign-ins until {{time}}',
  'security2.unlock': 'Unlock',
  'security2.unlocked': '{{name}} can sign in again',
  'security2.invitationSentInstead':
    'This email already has an account, so an invitation was sent; they join when they accept.',
  'security2.signOutOthers':
    'Sign out of {count, plural, one {# other device} other {# other devices}}',
  'security2.othersSignedOut':
    'Signed out of {count, plural, one {# other device} other {# other devices}}',

  // audit trail actions
  'security2.audit.CREATE': 'Created',
  'security2.audit.UPDATE': 'Updated',
  'security2.audit.DELETE': 'Deleted',
  'security2.audit.SIGN_IN': 'Signed in',
  'security2.audit.SIGN_IN_FAILED': 'Failed sign-in',
  'security2.audit.SIGN_OUT': 'Signed out',
  'security2.audit.ACCOUNT_LOCKED': 'Account locked',
  'security2.audit.ACCOUNT_UNLOCKED': 'Account unlocked',
  'security2.audit.SESSION_REVOKED': 'Device signed out',
  'security2.audit.OTHER_SESSIONS_REVOKED': 'Other devices signed out',
  'security2.audit.PASSWORD_CHANGED': 'Password changed',
  'security2.audit.PASSWORD_RESET': 'Password reset',
  'security2.audit.PASSWORD_RESET_REQUESTED': 'Password reset requested',
  'security2.audit.TWO_FACTOR_ENABLED': 'Two-step verification on',
  'security2.audit.TWO_FACTOR_DISABLED': 'Two-step verification off',
  'security2.audit.RECOVERY_CODE_USED': 'Recovery code used',
  'security2.audit.RECOVERY_CODES_REGENERATED': 'New recovery codes',
  'security2.audit.PASSKEY_REGISTERED': 'Passkey added',
  'security2.audit.PASSKEY_REMOVED': 'Passkey removed',
  'security2.audit.INVITATION_ACCEPTED': 'Invitation accepted',
  'security2.audit.ROLE_PERMISSIONS_CHANGED': 'Role permissions changed',
  'security2.audit.ROOT_ACTED_IN_TENANT': 'Root administrator worked in this pharmacy',

  // server refusals
  'errors.webhook_url_not_allowed':
    'The address must be an https URL on the public internet, not a local or private one.',
  'errors.code_already_used': 'That code was already used; wait for the next one.',
  'errors.session_required': 'Sign in again to do this.',
  'errors.membership_not_found': 'That person is not a member of this pharmacy.',
};
