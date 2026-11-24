/**
 * Platform and pharmacy administration added after the first release: tenant editing, root
 * administrators, staff profiles, delivery details, opening balances and the setup checklist.
 */
export const ADMIN2_EN: Readonly<Record<string, string>> = {
  // dosage forms
  'enum.ORAL_SOLUTION': 'Oral solution',
  'enum.SPRAY': 'Spray',
  'enum.PATCH': 'Patch',
  'enum.POWDER': 'Powder',
  'enum.LOTION': 'Lotion',
  'enum.PESSARY': 'Pessary',
  'enum.LOZENGE': 'Lozenge',
  'enum.EYE_OINTMENT': 'Eye ointment',
  'enum.INFUSION': 'Infusion',

  // editing a pharmacy (root administrator)
  'admin2.editPharmacy': 'Edit pharmacy',
  'admin2.currencyLockHint': 'Can change only until the pharmacy has posted any transaction.',
  'admin2.contact': 'Contact',
  'admin2.contactName': 'Contact person',
  'admin2.contactEmail': 'Contact email',
  'admin2.contactPhone': 'Contact phone',
  'admin2.pharmacySaved': 'Pharmacy details saved',

  // root administrators
  'admin2.status': 'Status',
  'admin2.sendReset': 'Send password reset',
  'admin2.deactivate': 'Deactivate',
  'admin2.remove': 'Remove',
  'admin2.you': 'You',
  'admin2.confirmDeactivate':
    'Deactivate {{name}}? They are signed out everywhere until reactivated.',
  'admin2.confirmRemove':
    'Remove {{name}} as a root administrator? Their account stays only for pharmacies they belong to.',
  'admin2.rootDeactivated': 'Root administrator deactivated',
  'admin2.rootReactivated': 'Root administrator reactivated',
  'admin2.rootRemoved': 'Root administrator removed',
  'admin2.resetSent': 'A password reset link was sent to {{email}}',

  // profile and phone
  'admin2.profile': 'Profile',
  'admin2.phone': 'Phone',
  'admin2.phoneHint':
    'Such as 0754 000 111 or +255754000111; kept in international form. Used for SMS and WhatsApp alerts.',
  'admin2.phoneAdminHint': 'Only for a person who has no phone yet; people edit their own.',
  'admin2.profileSaved': 'Profile saved',

  // delivery detail
  'admin2.deliveryDetail': 'Message details',
  'admin2.subject': 'Subject',
  'admin2.messageText': 'Message',
  'admin2.secretsMasked': 'Secret parts of links are hidden (•••).',
  'admin2.resend': 'Resend',
  'admin2.resent': 'Sent again to {{to}}',

  // opening balances
  'nav.finance.opening-balances': 'Opening balances',
  'admin2.openingBalances': 'Opening balances',
  'admin2.openingIntro':
    'What the pharmacy held and owed when it started using the system. Posted once; owner’s equity takes the difference.',
  'admin2.openingPosted': 'Opening balances posted as {{number}} on {{date}}.',
  'admin2.cash': 'Cash',
  'admin2.bank': 'Bank',
  'admin2.mobileMoney': 'Mobile money',
  'admin2.inventory': 'Stock at cost',
  'admin2.receivables': 'Customers owe',
  'admin2.payables': 'Owed to suppliers',
  'admin2.capital': 'Owner’s equity',
  'admin2.party': 'Customer or supplier',
  'admin2.type': 'Type',
  'admin2.amount': 'Amount',
  'admin2.owesUs': 'Owes the pharmacy',
  'admin2.weOwe': 'The pharmacy owes',
  'admin2.noParties': 'No customer or supplier balances.',
  'admin2.moneyAndStock': 'Money and stock',
  'admin2.asOf': 'As of',
  'admin2.inventoryHint': 'Stock on hand at cost is {{value}}.',
  'admin2.customersOweUs': 'Customers who owe the pharmacy',
  'admin2.addCustomer': 'Add a customer…',
  'admin2.weOweSuppliers': 'Suppliers the pharmacy owes',
  'admin2.addSupplier': 'Add a supplier…',
  'admin2.capitalHint': 'Everything held less everything owed.',
  'admin2.postOpening': 'Post opening balances',
  'admin2.confirmOpening': 'Post the opening balances? This can be done only once.',
  'admin2.openingSaved': 'Opening balances posted',
  'admin2.overdraw':
    'This takes {{account}} below zero: it holds {{balance}}. You can still save if the money came from elsewhere.',

  // setup checklist
  'admin2.setupTitle': 'Set up your pharmacy',
  'admin2.setupProgress': '{{done}} of {{total}} done',
  'admin2.setupDismiss': 'Hide',
  'admin2.setupMarkDone': 'Mark done',
  'admin2.setup.settings': 'Review settings: tax, receipts, currencies and logo',
  'admin2.setup.branches': 'Add branch addresses and phones',
  'admin2.setup.users': 'Add your staff',
  'admin2.setup.products': 'Add products',
  'admin2.setup.stock': 'Record opening stock',
  'admin2.setup.opening': 'Post opening balances',
  'admin2.setup.rates': 'Record exchange rates for accepted currencies',
  'admin2.setup.providers': 'Check message wording and SMS/email providers',

  // server refusals
  'errors.duplicate_supplier_invoice': 'This supplier invoice is already received.',
  'errors.currency_locked': 'The base currency cannot change once the pharmacy has traded.',
  'errors.last_root_admin': 'The platform needs at least one active root administrator.',
  'errors.cannot_change_self': 'You cannot deactivate or remove yourself.',
  'errors.root_admin_not_found': 'No such root administrator.',
  'errors.invalid_phone': 'Enter a phone such as 0754 000 111 or +255754000111.',
  'errors.delivery_not_found': 'No such message.',
  'errors.cannot_resend': 'In-app messages stay in the inbox; nothing to resend.',
  'errors.opening_balances_posted': 'The opening balances were already posted.',
  'errors.duplicate_party': 'Each customer or supplier appears once.',
};
