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

    // Actions
    follow: '+ Follow',
    following: '✓ Following',
    block_user: '🚫 Block user',
    unblock_user: '✓ Blocked — tap to unblock',
    delete: 'Delete',
    send: 'Send',
    save: 'Save',
    cancel: 'Cancel',

    // Profile
    invite_neighbors: '🎁  Invite neighbors',
    followers_label: 'Followers',
    listings_label: 'Listings',
    reviews_label: 'Reviews',
    trust_label: 'Trust',
    rating_label: 'Rating',

    // Misc
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

    invite_neighbors: '🎁  पड़ोसियों को बुलाएँ',
    followers_label: 'फ़ॉलोअर',
    listings_label: 'लिस्टिंग',
    reviews_label: 'रिव्यू',
    trust_label: 'भरोसा',
    rating_label: 'रेटिंग',

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

export function t(key: StringKey): string {
  const l = useI18n.getState().locale;
  return STRINGS[l][key] ?? STRINGS.en[key];
}

export function useT() {
  const l = useI18n((s) => s.locale);
  return (key: StringKey) => STRINGS[l][key] ?? STRINGS.en[key];
}
