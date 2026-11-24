/** Swahili texts of fiscal documents (risiti za TRA VFD, hati za marejesho, ripoti Z) and VAT. */
export const FISCAL_SW: Readonly<Record<string, string>> = {
  'nav.finance.z-reports': 'Ripoti Z',

  // VAT registration (settings)
  'vat.registration': 'Usajili wa VAT',
  'vat.registered': 'Imesajiliwa kwa VAT',
  'vat.registeredHint':
    'Ikizimwa: famasia haitozi VAT kwa mauzo yoyote wala kuweka VAT ya manunuzi, bila kujali bidhaa zake.',
  'vat.standardRate': 'Kiwango cha kawaida cha VAT %',
  'vat.standardRateHint':
    'Kiwango ambacho kila bidhaa ya kiwango cha kawaida huuzwa (18% Tanzania; thibitisha).',
  'vat.tin': 'TIN',
  'vat.tinHint': 'Namba ya Utambulisho wa Mlipakodi: tarakimu 9, kama 123-456-789.',
  'vat.vrn': 'VRN',
  'vat.vrnHint': 'Namba ya Usajili wa VAT, kama kwenye cheti cha VAT, kama 40-012345-A.',
  'vat.numbersMissing':
    'Famasia iliyosajiliwa kwa VAT huchapisha TIN na VRN kwenye kila risiti: ziongeze hapa.',

  // products
  'vat.category': 'Aina ya VAT',
  'vat.soldAt': 'Inauzwa kwa VAT {{rate}}%',
  'vat.notRegisteredHint': 'Famasia haijasajiliwa kwa VAT, hivyo haitozwi VAT.',
  'vat.categoryHint':
    'Dawa nyingi hazitozwi VAT Tanzania; thibitisha kila moja na mhasibu wa famasia.',
  'enum.STANDARD': 'Kiwango cha kawaida',
  'enum.ZERO_RATED': 'Kiwango sifuri',
  'enum.EXEMPT': 'Msamaha wa VAT',

  // expenses and goods receipts
  'vat.inTheAmount': 'VAT iliyomo kwenye kiasi',
  'vat.inTheAmountHint': 'Kutoka ankara ya VAT ya msambazaji; inawekwa kama VAT ya manunuzi.',
  'vat.onTheInvoice': 'VAT kwenye ankara',
  'vat.onTheInvoiceHint':
    'Juu ya gharama za kipimo, ambazo hazina VAT; anadaiwa msambazaji na inawekwa kama VAT ya manunuzi.',
  'vat.owed': 'Deni pamoja na VAT',

  // the VAT report
  'vat.inputVat': 'VAT ya manunuzi',
  'vat.netOutputVat': 'VAT ya mauzo ukiondoa marejesho',
  'vat.netPayableHint':
    'VAT ya mauzo ukiondoa marejesho na VAT ya manunuzi; chini ya sifuri ni salio la kudai.',
  'vat.byCategory': 'Mauzo kwa aina ya VAT',
  'vat.salesNet': 'Mauzo (bila VAT)',
  'vat.salesTax': 'VAT ya mauzo',
  'vat.returnsNet': 'Marejesho (bila VAT)',
  'vat.returnsTax': 'VAT ya marejesho',
  'vat.net': 'Jumla bila VAT',
  'vat.tax': 'VAT',

  // receipts and sale detail
  'fiscal.receipt': 'Risiti ya kodi',
  'fiscal.creditNote': 'Hati ya marejesho',
  'fiscal.number': 'Na.',
  'fiscal.verificationCode': 'Namba ya uthibitisho',
  'fiscal.counters': 'GC {{global}} · DC {{daily}}',
  'fiscal.pending': 'Risiti ya kodi inasubiri: itatolewa mara mamlaka ya kodi itakapojibu.',
  'fiscal.failed': 'Mamlaka ya kodi imekataa risiti ya kodi; inaweza kutumwa tena.',
  'fiscal.qr': 'Msimbo QR wa kuthibitisha risiti ya kodi',
  'fiscal.documents': 'Hati za kodi',
  'fiscal.kind': 'Hati',
  'fiscal.status': 'Kodi',
  'fiscal.attempts': 'Majaribio',
  'fiscal.lastError': 'Hitilafu ya mwisho',
  'fiscal.issuedAt': 'Imetolewa',
  'fiscal.retry': 'Tuma tena',
  'fiscal.sent': 'Imetumwa kwa mamlaka ya kodi',
  'enum.ISSUED': 'Imetolewa',
  'enum.RECEIPT': 'Risiti',
  'enum.CREDIT_NOTE': 'Hati ya marejesho',
  'enum.Z_REPORT': 'Ripoti Z',

  // Z reports
  'fiscal.zReports': 'Ripoti Z',
  'fiscal.zReportsSub': 'Siku ya kila tawi, iliyofungwa na mamlaka ya kodi.',
  'fiscal.closeDay': 'Funga siku',
  'fiscal.closeDayHint':
    'Kazi iliyopangwa hufunga kila siku iliyopita yenyewe; funga leo hapa tawi likifungwa.',
  'fiscal.day': 'Siku',
  'fiscal.branch': 'Tawi',
  'fiscal.receipts': 'Risiti',
  'fiscal.creditNotes': 'Hati za marejesho',
  'fiscal.total': 'Jumla',
  'fiscal.vat': 'VAT',
  'fiscal.noZReports': 'Bado hakuna ripoti Z.',
  'fiscal.dayClosed': 'Siku imefungwa: {{number}}',

  // refusals
  'errors.invalid_tin': 'TIN ni tarakimu 9, kama 123-456-789.',
  'errors.invalid_vrn': 'VRN hiyo haiko katika muundo unaojulikana, kama 40-012345-A.',
  'errors.vat_not_registered':
    'Famasia haijasajiliwa kwa VAT, hivyo VAT haiwekwi: iweke ndani ya gharama.',
  'errors.vat_exceeds_amount': 'VAT haiwezi kuzidi kiasi kilicholipwa.',
  'errors.fiscal_document_not_found': 'Hakuna hati hiyo ya kodi katika tawi hili.',
  'errors.fiscal_document_issued': 'Hati hii ya kodi imeshatolewa ({{receiptNumber}}).',
  'errors.fiscal_not_enabled': 'Famasia hii haijaunganishwa na mfumo wa kodi.',
  'errors.invalid_day': 'Siku inaweza kufungwa tu ikishaanza (leo ni {{today}}).',
};
