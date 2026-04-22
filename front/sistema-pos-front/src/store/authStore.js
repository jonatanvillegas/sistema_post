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
      isCajero: () => get().usuario?.rol === 'cajero',
      isInventario: () => get().usuario?.rol === 'inventario',

      canApplyDiscount: () => {
        const u = get().usuario;
        if (!u) return false;
        if (u.rol === 'admin') return true;
        if (u.rol === 'cajero') return Boolean(u.puedeAplicarDescuento);
        return false;
      },

      hasAnyRole: (roles = []) => {
        const rol = get().usuario?.rol;
        if (!rol) return false;
        if (!Array.isArray(roles) || roles.length === 0) return true;
        return roles.includes(rol);
      },

      getHomePath: () => {
        const rol = get().usuario?.rol;
        if (rol === 'admin') return '/dashboard';
        if (rol === 'inventario') return '/inventario';
        return '/ventas';
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'pos-auth',
      partialize: (state) => ({ token: state.token, usuario: state.usuario }),
    }
  )
);
