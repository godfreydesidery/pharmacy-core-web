/**
 * The owner's decisions of 24 Nov 2026 (Batch 10, stream 5): shared counter PCs, the password
 * minimum, two root administrators for a legal-hold lift or an erasure, the expiry write-down and
 * the VAT apportionment, and debit notes.
 */
export const DECISIONS_EN: Readonly<Record<string, string>> = {
  'sharedPc.setting': 'Shared counter PCs',
  'sharedPc.hint':
    'Turn on when several people use the same computers. Signing in lasts until the browser is closed, and sales put aside at the till are dropped at the end of the day (in the pharmacy’s time zone) instead of after 12 hours.',

  'writedown.title': 'Stock write-down',
  'writedown.enabled': 'Write down stock near or past its expiry each month',
  'writedown.hint':
    'Each month the books set aside part of the cost of stock that has expired or will expire soon (an expense against an inventory provision), and adjust last month’s amount. Your accountant should confirm these percentages before you rely on them. A change applies from the next monthly run.',
  'writedown.days': 'Days to expiry',
  'writedown.daysHint': '0 = already expired',
  'writedown.percent': 'Write down %',
  'writedown.expired': 'Expired',
  'writedown.within': 'Within {{days}} days',
  'writedown.add': 'Add band',
  'writedown.remove': 'Remove band',
  'writedown.needOne': 'Add at least one band, or turn the write-down off.',
  'writedown.tooMany': 'At most {{max}} bands.',
  'writedown.daysOrder': 'Days to expiry must rise from band to band, from 0 to 730.',
  'writedown.percentRange': 'Each percentage is between 0 and 100.',
  'writedown.percentOrder': 'A band further from expiry cannot have a higher percentage.',

  'apportion.title': 'VAT apportionment',
  'apportion.hint':
    'Input VAT on costs that serve both taxable and exempt sales is reclaimed only in part. Your accountant (or TRA) should confirm the method. A change applies from the next monthly run.',
  'apportion.method': 'Method',
  'apportion.AUTOMATIC': 'Automatic: the taxable share of sales',
  'apportion.FIXED': 'A fixed percentage agreed with TRA or the accountant',
  'apportion.automaticHint':
    'Each month uses that month’s share of standard and zero-rated sales in all sales; the year-end month corrects the year to the year’s share.',
  'apportion.fixedPercent': 'Recoverable %',
  'apportion.fixedRequired': 'Enter the recoverable percentage for the fixed method.',
  'apportion.yearEnd': 'Financial year ends in',
  'apportion.roundUp': 'Round the share up to the next whole percent',
  'apportion.roundUpHint':
    'Common practice for the standard method; turn off to keep two decimals.',

  'password.minLength': 'At least {{min}} characters.',
  'password.minLengthTwoFactor':
    'At least {{min}} characters (8 is enough once two-factor is on; 15 without it).',
  'password.resetHint':
    'At least 15 characters, or 8 if your account uses two-factor (an authenticator app or a passkey).',
  'password.tooShort': 'Use at least {{min}} characters.',
  'password.changeFirst':
    'Turning two-factor off needs a password of at least {{min}} characters. Change your password first.',

  'nav.platform-approvals': 'Pending approvals',
  'nav.platform.approvals': 'Pending approvals',
  'rootApproval.title': 'Pending approvals',
  'rootApproval.sub':
    'Lifting a legal hold and erasing a pharmacy need a second root administrator.',
  'rootApproval.none': 'Nothing is waiting for approval.',
  'rootApproval.action.LIFT_LEGAL_HOLD': 'Lift the legal hold',
  'rootApproval.action.ERASE_TENANT': 'Erase the pharmacy',
  'rootApproval.status.PENDING': 'Waiting',
  'rootApproval.status.EXECUTED': 'Done',
  'rootApproval.status.CANCELLED': 'Cancelled',
  'rootApproval.status.EXPIRED': 'Expired',
  'rootApproval.requestedBy': 'Asked by',
  'rootApproval.expires': 'Expires',
  'rootApproval.reason': 'Reason',
  'rootApproval.approve': 'Approve',
  'rootApproval.cancel': 'Cancel request',
  'rootApproval.approveTitle': 'Approve: {{action}}',
  'rootApproval.approveText':
    '{{action}} for {{name}} was asked by {{who}}. It happens as soon as you approve. Type your own password to approve.',
  'rootApproval.password': 'Your password',
  'rootApproval.code': 'Two-factor code (if your account uses one)',
  'rootApproval.yours': 'You asked for this; another root administrator approves it.',
  'rootApproval.requested':
    'Request sent. A second root administrator must approve it under Pending approvals.',
  'rootApproval.approved': 'Approved and done.',
  'rootApproval.cancelled': 'Request cancelled.',
  'rootApproval.cancelConfirm': 'Cancel this request?',
  'rootApproval.liftTitle': 'Ask to lift the legal hold',
  'rootApproval.liftText':
    'A second root administrator must approve before the hold is lifted. Say why it can be lifted.',
  'rootApproval.reasonPlaceholder': 'Why, for the record',
  'rootApproval.ask': 'Send for approval',
  'rootApproval.pendingHere': 'A request is waiting for a second root administrator.',

  'statements.tab.writedown': 'Expiry write-down',
  'writedownReport.title': 'Expiry write-down',
  'writedownReport.sub':
    'The monthly provision for stock near or past its expiry, by branch and band. Your accountant should confirm the method.',
  'writedownReport.period': 'Month',
  'writedownReport.stockAtCost': 'Stock at cost',
  'writedownReport.provision': 'Provision',
  'writedownReport.previous': 'Last month',
  'writedownReport.adjustment': 'Adjustment',
  'writedownReport.journal': 'Journal',
  'writedownReport.off': 'Write-down off',
  'writedownReport.costAtRisk': 'Cost in band',
  'writedownReport.branch': 'Branch',
  'writedownReport.none': 'No monthly run in this range yet.',
  'writedownReport.runNow': 'Run last month now',

  'vatReport.reclaimable': 'Reclaimable input VAT',
  'vatReport.nonReclaimable': 'Not reclaimable (to expense)',
  'vatReport.beforeApportionment': 'Input VAT before apportionment',
  'vatReport.apportionment': 'Apportionment',
  'vatReport.ratio': 'Recoverable share',
  'vatReport.kind.MONTHLY': 'Month',
  'vatReport.kind.ANNUAL': 'Year true-up',
  'vatReport.method.AUTOMATIC': 'Automatic',
  'vatReport.method.FIXED': 'Fixed',
  'vatReport.debitNotes': 'Debit notes',
  'vatReport.salesDebitNotes': 'To customers',
  'vatReport.purchaseDebitNotes': 'From suppliers',
  'vatReport.net': 'Net',
  'vatReport.vat': 'VAT',

  'payables.type.DEBIT_NOTE': 'Supplier debit note',

  'errors.invalid_provision_bands':
    'The write-down bands are not valid: 1 to {{maxBands}} bands, days to expiry rising from 0 to {{maxDays}}, each percentage from 0 to 100 and not rising.',
  'errors.invalid_apportionment_method': 'Choose the automatic or the fixed method.',
  'errors.invalid_recoverable_percent':
    'The recoverable percentage is between {{min}} and {{max}}.',
  'errors.recoverable_percent_required':
    'The fixed method needs the recoverable percentage agreed with TRA or the accountant.',
  'errors.invalid_year_end_month': 'The financial year ends in a month from 1 to 12.',
  'errors.password_too_short': 'The password must have at least {{minLength}} characters.',
  'errors.password_too_short_without_two_factor':
    'Without two-factor a password needs at least {{minLength}} characters. Change your password first, then turn two-factor off.',
  'errors.second_root_admin_required':
    'This needs a second root administrator to approve it, and there is only one. Add another root administrator first.',
  'errors.root_approval_pending': 'A request for this is already waiting for approval.',
  'errors.not_under_legal_hold': 'This pharmacy is not under a legal hold.',
  'errors.root_approval_closed': 'This request is no longer waiting: it was done or cancelled.',
  'errors.root_approval_expired': 'This request expired before it was approved; ask again.',
  'errors.root_approval_required':
    'This needs a second root administrator: send it for approval under Pending approvals.',
  'errors.debit_note_needs_customer':
    'A debit note charges a customer’s account, and this sale has no customer.',
  'errors.debit_note_base_currency_only':
    'A debit note can be recorded only for a receipt in the base currency.',
};
