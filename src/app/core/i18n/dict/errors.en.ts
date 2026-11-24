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
  'errors.precondition_failed': 'Someone else changed this record; reload to see their change.',
  'errors.precondition_required':
    'This change must name the version of the record it edits; reload and try again.',
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
  'errors.insufficient_stock':
    'Not enough stock: {{available}} available, {{requested}} needed. {{product}}{{batch}}',
  'errors.payment_short': 'The payments ({{paid}}) do not cover the total ({{total}}).',
  'errors.overpaid_non_cash':
    'Only cash can be overpaid, unless the excess goes on the customer account.',
  'errors.customer_required': 'A walk-in customer cannot owe; choose the customer.',
  'errors.credit_limit_exceeded':
    'This would take the customer over their credit limit ({{limit}}).',
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
  'errors.invalid_gtin':
    'This barcode is not a valid GTIN (EAN-13, UPC-A, GTIN-8 or GTIN-14): its check digit is wrong.',
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

  // The fallback for an `invalid_<field>` reason with no line of its own (see localizeError).
  'errors.invalid_input': 'Check the information entered.',

  // edge and lists
  'errors.busy_try_again': 'Another till was using the same stock or account; try again.',
  'errors.idempotency_in_progress': 'This request is still being processed; wait a moment.',
  'errors.idempotency_key_reused':
    'This request was already sent with different details; start it again.',
  'errors.invalid_idempotency_key':
    'The request could not be sent safely; reload the page and try again.',
  'errors.method_not_allowed': 'This action is not available.',
  'errors.unsupported_media_type': 'The request could not be read.',
  'errors.invalid_cursor': 'The list has changed; reload it.',
  'errors.invalid_limit': 'Show between 1 and 100 rows.',
  'errors.invalid_page': 'The page must be a whole number from 1.',
  'errors.invalid_value': 'A required value is missing.',

  // sign-in and accounts
  'errors.session_idle':
    'You were signed out after {{idleMinutes}} minutes without using the app; sign in again.',
  'errors.session_not_found': 'That session has already ended.',
  'errors.managed_login':
    'This is a pharmacy staff login: its pharmacy keeps its details and resets its password.',
  'errors.password_required': 'Choose a new password.',
  'errors.same_email': 'That is already your sign-in email.',
  'errors.email_taken': 'That email has an account now; ask for another change.',
  'errors.already_verified': 'That phone is already verified.',
  'errors.phone_needs_verification':
    'Add or change your phone on the security page, with the code sent to it.',
  'errors.recovery_on_hold':
    'For your safety, this recovery link works only after a waiting period; try again later.',
  'errors.already_a_member':
    'Your account is already in that pharmacy; ask its admin to remove one of the two.',
  'errors.invitation_not_found': 'No such invitation.',
  'errors.passkey_not_found': 'No such passkey.',
  'errors.invalid_credential': 'The passkey did not answer; try again.',
  'errors.user_not_found': 'No such user.',
  'errors.role_not_found': 'No such role.',
  'errors.invalid_permissions': 'One of these permissions cannot be given to a pharmacy role.',
  'errors.invalid_idle_minutes': 'The idle limit must be between 5 and 60 minutes.',

  // pharmacy and platform
  'errors.tenant_not_found': 'No such pharmacy.',
  'errors.branch_not_found': 'No such branch.',
  'errors.settings_not_found':
    "The pharmacy's settings are missing; contact the platform administrator.",
  'errors.erased': "The pharmacy's data is already erased.",
  'errors.invalid_country': 'The country must be a two-letter code, such as TZ.',
  'errors.invalid_timezone': 'Choose a time zone, such as Africa/Dar_es_Salaam.',
  'errors.invalid_look': 'Choose a look from the list.',
  'errors.invalid_expiry_alert_days': 'Expiry alerts must come 1 to 730 days ahead.',
  'errors.clock_backwards': 'The simulated clock only moves forward.',
  'errors.clock_move': 'Give either a duration to move forward or a time to move to.',
  'errors.reseal_running': 'The re-encryption of the keys is already running.',

  // selling, customers and insurance
  'errors.product_inactive': 'This product is no longer sold: {{product}}.',
  'errors.product_not_found': 'No such product.',
  'errors.customer_not_found': 'No such customer.',
  'errors.member_not_of_customer': "This insurance membership is not the customer's.",
  'errors.account_on_hold': "The customer's account is on hold; no new credit is allowed.",
  'errors.invalid_credit_limit': 'Enter the credit limit.',
  'errors.currency_not_accepted':
    'This pharmacy does not accept {{currency}} (Settings → Currencies).',
  'errors.refund_method_not_allowed': 'A refund goes back the way the sale was paid.',
  'errors.preauth_required': 'This insurer needs a pre-authorisation number.',
  'errors.payer_not_found': 'No such insurer.',
  'errors.scheme_not_found': 'No such insurance scheme.',
  'errors.claim_not_found': 'No such claim.',
  'errors.remittance_exceeds_due': 'A claim cannot be paid more than it has due.',
  'errors.sale_line_not_found': 'That line is not on this sale.',
  'errors.return_not_found': 'No such return.',
  'errors.return_line_not_found': 'That line is not on this return.',
  'errors.promotion_not_found': 'No such promotion.',
  'errors.price_list_not_found': 'No such price list.',
  'errors.duplicate_voucher': 'A voucher with this code already exists.',
  'errors.invalid_expiry': 'The expiry date has passed.',
  'errors.method_not_found': 'No such payment method.',
  'errors.invalid_adapter': 'That payment connection is not known.',
  'errors.invalid_kind': 'That kind of payment is not known.',
  'errors.payment_request_not_found': 'No such payment request.',
  'errors.invalid_payment_method': 'Choose one of the payment methods offered.',
  'errors.invalid_payment_terms_days': 'Payment terms must be 0 to 365 days.',
  'errors.overpayment':
    'That is more than is still owed on those receipts; pay at most that, or pay the rest on account.',
  'errors.invalid_action': 'That action does not need approval.',

  // stock, purchasing and finance
  'errors.batch_not_found': 'No such batch.',
  'errors.batch_required': 'The product came in several batches; choose the batch of each line.',
  'errors.batch_not_expired':
    'This batch has not expired; destroy it as damaged, or wait until it expires.',
  'errors.batch_not_on_receipt': 'This batch was not received on that goods receipt.',
  'errors.duplicate_line': 'Each line appears once.',
  'errors.expiry_required': "The ingredients have no expiry date; give the product's expiry date.",
  'errors.invalid_quantity': 'Enter a valid quantity.',
  'errors.invalid_type': 'Stock comes in as opening stock or as a goods receipt.',
  'errors.invalid_direction': 'Choose outgoing or incoming.',
  'errors.invalid_within_days': 'Days must be between 0 and 3650.',
  'errors.invalid_serial': 'A serial number is at most 64 characters and has no comma.',
  'errors.count_not_found': 'No such stock-take.',
  'errors.line_not_found': 'That line is not on this record.',
  'errors.transfer_not_found': 'No such transfer.',
  'errors.destruction_not_found': 'No such destruction record.',
  'errors.invalid_date': 'The date cannot be in the future.',
  'errors.future_date': 'The date {{date}} is after today ({{today}}).',
  'errors.invalid_adjustment': 'The adjustment must be more than -100%.',
  'errors.goods_receipt_not_found': 'No such goods receipt.',
  'errors.purchase_order_not_found': 'No such purchase order.',
  'errors.supplier_not_found': 'No such supplier.',
  'errors.supplier_return_not_found': 'No such supplier return.',
  'errors.category_not_found': 'No such category.',
  'errors.manufacturer_not_found': 'No such manufacturer.',
  'errors.invalid_period': 'The end date is before the start date.',

  // messages and integrations
  'errors.unknown_category': 'No such notification category.',
  'errors.unknown_template': 'No such message template.',
  'errors.notification_not_found': 'No such notification.',
  'errors.webhook_not_found': 'No such webhook.',
  'errors.invalid_channel': 'In-app messages need no provider.',
  'errors.invalid_month': 'The month must look like 2026-11.',

  // files, imports and exports
  'errors.empty_file': 'Choose a file to import.',
  'errors.unreadable_file': 'The file could not be read.',
  'errors.unsupported_file':
    'Old .xls files cannot be read: save it as an Excel workbook (.xlsx) or as CSV.',
  'errors.unsupported_type': 'Only PNG, JPEG or WebP images and PDF documents may be uploaded.',
  'errors.file_too_large': 'A file may be at most 10 MB.',
  'errors.file_not_found': 'No such file.',
  'errors.invalid_size': 'The file is empty.',
  'errors.invalid_owner_type': 'A file cannot be attached here.',
  'errors.invalid_purpose': 'A file cannot be attached here.',
  'errors.invalid_format': 'Download as Excel (xlsx) or CSV.',
  'errors.too_many_rows':
    'Too many rows match (more than {{max}}): narrow the filters and download again.',
  'errors.period_too_long': 'Choose a period of at most 366 days.',
  'errors.too_many_uids': 'Too many products at once (at most {{max}}).',
  'errors.database_busy': 'The system is busy right now. Try again in a moment.',
};
