import { create } from 'zustand';

const crearPestana = (id) => ({
  id,
  nombre: `Venta ${id}`,
  cliente: { nombre: 'Consumidor Final', nit: 'CF' },
  productos: [],
  descuento: 0,
});

export const useVentaStore = create((set, get) => ({
  pestanas: [crearPestana(1)],
  pestanaActiva: 1,
  nextId: 2,

  agregarPestana: () => {
    const { nextId, pestanas } = get();
    const nueva = crearPestana(nextId);
    set({ pestanas: [...pestanas, nueva], pestanaActiva: nextId, nextId: nextId + 1 });
  },

  cerrarPestana: (id) => {
    const { pestanas, pestanaActiva } = get();
    if (pestanas.length === 1) return; // Siempre queda una
    const nuevas = pestanas.filter((p) => p.id !== id);
    const activa = pestanaActiva === id ? nuevas[nuevas.length - 1].id : pestanaActiva;
    set({ pestanas: nuevas, pestanaActiva: activa });
  },

  setPestanaActiva: (id) => set({ pestanaActiva: id }),

  // Agregar/actualizar producto en pestaña activa
  agregarProducto: (producto) => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) => {
      if (p.id !== pestanaActiva) return p;
      const existe = p.productos.find((x) => x.productoId === producto._id);
      if (existe) {
        return {
          ...p,
          productos: p.productos.map((x) =>
            x.productoId === producto._id
              ? { ...x, cantidad: x.cantidad + 1, subtotal: (x.cantidad + 1) * x.precioUnitario }
              : x
          ),
        };
      }
      return {
        ...p,
        productos: [
          ...p.productos,
          {
            productoId: producto._id,
            nombre: producto.nombre,
            codigo: producto.codigo || '',
            cantidad: 1,
            precioUnitario: producto.precioVenta,
            subtotal: producto.precioVenta,
            stockDisponible: producto.stock,
          },
        ],
      };
    });
    set({ pestanas: nuevas });
  },

  cambiarCantidad: (productoId, cantidad) => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) => {
      if (p.id !== pestanaActiva) return p;
      return {
        ...p,
        productos: p.productos.map((x) =>
          x.productoId === productoId
            ? { ...x, cantidad, subtotal: cantidad * x.precioUnitario }
            : x
        ),
      };
    });
    set({ pestanas: nuevas });
  },

  quitarProducto: (productoId) => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) => {
      if (p.id !== pestanaActiva) return p;
      return { ...p, productos: p.productos.filter((x) => x.productoId !== productoId) };
    });
    set({ pestanas: nuevas });
  },

  setDescuento: (descuento) => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) =>
      p.id === pestanaActiva ? { ...p, descuento: Number(descuento) } : p
    );
    set({ pestanas: nuevas });
  },

  setCliente: (cliente) => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) =>
      p.id === pestanaActiva ? { ...p, cliente: { ...cliente } } : p
    );
    set({ pestanas: nuevas });
  },

  setProductosEnPestana: (productos) => {
    const { pestanas, pestanaActiva } = get();
    const safeProductos = Array.isArray(productos) ? productos : [];
    const nuevas = pestanas.map((p) => (p.id === pestanaActiva ? { ...p, productos: safeProductos } : p));
    set({ pestanas: nuevas });
  },

  limpiarPestana: () => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) =>
      p.id === pestanaActiva
        ? { ...p, productos: [], descuento: 0, cliente: { nombre: 'Consumidor Final', nit: 'CF', _id: null } }
        : p
    );
    set({ pestanas: nuevas });
  },

  getPestanaActiva: () => {
    const { pestanas, pestanaActiva } = get();
    return pestanas.find((p) => p.id === pestanaActiva);
  },

  getSubtotal: () => {
    const pestana = get().getPestanaActiva();
    return pestana?.productos.reduce((s, p) => s + p.subtotal, 0) || 0;
  },

  getTotal: () => {
    const pestana = get().getPestanaActiva();
    const sub = pestana?.productos.reduce((s, p) => s + p.subtotal, 0) || 0;
    return sub - (pestana?.descuento || 0);
  },
}));
