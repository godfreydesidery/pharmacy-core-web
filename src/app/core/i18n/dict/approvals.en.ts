/** A manager's approval on the same screen, and the pharmacy's controls in Settings. */
export const APPROVALS_EN: Readonly<Record<string, string>> = {
  'approval.title': 'Manager approval',
  'approval.text': 'A manager must approve {{action}}. Ask a manager to sign in here.',
  'approval.amount': 'Amount',
  'approval.login': "Manager's email or sign-in",
  'approval.password': "Manager's password",
  'approval.hint':
    'Only someone allowed to approve, other than you, can approve it. It works once.',
  'approval.approve': 'Approve',
  'approval.selfText':
    'You are the only person here who can approve {{action}}. Approve it yourself with your password.',
  'approval.selfHint':
    "It is recorded as a self-approval, and shows as one in the audit trail and the owner's reports. Once someone else can approve, they must.",
  'approval.action.REFUND': 'this refund',
  'approval.action.LATE_RETURN': 'a return after the return window',
  'approval.action.STOCK_WRITE_OFF': 'writing off stock',
  'approval.action.CONTROLLED_WRITE_OFF': 'writing off a controlled medicine',
  'approval.action.LATE_OPENING_STOCK': 'opening stock in a branch that has traded',
  'approval.action.VOUCHER': 'this voucher',
  'approval.action.DEEP_DISCOUNT': 'a discount above the maximum',
  'approval.action.DEEP_PROMOTION': 'a promotion deeper than the maximum discount',
  'approval.action.PERIOD_UNLOCK': 'opening a locked period of the books',
  'approval.action.SCHEDULE_CHANGE': "changing a medicine's dispensing class",
  'approval.action.CREDIT_WRITE_OFF': "writing off a customer's debt",
  'approval.action.SHIFT_VARIANCE': 'closing this shift with a cash difference',
  'approval.action.TRANSFER_SHORTFALL': 'a transfer shortfall',
  'controls.title': 'Approvals and controls',
  'controls.approvalLimit': 'Approval limit',
  'controls.approvalLimitHint':
    'Above this amount a refund, a stock write-off, a voucher or a cash difference at shift close needs a manager. Controlled medicines, late returns, deep discounts, unlocking the books and credit write-offs always do.',
  'controls.returnWindow': 'Return window (days)',
  'controls.returnWindowHint':
    'Goods may come back this many days after the sale; later returns need a manager.',
  'controls.requireOpenShift': 'A cashier opens a till shift before selling',
  'controls.requireOpenShiftHint':
    'Selling, refunds and vouchers need an open shift, so the cash in each till has an owner.',
  'errors.approval_required': 'A manager must approve this.',
  'errors.approval_invalid': 'That approval has expired, was used or does not match. Ask again.',
  'errors.approver_is_requester': 'Someone else must approve: you cannot approve your own request.',
  'errors.not_an_approver': 'That person is not allowed to approve this here.',
  'errors.invalid_return_window': 'The return window must be between 0 and 365 days.',
  'errors.shift_required': 'Open a till shift first.',
  'restock.goesTo': 'Goes to',
  'restock.SHELF': 'Back on the shelf',
  'restock.QUARANTINE': 'Held aside (quarantine)',
  'restock.DAMAGED': 'Damaged: write off',
  'restock.explain':
    'Choose where each item goes. Prescription and controlled medicines are never put back on the shelf: they are held aside until a pharmacist releases or writes them off.',
  'errors.restock_not_allowed':
    'A prescription or controlled medicine cannot go back on the shelf.',
  'rolesNotice.title': 'Recommended roles',
  'rolesNotice.text':
    'Roles are now split so that no one person can sell, refund and write off stock alone. Your pharmacy keeps its roles until you apply the recommended ones.',
  'rolesNotice.gains': 'gains',
  'rolesNotice.loses': 'loses',
  'rolesNotice.apply': 'Apply recommended roles',
  'rolesNotice.show': 'Show the changes',
  'rolesNotice.hide': 'Hide the changes',
  'rolesNotice.keep': 'Keep my roles',
  'rolesNotice.appliedToast': 'The recommended roles were applied.',
  'periodLock.unlockNeedsManager':
    'Moving the lock to an earlier date, or removing it, needs a manager to approve.',
  'errors.supplier_return_needs_receipt':
    'Choose the goods receipt this return belongs to; only a manager can return goods without one.',
  'creditLimit.change': 'Change credit limit',
  'creditLimit.hint':
    'Credit sales above the limit are refused. Changing it is recorded in the audit trail.',
  'creditLimit.saved': 'The credit limit was changed.',
  'creditLimit.notAllowed': 'Only an accountant or a manager can set or change a credit limit.',
  'errors.credit_limit_not_allowed':
    'Only an accountant or a manager can set or change a credit limit.',
  'pos.deepDiscount': 'Above {{max}}%: a manager approves when you complete the sale.',
  'pricing.switchOff': 'Switch off',
  'pricing.confirmSwitchOff':
    'Switch off “{{name}}”? It stays on record and can be switched on again.',
  'errors.invalid_disposition': 'Choose where the returned item goes.',
  'errors.nothing_held': 'Nothing of this line is held aside any more.',
  'errors.invalid_outcome': 'Choose to put it back on the shelf or write it off.',
  'held.title': 'Held aside',
  'held.text':
    'Returned items held aside until a pharmacist checks them. Prescription and controlled medicines can only be written off.',
  'held.quantity': 'Held',
  'held.toShelf': 'Back on the shelf',
  'held.writeOff': 'Write off',
  'held.confirmShelf': 'Put {{quantity}} × {{product}} back on the shelf for sale?',
  'held.confirmWriteOff': 'Write off {{quantity}} × {{product}} as damaged?',
  'held.shelved': '{{quantity}} × {{product}} went back on the shelf.',
  'held.writtenOff': '{{quantity}} × {{product}} was written off.',
  'count.blind': 'Blind count',
  'count.review': 'Review differences',
  'count.lossValue': 'Shortages at cost:',
  'errors.note_required': 'Write a note saying why.',
  'errors.batch_cost_differs':
    'This batch is already in stock at {{batchUnitCost}} a unit, and opening stock of it comes at that cost. Record it as a goods receipt or use another batch number.',
  'errors.receiver_is_sender': 'Someone other than the person who sent it must receive it.',
  'errors.schedule_downgrade':
    'A prescription or controlled medicine cannot be made into a product of a lower class.',
  'errors.no_recipe': 'This product has no pack link or formula to make it from.',
  'errors.recipe_mismatch': 'The quantities do not match the pack link or formula.',
  'errors.inputs_below_formula': 'The ingredients are less than the formula needs.',
  'errors.invalid_days': 'Days must be between 1 and 365.',
  'errors.invalid_received_quantity': 'The received quantity cannot be more than was sent.',
  'transfer.overdue': 'Overdue',
  'transfer.daysInTransit': '{{days}} days in transit',
  'transfer.receiveTitle': 'Receive {{number}}',
  'transfer.receiveText':
    'Count what arrived. Anything short is recorded as a loss of the branch that sent it.',
  'transfer.arrived': 'Arrived',
  'transfer.shortNote': 'What happened to the missing units?',
  'transfer.shortHint': '{{units}} units short. A large loss needs a manager to approve.',
  'controlled.noLonger': 'no longer controlled',
  'openShift.title': 'Open your shift',
  'openShift.text':
    'This pharmacy ties the cash in each till to a cashier. Count the cash in the drawer to start your shift, then carry on.',
  'openShift.float': 'Cash in the drawer',
  'openShift.hintLast':
    'Counted at the last close: {{amount}}. Change it if the drawer holds something else.',
  'openShift.hintNone': 'Type the cash in the drawer, or 0.',
  'openShift.open': 'Open shift and continue',
  'data.preparing':
    'Preparing your export. It downloads here when it is ready; keep this page open.',
  'data.ready': 'Your export is ready and downloading.',
  'data.expired': 'That export has expired. Start a new one.',
  'data.stillPreparing':
    'The export is still being prepared. Try again in a few minutes to download it.',
  'errors.export_running': 'An export is already being prepared.',
  'errors.export_not_found': 'That export no longer exists.',
  'errors.file_too_large_uncompressed': 'The file is too large once unpacked (over 50 MB).',
  'errors.file_too_compressed':
    'The file is packed in a way that is not allowed. Save it again from your spreadsheet program.',
  'errors.file_too_many_entries': 'The file has too many parts to be a normal spreadsheet.',
  'errors.file_not_allowed':
    'This kind of file is not allowed. Use .xlsx or .csv without a password.',
  'errors.cell_too_long': 'A cell holds more than 32,767 characters.',
  'errors.too_many_columns': 'The sheet has data beyond column 200.',
  'providers.reenterSecret': 'The server changed: type the password again, or it will be cleared.',
  'providers.port.587': '587 (STARTTLS, recommended)',
  'providers.port.465': '465 (TLS)',
  'providers.port.2525': '2525 (STARTTLS)',
  'providers.port.2587': '2587 (STARTTLS)',
  'providers.port.25': '25 (STARTTLS)',
  'delivery.smsCapReached':
    'Monthly SMS allowance used: add your own SMS provider or upgrade the plan.',
  'webhooks.rotate': 'Rotate secret',
  'webhooks.confirmRotate':
    'Make a new signing secret for {{url}}? The old one keeps signing for 24 hours, so you can update your receiver.',
  'webhooks.oldUntil': 'The old secret keeps signing until {{time}}.',
  'webhooks.limit': 'At most 10 webhooks per pharmacy.',
  'errors.smtp_host_not_allowed':
    'That mail server address is not allowed. Use a public mail server name.',
  'errors.smtp_port_not_allowed': 'Use port 587, 465, 2525, 2587 or 25.',
  'errors.sms_cap_reached':
    "This month's SMS allowance is used. Add your own SMS provider or upgrade the plan.",
  'errors.webhook_limit': 'At most 10 webhooks per pharmacy.',
  'errors.adapter_not_available': 'That payment method is not available here.',
  'errors.payment_mismatch': 'This payment request belongs to another method or branch.',
  'webhooks.signing':
    'Each delivery is a POST signed the Standard Webhooks way (standardwebhooks.com): headers',
  'webhooks.signingMore':
    '(HMAC-SHA256 of id.timestamp.body with your secret). Reject a timestamp more than 5 minutes off. X-Pharmacy-Signature still comes for now but will be removed.',
};
