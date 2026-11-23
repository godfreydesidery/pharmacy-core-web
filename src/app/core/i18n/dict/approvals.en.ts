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
};
