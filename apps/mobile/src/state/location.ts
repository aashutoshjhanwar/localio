import { create } from 'zustand';
import { secureStorage } from './secureStorage';

const KEY = 'localio.location_override';
const RECENT_KEY = 'localio.location_recents';
const MAX_RECENTS = 6;

export interface LocationPick {
  label: string;        // "DLF Phase 2, Gurgaon"
  lat: number;
  lng: number;
  societyId?: string;   // optional — when picked from a society
  pincode?: string;
}

interface LocationState {
  override: LocationPick | null;
  recents: LocationPick[];
  hydrate: () => Promise<void>;
  setOverride: (p: LocationPick | null) => Promise<void>;
  pushRecent: (p: LocationPick) => Promise<void>;
}

export const useLocationOverride = create<LocationState>((set, get) => ({
  override: null,
  recents: [],
  hydrate: async () => {
    try {
      const raw = await secureStorage.get(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocationPick;
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') set({ override: parsed });
      }
    } catch { /* noop */ }
    try {
      const raw = await secureStorage.get(RECENT_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as LocationPick[];
        if (Array.isArray(arr)) set({ recents: arr.slice(0, MAX_RECENTS) });
      }
    } catch { /* noop */ }
  },
  setOverride: async (p) => {
    if (p) await secureStorage.set(KEY, JSON.stringify(p));
    else await secureStorage.del(KEY);
    set({ override: p });
    if (p) await get().pushRecent(p);
  },
  pushRecent: async (p) => {
    const dedup = [p, ...get().recents.filter((r) => !(r.label === p.label && r.lat === p.lat && r.lng === p.lng))]
      .slice(0, MAX_RECENTS);
    await secureStorage.set(RECENT_KEY, JSON.stringify(dedup));
    set({ recents: dedup });
  },
}));
