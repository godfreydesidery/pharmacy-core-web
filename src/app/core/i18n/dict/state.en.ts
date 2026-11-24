/**
 * Account and list states: a list that failed to load, a suspended or closed pharmacy (by why it
 * is suspended), and the forgotten password of a pharmacy's staff login.
 */
export const STATE_EN: Readonly<Record<string, string>> = {
  // a list or record that failed to load (the shared empty widget)
  'state.list.failed': 'This could not be loaded',

  // forgot password: a staff login (name@CODE) is reset by its pharmacy
  'state.forgot.label': 'Email or staff login',
  'state.forgot.staffTitle': '{{login}} is a staff login.',
  'state.forgot.staffBody':
    'Its password is reset by the pharmacy ({{code}}), not by email: ask your manager to open Administration → Users, find your login and choose Reset password. You get a temporary password and choose your own when you sign in.',
  'state.forgot.staffHint':
    "Signing in with a staff login, such as juma@DAWA? Ask your pharmacy's manager to reset its password.",

  // a pharmacy that is not active, by why
  'state.suspended.pay': 'See the invoice and pay',
  'state.suspended.contact':
    'Contact the platform administrator to learn more or to reactivate it.',
  'state.suspended.unpaid.title': 'The subscription is unpaid',
  'state.suspended.unpaid.body.admin':
    "{{pharmacy}}'s subscription is unpaid. You can still see its data and download it, but nothing can be changed, and nobody can sell, until the open invoice is paid.",
  'state.suspended.unpaid.body.staff':
    "{{pharmacy}}'s subscription is unpaid, so nobody can work in it for now.",
  'state.suspended.unpaid.hint':
    "Your pharmacy's administrator can renew it; work resumes once it is paid.",
  'state.suspended.legal-hold.title': 'This pharmacy is under a legal hold',
  'state.suspended.legal-hold.body':
    'Nobody can work in {{pharmacy}} while a dispute or a legal order is settled. Its data is kept exactly as it is, and cannot be erased, until the hold is lifted.',
  'state.suspended.platform.title': 'Suspended by the platform',
  'state.suspended.platform.body':
    'The platform administrator has suspended {{pharmacy}}: nobody can work in it until it is reactivated. Its data is kept safe.',
  'state.suspended.suspended.title': 'This pharmacy is suspended',
  'state.suspended.suspended.body':
    'Nobody can work in {{pharmacy}} for now. Its data is kept safe.',
  'state.suspended.suspended.hint':
    "Its subscription may be unpaid, or the platform may have suspended it: ask your pharmacy's administrator.",
  'state.suspended.closed.title': 'This pharmacy is closed',
  'state.suspended.closed.body':
    '{{pharmacy}} is closed: nobody works in it any more. Its admins can still download its data until it is erased.',
  'state.suspended.erased.title': "This pharmacy's data was erased",
  'state.suspended.erased.body':
    '{{pharmacy}} was closed and its data erased; nothing of it can be opened any more.',
};
