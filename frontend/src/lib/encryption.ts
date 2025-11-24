import { create } from "zustand";

type EncryptionState = {
  token: string | null;
  setToken: (token: string | null) => void;
};

const STORAGE_KEY = "workout-tracker-token";

export const useEncryptionStore = create<EncryptionState>((set) => ({
  token: window.localStorage.getItem(STORAGE_KEY),
  setToken: (token) => {
    if (!token) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, token);
    }
    set({ token });
  },
}));
