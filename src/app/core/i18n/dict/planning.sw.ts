/** Mapendekezo ya kuagiza na kufunga kipindi. */
export const PLANNING_SW: Readonly<Record<string, string>> = {
  'nav.purchasing.reorder': 'Mapendekezo ya kuagiza',
  'nav.finance.period-lock': 'Kufunga kipindi',
  'reorder.title': 'Mapendekezo ya kuagiza',
  'reorder.sub':
    'Kile tawi hili linapaswa kuagiza, kwa kasi ya mauzo ya kila bidhaa. Kagua idadi, kisha tengeneza oda moja kwa kila msambazaji.',
  'reorder.window': 'Mauzo ya siku zilizopita',
  'reorder.cover': 'Stoo ya kutosha (siku)',
  'reorder.formula':
    'Pendekezo = mauzo kwa siku × (muda wa msambazaji kuleta + siku za kutosha), angalau kiwango cha kuagiza, ukiondoa stoo iliyopo na iliyoagizwa.',
  'reorder.leadTime': 'Huleta ndani ya siku {days, plural, other {#}}',
  'reorder.noSupplier': 'Bado hakuna msambazaji',
  'reorder.chooseSupplier': 'Chagua msambazaji…',
  'reorder.total': 'Thamani ya oda',
  'reorder.product': 'Bidhaa',
  'reorder.sold': 'Zilizouzwa',
  'reorder.perDay': 'Kwa siku',
  'reorder.onHand': 'Zilizopo',
  'reorder.onOrder': 'Zilizoagizwa',
  'reorder.reorderLevel': 'Kiwango cha kuagiza',
  'reorder.quantity': 'Agiza',
  'reorder.unitCost': 'Gharama kwa kimoja',
  'reorder.multiple': 'Kwa paketi za {{n}}',
  'reorder.none':
    'Hakuna kinachohitaji kuagizwa: stoo na oda zilizo wazi zinatosha mauzo yanayotarajiwa.',
  'reorder.create': 'Tengeneza oda za ununuzi',
  'reorder.nothing': 'Idadi zote ni sifuri, au hakuna msambazaji aliyechaguliwa.',
  'reorder.created':
    '{n, plural, one {Oda # ya ununuzi imetengenezwa} other {Oda # za ununuzi zimetengenezwa}}',
  'partners.leadTimeDays': 'Muda wa kuleta (siku)',
  'periodLock.title': 'Kufunga kipindi',
  'periodLock.sub':
    'Funga vitabu hadi tarehe fulani: hakuna kinachoweza kurekodiwa siku hiyo au kabla yake.',
  'periodLock.lockedThrough': 'Vitabu vimefungwa hadi {{date}}.',
  'periodLock.open': 'Hakuna kipindi kilichofungwa.',
  'periodLock.ruleRefused':
    'Matumizi, malipo kwa wasambazaji na salio la kuanzia lenye tarehe ya kipindi kilichofungwa hukataliwa.',
  'periodLock.ruleMoved':
    'Mauzo, marejesho na mapokezi yanayofika vitabuni kwa kuchelewa kwa siku iliyofungwa hurekodiwa siku ya kwanza iliyo wazi.',
  'periodLock.date': 'Funga hadi',
  'periodLock.lock': 'Funga kipindi',
  'periodLock.unlock': 'Fungua',
  'periodLock.confirmUnlock':
    'Fungua tena kipindi kilichofungwa? Rekodi za tarehe za nyuma zitaruhusiwa tena.',
  'periodLock.locked': 'Kipindi kimefungwa',
  'periodLock.unlocked': 'Kipindi kimefunguliwa',
  'errors.period_locked': 'Vitabu vimefungwa kwa tarehe hiyo; chagua tarehe ya baadaye.',
  'errors.invalid_lock_date': 'Ni siku za kabla ya leo tu zinazoweza kufungwa.',
  'errors.invalid_lead_time': 'Muda wa kuleta ni siku 0 hadi 365.',
  'errors.supplier_required': 'Chagua msambazaji wa bidhaa hizi.',
  'errors.orders_required': 'Idadi zote ni sifuri.',
  'errors.invalid_days': 'Chagua siku 1 hadi 365.',
};
