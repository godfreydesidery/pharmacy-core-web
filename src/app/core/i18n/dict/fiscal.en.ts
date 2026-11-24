/** English texts of fiscal documents (TRA VFD receipts, credit notes, Z reports) and VAT. */
export const FISCAL_EN: Readonly<Record<string, string>> = {
  'nav.finance.z-reports': 'Z reports',

  // VAT registration (settings)
  'vat.registration': 'VAT registration',
  'vat.registered': 'Registered for VAT',
  'vat.registeredHint':
    'Off: the pharmacy charges no VAT on any sale and books no input VAT, whatever its products say.',
  'vat.standardRate': 'Standard VAT rate %',
  'vat.standardRateHint': 'What every standard-rated product is sold at (18% in Tanzania; verify).',
  'vat.tin': 'TIN',
  'vat.tinHint': 'Taxpayer Identification Number: 9 digits, such as 123-456-789.',
  'vat.vrn': 'VRN',
  'vat.vrnHint': 'VAT Registration Number, as on the VAT certificate, such as 40-012345-A.',
  'vat.numbersMissing':
    'A VAT-registered pharmacy prints its TIN and VRN on every receipt: add them here.',

  // products
  'vat.category': 'VAT category',
  'vat.soldAt': 'Sold at {{rate}}% VAT',
  'vat.notRegisteredHint': 'The pharmacy is not VAT-registered, so no VAT is charged on it.',
  'vat.categoryHint':
    'Most medicines are exempt in Tanzania; check each with the pharmacy’s accountant.',
  'enum.STANDARD': 'Standard rate',
  'enum.ZERO_RATED': 'Zero-rated',
  'enum.EXEMPT': 'Exempt',

  // expenses and goods receipts
  'vat.inTheAmount': 'VAT in the amount',
  'vat.inTheAmountHint': 'From the supplier’s VAT invoice; booked as input VAT.',
  'vat.onTheInvoice': 'VAT on the invoice',
  'vat.onTheInvoiceHint':
    'On top of the unit costs, which exclude VAT; owed to the supplier and booked as input VAT.',
  'vat.owed': 'Owed with VAT',

  // the VAT report
  'vat.inputVat': 'Input VAT',
  'vat.netOutputVat': 'Output VAT less returns',
  'vat.netPayableHint': 'Output VAT less returns less input VAT; below zero is a credit.',
  'vat.byCategory': 'Sales by VAT category',
  'vat.salesNet': 'Sales (net)',
  'vat.salesTax': 'VAT on sales',
  'vat.returnsNet': 'Returns (net)',
  'vat.returnsTax': 'VAT on returns',
  'vat.net': 'Net',
  'vat.tax': 'VAT',

  // receipts and sale detail
  'fiscal.receipt': 'Fiscal receipt',
  'fiscal.creditNote': 'Credit note',
  'fiscal.number': 'No.',
  'fiscal.verificationCode': 'Verification code',
  'fiscal.counters': 'GC {{global}} · DC {{daily}}',
  'fiscal.pending': 'Fiscal receipt pending: it is issued as soon as the tax authority answers.',
  'fiscal.failed': 'The tax authority refused the fiscal receipt; it can be sent again.',
  'fiscal.qr': 'QR code to verify the fiscal receipt',
  'fiscal.documents': 'Fiscal documents',
  'fiscal.kind': 'Document',
  'fiscal.status': 'Fiscal',
  'fiscal.attempts': 'Attempts',
  'fiscal.lastError': 'Last error',
  'fiscal.issuedAt': 'Issued',
  'fiscal.retry': 'Send again',
  'fiscal.sent': 'Sent to the tax authority',
  'enum.ISSUED': 'Issued',
  'enum.RECEIPT': 'Receipt',
  'enum.CREDIT_NOTE': 'Credit note',
  'enum.Z_REPORT': 'Z report',

  // Z reports
  'fiscal.zReports': 'Z reports',
  'fiscal.zReportsSub': 'Each branch’s day, closed with the tax authority.',
  'fiscal.closeDay': 'Close the day',
  'fiscal.closeDayHint':
    'The scheduled job closes each past day by itself; close today here when the branch shuts.',
  'fiscal.day': 'Day',
  'fiscal.branch': 'Branch',
  'fiscal.receipts': 'Receipts',
  'fiscal.creditNotes': 'Credit notes',
  'fiscal.total': 'Total',
  'fiscal.vat': 'VAT',
  'fiscal.noZReports': 'No Z reports yet.',
  'fiscal.dayClosed': 'Day closed: {{number}}',

  // refusals
  'errors.invalid_tin': 'A TIN is 9 digits, such as 123-456-789.',
  'errors.invalid_vrn': 'That VRN is not in a known form, such as 40-012345-A.',
  'errors.vat_not_registered':
    'The pharmacy is not VAT-registered, so no VAT is recorded: put it in the cost instead.',
  'errors.vat_exceeds_amount': 'The VAT cannot be more than the amount paid.',
  'errors.fiscal_document_not_found': 'No such fiscal document at this branch.',
  'errors.fiscal_document_issued': 'This fiscal document is issued already ({{receiptNumber}}).',
  'errors.fiscal_not_enabled': 'No fiscal integration is on for this pharmacy.',
  'errors.invalid_day': 'A day can be closed only once it has begun (today is {{today}}).',
};
