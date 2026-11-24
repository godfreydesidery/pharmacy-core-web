/**
 * Health details (STD-7, STD-8): who may dispense prescription medicines, the prescription's date,
 * TMDA registration numbers and adverse drug reaction reports.
 */
export const HEALTH_EN: Readonly<Record<string, string>> = {
  // permissions (Administration → Roles)
  'enum.pharmacy': 'Pharmacy',
  'perm.sales.dispense_rx': 'Dispense prescription medicines',
  'perm.health.view': 'View health details: prescriptions, patients, diagnoses, adverse reactions',
  'perm.adr.report': 'Report adverse drug reactions',

  // POS prescription
  'pos.prescriptionDate': 'Prescription date',
  'pos.prescriptionDateHint': 'The day it was written; valid 6 months.',
  'pos.dispenseNotAllowed':
    'Only staff allowed to dispense prescription medicines can sell this; ask the pharmacist.',

  // sale detail
  'sales.prescriptionDate': 'Prescription date',
  'sales.dispensedBy': 'Dispensed by',
  'sales.dispensedByName': 'Dispensed by {{name}}',
  'sales.prescriptionWithheld':
    'This sale has a prescription. Seeing its details needs the health.view permission.',

  // controlled-drugs register
  'controlled.rxDate': 'Prescription date',
  'controlled.dispensedBy': 'Dispensed by',
  'controlled.withheld': 'Withheld: needs the health.view permission',

  // products
  'catalogue.tmdaRegistration': 'TMDA registration number',
  'catalogue.tmdaRegistrationHint': 'As on the TMDA register, for medicines and medical devices.',
  'catalogue.tmdaShort': 'TMDA',

  // Inventory → Adverse reactions
  'nav.inventory.adverse-reactions': 'Adverse reactions',
  'adr.title': 'Adverse drug reactions',
  'adr.sub':
    'Suspected adverse reactions reported at the pharmacy, each ready to send to TMDA on its yellow form.',
  'adr.new': 'Report a reaction',
  'adr.pickBranch': 'Pick a branch to report a reaction.',
  'adr.back': 'All reports',
  'adr.export': 'Download CSV (TMDA form)',
  'adr.exportFailed': 'The report could not be downloaded.',
  'adr.search': 'Search by number, product, patient or reaction',
  'adr.none': 'No adverse reactions reported.',
  'adr.number': 'Report',
  'adr.formHint':
    'The fields follow the TMDA yellow form (suspected adverse drug reaction report). Verify against the current TMDA form before sending.',
  'adr.section.patient': 'Patient',
  'adr.section.medicine': 'Suspected medicine',
  'adr.section.reaction': 'Reaction',
  'adr.section.reporter': 'Reporter',
  'adr.customer': 'Customer (optional)',
  'adr.customerHint': 'Links the report to the customer; fills the patient’s name.',
  'adr.searchCustomer': 'Search customers',
  'adr.patientName': 'Patient name or initials',
  'adr.patientAge': 'Age (years)',
  'adr.patientSex': 'Sex',
  'adr.sex.FEMALE': 'Female',
  'adr.sex.MALE': 'Male',
  'adr.patientWeightKg': 'Weight (kg)',
  'adr.product': 'Medicine',
  'adr.searchProduct': 'Search products',
  'adr.batchNumber': 'Batch number',
  'adr.dose': 'Dose and frequency',
  'adr.doseHint': 'Such as 500 mg three times a day',
  'adr.route': 'Route',
  'adr.routeHint': 'Such as oral',
  'adr.indication': 'Reason for use',
  'adr.therapy': 'Therapy',
  'adr.therapyStarted': 'Therapy started',
  'adr.therapyStopped': 'Therapy stopped',
  'adr.reaction': 'Description of the reaction',
  'adr.onsetDate': 'Onset date',
  'adr.seriousnessCol': 'Seriousness',
  'adr.seriousness.SERIOUS': 'Serious',
  'adr.seriousness.NOT_SERIOUS': 'Not serious',
  'adr.seriousReason': 'Why serious',
  'adr.seriousReason.DEATH': 'Death',
  'adr.seriousReason.LIFE_THREATENING': 'Life-threatening',
  'adr.seriousReason.HOSPITALISATION': 'Hospitalisation (initial or prolonged)',
  'adr.seriousReason.DISABILITY': 'Disability or incapacity',
  'adr.seriousReason.CONGENITAL_ANOMALY': 'Congenital anomaly',
  'adr.seriousReason.OTHER_MEDICALLY_IMPORTANT': 'Other medically important condition',
  'adr.outcome': 'Outcome',
  'adr.outcome.RECOVERED': 'Recovered',
  'adr.outcome.RECOVERING': 'Recovering',
  'adr.outcome.NOT_RECOVERED': 'Not recovered',
  'adr.outcome.RECOVERED_WITH_SEQUELAE': 'Recovered with sequelae',
  'adr.outcome.FATAL': 'Fatal',
  'adr.outcome.UNKNOWN': 'Unknown',
  'adr.reporterName': 'Reporter',
  'adr.reporterProfession': 'Profession',
  'adr.professionHint': 'Such as pharmacist',
  'adr.reporterPhone': 'Reporter’s phone',
  'adr.recorded': 'Recorded',
  'adr.note': 'Note',
  'adr.save': 'Save report',
  'adr.saved': 'Report {{number}} saved.',

  // refusals
  'errors.dispense_not_allowed':
    'Only staff allowed to dispense prescription medicines can sell this; ask the pharmacist.',
  'errors.prescription_incomplete':
    'A prescription medicine needs the prescriber’s registration number, the patient’s name and the prescription date.',
  'errors.prescription_date_in_future': 'The prescription date cannot be in the future.',
  'errors.prescription_expired':
    'The prescription is older than {{validMonths}} months (written before {{oldestAllowed}}): ask for a new one.',
  'errors.adverse_reaction_not_found': 'No such adverse reaction report.',
  'errors.onset_in_future': 'The onset date cannot be in the future.',
  'errors.serious_reason_required': 'Say why the reaction is serious.',
  'errors.invalid_therapy_dates': 'The medicine cannot be stopped before it was started.',
  'errors.invalid_patient_age': "The patient's age must be between 0 and 150 years.",
  'errors.invalid_patient_weight_kg':
    "The patient's weight must be more than 0 and less than 1000 kg.",
};
