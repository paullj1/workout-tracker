import { create } from "zustand";
const STORAGE_KEY = "workout-tracker-token";
export const useEncryptionStore = create((set) => ({
    token: window.localStorage.getItem(STORAGE_KEY),
    setToken: (token) => {
        if (!token) {
            window.localStorage.removeItem(STORAGE_KEY);
        }
        else {
            window.localStorage.setItem(STORAGE_KEY, token);
        }
        set({ token });
    },
}));
