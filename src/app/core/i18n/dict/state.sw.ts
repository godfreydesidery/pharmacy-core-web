/** Hali za akaunti na orodha, kwa Kiswahili; tazama state.en.ts. */
export const STATE_SW: Readonly<Record<string, string>> = {
  'state.list.failed': 'Imeshindikana kupakia taarifa hizi',

  'state.forgot.label': 'Barua pepe au akaunti ya mfanyakazi',
  'state.forgot.staffTitle': '{{login}} ni akaunti ya mfanyakazi.',
  'state.forgot.staffBody':
    'Nenosiri lake huwekwa upya na famasia ({{code}}), si kwa barua pepe: mwombe meneja wako afungue Utawala → Watumiaji, atafute akaunti yako na achague "Weka nenosiri jipya". Utapewa nenosiri la muda, kisha utachagua lako mwenyewe utakapoingia.',
  'state.forgot.staffHint':
    'Unaingia kwa akaunti ya mfanyakazi, kama juma@DAWA? Mwombe meneja wa famasia yako aweke upya nenosiri lake.',

  'state.suspended.pay': 'Angalia ankara na ulipe',
  'state.suspended.contact':
    'Wasiliana na msimamizi wa mfumo kwa maelezo zaidi au ili famasia irejeshwe.',
  'state.suspended.unpaid.title': 'Usajili haujalipwa',
  'state.suspended.unpaid.body.admin':
    'Usajili wa {{pharmacy}} haujalipwa. Bado unaweza kuona data yake na kuipakua, lakini hakuna kinachoweza kubadilishwa, wala hakuna anayeweza kuuza, mpaka ankara iliyo wazi ilipwe.',
  'state.suspended.unpaid.body.staff':
    'Usajili wa {{pharmacy}} haujalipwa, kwa hiyo hakuna anayeweza kufanya kazi ndani yake kwa sasa.',
  'state.suspended.unpaid.hint':
    'Msimamizi wa famasia yako anaweza kuulipia; kazi itaendelea mara baada ya malipo.',
  'state.suspended.legal-hold.title': 'Famasia hii imezuiliwa kisheria',
  'state.suspended.legal-hold.body':
    'Hakuna anayeweza kufanya kazi katika {{pharmacy}} wakati mgogoro au amri ya kisheria inashughulikiwa. Data yake inahifadhiwa kama ilivyo, na haiwezi kufutwa, mpaka zuio liondolewe.',
  'state.suspended.platform.title': 'Imesimamishwa na msimamizi wa mfumo',
  'state.suspended.platform.body':
    'Msimamizi wa mfumo ameisimamisha {{pharmacy}}: hakuna anayeweza kufanya kazi ndani yake mpaka irejeshwe. Data yake iko salama.',
  'state.suspended.suspended.title': 'Famasia hii imesimamishwa',
  'state.suspended.suspended.body':
    'Hakuna anayeweza kufanya kazi katika {{pharmacy}} kwa sasa. Data yake iko salama.',
  'state.suspended.suspended.hint':
    'Huenda usajili wake haujalipwa, au msimamizi wa mfumo ameisimamisha: muulize msimamizi wa famasia yako.',
  'state.suspended.closed.title': 'Famasia hii imefungwa',
  'state.suspended.closed.body':
    '{{pharmacy}} imefungwa: hakuna anayefanya kazi ndani yake tena. Wasimamizi wake bado wanaweza kupakua data yake mpaka ifutwe.',
  'state.suspended.erased.title': 'Data ya famasia hii imefutwa',
  'state.suspended.erased.body':
    '{{pharmacy}} ilifungwa na data yake ikafutwa; hakuna chochote chake kinachoweza kufunguliwa tena.',
};
