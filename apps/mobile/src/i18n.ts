import { create } from 'zustand';
import { secureStorage } from './state/secureStorage';

export type Locale = 'en' | 'hi';
const KEY = 'localio.locale';

const STRINGS = {
  en: {
    // Tabs
    tab_feed: 'LOCALIO',
    tab_services: 'Services',
    tab_bookings: 'Bookings',
    tab_chats: 'Chats',
    tab_profile: 'Profile',

    // Feed
    search_placeholder: 'Search listings, services, societies',
    empty_feed: 'Nothing nearby yet. Pull to refresh.',
    new_post_cta: 'Post to neighborhood',
    ask_title: 'Ask the neighborhood',
    post_new: 'New post',
    polls_nearby: 'Polls nearby',
    events_nearby: 'Events nearby',
    categories: 'Browse categories',
    notifications: 'Notifications',
    nearby_map: 'Nearby map',

    // Actions / buttons
    follow: '+ Follow',
    following: '✓ Following',
    block_user: '🚫 Block user',
    unblock_user: '✓ Blocked — tap to unblock',
    delete: 'Delete',
    send: 'Send',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    post: 'Post',
    retry: 'Retry',
    continue_btn: 'Continue',
    confirm: 'Confirm',
    remove: 'Remove',
    share: 'Share',
    loading: 'Loading…',
    sending: 'Sending…',
    done: 'Done',
    okay: 'OK',
    back: 'Back',
    next: 'Next',
    close: 'Close',

    // Profile
    invite_neighbors: '🎁  Invite neighbors',
    followers_label: 'Followers',
    listings_label: 'Listings',
    reviews_label: 'Reviews',
    trust_label: 'Trust',
    rating_label: 'Rating',
    profile_name: 'Name',
    profile_bio: 'Bio',
    profile_edit: 'Edit',
    set_your_name: 'Set your name',
    your_neighbourhood: 'Your neighbourhood',
    not_set_tap_to_join: 'Not set — tap to join one near you',
    my_posts: '📋  My posts',
    offer_a_service: '🛠️  Offer a service',
    saved_listings: '♥  Saved listings',
    verify_identity: '✅  Verify your identity (KYC)',
    wanted_requests: '🙋  Wanted requests nearby',
    following_menu: '👥  Following',
    my_groups_menu: '🏘️  My groups & channels',
    sos_menu: '🚨  Emergency SOS',
    kyc_verified: '✓ KYC verified',
    bio_placeholder: 'A line about you',
    bio_empty_hint: 'Add a bio so your neighbors know what you do.',
    name_placeholder: 'Your name',

    // Auth / Login
    login_welcome: 'Welcome to LOCALIO',
    login_tagline: 'Your neighborhood, one tap away.',
    login_phone_label: 'Phone number',
    login_phone_placeholder: 'e.g. +91 98290 12345',
    login_send_otp: 'Send OTP',
    login_otp_label: 'Enter the 6-digit OTP',
    login_verify: 'Verify & continue',
    login_resend: 'Resend OTP',
    login_change_number: 'Change number',
    login_referral: 'Referral code (optional)',
    login_terms: 'By continuing you agree to our terms.',

    // Chat
    chat_empty: 'No messages yet — say hi 👋',
    chat_type_placeholder: 'Type a message',
    chat_send: 'Send',
    chat_attach_image: '📷 Photo',
    chat_share_location: '📍 Location',
    chat_make_offer: '💰 Make offer',
    chat_list_empty: 'No conversations yet. Tap a listing to chat with the seller.',
    chat_archived: 'Archived',
    chat_muted: 'Muted',
    chat_pinned: 'Pinned',

    // Groups + channels
    groups_title: 'My groups',
    groups_empty_title: 'No groups yet',
    groups_empty_body: 'Join your society above to auto-join #buy-sell, #services, #sos and more.',
    group_join_society: '🏘  Find a society to join',
    group_members: '👥 Members',
    group_send_sos: '🚨 Send SOS',
    group_channels_title: 'Channels',
    group_announcements_title: '📢 Announcements',
    group_new_announcement: '+ Post announcement',
    group_announcement_title_ph: 'Title',
    group_announcement_body_ph: 'Body',
    group_posting: 'Posting…',
    group_admins_post_here: 'Admins post here',
    group_no_messages: 'No messages yet',
    group_members_title: 'Members',
    group_make_admin: '⭐ Make admin',
    group_demote: '↓ Demote to member',
    group_mute_24: '🔇 Mute for 24h',
    group_unmute: '🔊 Unmute',
    group_remove_member: '🚫 Remove from group',
    group_remove_confirm_title: 'Remove member',
    group_remove_confirm_body: 'They will lose access to all channels in this group.',
    role_owner: '👑 Owner',
    role_admin: '⭐ Admin',
    role_member: 'Member',
    you_suffix: '(you)',

    // SOS
    sos_title: 'Send SOS',
    sos_banner_title: '🚨 Emergency broadcast',
    sos_banner_body: 'Alerts all verified neighbors within the chosen radius + your society\'s #sos channel. Use only for real emergencies.',
    sos_type_label: 'Type',
    sos_message_label: 'Message',
    sos_message_placeholder: 'e.g. Medical help needed, ground floor, block B3',
    sos_radius_label: 'Alert radius',
    sos_broadcast: '🚨 BROADCAST SOS',
    sos_sent_title: 'SOS sent',
    sos_sent_body: (n: number) => `Alert delivered to ${n} neighbors nearby.`,
    sos_cat_medical: 'Medical',
    sos_cat_security: 'Security',
    sos_cat_fire: 'Fire',
    sos_cat_other: 'Other',
    sos_add_message: 'Add a short message',
    sos_add_message_body: 'Describe what help you need.',

    // Listings / marketplace
    listing_sell_cta: 'Sell something',
    listing_price: 'Price',
    listing_negotiable: 'Negotiable',
    listing_description: 'Description',
    listing_category: 'Category',
    listing_photos: 'Photos',
    listing_mark_sold: 'Mark as sold',
    listing_bump: 'Bump to top',
    listing_views: 'views',
    listing_posted: 'Posted',
    offer_make: 'Make an offer',
    offer_amount: 'Your offer',
    offer_send: 'Send offer',
    offer_accepted: 'Accepted',
    offer_declined: 'Declined',
    offer_pending: 'Pending',

    // Services / bookings
    service_book: 'Book',
    service_instant_chat: 'Chat now',
    booking_requested: 'Requested',
    booking_accepted: 'Accepted',
    booking_rejected: 'Rejected',
    booking_completed: 'Completed',
    booking_cancelled: 'Cancelled',

    // Search + filters
    filter_distance: 'Distance',
    filter_price: 'Price',
    filter_rating: 'Rating',
    filter_verified: 'Verified only',
    filter_apply: 'Apply filters',
    filter_clear: 'Clear',

    // Errors / status
    err_generic: 'Something went wrong.',
    err_network: 'Network error. Check your connection.',
    err_unauthorized: 'Please log in again.',
    err_not_found: 'Not found.',
    err_location_permission: 'Location permission required',

    // Language
    language: 'Language',
    language_english: 'English',
    language_hindi: 'हिन्दी',
  },

  hi: {
    tab_feed: 'लोकैलिओ',
    tab_services: 'सेवाएँ',
    tab_bookings: 'बुकिंग',
    tab_chats: 'चैट',
    tab_profile: 'प्रोफ़ाइल',

    search_placeholder: 'लिस्टिंग, सेवाएँ, सोसाइटी खोजें',
    empty_feed: 'पास में कुछ नहीं मिला। रिफ्रेश करें।',
    new_post_cta: 'पड़ोस में पोस्ट करें',
    ask_title: 'पड़ोस से पूछें',
    post_new: 'नई पोस्ट',
    polls_nearby: 'पास के पोल',
    events_nearby: 'पास के इवेंट',
    categories: 'श्रेणियाँ देखें',
    notifications: 'सूचनाएँ',
    nearby_map: 'पास का नक्शा',

    follow: '+ फ़ॉलो',
    following: '✓ फ़ॉलो कर रहे हैं',
    block_user: '🚫 ब्लॉक करें',
    unblock_user: '✓ ब्लॉक किया — अनब्लॉक करें',
    delete: 'हटाएँ',
    send: 'भेजें',
    save: 'सहेजें',
    cancel: 'रद्द',
    edit: 'बदलें',
    post: 'पोस्ट',
    retry: 'फिर कोशिश',
    continue_btn: 'आगे बढ़ें',
    confirm: 'पक्का',
    remove: 'हटाएँ',
    share: 'शेयर',
    loading: 'लोड हो रहा है…',
    sending: 'भेजा जा रहा है…',
    done: 'हो गया',
    okay: 'ठीक',
    back: 'पीछे',
    next: 'अगला',
    close: 'बंद',

    invite_neighbors: '🎁  पड़ोसियों को बुलाएँ',
    followers_label: 'फ़ॉलोअर',
    listings_label: 'लिस्टिंग',
    reviews_label: 'रिव्यू',
    trust_label: 'भरोसा',
    rating_label: 'रेटिंग',
    profile_name: 'नाम',
    profile_bio: 'बायो',
    profile_edit: 'बदलें',
    set_your_name: 'अपना नाम डालें',
    your_neighbourhood: 'आपका पड़ोस',
    not_set_tap_to_join: 'सेट नहीं — पास की सोसाइटी जॉइन करें',
    my_posts: '📋  मेरी पोस्ट',
    offer_a_service: '🛠️  सेवा दें',
    saved_listings: '♥  सेव की हुई',
    verify_identity: '✅  पहचान जांचें (KYC)',
    wanted_requests: '🙋  पास की ज़रूरतें',
    following_menu: '👥  फ़ॉलो कर रहे हैं',
    my_groups_menu: '🏘️  मेरे ग्रुप और चैनल',
    sos_menu: '🚨  आपातकालीन SOS',
    kyc_verified: '✓ KYC सत्यापित',
    bio_placeholder: 'अपने बारे में एक लाइन',
    bio_empty_hint: 'बायो लिखें ताकि पड़ोसी जान सकें आप क्या करते हैं।',
    name_placeholder: 'आपका नाम',

    login_welcome: 'लोकैलिओ में आपका स्वागत है',
    login_tagline: 'आपका पड़ोस, एक क्लिक में।',
    login_phone_label: 'मोबाइल नंबर',
    login_phone_placeholder: 'जैसे +91 98290 12345',
    login_send_otp: 'OTP भेजें',
    login_otp_label: '6 अंकों का OTP डालें',
    login_verify: 'जांचें और आगे बढ़ें',
    login_resend: 'OTP फिर भेजें',
    login_change_number: 'नंबर बदलें',
    login_referral: 'रेफ़रल कोड (ऐच्छिक)',
    login_terms: 'आगे बढ़कर आप हमारी शर्तें मानते हैं।',

    chat_empty: 'कोई संदेश नहीं — नमस्ते कहें 👋',
    chat_type_placeholder: 'संदेश लिखें',
    chat_send: 'भेजें',
    chat_attach_image: '📷 फ़ोटो',
    chat_share_location: '📍 लोकेशन',
    chat_make_offer: '💰 ऑफ़र दें',
    chat_list_empty: 'कोई चैट नहीं। किसी लिस्टिंग पर टैप करके सेलर से बात करें।',
    chat_archived: 'आर्काइव',
    chat_muted: 'म्यूट',
    chat_pinned: 'पिन',

    groups_title: 'मेरे ग्रुप',
    groups_empty_title: 'अभी कोई ग्रुप नहीं',
    groups_empty_body: 'ऊपर से सोसाइटी जॉइन करें — #buy-sell, #services, #sos सब अपने आप जुड़ जाएँगे।',
    group_join_society: '🏘  पास की सोसाइटी खोजें',
    group_members: '👥 सदस्य',
    group_send_sos: '🚨 SOS भेजें',
    group_channels_title: 'चैनल',
    group_announcements_title: '📢 घोषणाएँ',
    group_new_announcement: '+ नई घोषणा',
    group_announcement_title_ph: 'शीर्षक',
    group_announcement_body_ph: 'विवरण',
    group_posting: 'पोस्ट हो रहा है…',
    group_admins_post_here: 'यहाँ एडमिन पोस्ट करते हैं',
    group_no_messages: 'कोई संदेश नहीं',
    group_members_title: 'सदस्य',
    group_make_admin: '⭐ एडमिन बनाएँ',
    group_demote: '↓ सदस्य बनाएँ',
    group_mute_24: '🔇 24 घंटे म्यूट',
    group_unmute: '🔊 अनम्यूट',
    group_remove_member: '🚫 ग्रुप से हटाएँ',
    group_remove_confirm_title: 'सदस्य हटाएँ',
    group_remove_confirm_body: 'वे इस ग्रुप के सारे चैनल नहीं देख पाएँगे।',
    role_owner: '👑 मालिक',
    role_admin: '⭐ एडमिन',
    role_member: 'सदस्य',
    you_suffix: '(आप)',

    sos_title: 'SOS भेजें',
    sos_banner_title: '🚨 आपातकालीन प्रसारण',
    sos_banner_body: 'चुनी गई दूरी में सारे सत्यापित पड़ोसियों और आपकी सोसाइटी के #sos चैनल तक अलर्ट जाएगा। सिर्फ़ सच्ची इमरजेंसी में उपयोग करें।',
    sos_type_label: 'प्रकार',
    sos_message_label: 'संदेश',
    sos_message_placeholder: 'जैसे: ग्राउंड फ्लोर B3 पर मेडिकल मदद चाहिए',
    sos_radius_label: 'अलर्ट दूरी',
    sos_broadcast: '🚨 SOS प्रसारित करें',
    sos_sent_title: 'SOS भेजा गया',
    sos_sent_body: (n: number) => `${n} पड़ोसियों तक अलर्ट पहुँचा।`,
    sos_cat_medical: 'मेडिकल',
    sos_cat_security: 'सुरक्षा',
    sos_cat_fire: 'आग',
    sos_cat_other: 'अन्य',
    sos_add_message: 'छोटा संदेश लिखें',
    sos_add_message_body: 'बताइए किस मदद की ज़रूरत है।',

    listing_sell_cta: 'कुछ बेचें',
    listing_price: 'कीमत',
    listing_negotiable: 'मोलभाव मुमकिन',
    listing_description: 'विवरण',
    listing_category: 'श्रेणी',
    listing_photos: 'फ़ोटो',
    listing_mark_sold: 'बिक गया',
    listing_bump: 'ऊपर ले जाएँ',
    listing_views: 'बार देखा',
    listing_posted: 'पोस्ट किया',
    offer_make: 'ऑफ़र दें',
    offer_amount: 'आपका ऑफ़र',
    offer_send: 'ऑफ़र भेजें',
    offer_accepted: 'स्वीकार',
    offer_declined: 'अस्वीकार',
    offer_pending: 'प्रतीक्षा में',

    service_book: 'बुक करें',
    service_instant_chat: 'अभी चैट करें',
    booking_requested: 'अनुरोध किया',
    booking_accepted: 'स्वीकार',
    booking_rejected: 'अस्वीकार',
    booking_completed: 'पूरा',
    booking_cancelled: 'रद्द',

    filter_distance: 'दूरी',
    filter_price: 'कीमत',
    filter_rating: 'रेटिंग',
    filter_verified: 'सिर्फ़ सत्यापित',
    filter_apply: 'फ़िल्टर लगाएँ',
    filter_clear: 'साफ़ करें',

    err_generic: 'कुछ गड़बड़ हुई।',
    err_network: 'नेटवर्क नहीं मिला। कनेक्शन जांचें।',
    err_unauthorized: 'कृपया फिर लॉगिन करें।',
    err_not_found: 'नहीं मिला।',
    err_location_permission: 'लोकेशन की अनुमति चाहिए',

    language: 'भाषा',
    language_english: 'English',
    language_hindi: 'हिन्दी',
  },
} as const;

export type StringKey = keyof typeof STRINGS['en'];

interface I18nState {
  locale: Locale;
  hydrate: () => Promise<void>;
  setLocale: (l: Locale) => Promise<void>;
}

export const useI18n = create<I18nState>((set, get) => ({
  locale: 'en',
  hydrate: async () => {
    const saved = (await secureStorage.get(KEY)) as Locale | null;
    if (saved === 'en' || saved === 'hi') set({ locale: saved });
  },
  setLocale: async (l) => {
    await secureStorage.set(KEY, l);
    set({ locale: l });
  },
}));

type Translator = (key: StringKey, ...args: any[]) => string;

function translate(l: Locale, key: StringKey, args: any[]): string {
  const v = (STRINGS[l] as any)[key] ?? (STRINGS.en as any)[key];
  if (typeof v === 'function') return v(...args);
  return v as string;
}

export const t: Translator = (key, ...args) =>
  translate(useI18n.getState().locale, key, args);

export function useT(): Translator {
  const l = useI18n((s) => s.locale);
  return (key, ...args) => translate(l, key, args);
}
