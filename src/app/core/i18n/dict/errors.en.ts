/**
 * Server refusals by their stable `reason`, as `errors.<reason>`. English users see the API's own
 * `detail`, which names the product, amount or field; these lines are the general meaning, shown
 * in a language the API does not speak (see `localizeError`). A reason with no entry shows the
 * server's detail.
 */
export const ERRORS_EN: Readonly<Record<string, string>> = {
  // transport and edge
  'errors.network_error': 'The server could not be reached. Check your connection.',
  'errors.internal_error': 'Something went wrong; it has been logged.',
  'errors.too_many_requests': 'Too many requests; wait a moment and try again.',
  'errors.malformed_request': 'The request could not be read.',
  'errors.missing_input': 'Some required information is missing.',
  'errors.route_not_found': 'This action is not available.',
  'errors.conflict': 'This conflicts with an existing record.',
  'errors.stale_version': 'Someone changed this record meanwhile; reload and try again.',
  'errors.forbidden': 'Your role does not allow this.',
  'errors.unauthenticated': 'Sign in to continue.',

  // sign-in and security
  'errors.account_locked': 'Too many failed sign-ins; the account is locked for a while.',
  'errors.client_locked': 'Too many failed sign-ins from this device; try again later.',
  'errors.invalid_credentials': 'The email or password is wrong.',
  'errors.invalid_current_password': 'The current password is wrong.',
  'errors.weak_password': 'The password must be 8 to 128 characters long.',
  'errors.invalid_code': 'That code is not right.',
  'errors.invalid_token': 'This reset link is not valid any more; ask for a new one.',
  'errors.challenge_expired': 'This sign-in has expired; sign in again with your password.',
  'errors.session_expired': 'Your session has expired; sign in again.',
  'errors.ceremony_expired': 'The passkey request has expired; try again.',
  'errors.passkey_exists': 'This passkey is already registered.',
  'errors.passkey_rejected': 'The passkey could not be registered.',
  'errors.two_factor_already_enabled':
    'Two-step verification is on; turn it off to set up a new app.',
  'errors.two_factor_not_enabled': 'Turn two-step verification on first.',
  'errors.two_factor_not_started': 'Start the two-step verification set-up first.',
  'errors.two_factor_required': 'This account signs in with a second step.',
  'errors.two_factor_setup_required':
    'Set up two-step verification on your account before using the platform.',
  'errors.invitation_not_open': 'This invitation was already used, revoked or has expired.',
  'errors.password_change_required':
    'Choose your own password before you start: yours was set by your pharmacy.',
  'errors.same_password': 'Choose a new password of your own, not the one you were given.',
  'errors.username_taken': 'This username is already used in this pharmacy.',
  'errors.invalid_username':
    'A username is 2 to 32 letters or digits, and may use . - or _ (such as juma or mary.k).',
  'errors.not_managed':
    'This person signs in with their own account; only they can change its password.',
  'errors.account_exists':
    'This email already has an account: sign in, then accept the invitation.',
  'errors.managed_login_cannot_join':
    "A pharmacy's staff login works only in that pharmacy. Sign in with your own account, or create one, to accept this invitation.",
  'errors.direct_creation_disabled':
    'This pharmacy invites people by email; it does not create logins for them.',

  // workspace
  'errors.tenant_suspended': "This pharmacy's account is suspended.",
  'errors.tenant_required': 'Choose the pharmacy first.',
  'errors.branch_required': 'Choose a branch first.',
  'errors.branch_not_allowed': 'You do not work at that branch.',
  'errors.head_office_required': 'The head office cannot be deactivated.',
  'errors.cannot_deactivate_self': 'You cannot deactivate your own membership.',
  'errors.invalid_branch_uids': 'Choose at least one branch, or allow every branch.',
  'errors.duplicate_email': 'A user with this email already exists.',
  'errors.duplicate_code': 'This code is already in use.',
  'errors.duplicate_name': 'This name is already in use.',

  // selling
  'errors.insufficient_stock': 'There is not enough stock of this product here.',
  'errors.payment_short': 'The payments do not cover the total.',
  'errors.overpaid_non_cash':
    'Only cash can be overpaid, unless the excess goes on the customer account.',
  'errors.customer_required': 'A walk-in customer cannot owe; choose the customer.',
  'errors.credit_limit_exceeded': 'This would take the customer over their credit limit.',
  'errors.credit_not_permitted': 'Your role may not sell on account.',
  'errors.insufficient_account_credit': 'The account does not hold enough credit.',
  'errors.discount_not_allowed': 'You may not give a discount.',
  'errors.prescription_required': "A prescription item needs the prescriber's details.",
  'errors.member_required': "An insurance payment needs the customer's membership.",
  'errors.member_not_found': 'The customer has no valid insurance today.',
  'errors.member_inactive': 'This insurance membership is not active.',
  'errors.insurance_amount_mismatch':
    'The insurance amount does not match what the insurer covers.',
  'errors.rate_missing': 'There is no exchange rate for this currency yet.',
  'errors.serial_required': 'Scan or enter the serial number of each unit.',
  'errors.tracking_mode_locked': 'The tracking mode cannot change while the product is in stock.',
  'errors.foreign_refund_method':
    'A refund in a foreign currency is paid in cash, by card or by mobile money.',
  'errors.foreign_refund_not_allowed':
    'A sale paid partly on credit, by insurance or from account credit is refunded in the base currency.',
  'errors.refund_currency_not_tendered': 'The sale was not paid in that currency.',
  'errors.serials_mismatch': 'Give one serial number per unit.',
  'errors.serial_not_in_stock': 'That serial number is not in stock here.',
  'errors.serial_not_on_sale': 'That serial number is not on this sale.',
  'errors.serial_not_sold': 'That serial number has not been sold.',
  'errors.serials_not_tracked': 'This product is not tracked by serial number.',
  'errors.duplicate_serial': 'This serial number is already recorded.',
  'errors.batch_expired': 'This batch has expired.',
  'errors.return_exceeds_sold': 'You cannot return more than was sold.',
  'errors.sale_other_branch': 'A sale is returned at the branch that sold it.',
  'errors.sale_not_found': 'No such sale.',

  // stock and purchasing
  'errors.same_branch': 'A transfer goes to another branch.',
  'errors.not_destination': 'Only the destination branch receives a transfer.',
  'errors.already_received': 'The transfer has been received already.',
  'errors.over_receipt': 'You cannot receive more than was ordered.',
  'errors.not_cancellable': 'Only an order with nothing received yet can be cancelled.',
  'errors.purchase_order_closed': 'The purchase order is closed.',
  'errors.purchase_order_other_branch': 'The purchase order is for another branch.',
  'errors.supplier_mismatch': 'The purchase order is to another supplier.',
  'errors.product_not_on_order': 'The product is not on the purchase order.',
  'errors.currency_mismatch': "The receipt must be in the order's currency.",
  'errors.batch_expiry_mismatch': 'This batch is already recorded with another expiry date.',
  'errors.batch_not_of_product': 'The batch is not a batch of this product.',
  'errors.serial_not_of_batch': 'Each serial must belong to the batch adjusted.',
  'errors.duplicate_product': 'Each product appears once.',
  'errors.invalid_quantity_change': 'The quantity change must not be zero.',

  // catalogue
  'errors.duplicate_sku': 'Another product already has this code.',
  'errors.duplicate_gtin': 'Another product already has this barcode (GTIN).',
  'errors.invalid_gtin': 'The barcode (GTIN) must be 8 to 14 digits.',
  'errors.invalid_atc_code': 'This is not a WHO ATC code, such as N02BE01.',
  'errors.invalid_generic_name': 'A medicine needs its generic (INN) name.',
  'errors.invalid_dosage_form': 'A medicine needs its dosage form.',
  'errors.category_cycle': 'A category cannot sit under itself or one of its sub-categories.',
  'errors.category_too_deep': 'Categories cannot be nested this deep.',
  'errors.invalid_warranty_months': 'The warranty period is out of range.',
  'errors.invalid_reorder_level': 'The reorder level must be zero or more.',

  // money, insurance and receivables
  'errors.invalid_amount': 'The amount must be more than zero.',
  'errors.invalid_rate': 'The rate must be more than zero.',
  'errors.exchange_rate_mismatch':
    'That exchange rate differs from the rate recorded for today. Record the new rate under Exchange rates first.',
  'errors.base_currency_only': 'This payment is taken in the base currency of the pharmacy only.',
  'errors.owner_required': 'Choose the record the file belongs to.',
  'errors.invalid_exchange_rate': 'The exchange rate must be more than zero.',
  'errors.same_currency': 'Choose two different currencies.',
  'errors.invalid_effective_on': 'The date cannot be in the future.',
  'errors.charge_not_open': 'That charge is not open on this account.',
  'errors.write_off_exceeds_open': 'You cannot write off more than is owed.',
  'errors.claim_closed': 'This claim is closed.',
  'errors.claim_not_payable': 'That claim is not awaiting payment.',
  'errors.no_claims_in_period': 'There are no draft claims in this period.',
  'errors.remittance_mismatch': 'The amounts per claim must add up to the total.',
  'errors.duplicate_member_number': 'This member number is already registered.',
  'errors.invalid_diagnosis_code': 'The diagnosis must be an ICD-10 code, such as J06.9.',
  'errors.invalid_valid_until': 'The end date is before the start date.',

  // general input
  'errors.invalid_name': 'The name is required.',
  'errors.invalid_range': 'The start date must not be after the end date.',
  'errors.invalid_url': 'The address must be an https URL.',
  'errors.invalid_event_types': 'Choose valid event types.',
  'errors.upload_missing': 'The file has not finished uploading; try again.',
  'errors.url_expired': 'This file link has expired; open it again.',
  'errors.invalid_signature': 'This file link is not valid.',
};
