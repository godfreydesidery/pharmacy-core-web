/** Server refusals in Swahili, by `reason`; see errors.en.ts. */
export const ERRORS_SW: Readonly<Record<string, string>> = {
  // transport and edge
  'errors.network_error': 'Seva haipatikani. Angalia muunganisho wako wa mtandao.',
  'errors.internal_error': 'Hitilafu imetokea; imeandikwa kwenye kumbukumbu.',
  'errors.too_many_requests': 'Maombi ni mengi mno; subiri kidogo kisha ujaribu tena.',
  'errors.malformed_request': 'Ombi halikuweza kusomeka.',
  'errors.missing_input': 'Baadhi ya taarifa zinazohitajika hazipo.',
  'errors.route_not_found': 'Kitendo hiki hakipatikani.',
  'errors.conflict': 'Hii inagongana na rekodi iliyopo.',
  'errors.stale_version': 'Mtu mwingine amebadilisha rekodi hii; pakia upya kisha ujaribu tena.',
  'errors.precondition_failed':
    'Mtu mwingine amebadilisha rekodi hii; pakia upya ili kuona mabadiliko yake.',
  'errors.precondition_required':
    'Badiliko hili lazima litaje toleo la rekodi linalohariri; pakia upya kisha ujaribu tena.',
  'errors.forbidden': 'Jukumu lako haliruhusu hili.',
  'errors.unauthenticated': 'Ingia ili kuendelea.',

  // sign-in and security
  'errors.account_locked': 'Majaribio mengi ya kuingia yameshindwa; akaunti imefungwa kwa muda.',
  'errors.client_locked':
    'Majaribio mengi ya kuingia yameshindwa kutoka kifaa hiki; jaribu tena baadaye.',
  'errors.invalid_credentials': 'Barua pepe au nenosiri si sahihi.',
  'errors.invalid_current_password': 'Nenosiri la sasa si sahihi.',
  'errors.weak_password': 'Nenosiri lisizidi herufi 128.',
  'errors.invalid_code': 'Msimbo huo si sahihi.',
  'errors.invalid_token': 'Kiungo hiki cha kuweka upya hakifanyi kazi tena; omba kipya.',
  'errors.challenge_expired': 'Muda wa kuingia umeisha; ingia tena kwa nenosiri lako.',
  'errors.session_expired': 'Muda wa kuingia umeisha; ingia tena.',
  'errors.ceremony_expired': 'Muda wa ombi la passkey umeisha; jaribu tena.',
  'errors.passkey_exists': 'Passkey hii imeshasajiliwa.',
  'errors.passkey_rejected': 'Passkey haikuweza kusajiliwa.',
  'errors.two_factor_already_enabled':
    'Uthibitisho wa hatua mbili umewashwa; uzime kwanza ili kuweka programu mpya.',
  'errors.two_factor_not_enabled': 'Washa uthibitisho wa hatua mbili kwanza.',
  'errors.two_factor_not_started': 'Anza kwanza kuweka uthibitisho wa hatua mbili.',
  'errors.two_factor_required': 'Akaunti hii huingia kwa hatua ya pili.',
  'errors.two_factor_setup_required':
    'Weka uthibitisho wa hatua mbili kwenye akaunti yako kabla ya kutumia jukwaa.',
  'errors.invitation_not_open': 'Mwaliko huu umeshatumika, umefutwa au muda wake umeisha.',
  'errors.password_change_required':
    'Chagua nenosiri lako mwenyewe kabla ya kuanza: hili uliwekewa na duka lako la dawa.',
  'errors.same_password': 'Chagua nenosiri jipya lako mwenyewe, si lile ulilopewa.',
  'errors.username_taken': 'Jina hili la mtumiaji tayari linatumika katika duka hili.',
  'errors.invalid_username':
    'Jina la mtumiaji ni herufi au tarakimu 2 hadi 32, na linaweza kuwa na . - au _ (mfano juma au mary.k).',
  'errors.not_managed':
    'Mtu huyu huingia kwa akaunti yake mwenyewe; ni yeye tu anayeweza kubadilisha nenosiri lake.',
  'errors.account_exists':
    'Barua pepe hii tayari ina akaunti: ingia kwanza, kisha ukubali mwaliko.',
  'errors.managed_login_cannot_join':
    'Akaunti ya mfanyakazi wa duka hufanya kazi katika duka hilo tu. Ingia kwa akaunti yako mwenyewe, au fungua moja, ili ukubali mwaliko huu.',
  'errors.direct_creation_disabled':
    'Duka hili hualika watu kwa barua pepe; halitengenezi akaunti za kuingia kwa ajili yao.',

  // workspace
  'errors.tenant_suspended': 'Akaunti ya duka hili la dawa imesimamishwa.',
  'errors.tenant_required': 'Chagua duka la dawa kwanza.',
  'errors.branch_required': 'Chagua tawi kwanza.',
  'errors.branch_not_allowed': 'Hufanyi kazi kwenye tawi hilo.',
  'errors.head_office_required': 'Makao makuu hayawezi kuzimwa.',
  'errors.cannot_deactivate_self': 'Huwezi kuzima uanachama wako mwenyewe.',
  'errors.invalid_branch_uids': 'Chagua angalau tawi moja, au ruhusu matawi yote.',
  'errors.duplicate_email': 'Tayari kuna mtumiaji mwenye barua pepe hii.',
  'errors.duplicate_code': 'Msimbo huu tayari unatumika.',
  'errors.duplicate_name': 'Jina hili tayari linatumika.',

  // selling
  'errors.insufficient_stock':
    'Hifadhi haitoshi: zipo {{available}} tu, unahitaji {{requested}}. {{product}}{{batch}}',
  'errors.payment_short': 'Malipo ({{paid}}) hayatoshi kufikia jumla ({{total}}).',
  'errors.overpaid_non_cash':
    'Ni fedha taslimu tu inayoweza kuzidi, isipokuwa ziada iwekwe kwenye akaunti ya mteja.',
  'errors.customer_required': 'Mteja wa papo kwa papo hawezi kudaiwa; chagua mteja.',
  'errors.credit_limit_exceeded': 'Hii itampitisha mteja kikomo chake cha mkopo ({{limit}}).',
  'errors.credit_not_permitted': 'Jukumu lako haliruhusu kuuza kwa mkopo.',
  'errors.insufficient_account_credit': 'Akaunti haina salio la kutosha.',
  'errors.discount_not_allowed': 'Huruhusiwi kutoa punguzo.',
  'errors.prescription_required': 'Dawa ya cheti cha daktari inahitaji taarifa za daktari.',
  'errors.member_required': 'Malipo ya bima yanahitaji uanachama wa bima wa mteja.',
  'errors.member_not_found': 'Mteja hana bima halali leo.',
  'errors.member_inactive': 'Uanachama huu wa bima haufanyi kazi.',
  'errors.insurance_amount_mismatch': 'Kiasi cha bima hakilingani na kinacholipwa na bima.',
  'errors.rate_missing': 'Bado hakuna kiwango cha kubadilisha fedha kwa sarafu hii.',
  'errors.serial_required': 'Changanua au weka namba ya utambulisho ya kila kipande.',
  'errors.tracking_mode_locked': 'Njia ya ufuatiliaji haiwezi kubadilika wakati bidhaa iko stoo.',
  'errors.foreign_refund_method':
    'Rejesho kwa sarafu ya kigeni hulipwa kwa taslimu, kadi au pesa ya simu.',
  'errors.foreign_refund_not_allowed':
    'Mauzo yaliyolipwa kwa sehemu kwa mkopo, bima au salio la akaunti yanarejeshwa kwa sarafu ya msingi.',
  'errors.refund_currency_not_tendered': 'Mauzo hayakulipwa kwa sarafu hiyo.',
  'errors.serials_mismatch': 'Weka namba moja ya utambulisho kwa kila kipande.',
  'errors.serial_not_in_stock': 'Namba hiyo ya utambulisho haipo kwenye hifadhi hapa.',
  'errors.serial_not_on_sale': 'Namba hiyo ya utambulisho haipo kwenye mauzo haya.',
  'errors.serial_not_sold': 'Namba hiyo ya utambulisho haijauzwa.',
  'errors.serials_not_tracked': 'Bidhaa hii haifuatiliwi kwa namba ya utambulisho.',
  'errors.duplicate_serial': 'Namba hii ya utambulisho tayari imeandikwa.',
  'errors.batch_expired': 'Bechi hii imeisha muda.',
  'errors.return_exceeds_sold': 'Huwezi kurudisha zaidi ya kilichouzwa.',
  'errors.sale_other_branch': 'Mauzo hurudishwa kwenye tawi lililouza.',
  'errors.sale_not_found': 'Mauzo hayo hayapo.',

  // stock and purchasing
  'errors.same_branch': 'Uhamisho huenda kwenye tawi jingine.',
  'errors.not_destination': 'Ni tawi linalopokea tu linaloweza kupokea uhamisho.',
  'errors.already_received': 'Uhamisho huu umeshapokelewa.',
  'errors.over_receipt': 'Huwezi kupokea zaidi ya kilichoagizwa.',
  'errors.not_cancellable': 'Ni oda ambayo bado haijapokelewa chochote tu inayoweza kufutwa.',
  'errors.purchase_order_closed': 'Oda ya manunuzi imefungwa.',
  'errors.purchase_order_other_branch': 'Oda ya manunuzi ni ya tawi jingine.',
  'errors.supplier_mismatch': 'Oda ya manunuzi ni kwa msambazaji mwingine.',
  'errors.product_not_on_order': 'Bidhaa hii haipo kwenye oda ya manunuzi.',
  'errors.currency_mismatch': 'Mapokezi yawe kwa sarafu ya oda.',
  'errors.batch_expiry_mismatch': 'Bechi hii tayari imeandikwa na tarehe nyingine ya kuisha.',
  'errors.batch_not_of_product': 'Bechi hii si ya bidhaa hii.',
  'errors.serial_not_of_batch': 'Kila namba ya utambulisho iwe ya bechi inayorekebishwa.',
  'errors.duplicate_product': 'Kila bidhaa ionekane mara moja tu.',
  'errors.invalid_quantity_change': 'Mabadiliko ya kiasi yasiwe sifuri.',

  // catalogue
  'errors.duplicate_sku': 'Bidhaa nyingine tayari ina msimbo huu.',
  'errors.duplicate_gtin': 'Bidhaa nyingine tayari ina msimbopau (GTIN) huu.',
  'errors.invalid_gtin':
    'Msimbopau huu si GTIN halali (EAN-13, UPC-A, GTIN-8 au GTIN-14): tarakimu yake ya kuhakiki si sahihi.',
  'errors.invalid_atc_code': 'Huu si msimbo wa ATC wa WHO, kama N02BE01.',
  'errors.invalid_generic_name': 'Dawa inahitaji jina lake la kitaalamu (INN).',
  'errors.invalid_dosage_form': 'Dawa inahitaji aina yake ya dawa (kidonge, sharubati…).',
  'errors.category_cycle': 'Kundi haliwezi kuwa chini yake lenyewe au chini ya kundi lake dogo.',
  'errors.category_too_deep': 'Makundi hayawezi kupangwa kwa kina hiki.',
  'errors.invalid_warranty_months': 'Muda wa dhamana uko nje ya kiwango.',
  'errors.invalid_reorder_level': 'Kiwango cha kuagiza upya kiwe sifuri au zaidi.',

  // money, insurance and receivables
  'errors.invalid_amount': 'Kiasi kiwe zaidi ya sifuri.',
  'errors.invalid_rate': 'Kiwango kiwe zaidi ya sifuri.',
  'errors.exchange_rate_mismatch':
    'Kiwango hicho si kiwango cha leo kilichorekodiwa. Rekodi kiwango kipya kwenye Viwango vya fedha kwanza.',
  'errors.base_currency_only': 'Malipo haya hupokelewa kwa sarafu ya duka pekee.',
  'errors.owner_required': 'Chagua kumbukumbu ambayo faili ni yake.',
  'errors.invalid_exchange_rate': 'Kiwango cha kubadilisha fedha kiwe zaidi ya sifuri.',
  'errors.same_currency': 'Chagua sarafu mbili tofauti.',
  'errors.invalid_effective_on': 'Tarehe haiwezi kuwa ya baadaye.',
  'errors.charge_not_open': 'Deni hilo halipo wazi kwenye akaunti hii.',
  'errors.write_off_exceeds_open': 'Huwezi kufuta zaidi ya kinachodaiwa.',
  'errors.claim_closed': 'Dai hili limefungwa.',
  'errors.claim_not_payable': 'Dai hilo halisubiri malipo.',
  'errors.no_claims_in_period': 'Hakuna madai ya rasimu katika kipindi hiki.',
  'errors.remittance_mismatch': 'Kiasi kwa kila dai kijumlishe hadi jumla.',
  'errors.duplicate_member_number': 'Namba hii ya mwanachama tayari imesajiliwa.',
  'errors.invalid_diagnosis_code': 'Utambuzi uwe msimbo wa ICD-10, kama J06.9.',
  'errors.invalid_valid_until': 'Tarehe ya mwisho iko kabla ya tarehe ya kuanza.',

  // general input
  'errors.invalid_name': 'Jina linahitajika.',
  'errors.invalid_range': 'Tarehe ya kuanza isiwe baada ya tarehe ya mwisho.',
  'errors.invalid_url': 'Anwani iwe URL ya https.',
  'errors.invalid_event_types': 'Chagua aina sahihi za matukio.',
  'errors.upload_missing': 'Faili haijamaliza kupakiwa; jaribu tena.',
  'errors.url_expired': 'Muda wa kiungo hiki cha faili umeisha; kifungue tena.',
  'errors.invalid_signature': 'Kiungo hiki cha faili si halali.',

  'errors.invalid_input': 'Kagua taarifa ulizoweka.',

  // edge and lists
  'errors.busy_try_again':
    'Droo nyingine ilikuwa ikitumia bidhaa au akaunti hiyo hiyo; jaribu tena.',
  'errors.idempotency_in_progress': 'Ombi hili bado linashughulikiwa; subiri kidogo.',
  'errors.idempotency_key_reused': 'Ombi hili lilishatumwa likiwa na taarifa tofauti; lianze upya.',
  'errors.invalid_idempotency_key':
    'Ombi halikuweza kutumwa kwa usalama; pakia ukurasa upya kisha ujaribu tena.',
  'errors.method_not_allowed': 'Kitendo hiki hakipatikani.',
  'errors.unsupported_media_type': 'Ombi halikuweza kusomeka.',
  'errors.invalid_cursor': 'Orodha imebadilika; ipakie upya.',
  'errors.invalid_limit': 'Onyesha safu kati ya 1 na 100.',
  'errors.invalid_page': 'Ukurasa lazima uwe namba kamili kuanzia 1.',
  'errors.invalid_value': 'Taarifa inayohitajika haipo.',

  // sign-in and accounts
  'errors.session_idle':
    'Umetolewa baada ya dakika {{idleMinutes}} bila kutumia programu; ingia tena.',
  'errors.session_not_found': 'Kipindi hicho cha kuingia kimeshaisha.',
  'errors.managed_login':
    'Hii ni akaunti ya mfanyakazi wa famasia: famasia yake ndiyo hutunza taarifa zake na huweka upya nenosiri lake.',
  'errors.password_required': 'Chagua nenosiri jipya.',
  'errors.same_email': 'Hiyo tayari ni barua pepe yako ya kuingia.',
  'errors.email_taken': 'Barua pepe hiyo sasa ina akaunti; omba badiliko jingine.',
  'errors.already_verified': 'Simu hiyo tayari imethibitishwa.',
  'errors.phone_needs_verification':
    'Ongeza au badilisha simu yako kwenye ukurasa wa usalama, kwa msimbo utakaotumwa kwake.',
  'errors.recovery_on_hold':
    'Kwa usalama wako, kiungo hiki cha kurejesha akaunti hufanya kazi baada ya muda wa kusubiri; jaribu tena baadaye.',
  'errors.already_a_member':
    'Akaunti yako tayari iko kwenye famasia hiyo; mwombe msimamizi wake aondoe mojawapo.',
  'errors.invitation_not_found': 'Mwaliko huo haupo.',
  'errors.passkey_not_found': 'Passkey hiyo haipo.',
  'errors.invalid_credential': 'Passkey haikujibu; jaribu tena.',
  'errors.user_not_found': 'Mtumiaji huyo hayupo.',
  'errors.role_not_found': 'Jukumu hilo halipo.',
  'errors.invalid_permissions': 'Mojawapo ya ruhusa hizi haiwezi kutolewa kwa jukumu la famasia.',
  'errors.invalid_idle_minutes': 'Kikomo cha kutotumika kiwe kati ya dakika 5 na 60.',

  // pharmacy and platform
  'errors.tenant_not_found': 'Famasia hiyo haipo.',
  'errors.branch_not_found': 'Tawi hilo halipo.',
  'errors.settings_not_found': 'Mipangilio ya famasia haipo; wasiliana na msimamizi wa mfumo.',
  'errors.erased': 'Data ya famasia tayari imefutwa.',
  'errors.invalid_country': 'Nchi iwe msimbo wa herufi mbili, kama TZ.',
  'errors.invalid_timezone': 'Chagua saa za eneo, kama Africa/Dar_es_Salaam.',
  'errors.invalid_look': 'Chagua mwonekano kutoka kwenye orodha.',
  'errors.invalid_expiry_alert_days': 'Tahadhari za kuisha muda ziwe siku 1 hadi 730 kabla.',
  'errors.clock_backwards': 'Saa ya majaribio husogea mbele tu.',
  'errors.clock_move': 'Weka muda wa kusogeza mbele au wakati wa kuhamia.',
  'errors.reseal_running': 'Usimbaji upya wa funguo tayari unaendelea.',

  // selling, customers and insurance
  'errors.product_inactive': 'Bidhaa hii haiuzwi tena: {{product}}.',
  'errors.product_not_found': 'Bidhaa hiyo haipo.',
  'errors.customer_not_found': 'Mteja huyo hayupo.',
  'errors.member_not_of_customer': 'Uanachama huu wa bima si wa mteja huyu.',
  'errors.account_on_hold': 'Akaunti ya mteja imesimamishwa; hakuna mkopo mpya unaoruhusiwa.',
  'errors.invalid_credit_limit': 'Weka kikomo cha mkopo.',
  'errors.currency_not_accepted': 'Famasia hii haipokei sarafu {{currency}} (Mipangilio → Sarafu).',
  'errors.currency_not_supported':
    'Sarafu {{currency}} ina desimali zaidi ya 2; sarafu kuu ya famasia inaweza kuwa na desimali 2 tu.',
  'errors.refund_method_not_allowed': 'Fedha hurudishwa kwa njia ileile ambayo mauzo yalilipwa.',
  'errors.preauth_required': 'Bima hii inahitaji namba ya idhini ya awali.',
  'errors.payer_not_found': 'Mlipaji huyo hayupo.',
  'errors.scheme_not_found': 'Mpango huo wa bima haupo.',
  'errors.claim_not_found': 'Dai hilo halipo.',
  'errors.remittance_exceeds_due': 'Dai haliwezi kulipwa zaidi ya kiasi kinachodaiwa.',
  'errors.sale_line_not_found': 'Mstari huo haupo kwenye mauzo haya.',
  'errors.return_not_found': 'Marejesho hayo hayapo.',
  'errors.return_line_not_found': 'Mstari huo haupo kwenye marejesho haya.',
  'errors.promotion_not_found': 'Promosheni hiyo haipo.',
  'errors.price_list_not_found': 'Orodha hiyo ya bei haipo.',
  'errors.duplicate_voucher': 'Tayari kuna vocha yenye msimbo huu.',
  'errors.invalid_expiry': 'Tarehe ya kuisha imeshapita.',
  'errors.method_not_found': 'Njia hiyo ya malipo haipo.',
  'errors.invalid_adapter': 'Muunganisho huo wa malipo haujulikani.',
  'errors.invalid_kind': 'Aina hiyo ya malipo haijulikani.',
  'errors.payment_request_not_found': 'Ombi hilo la malipo halipo.',
  'errors.invalid_payment_method': 'Chagua mojawapo ya njia za malipo zilizopo.',
  'errors.invalid_payment_terms_days': 'Muda wa kulipa uwe siku 0 hadi 365.',
  'errors.overpayment':
    'Hiki ni zaidi ya kinachodaiwa bado kwenye stakabadhi hizo; lipa kisichozidi hicho, au lipa kilichobaki kwenye akaunti.',
  'errors.invalid_action': 'Kitendo hicho hakihitaji idhini.',

  // stock, purchasing and finance
  'errors.batch_not_found': 'Bechi hiyo haipo.',
  'errors.batch_required': 'Bidhaa hii ilikuja kwa bechi kadhaa; chagua bechi ya kila mstari.',
  'errors.batch_not_expired':
    'Bechi hii bado haijaisha muda; iteketeze kama iliyoharibika, au subiri hadi iishe muda.',
  'errors.batch_not_on_receipt': 'Bechi hii haikupokelewa kwenye mapokezi hayo ya bidhaa.',
  'errors.duplicate_line': 'Kila mstari uonekane mara moja tu.',
  'errors.expiry_required':
    'Viambato havina tarehe ya kuisha; weka tarehe ya kuisha ya bidhaa inayotengenezwa.',
  'errors.invalid_quantity': 'Weka idadi sahihi.',
  'errors.invalid_type': 'Bidhaa huingia kama hifadhi ya kuanzia au kama mapokezi ya bidhaa.',
  'errors.invalid_direction': 'Chagua zinazotoka au zinazoingia.',
  'errors.invalid_within_days': 'Siku ziwe kati ya 0 na 3650.',
  'errors.invalid_serial': 'Namba ya utambulisho isizidi herufi 64 na isiwe na koma.',
  'errors.count_not_found': 'Hesabu hiyo ya stoo haipo.',
  'errors.line_not_found': 'Mstari huo haupo kwenye rekodi hii.',
  'errors.transfer_not_found': 'Uhamisho huo haupo.',
  'errors.destruction_not_found': 'Rekodi hiyo ya uteketezaji haipo.',
  'errors.invalid_date': 'Tarehe haiwezi kuwa ya siku zijazo.',
  'errors.future_date': 'Tarehe {{date}} ni baada ya leo ({{today}}).',
  'errors.invalid_adjustment': 'Marekebisho yawe zaidi ya -100%.',
  'errors.goods_receipt_not_found': 'Mapokezi hayo ya bidhaa hayapo.',
  'errors.purchase_order_not_found': 'Oda hiyo ya manunuzi haipo.',
  'errors.supplier_not_found': 'Msambazaji huyo hayupo.',
  'errors.supplier_return_not_found': 'Marejesho hayo kwa msambazaji hayapo.',
  'errors.category_not_found': 'Kundi hilo halipo.',
  'errors.manufacturer_not_found': 'Mtengenezaji huyo hayupo.',
  'errors.invalid_period': 'Tarehe ya mwisho ni kabla ya tarehe ya kuanza.',

  // messages and integrations
  'errors.unknown_category': 'Kundi hilo la arifa halipo.',
  'errors.unknown_template': 'Kiolezo hicho cha ujumbe hakipo.',
  'errors.notification_not_found': 'Arifa hiyo haipo.',
  'errors.webhook_not_found': 'Webhook hiyo haipo.',
  'errors.invalid_channel': 'Ujumbe wa ndani ya programu hauhitaji mtoa huduma.',
  'errors.invalid_month': 'Mwezi uandikwe kama 2026-11.',

  // files, imports and exports
  'errors.empty_file': 'Chagua faili la kuingiza.',
  'errors.unreadable_file': 'Faili halikuweza kusomeka.',
  'errors.unsupported_file':
    'Faili la zamani la .xls haliwezi kusomwa: lihifadhi kama Excel (.xlsx) au CSV.',
  'errors.unsupported_type':
    'Ni picha za PNG, JPEG au WebP na nyaraka za PDF tu zinazoweza kupakiwa.',
  'errors.file_too_large': 'Faili lisizidi MB 10.',
  'errors.file_not_found': 'Faili hilo halipo.',
  'errors.invalid_size': 'Faili ni tupu.',
  'errors.invalid_owner_type': 'Faili haliwezi kuambatishwa hapa.',
  'errors.invalid_purpose': 'Faili haliwezi kuambatishwa hapa.',
  'errors.invalid_format': 'Pakua kama Excel (xlsx) au CSV.',
  'errors.too_many_rows':
    'Safu nyingi mno zinalingana (zaidi ya {{max}}): punguza vichujio kisha upakue tena.',
  'errors.period_too_long': 'Chagua kipindi kisichozidi siku 366.',
  'errors.too_many_uids': 'Bidhaa nyingi mno kwa mara moja (zisizozidi {{max}}).',
  'errors.database_busy': 'Mfumo una shughuli nyingi sasa hivi. Jaribu tena baada ya muda mfupi.',
};
