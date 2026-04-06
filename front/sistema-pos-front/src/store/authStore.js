import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      usuario: null,
      token: null,

      login: (token, usuario) => set({ token, usuario }),

      logout: () => set({ token: null, usuario: null }),

      isAdmin: () => get().usuario?.rol === 'admin',

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'pos-auth',
      partialize: (state) => ({ token: state.token, usuario: state.usuario }),
    }
  )
);
