/**
 * Maamuzi ya mmiliki ya 24 Nov 2026 (Batch 10, mkondo 5): kompyuta za kaunta zinazoshirikiwa,
 * urefu wa nenosiri, wasimamizi wakuu wawili, upunguzaji wa thamani ya bidhaa zinazokaribia
 * kuisha muda, mgawanyo wa VAT na hati za deni.
 */
export const DECISIONS_SW: Readonly<Record<string, string>> = {
  'sharedPc.setting': 'Kompyuta za kaunta zinazoshirikiwa',
  'sharedPc.hint':
    'Washa watu kadhaa wanapotumia kompyuta zilezile. Kuingia kunadumu hadi kivinjari kifungwe, na mauzo yaliyowekwa kando kwenye kaunta yanaondolewa mwisho wa siku (kwa saa za duka la dawa) badala ya baada ya saa 12.',

  'writedown.title': 'Upunguzaji wa thamani ya bidhaa',
  'writedown.enabled': 'Punguza thamani ya bidhaa zinazokaribia au zilizopita muda kila mwezi',
  'writedown.hint':
    'Kila mwezi vitabu vinatenga sehemu ya gharama ya bidhaa zilizoisha muda au zitakazoisha karibuni (gharama dhidi ya akiba ya bidhaa), na kurekebisha kiasi cha mwezi uliopita. Mhasibu wako athibitishe asilimia hizi kabla ya kuzitegemea. Badiliko linaanza kwenye mzunguko ujao wa mwezi.',
  'writedown.days': 'Siku hadi kuisha muda',
  'writedown.daysHint': '0 = tayari zimeisha muda',
  'writedown.percent': 'Punguza %',
  'writedown.expired': 'Zimeisha muda',
  'writedown.within': 'Ndani ya siku {{days}}',
  'writedown.add': 'Ongeza kundi',
  'writedown.remove': 'Ondoa kundi',
  'writedown.needOne': 'Ongeza angalau kundi moja, au zima upunguzaji.',
  'writedown.tooMany': 'Makundi {{max}} kwa juu kabisa.',
  'writedown.daysOrder': 'Siku hadi kuisha muda ziongezeke kundi kwa kundi, kutoka 0 hadi 730.',
  'writedown.percentRange': 'Kila asilimia iwe kati ya 0 na 100.',
  'writedown.percentOrder':
    'Kundi lililo mbali zaidi na kuisha muda haliwezi kuwa na asilimia kubwa zaidi.',

  'apportion.title': 'Mgawanyo wa VAT',
  'apportion.hint':
    'VAT ya manunuzi kwenye gharama zinazohudumia mauzo yanayotozwa kodi na yasiyotozwa inarudishwa kwa sehemu tu. Mhasibu wako (au TRA) athibitishe njia. Badiliko linaanza kwenye mzunguko ujao wa mwezi.',
  'apportion.method': 'Njia',
  'apportion.AUTOMATIC': 'Moja kwa moja: sehemu ya mauzo yanayotozwa kodi',
  'apportion.FIXED': 'Asilimia maalum iliyokubaliwa na TRA au mhasibu',
  'apportion.automaticHint':
    'Kila mwezi unatumia sehemu ya mauzo ya kiwango cha kawaida na sifuri katika mauzo yote ya mwezi huo; mwezi wa mwisho wa mwaka unarekebisha mwaka kwa sehemu ya mwaka.',
  'apportion.fixedPercent': 'Asilimia inayorudishwa %',
  'apportion.fixedRequired': 'Weka asilimia inayorudishwa kwa njia ya asilimia maalum.',
  'apportion.yearEnd': 'Mwaka wa fedha unaisha mwezi',
  'apportion.roundUp': 'Pandisha sehemu hadi asilimia nzima inayofuata',
  'apportion.roundUpHint':
    'Ni desturi ya kawaida kwa njia ya kawaida; zima ili kubaki na desimali mbili.',

  'password.minLength': 'Angalau herufi {{min}}.',
  'password.minLengthTwoFactor':
    'Angalau herufi {{min}} (8 zinatosha uthibitishaji wa hatua mbili ukiwa umewashwa; 15 bila huo).',
  'password.resetHint':
    'Angalau herufi 15, au 8 akaunti yako ikitumia uthibitishaji wa hatua mbili (programu ya uthibitishaji au passkey).',
  'password.tooShort': 'Tumia angalau herufi {{min}}.',
  'password.changeFirst':
    'Kuzima uthibitishaji wa hatua mbili kunahitaji nenosiri la angalau herufi {{min}}. Badilisha nenosiri lako kwanza.',

  'nav.platform-approvals': 'Idhini zinazosubiri',
  'nav.platform.approvals': 'Idhini zinazosubiri',
  'rootApproval.title': 'Idhini zinazosubiri',
  'rootApproval.sub':
    'Kuondoa zuio la kisheria na kufuta duka la dawa kunahitaji msimamizi mkuu wa pili.',
  'rootApproval.none': 'Hakuna kinachosubiri idhini.',
  'rootApproval.action.LIFT_LEGAL_HOLD': 'Ondoa zuio la kisheria',
  'rootApproval.action.ERASE_TENANT': 'Futa duka la dawa',
  'rootApproval.status.PENDING': 'Inasubiri',
  'rootApproval.status.EXECUTED': 'Imefanyika',
  'rootApproval.status.CANCELLED': 'Imeghairiwa',
  'rootApproval.status.EXPIRED': 'Imeisha muda',
  'rootApproval.requestedBy': 'Imeombwa na',
  'rootApproval.expires': 'Inaisha',
  'rootApproval.reason': 'Sababu',
  'rootApproval.approve': 'Idhinisha',
  'rootApproval.cancel': 'Ghairi ombi',
  'rootApproval.approveTitle': 'Idhinisha: {{action}}',
  'rootApproval.approveText':
    '{{action}} kwa {{name}} kuliombwa na {{who}}. Kunafanyika mara tu unapoidhinisha. Andika nenosiri lako kuidhinisha.',
  'rootApproval.password': 'Nenosiri lako',
  'rootApproval.code': 'Msimbo wa hatua mbili (kama akaunti yako inautumia)',
  'rootApproval.yours': 'Wewe uliomba hili; msimamizi mkuu mwingine ndiye anaidhinisha.',
  'rootApproval.requested':
    'Ombi limetumwa. Msimamizi mkuu wa pili lazima aliidhinishe kwenye Idhini zinazosubiri.',
  'rootApproval.approved': 'Imeidhinishwa na kufanyika.',
  'rootApproval.cancelled': 'Ombi limeghairiwa.',
  'rootApproval.cancelConfirm': 'Ughairi ombi hili?',
  'rootApproval.liftTitle': 'Omba kuondoa zuio la kisheria',
  'rootApproval.liftText':
    'Msimamizi mkuu wa pili lazima aidhinishe kabla zuio halijaondolewa. Eleza kwa nini linaweza kuondolewa.',
  'rootApproval.reasonPlaceholder': 'Kwa nini, kwa kumbukumbu',
  'rootApproval.ask': 'Tuma kwa idhini',
  'rootApproval.pendingHere': 'Ombi linasubiri msimamizi mkuu wa pili.',

  'statements.tab.writedown': 'Upunguzaji kwa kuisha muda',
  'writedownReport.title': 'Upunguzaji wa thamani kwa kuisha muda',
  'writedownReport.sub':
    'Akiba ya kila mwezi kwa bidhaa zinazokaribia au zilizopita muda, kwa tawi na kundi. Mhasibu wako athibitishe njia.',
  'writedownReport.period': 'Mwezi',
  'writedownReport.stockAtCost': 'Bidhaa kwa gharama',
  'writedownReport.provision': 'Akiba',
  'writedownReport.previous': 'Mwezi uliopita',
  'writedownReport.adjustment': 'Marekebisho',
  'writedownReport.journal': 'Jarida',
  'writedownReport.off': 'Upunguzaji umezimwa',
  'writedownReport.costAtRisk': 'Gharama ndani ya kundi',
  'writedownReport.branch': 'Tawi',
  'writedownReport.none': 'Bado hakuna mzunguko wa mwezi katika kipindi hiki.',
  'writedownReport.runNow': 'Endesha mwezi uliopita sasa',

  'vatReport.reclaimable': 'VAT ya manunuzi inayorudishwa',
  'vatReport.nonReclaimable': 'Isiyorudishwa (kwenda gharama)',
  'vatReport.beforeApportionment': 'VAT ya manunuzi kabla ya mgawanyo',
  'vatReport.apportionment': 'Mgawanyo',
  'vatReport.ratio': 'Sehemu inayorudishwa',
  'vatReport.kind.MONTHLY': 'Mwezi',
  'vatReport.kind.ANNUAL': 'Marekebisho ya mwaka',
  'vatReport.method.AUTOMATIC': 'Moja kwa moja',
  'vatReport.method.FIXED': 'Asilimia maalum',
  'vatReport.debitNotes': 'Hati za deni',
  'vatReport.salesDebitNotes': 'Kwa wateja',
  'vatReport.purchaseDebitNotes': 'Kutoka kwa wasambazaji',
  'vatReport.net': 'Halisi',
  'vatReport.vat': 'VAT',

  'payables.type.DEBIT_NOTE': 'Hati ya deni ya msambazaji',

  'errors.invalid_provision_bands':
    'Makundi ya upunguzaji si sahihi: makundi 1 hadi {{maxBands}}, siku hadi kuisha muda zikiongezeka kutoka 0 hadi {{maxDays}}, kila asilimia kutoka 0 hadi 100 bila kuongezeka.',
  'errors.invalid_apportionment_method': 'Chagua njia ya moja kwa moja au ya asilimia maalum.',
  'errors.invalid_recoverable_percent': 'Asilimia inayorudishwa iwe kati ya {{min}} na {{max}}.',
  'errors.recoverable_percent_required':
    'Njia ya asilimia maalum inahitaji asilimia inayorudishwa iliyokubaliwa na TRA au mhasibu.',
  'errors.invalid_year_end_month': 'Mwaka wa fedha unaisha mwezi kati ya 1 na 12.',
  'errors.password_too_short': 'Nenosiri liwe na angalau herufi {{minLength}}.',
  'errors.password_too_short_without_two_factor':
    'Bila uthibitishaji wa hatua mbili nenosiri linahitaji angalau herufi {{minLength}}. Badilisha nenosiri lako kwanza, kisha zima uthibitishaji wa hatua mbili.',
  'errors.second_root_admin_required':
    'Hili linahitaji idhini ya msimamizi mkuu wa pili, na yupo mmoja tu. Ongeza msimamizi mkuu mwingine kwanza.',
  'errors.root_approval_pending': 'Ombi la hili tayari linasubiri idhini.',
  'errors.not_under_legal_hold': 'Duka hili la dawa halina zuio la kisheria.',
  'errors.root_approval_closed': 'Ombi hili halisubiri tena: limefanyika au limeghairiwa.',
  'errors.root_approval_expired': 'Ombi hili liliisha muda kabla ya kuidhinishwa; omba tena.',
  'errors.root_approval_required':
    'Hili linahitaji msimamizi mkuu wa pili: litume kwa idhini kwenye Idhini zinazosubiri.',
  'errors.debit_note_needs_customer':
    'Hati ya deni inatoza akaunti ya mteja, na mauzo haya hayana mteja.',
  'errors.debit_note_base_currency_only':
    'Hati ya deni inaweza kurekodiwa tu kwa stakabadhi ya sarafu ya msingi.',
};
