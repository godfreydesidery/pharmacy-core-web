/** Controlled-drugs register and the stricter prescription it needs. */
export const CONTROLLED_EN: Readonly<Record<string, string>> = {
  'nav.inventory.controlled': 'Controlled drugs',
  'controlled.title': 'Controlled drugs register',
  'controlled.sub': 'Every movement of controlled drugs at {{branch}}, with the running balance.',
  'controlled.what': 'the controlled-drugs register',
  'controlled.products': 'Controlled drugs',
  'controlled.none': 'No product is scheduled as controlled.',
  'controlled.pick': 'Pick a drug to see its register.',
  'controlled.balance': 'Balance on hand: {{count}}',
  'controlled.date': 'Date',
  'controlled.entry': 'Entry',
  'controlled.reference': 'Document',
  'controlled.batch': 'Batch',
  'controlled.in': 'In',
  'controlled.out': 'Out',
  'controlled.balanceCol': 'Balance',
  'controlled.patient': 'Patient',
  'controlled.prescriber': 'Prescriber',
  'controlled.registration': 'Registration no.',
  'controlled.rxReference': 'Prescription ref.',
  'controlled.by': 'Recorded by',
  'controlled.noEntries': 'No movements yet.',
  'controlled.print': 'Print',
  'controlled.export': 'Export CSV',
  'pos.controlledRxIncomplete':
    'A controlled drug needs the prescriber, registration number, prescription reference and patient.',
  'errors.controlled_prescription_incomplete':
    'A controlled drug needs the prescriber, registration number, prescription reference and patient.',
  'errors.not_controlled': 'That product is not a controlled drug.',
  'errors.rate_out_of_range':
    'That rate is far from the recorded one. Check it, or record the new rate under Finance → Exchange rates.',
};
