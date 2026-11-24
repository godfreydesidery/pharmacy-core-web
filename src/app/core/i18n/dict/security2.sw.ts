/** Kufungwa kwa akaunti, kutoka kwenye vifaa vingine, mialiko na maelezo ya kumbukumbu za ukaguzi. */
export const SECURITY2_SW: Readonly<Record<string, string>> = {
  'security2.locked': 'Imefungwa',
  'security2.lockedUntil': 'Imefungwa kwa sababu ya majaribio mabaya ya kuingia hadi {{time}}',
  'security2.unlock': 'Fungua',
  'security2.unlocked': '{{name}} anaweza kuingia tena',
  'security2.invitationSentInstead':
    'Barua pepe hii tayari ina akaunti, kwa hiyo mwaliko umetumwa; atajiunga atakapoukubali.',
  'security2.signOutOthers':
    'Toka kwenye {count, plural, one {kifaa # kingine} other {vifaa vingine #}}',
  'security2.othersSignedOut':
    'Umetoka kwenye {count, plural, one {kifaa # kingine} other {vifaa vingine #}}',

  // audit trail actions
  'security2.audit.CREATE': 'Imeundwa',
  'security2.audit.UPDATE': 'Imebadilishwa',
  'security2.audit.DELETE': 'Imefutwa',
  'security2.audit.SIGN_IN': 'Ameingia',
  'security2.audit.SIGN_IN_FAILED': 'Kuingia kumeshindwa',
  'security2.audit.SIGN_OUT': 'Ametoka',
  'security2.audit.ACCOUNT_LOCKED': 'Akaunti imefungwa',
  'security2.audit.ACCOUNT_UNLOCKED': 'Akaunti imefunguliwa',
  'security2.audit.SESSION_REVOKED': 'Kifaa kimetolewa',
  'security2.audit.OTHER_SESSIONS_REVOKED': 'Vifaa vingine vimetolewa',
  'security2.audit.PASSWORD_CHANGED': 'Nenosiri limebadilishwa',
  'security2.audit.PASSWORD_RESET': 'Nenosiri limewekwa upya',
  'security2.audit.PASSWORD_RESET_REQUESTED': 'Ombi la kuweka nenosiri upya',
  'security2.audit.TWO_FACTOR_ENABLED': 'Uthibitisho wa hatua mbili umewashwa',
  'security2.audit.TWO_FACTOR_DISABLED': 'Uthibitisho wa hatua mbili umezimwa',
  'security2.audit.RECOVERY_CODE_USED': 'Msimbo wa dharura umetumika',
  'security2.audit.RECOVERY_CODES_REGENERATED': 'Misimbo mipya ya dharura',
  'security2.audit.PASSKEY_REGISTERED': 'Passkey imeongezwa',
  'security2.audit.PASSKEY_REMOVED': 'Passkey imeondolewa',
  'security2.audit.INVITATION_ACCEPTED': 'Mwaliko umekubaliwa',
  'security2.audit.ROLE_PERMISSIONS_CHANGED': 'Ruhusa za jukumu zimebadilishwa',
  'security2.audit.ROOT_ACTED_IN_TENANT': 'Msimamizi mkuu wa mfumo amefanya kazi katika duka hili',

  // server refusals
  'errors.webhook_url_not_allowed':
    'Anwani lazima iwe URL ya https kwenye mtandao wa umma, si ya ndani au binafsi.',
  'errors.code_already_used': 'Msimbo huo umeshatumika; subiri unaofuata.',
  'errors.session_required': 'Ingia tena ili kufanya hivi.',
  'errors.membership_not_found': 'Mtu huyo si mwanachama wa duka hili.',
};
