/** Point of sale: stock badges, payment rows, prescriptions, channels. */
export const TILL_EN: Readonly<Record<string, string>> = {
  'till.paymentMethod': 'Payment method',
  'till.left': '{{count}} left',
  'till.looseAndPacks': '{{loose}} loose · {{packs}} in packs',
  'till.packsHint': 'Selling more than the loose units opens a pack automatically.',
  'till.rxIncomplete': 'Fill in the missing prescription details.',
  'till.controlledNotice':
    'Controlled drug: every detail below goes into the controlled-drugs register, so all are required.',
  'till.voucherVoided': 'Voucher {{code}} voided',
  'till.channel.CASH': 'Cash',
  'till.channel.MPESA': 'M-Pesa',
  'till.channel.MIXX': 'Mixx by Yas',
  'till.channel.AIRTEL_MONEY': 'Airtel Money',
  'till.channel.SELCOM': 'Selcom',
  'till.channel.AZAMPAY': 'AzamPay',
  'till.channel.MOBILE_OTHER': 'Mobile money',
  'till.channel.BANK_TRANSFER': 'Bank transfer',
  'till.channel.CARD': 'Card',
  'till.channel.CHEQUE': 'Cheque',
  'till.channel.VOUCHER': 'Voucher',
  'till.channel.SIMULATOR': 'Simulator (testing)',
};
