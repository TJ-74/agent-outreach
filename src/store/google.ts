import { create } from "zustand";

interface GoogleState {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  userId: string | null;
  isLoading: boolean;
  checkConnection: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useGoogleStore = create<GoogleState>((set) => ({
  isConnected: false,
  userEmail: null,
  userName: null,
  userId: null,
  isLoading: true,

  checkConnection: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/google/status");
      const data = await res.json();
      set({
        isConnected: data.connected,
        userEmail: data.email || null,
        userName: data.name || null,
        userId: data.userId || null,
        isLoading: false,
      });
    } catch {
      set({
        isConnected: false,
        userEmail: null,
        userName: null,
        userId: null,
        isLoading: false,
      });
    }
  },

  disconnect: async () => {
    await fetch("/api/google/status", { method: "DELETE" });
    set({ isConnected: false, userEmail: null, userName: null, userId: null });
  },
}));
