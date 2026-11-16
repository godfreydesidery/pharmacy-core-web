/** Kiswahili for admin2.en.ts. */
export const ADMIN2_SW: Readonly<Record<string, string>> = {
  // dosage forms
  'enum.ORAL_SOLUTION': 'Dawa ya maji ya kunywa',
  'enum.SPRAY': 'Dawa ya kunyunyiza',
  'enum.PATCH': 'Kibandiko cha ngozi',
  'enum.POWDER': 'Unga',
  'enum.LOTION': 'Losheni',
  'enum.PESSARY': 'Kidonge cha ukeni',
  'enum.LOZENGE': 'Kidonge cha kunyonya',
  'enum.EYE_OINTMENT': 'Mafuta ya macho',
  'enum.INFUSION': 'Dripu',

  // editing a pharmacy (root administrator)
  'admin2.editPharmacy': 'Hariri duka la dawa',
  'admin2.currencyLockHint': 'Inaweza kubadilishwa tu kabla duka halijarekodi muamala wowote.',
  'admin2.contact': 'Mawasiliano',
  'admin2.contactName': 'Mtu wa mawasiliano',
  'admin2.contactEmail': 'Barua pepe ya mawasiliano',
  'admin2.contactPhone': 'Simu ya mawasiliano',
  'admin2.pharmacySaved': 'Taarifa za duka zimehifadhiwa',

  // root administrators
  'admin2.status': 'Hali',
  'admin2.sendReset': 'Tuma kiungo cha kubadilisha nenosiri',
  'admin2.deactivate': 'Zima',
  'admin2.remove': 'Ondoa',
  'admin2.you': 'Wewe',
  'admin2.confirmDeactivate':
    'Zima {{name}}? Ataondolewa kwenye vifaa vyote hadi atakapowashwa tena.',
  'admin2.confirmRemove':
    'Ondoa {{name}} kama msimamizi mkuu? Akaunti yake inabaki kwa maduka anayohusika nayo tu.',
  'admin2.rootDeactivated': 'Msimamizi mkuu amezimwa',
  'admin2.rootReactivated': 'Msimamizi mkuu amewashwa tena',
  'admin2.rootRemoved': 'Msimamizi mkuu ameondolewa',
  'admin2.resetSent': 'Kiungo cha kubadilisha nenosiri kimetumwa kwa {{email}}',

  // profile and phone
  'admin2.profile': 'Wasifu',
  'admin2.phone': 'Simu',
  'admin2.phoneHint':
    'Kwa mfumo wa kimataifa, kama +255754000111. Hutumika kwa arifa za SMS na WhatsApp.',
  'admin2.phoneAdminHint': 'Kwa mtu ambaye bado hana simu tu; kila mtu hubadilisha yake mwenyewe.',
  'admin2.profileSaved': 'Wasifu umehifadhiwa',

  // delivery detail
  'admin2.deliveryDetail': 'Maelezo ya ujumbe',
  'admin2.subject': 'Kichwa',
  'admin2.messageText': 'Ujumbe',
  'admin2.secretsMasked': 'Sehemu za siri za viungo zimefichwa (•••).',
  'admin2.resend': 'Tuma tena',
  'admin2.resent': 'Umetumwa tena kwa {{to}}',

  // opening balances
  'nav.finance.opening-balances': 'Salio la kuanzia',
  'admin2.openingBalances': 'Salio la kuanzia',
  'admin2.openingIntro':
    'Kile duka lilichokuwa nacho na kudaiwa lilipoanza kutumia mfumo. Hurekodiwa mara moja; mtaji wa mmiliki huchukua tofauti.',
  'admin2.openingPosted': 'Salio la kuanzia limerekodiwa kama {{number}} tarehe {{date}}.',
  'admin2.cash': 'Taslimu',
  'admin2.bank': 'Benki',
  'admin2.mobileMoney': 'Pesa ya simu',
  'admin2.inventory': 'Stoo kwa gharama',
  'admin2.receivables': 'Wateja wanadaiwa',
  'admin2.payables': 'Wasambazaji wanadai',
  'admin2.capital': 'Mtaji wa mmiliki',
  'admin2.party': 'Mteja au msambazaji',
  'admin2.type': 'Aina',
  'admin2.amount': 'Kiasi',
  'admin2.owesUs': 'Anadaiwa na duka',
  'admin2.weOwe': 'Duka linadaiwa',
  'admin2.noParties': 'Hakuna salio la wateja wala wasambazaji.',
  'admin2.moneyAndStock': 'Pesa na stoo',
  'admin2.asOf': 'Kufikia tarehe',
  'admin2.inventoryHint': 'Stoo iliyopo kwa gharama ni {{value}}.',
  'admin2.customersOweUs': 'Wateja wanaodaiwa na duka',
  'admin2.addCustomer': 'Ongeza mteja…',
  'admin2.weOweSuppliers': 'Wasambazaji wanaodai duka',
  'admin2.addSupplier': 'Ongeza msambazaji…',
  'admin2.capitalHint': 'Vyote vilivyopo ukitoa vyote vinavyodaiwa.',
  'admin2.postOpening': 'Rekodi salio la kuanzia',
  'admin2.confirmOpening': 'Rekodi salio la kuanzia? Hii hufanyika mara moja tu.',
  'admin2.openingSaved': 'Salio la kuanzia limerekodiwa',
  'admin2.overdraw':
    'Hii itaifanya {{account}} iwe chini ya sifuri: ina {{balance}}. Bado unaweza kuhifadhi ikiwa pesa imetoka mahali pengine.',

  // setup checklist
  'admin2.setupTitle': 'Andaa duka lako',
  'admin2.setupProgress': '{{done}} kati ya {{total}} yamekamilika',
  'admin2.setupDismiss': 'Ficha',
  'admin2.setupMarkDone': 'Weka kuwa imekamilika',
  'admin2.setup.settings': 'Kagua mipangilio: kodi, risiti, sarafu na nembo',
  'admin2.setup.branches': 'Weka anwani na simu za matawi',
  'admin2.setup.users': 'Ongeza wafanyakazi wako',
  'admin2.setup.products': 'Ongeza bidhaa',
  'admin2.setup.stock': 'Rekodi stoo ya mwanzo',
  'admin2.setup.opening': 'Rekodi salio la kuanzia',
  'admin2.setup.rates': 'Rekodi viwango vya kubadilisha fedha kwa sarafu zinazokubaliwa',
  'admin2.setup.providers': 'Kagua maneno ya ujumbe na watoa huduma wa SMS/barua pepe',

  // server refusals
  'errors.duplicate_supplier_invoice': 'Ankara hii ya msambazaji imeshapokelewa.',
  'errors.currency_locked': 'Sarafu ya msingi haiwezi kubadilika baada ya duka kufanya biashara.',
  'errors.last_root_admin': 'Mfumo unahitaji angalau msimamizi mkuu mmoja aliye hai.',
  'errors.cannot_change_self': 'Huwezi kujizima wala kujiondoa mwenyewe.',
  'errors.root_admin_not_found': 'Msimamizi mkuu huyo hayupo.',
  'errors.invalid_phone': 'Weka simu kwa mfumo wa kimataifa, kama +255754000111.',
  'errors.delivery_not_found': 'Ujumbe huo haupo.',
  'errors.cannot_resend':
    'Ujumbe wa ndani ya programu hubaki kwenye kikasha; hakuna cha kutuma tena.',
  'errors.opening_balances_posted': 'Salio la kuanzia limesharekodiwa.',
  'errors.duplicate_party': 'Kila mteja au msambazaji aonekane mara moja.',
};
