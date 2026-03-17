import { create } from "zustand";

interface OutlookState {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  userId: string | null;
  isLoading: boolean;
  checkConnection: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useOutlookStore = create<OutlookState>((set) => ({
  isConnected: false,
  userEmail: null,
  userName: null,
  userId: null,
  isLoading: true,

  checkConnection: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/outlook/status");
      const data = await res.json();
      set({
        isConnected: data.connected,
        userEmail: data.email || null,
        userName: data.name || null,
        userId: data.userId || null,
        isLoading: false,
      });

      if (data.connected && process.env.NEXT_PUBLIC_APP_URL) {
        fetch("/api/outlook/subscribe", { method: "POST" }).catch(() => {});
      }
    } catch {
      set({ isConnected: false, userEmail: null, userName: null, userId: null, isLoading: false });
    }
  },

  disconnect: async () => {
    await fetch("/api/outlook/status", { method: "DELETE" });
    set({ isConnected: false, userEmail: null, userName: null, userId: null });
  },
}));
