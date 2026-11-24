/**
 * Taarifa za afya (STD-7, STD-8): nani anaweza kutoa dawa za cheti, tarehe ya cheti, namba za
 * usajili wa TMDA na ripoti za madhara ya dawa.
 */
export const HEALTH_SW: Readonly<Record<string, string>> = {
  // ruhusa (Utawala → Majukumu)
  'enum.pharmacy': 'Famasia',
  'perm.sales.dispense_rx': 'Kutoa dawa za cheti cha daktari',
  'perm.health.view':
    'Kuona taarifa za afya: vyeti vya daktari, wagonjwa, utambuzi wa ugonjwa, madhara ya dawa',
  'perm.adr.report': 'Kuripoti madhara ya dawa',

  // cheti kwenye POS
  'pos.prescriptionDate': 'Tarehe ya cheti',
  'pos.prescriptionDateHint': 'Siku kilipoandikwa; kinafaa kwa miezi 6.',
  'pos.dispenseNotAllowed':
    'Ni wafanyakazi walioruhusiwa kutoa dawa za cheti tu wanaoweza kuuza hii; muulize mfamasia.',

  // maelezo ya mauzo
  'sales.prescriptionDate': 'Tarehe ya cheti',
  'sales.dispensedBy': 'Imetolewa na',
  'sales.dispensedByName': 'Imetolewa na {{name}}',
  'sales.prescriptionWithheld':
    'Mauzo haya yana cheti cha daktari. Kuona taarifa zake kunahitaji ruhusa ya health.view.',

  // rejista ya dawa zinazodhibitiwa
  'controlled.rxDate': 'Tarehe ya cheti',
  'controlled.dispensedBy': 'Imetolewa na',
  'controlled.withheld': 'Imefichwa: inahitaji ruhusa ya health.view',

  // bidhaa
  'catalogue.tmdaRegistration': 'Namba ya usajili wa TMDA',
  'catalogue.tmdaRegistrationHint': 'Kama ilivyo kwenye rejista ya TMDA, kwa dawa na vifaa tiba.',
  'catalogue.tmdaShort': 'TMDA',

  // Stoo → Madhara ya dawa
  'nav.inventory.adverse-reactions': 'Madhara ya dawa',
  'adr.title': 'Madhara ya dawa',
  'adr.sub':
    'Madhara yanayoshukiwa yaliyoripotiwa kwenye famasia, kila moja tayari kutumwa TMDA kwa fomu yake ya njano.',
  'adr.new': 'Ripoti madhara',
  'adr.pickBranch': 'Chagua tawi ili kuripoti madhara.',
  'adr.back': 'Ripoti zote',
  'adr.export': 'Pakua CSV (fomu ya TMDA)',
  'adr.exportFailed': 'Ripoti haikuweza kupakuliwa.',
  'adr.search': 'Tafuta kwa namba, bidhaa, mgonjwa au madhara',
  'adr.none': 'Hakuna madhara yaliyoripotiwa.',
  'adr.number': 'Ripoti',
  'adr.formHint':
    'Sehemu zinafuata fomu ya njano ya TMDA (ripoti ya madhara yanayoshukiwa ya dawa). Hakiki dhidi ya fomu ya sasa ya TMDA kabla ya kutuma.',
  'adr.section.patient': 'Mgonjwa',
  'adr.section.medicine': 'Dawa inayoshukiwa',
  'adr.section.reaction': 'Madhara',
  'adr.section.reporter': 'Mripoti',
  'adr.customer': 'Mteja (si lazima)',
  'adr.customerHint': 'Inaunganisha ripoti na mteja; inajaza jina la mgonjwa.',
  'adr.searchCustomer': 'Tafuta wateja',
  'adr.patientName': 'Jina au herufi za mwanzo za mgonjwa',
  'adr.patientAge': 'Umri (miaka)',
  'adr.patientSex': 'Jinsia',
  'adr.sex.FEMALE': 'Mke',
  'adr.sex.MALE': 'Mume',
  'adr.patientWeightKg': 'Uzito (kg)',
  'adr.product': 'Dawa',
  'adr.searchProduct': 'Tafuta bidhaa',
  'adr.batchNumber': 'Namba ya bechi',
  'adr.dose': 'Kipimo na mara',
  'adr.doseHint': 'Kama mg 500 mara tatu kwa siku',
  'adr.route': 'Njia ya kutumia',
  'adr.routeHint': 'Kama kwa mdomo',
  'adr.indication': 'Sababu ya kutumia',
  'adr.therapy': 'Matibabu',
  'adr.therapyStarted': 'Matibabu yalianza',
  'adr.therapyStopped': 'Matibabu yalisimamishwa',
  'adr.reaction': 'Maelezo ya madhara',
  'adr.onsetDate': 'Tarehe madhara yalipoanza',
  'adr.seriousnessCol': 'Ukubwa',
  'adr.seriousness.SERIOUS': 'Makubwa',
  'adr.seriousness.NOT_SERIOUS': 'Si makubwa',
  'adr.seriousReason': 'Kwa nini makubwa',
  'adr.seriousReason.DEATH': 'Kifo',
  'adr.seriousReason.LIFE_THREATENING': 'Hatari kwa maisha',
  'adr.seriousReason.HOSPITALISATION': 'Kulazwa hospitali (mwanzo au kuongezwa)',
  'adr.seriousReason.DISABILITY': 'Ulemavu au kushindwa kufanya kazi',
  'adr.seriousReason.CONGENITAL_ANOMALY': 'Kasoro ya kuzaliwa',
  'adr.seriousReason.OTHER_MEDICALLY_IMPORTANT': 'Hali nyingine muhimu kitabibu',
  'adr.outcome': 'Matokeo',
  'adr.outcome.RECOVERED': 'Amepona',
  'adr.outcome.RECOVERING': 'Anapona',
  'adr.outcome.NOT_RECOVERED': 'Hajapona',
  'adr.outcome.RECOVERED_WITH_SEQUELAE': 'Amepona na athari zilizobaki',
  'adr.outcome.FATAL': 'Kifo',
  'adr.outcome.UNKNOWN': 'Haijulikani',
  'adr.reporterName': 'Mripoti',
  'adr.reporterProfession': 'Taaluma',
  'adr.professionHint': 'Kama mfamasia',
  'adr.reporterPhone': 'Simu ya mripoti',
  'adr.recorded': 'Imerekodiwa',
  'adr.note': 'Maelezo',
  'adr.save': 'Hifadhi ripoti',
  'adr.saved': 'Ripoti {{number}} imehifadhiwa.',

  // makataa
  'errors.dispense_not_allowed':
    'Ni wafanyakazi walioruhusiwa kutoa dawa za cheti tu wanaoweza kuuza hii; muulize mfamasia.',
  'errors.prescription_incomplete':
    'Dawa ya cheti inahitaji namba ya usajili ya daktari, jina la mgonjwa na tarehe ya cheti.',
  'errors.prescription_date_in_future': 'Tarehe ya cheti haiwezi kuwa ijayo.',
  'errors.prescription_expired':
    'Cheti kina zaidi ya miezi {{validMonths}} (kiliandikwa kabla ya {{oldestAllowed}}): omba kipya.',
  'errors.adverse_reaction_not_found': 'Ripoti hiyo ya madhara haipo.',
  'errors.onset_in_future': 'Tarehe madhara yalipoanza haiwezi kuwa ijayo.',
  'errors.serious_reason_required': 'Eleza kwa nini madhara ni makubwa.',
  'errors.invalid_therapy_dates': 'Dawa haiwezi kusimamishwa kabla ya kuanzwa.',
  'errors.invalid_patient_age': 'Umri wa mgonjwa uwe kati ya miaka 0 na 150.',
  'errors.invalid_patient_weight_kg': 'Uzito wa mgonjwa uwe zaidi ya 0 na chini ya kilo 1000.',
};
