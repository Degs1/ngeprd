import { create } from "zustand";

export interface UserProfile {
  ownerId?: string;
  email: string | null;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export interface UserQuota {
  used: number;
  limit: number;
  remaining: number;
  isAdmin: boolean;
  resetAt: string;
}

interface UserStoreState {
  user: UserProfile | null;
  quota: UserQuota | null;
  isLoading: boolean;
  fetchUserQuota: () => Promise<void>;
  setQuota: (quota: UserQuota) => void;
}

export const useUserStore = create<UserStoreState>((set) => ({
  user: null,
  quota: null,
  isLoading: false,

  fetchUserQuota: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/user/quota");
      if (res.ok) {
        const data = await res.json();
        set({
          user: data.user,
          quota: data.quota,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn("fetchUserQuota failed:", err);
      set({ isLoading: false });
    }
  },

  setQuota: (quota: UserQuota) => set({ quota }),
}));
