import { create } from "zustand";

export type PrdStatus = "brainstorming" | "generating" | "ready" | "failed";

export interface PrdListItem {
  _id: string;
  title: string;
  status: PrdStatus;
  updatedAt: string | Date;
}

interface PrdStoreState {
  prds: PrdListItem[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  isSidebarOpenMobile: boolean;
  isSidebarCollapsedDesktop: boolean;

  fetchPrds: () => Promise<void>;
  createPrd: (idea: string, lang?: "id" | "en") => Promise<string | null>;
  renamePrd: (id: string, title: string) => Promise<boolean>;
  deletePrd: (id: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  setSidebarOpenMobile: (open: boolean) => void;
  toggleSidebarCollapsedDesktop: () => void;
}

export const usePrdStore = create<PrdStoreState>((set, get) => ({
  prds: [],
  isLoading: false,
  error: null,
  searchQuery: "",
  isSidebarOpenMobile: false,
  isSidebarCollapsedDesktop: false,

  fetchPrds: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/prds", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load PRDs: ${res.statusText}`);
      }
      const data = await res.json();
      set({ prds: Array.isArray(data) ? data : [], isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar PRD";
      set({ error: msg, isLoading: false });
    }
  },

  createPrd: async (idea: string, lang: "id" | "en" = "id") => {
    try {
      const res = await fetch("/api/prds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, lang }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Gagal membuat PRD");
      }

      const data = await res.json();
      const id = data.id;

      // Optimistically insert or immediately re-fetch list to guarantee sync
      const newTitle = idea.trim().slice(0, 60).trim() || "Untitled PRD";
      const optimisticPrd: PrdListItem = {
        _id: id,
        title: newTitle,
        status: "brainstorming",
        updatedAt: new Date().toISOString(),
      };

      set((state) => ({
        prds: [optimisticPrd, ...state.prds.filter((p) => p._id !== id)],
      }));

      // Background re-fetch for fresh server timestamps
      get().fetchPrds().catch(() => {});

      return id;
    } catch (err) {
      console.error("createPrd error:", err);
      throw err;
    }
  },

  renamePrd: async (id: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return false;

    // Optimistic update
    const previousPrds = get().prds;
    set((state) => ({
      prds: state.prds.map((p) =>
        p._id === id ? { ...p, title: trimmedTitle, updatedAt: new Date().toISOString() } : p
      ),
    }));

    try {
      const res = await fetch(`/api/prds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!res.ok) {
        // Revert on failure
        set({ prds: previousPrds });
        return false;
      }

      return true;
    } catch (err) {
      console.error("renamePrd error:", err);
      set({ prds: previousPrds });
      return false;
    }
  },

  deletePrd: async (id: string) => {
    // Optimistic update
    const previousPrds = get().prds;
    set((state) => ({
      prds: state.prds.filter((p) => p._id !== id),
    }));

    try {
      const res = await fetch(`/api/prds/${id}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        // Revert on failure
        set({ prds: previousPrds });
        return false;
      }

      return true;
    } catch (err) {
      console.error("deletePrd error:", err);
      set({ prds: previousPrds });
      return false;
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setSidebarOpenMobile: (open: boolean) => set({ isSidebarOpenMobile: open }),

  toggleSidebarCollapsedDesktop: () =>
    set((state) => ({ isSidebarCollapsedDesktop: !state.isSidebarCollapsedDesktop })),
}));
