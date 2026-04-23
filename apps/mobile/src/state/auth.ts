import { create } from 'zustand';
import { secureStorage } from './secureStorage';
import { clearChatCache } from '../api/chatCache';

const TOKEN_KEY = 'localio.token';
const USER_KEY = 'localio.user';

export interface Me {
  id: string;
  phone: string;
  name?: string | null;
  avatarUrl?: string | null;
  societyId?: string | null;
  kycVerified?: boolean;
}

interface AuthState {
  token: string | null;
  user: Me | null;
  hydrating: boolean;
  hydrate: () => Promise<void>;
  login: (token: string, user: Me) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: Me) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrating: true,
  hydrate: async () => {
    try {
      const token = await secureStorage.get(TOKEN_KEY);
      const userRaw = await secureStorage.get(USER_KEY);
      set({
        token,
        user: userRaw ? JSON.parse(userRaw) : null,
        hydrating: false,
      });
    } catch {
      set({ hydrating: false });
    }
  },
  login: async (token, user) => {
    await secureStorage.set(TOKEN_KEY, token);
    await secureStorage.set(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  logout: async () => {
    await secureStorage.del(TOKEN_KEY);
    await secureStorage.del(USER_KEY);
    await clearChatCache();
    set({ token: null, user: null });
  },
  setUser: async (u) => {
    await secureStorage.set(USER_KEY, JSON.stringify(u));
    set({ user: u });
  },
}));
