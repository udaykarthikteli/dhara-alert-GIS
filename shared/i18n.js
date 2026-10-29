// Shared by the API (SMS text) and the web app (UI). English is the fallback for any missing key.
// status: 'reviewed' = checked wording; 'draft' = best-effort, needs review by a native speaker before field use;
//         'todo' = not translated yet (falls back to English) - add strings in `S.<code>`.
export const LANGS = [
  { code: 'en',  name: 'English',        native: 'English',   status: 'reviewed' },
  { code: 'hi',  name: 'Hindi',          native: 'हिन्दी',      status: 'reviewed' },
  { code: 'as',  name: 'Assamese',       native: 'অসমীয়া',     status: 'reviewed' },
  { code: 'bn',  name: 'Bengali',        native: 'বাংলা',       status: 'reviewed' },
  { code: 'ne',  name: 'Nepali',         native: 'नेपाली',      status: 'reviewed' },
  { code: 'lus', name: 'Mizo',           native: 'Mizo ṭawng', status: 'draft' },
  { code: 'kha', name: 'Khasi',          native: 'Ka Khasi',  status: 'todo' },
  { code: 'mni', name: 'Meitei (Manipuri)', native: 'মৈতৈলোন্',  status: 'todo' },
];

export const S = {
  en: {
    title: 'Dhara Alert', tagline: 'Landslide early warning for North and North-East India',
    nav_map: 'Map', nav_dash: 'Dashboard', nav_roads: 'Roads', nav_report: 'Report', nav_alerts: 'Alerts', nav_sms: 'Get SMS alerts',
    enter: 'Open live map',
    level_low: 'Low', level_watch: 'Watch', level_warning: 'Warning', level_danger: 'Danger', level_critical: 'Critical',
    lhi: 'Landslide Hazard Index', fos: 'Factor of Safety', rain24: 'Rain, last 24 h', saturation: 'Soil saturation',
    forecast72: '72-hour risk forecast', priority: 'Emergency priority',
    road_open: 'Open', road_caution: 'Caution', road_risk: 'At risk', road_blocked: 'Blocked',
    report_title: 'Report a slope hazard', report_what: 'What do you see?',
    t_crack: 'Cracks in ground or road', t_move: 'Slope is moving', t_blocked: 'Road is blocked', t_debris: 'Debris flowing', t_seep: 'Water seeping from slope',
    note: 'Describe what you see (optional)', use_location: 'Use my location', attach: 'Add photo or video', send: 'Send report',
    queued: 'No network. Saved on your phone and will send when you are online.', sent: 'Report sent. Thank you.',
    phone: 'Mobile number', area: 'Area to watch', subscribe: 'Subscribe', subscribed: 'Subscribed',
    updated: 'Updated', offline: 'You are offline. Showing last saved data.', language: 'Language', no_alerts: 'No active alerts.',
    stat_sites: 'Sites monitored', stat_warn: 'At Warning or above', stat_roads: 'Roads affected',
    alert_tpl: '{level} landslide alert: {site}. Hazard index {lhi}/100. Stay away from steep slopes and cut roads. If you see cracks or hear rumbling, move to safer ground now.',
  },
  hi: {
    title: 'धारा अलर्ट', tagline: 'उत्तर और पूर्वोत्तर भारत के लिए भूस्खलन पूर्व-चेतावनी',
    nav_map: 'नक्शा', nav_dash: 'डैशबोर्ड', nav_roads: 'सड़कें', nav_report: 'रिपोर्ट', nav_alerts: 'अलर्ट', nav_sms: 'SMS अलर्ट पाएँ',
    enter: 'लाइव नक्शा खोलें',
    level_low: 'कम', level_watch: 'निगरानी', level_warning: 'चेतावनी', level_danger: 'खतरा', level_critical: 'अति गंभीर',
    lhi: 'भूस्खलन खतरा सूचकांक', fos: 'सुरक्षा गुणांक', rain24: 'पिछले 24 घंटे की बारिश', saturation: 'मिट्टी में नमी',
    forecast72: '72 घंटे का जोखिम पूर्वानुमान', priority: 'आपातकालीन प्राथमिकता',
    road_open: 'खुली', road_caution: 'सावधानी', road_risk: 'जोखिम में', road_blocked: 'बंद',
    report_title: 'ढलान पर खतरे की सूचना दें', report_what: 'आपको क्या दिख रहा है?',
    t_crack: 'ज़मीन या सड़क में दरार', t_move: 'ढलान खिसक रही है', t_blocked: 'सड़क बंद है', t_debris: 'मलबा बह रहा है', t_seep: 'ढलान से पानी रिस रहा है',
    note: 'जो देखा उसका विवरण (वैकल्पिक)', use_location: 'मेरा स्थान लें', attach: 'फोटो या वीडियो जोड़ें', send: 'रिपोर्ट भेजें',
    queued: 'नेटवर्क नहीं है। रिपोर्ट फ़ोन में सहेजी गई है और नेटवर्क आते ही भेज दी जाएगी।', sent: 'रिपोर्ट भेज दी गई। धन्यवाद।',
    phone: 'मोबाइल नंबर', area: 'निगरानी का क्षेत्र', subscribe: 'सदस्यता लें', subscribed: 'सदस्यता हो गई',
    updated: 'अद्यतन', offline: 'आप ऑफ़लाइन हैं। आख़िरी सहेजा गया डेटा दिख रहा है।', language: 'भाषा', no_alerts: 'कोई सक्रिय अलर्ट नहीं।',
    stat_sites: 'निगरानी वाले स्थल', stat_warn: 'चेतावनी या उससे ऊपर', stat_roads: 'प्रभावित सड़कें',
    alert_tpl: '{level} भूस्खलन अलर्ट: {site}। खतरा सूचकांक {lhi}/100। खड़ी ढलानों और कटे हुए रास्तों से दूर रहें। दरारें दिखें या गड़गड़ाहट सुनाई दे तो तुरंत सुरक्षित स्थान पर जाएँ।',
  },
  as: {
    title: 'ধাৰা এলাৰ্ট', tagline: 'উত্তৰ আৰু উত্তৰ-পূব ভাৰতৰ বাবে ভূমিস্খলনৰ পূৰ্ব-সতৰ্কবাণী',
    nav_map: 'মানচিত্ৰ', nav_dash: 'ডেচব\'ৰ্ড', nav_roads: 'পথ', nav_report: 'প্ৰতিবেদন', nav_alerts: 'সতৰ্কবাণী', nav_sms: 'SMS সতৰ্কবাণী লওক',
    enter: 'লাইভ মানচিত্ৰ খোলক',
    level_low: 'নিম্ন', level_watch: 'নজৰদাৰী', level_warning: 'সতৰ্কতা', level_danger: 'বিপদ', level_critical: 'অতি গুৰুতৰ',
    lhi: 'ভূমিস্খলন বিপদ সূচক', fos: 'নিৰাপত্তা গুণক', rain24: 'যোৱা ২৪ ঘণ্টাৰ বৰষুণ', saturation: 'মাটিৰ আৰ্দ্ৰতা',
    forecast72: '৭২ ঘণ্টাৰ বিপদৰ পূৰ্বাভাস', priority: 'জৰুৰীকালীন অগ্ৰাধিকাৰ',
    road_open: 'মুকলি', road_caution: 'সাৱধানতা', road_risk: 'বিপদত', road_blocked: 'বন্ধ',
    report_title: 'ঢালত বিপদৰ খবৰ দিয়ক', report_what: 'আপুনি কি দেখিছে?',
    t_crack: 'মাটি বা পথত ফাট', t_move: 'ঢাল সৰি আহিছে', t_blocked: 'পথ বন্ধ হৈ আছে', t_debris: 'ধ্বংসাৱশেষ বৈ আহিছে', t_seep: 'ঢালৰ পৰা পানী ওলাইছে',
    note: 'আপুনি কি দেখিছে লিখক (ঐচ্ছিক)', use_location: 'মোৰ অৱস্থান ব্যৱহাৰ কৰক', attach: 'ফটো বা ভিডিঅ\' যোগ কৰক', send: 'প্ৰতিবেদন পঠাওক',
    queued: 'নেটৱৰ্ক নাই। প্ৰতিবেদন ফোনত সংৰক্ষিত হ\'ল, নেটৱৰ্ক পালেই পঠিওৱা হ\'ব।', sent: 'প্ৰতিবেদন পঠিওৱা হ\'ল। ধন্যবাদ।',
    phone: 'মোবাইল নম্বৰ', area: 'চোৱাচিতা কৰিবলগীয়া অঞ্চল', subscribe: 'গ্ৰাহক হওক', subscribed: 'গ্ৰাহক হ\'ল',
    updated: 'আপডেট', offline: 'আপুনি অফলাইন। শেষবাৰ সংৰক্ষণ কৰা তথ্য দেখুওৱা হৈছে।', language: 'ভাষা', no_alerts: 'কোনো সক্ৰিয় সতৰ্কবাণী নাই।',
    stat_sites: 'নিৰীক্ষণ কৰা স্থান', stat_warn: 'সতৰ্কতা বা তাতোকৈ ওপৰত', stat_roads: 'প্ৰভাৱিত পথ',
    alert_tpl: '{level} ভূমিস্খলন সতৰ্কবাণী: {site}। বিপদ সূচক {lhi}/100। ঠেক ঢাল আৰু কটা পথৰ পৰা আঁতৰি থাকক। ফাট দেখিলে বা গুমগুমনি শুনিলে তৎক্ষণাত নিৰাপদ ঠাইলৈ যাওক।',
  },
  bn: {
    title: 'ধারা অ্যালার্ট', tagline: 'উত্তর ও উত্তর-পূর্ব ভারতের জন্য ভূমিধসের আগাম সতর্কতা',
    nav_map: 'মানচিত্র', nav_dash: 'ড্যাশবোর্ড', nav_roads: 'সড়ক', nav_report: 'রিপোর্ট', nav_alerts: 'সতর্কতা', nav_sms: 'SMS সতর্কতা পান',
    enter: 'লাইভ মানচিত্র খুলুন',
    level_low: 'নিম্ন', level_watch: 'নজরদারি', level_warning: 'সতর্কতা', level_danger: 'বিপদ', level_critical: 'অতি গুরুতর',
    lhi: 'ভূমিধস ঝুঁকি সূচক', fos: 'নিরাপত্তা গুণাঙ্ক', rain24: 'গত ২৪ ঘণ্টার বৃষ্টি', saturation: 'মাটির আর্দ্রতা',
    forecast72: '৭২ ঘণ্টার ঝুঁকির পূর্বাভাস', priority: 'জরুরি অগ্রাধিকার',
    road_open: 'খোলা', road_caution: 'সাবধানতা', road_risk: 'ঝুঁকিতে', road_blocked: 'বন্ধ',
    report_title: 'ঢালের বিপদের খবর দিন', report_what: 'আপনি কী দেখছেন?',
    t_crack: 'মাটি বা রাস্তায় ফাটল', t_move: 'ঢাল সরে যাচ্ছে', t_blocked: 'রাস্তা বন্ধ', t_debris: 'ধ্বংসাবশেষ নেমে আসছে', t_seep: 'ঢাল থেকে জল চুঁইয়ে বেরোচ্ছে',
    note: 'যা দেখছেন তার বিবরণ (ঐচ্ছিক)', use_location: 'আমার অবস্থান ব্যবহার করুন', attach: 'ছবি বা ভিডিও যোগ করুন', send: 'রিপোর্ট পাঠান',
    queued: 'নেটওয়ার্ক নেই। রিপোর্ট ফোনে সংরক্ষিত হয়েছে, নেটওয়ার্ক এলেই পাঠানো হবে।', sent: 'রিপোর্ট পাঠানো হয়েছে। ধন্যবাদ।',
    phone: 'মোবাইল নম্বর', area: 'নজরে রাখার এলাকা', subscribe: 'সদস্য হোন', subscribed: 'সদস্য হয়েছেন',
    updated: 'হালনাগাদ', offline: 'আপনি অফলাইনে আছেন। সর্বশেষ সংরক্ষিত তথ্য দেখানো হচ্ছে।', language: 'ভাষা', no_alerts: 'কোনো সক্রিয় সতর্কতা নেই।',
    stat_sites: 'পর্যবেক্ষণ স্থান', stat_warn: 'সতর্কতা বা তার উপরে', stat_roads: 'প্রভাবিত সড়ক',
    alert_tpl: '{level} ভূমিধস সতর্কতা: {site}। ঝুঁকি সূচক {lhi}/100। খাড়া ঢাল ও কাটা রাস্তা থেকে দূরে থাকুন। ফাটল দেখলে বা গুড়গুড় শব্দ শুনলে এখনই নিরাপদ স্থানে যান।',
  },
  ne: {
    title: 'धारा अलर्ट', tagline: 'उत्तर र उत्तर-पूर्वी भारतका लागि पहिरोको अग्रिम चेतावनी',
    nav_map: 'नक्सा', nav_dash: 'ड्यासबोर्ड', nav_roads: 'सडक', nav_report: 'रिपोर्ट', nav_alerts: 'अलर्ट', nav_sms: 'SMS अलर्ट पाउनुहोस्',
    enter: 'लाइभ नक्सा खोल्नुहोस्',
    level_low: 'कम', level_watch: 'निगरानी', level_warning: 'चेतावनी', level_danger: 'खतरा', level_critical: 'अति गम्भीर',
    lhi: 'पहिरो जोखिम सूचकांक', fos: 'सुरक्षा गुणांक', rain24: 'पछिल्लो २४ घण्टाको वर्षा', saturation: 'माटोको चिस्यान',
    forecast72: '७२ घण्टाको जोखिम पूर्वानुमान', priority: 'आपतकालीन प्राथमिकता',
    road_open: 'खुला', road_caution: 'सावधानी', road_risk: 'जोखिममा', road_blocked: 'बन्द',
    report_title: 'भिरालोमा खतराको सूचना दिनुहोस्', report_what: 'तपाईंले के देख्नुभयो?',
    t_crack: 'जमिन वा सडकमा चिरा', t_move: 'भिरालो भासिँदै छ', t_blocked: 'सडक बन्द छ', t_debris: 'भग्नावशेष बग्दै छ', t_seep: 'भिरालोबाट पानी रसाउँदै छ',
    note: 'देखेको कुराको विवरण (ऐच्छिक)', use_location: 'मेरो स्थान प्रयोग गर्नुहोस्', attach: 'फोटो वा भिडियो थप्नुहोस्', send: 'रिपोर्ट पठाउनुहोस्',
    queued: 'नेटवर्क छैन। रिपोर्ट फोनमा सुरक्षित भयो, नेटवर्क आउनेबित्तिकै पठाइनेछ।', sent: 'रिपोर्ट पठाइयो। धन्यवाद।',
    phone: 'मोबाइल नम्बर', area: 'निगरानी गर्ने क्षेत्र', subscribe: 'सदस्य बन्नुहोस्', subscribed: 'सदस्य भइयो',
    updated: 'अद्यावधिक', offline: 'तपाईं अफलाइन हुनुहुन्छ। पछिल्लो सुरक्षित डेटा देखाइँदै छ।', language: 'भाषा', no_alerts: 'कुनै सक्रिय अलर्ट छैन।',
    stat_sites: 'निगरानीका स्थल', stat_warn: 'चेतावनी वा माथि', stat_roads: 'प्रभावित सडक',
    alert_tpl: '{level} पहिरो अलर्ट: {site}। जोखिम सूचकांक {lhi}/100। ठाडो भिरालो र काटिएका बाटोबाट टाढा रहनुहोस्। चिरा देखे वा गड्गडाहट सुने तुरुन्तै सुरक्षित ठाउँमा जानुहोस्।',
  },
  // Mizo: best-effort draft. Please have a native speaker review before real-world use.
  lus: {
    title: 'Dhara Alert', tagline: 'Northeast India tana lei tla vaukhânna',
    nav_map: 'Map', nav_dash: 'Dashboard', nav_roads: 'Kawng', nav_report: 'Report', nav_alerts: 'Vaukhânna', nav_sms: 'SMS vaukhânna dawng rawh',
    enter: 'Live map hawng rawh',
    level_low: 'Tlem', level_watch: 'Ngaihven', level_warning: 'Vaukhânna', level_danger: 'Hlauhawm', level_critical: 'Hlauhawm lutuk',
    lhi: 'Lei tla hlauhawmna index', rain24: 'Darkar 24 chhunga ruah', saturation: 'Lei chhunga tui',
    road_open: 'Hawng', road_caution: 'Fimkhur', road_blocked: 'Khar',
    report_title: 'Tlang hlauhawm thu report rawh', report_what: 'Eng nge i hmuh?',
    t_move: 'Tlang a kal', t_blocked: 'Kawng a khar', t_seep: 'Tlang atangin tui a luang',
    note: 'I hmuh tawh chu ziak rawh (a duh chuan)', use_location: 'Ka awmna hmang rawh', attach: 'Thlalak emaw video belh rawh', send: 'Report thawn rawh',
    sent: 'Report thawn a ni. Lawmthu.',
    phone: 'Mobile number', subscribe: 'Subscribe rawh', subscribed: 'Subscribe a ni', language: 'Holh', no_alerts: 'Vaukhânna a awm lo.',
    alert_tpl: '{level} lei tla vaukhânna: {site}. Hlauhawmna index {lhi}/100. Tlang tlang leh kawng tuamte lakah hla rawh. Crack i hmuh emaw ri i hriat chuan hmun himah kal hmiah rawh.',
  },
  kha: {}, // TODO: Khasi translation (falls back to English)
  mni: {}, // TODO: Meitei translation (falls back to English)
};

export function t(lang, key, vars) {
  let s = (S[lang] && S[lang][key]) || S.en[key] || key;
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
export const levelName = (lang, level) => t(lang, 'level_' + level);
export const alertText = (lang, { level, site, lhi }) => t(lang, 'alert_tpl', { level: levelName(lang, level), site, lhi: Math.round(lhi) });

// Extra English-only strings (other languages fall back to English until translated).
Object.assign(S.en, {
  home_sub: 'Live rainfall, soil moisture, terrain and earthquake data, scored for slope failure every 15 minutes.',
  live: 'Live', stale: 'Last data shown', loading: 'Fetching live data…', hazard_now: 'Highest hazard now',
  sites_title: 'Slopes by emergency priority', roads_title: 'Road connectivity', alerts_title: 'Alerts', report_hint: 'Photos and videos are optional. Without network, your report is saved on this phone and sent later.',
  authority: 'Authority', verify: 'Verify', reject: 'Reject', verified: 'Verified', unverified: 'Unverified',
  sms_note_live: 'You will get an SMS in your language when a slope in your area reaches Danger or a Danger forecast.',
  sms_note_off: 'SMS delivery is not switched on for this deployment yet. You will still receive in-app and browser alerts.',
  notify: 'Browser notifications', forecast_matrix: 'Weather-linked risk forecast', next72: 'Next 72 hours',
});
