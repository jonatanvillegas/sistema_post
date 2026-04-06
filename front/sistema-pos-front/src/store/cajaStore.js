import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCajaStore = create(
  persist(
    (set) => ({
      cajaActual: null,
      setCajaActual: (caja) => set({ cajaActual: caja }),
      limpiarCaja: () => set({ cajaActual: null }),
    }),
    { name: 'pos-caja' }
  )
);
