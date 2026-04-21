import { create } from 'zustand';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const calcDiscountMonto = ({ baseAmount, tipo, valor }) => {
  const base = Number(baseAmount);
  const v = Number(valor);
  if (!isFinite(base) || base <= 0) return 0;
  if (!isFinite(v) || v <= 0) return 0;

  if (tipo === 'porcentaje') {
    const pct = Math.min(Math.max(0, v), 100);
    return round2(base * (pct / 100));
  }
  if (tipo === 'monto') {
    return round2(Math.min(Math.max(0, v), base));
  }
  return 0;
};

const recalcItem = (item) => {
  const qty = Number(item?.cantidad || 0);
  const unit = Number(item?.precioUnitario || 0);
  const subtotalBruto = round2(qty * unit);
  const descuentoTipo = item?.descuentoTipo || 'ninguno';
  const descuentoValor = Number(item?.descuentoValor || 0);
  const descuentoMonto = calcDiscountMonto({ baseAmount: subtotalBruto, tipo: descuentoTipo, valor: descuentoValor });
  const subtotal = round2(subtotalBruto - descuentoMonto);
  return {
    ...item,
    subtotalBruto,
    descuentoTipo,
    descuentoValor,
    descuentoMonto,
    subtotal,
  };
};

const crearPestana = (id) => ({
  id,
  nombre: `Venta ${id}`,
  cliente: { nombre: 'Consumidor Final', nit: 'CF' },
  productos: [],
  descuentoGeneralTipo: 'ninguno',
  descuentoGeneralValor: 0,
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
              ? recalcItem({ ...x, cantidad: x.cantidad + 1 })
              : x
          ),
        };
      }
      return {
        ...p,
        productos: [
          ...p.productos,
          recalcItem({
            productoId: producto._id,
            nombre: producto.nombre,
            codigo: producto.codigo || '',
            cantidad: 1,
            precioUnitario: producto.precioVenta,
            descuentoTipo: 'ninguno',
            descuentoValor: 0,
            stockDisponible: producto.controlaStock !== false ? producto.stock : null,
            controlaStock: producto.controlaStock !== false,
          }),
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
            ? recalcItem({ ...x, cantidad })
            : x
        ),
      };
    });
    set({ pestanas: nuevas });
  },

  cambiarDescuentoProducto: (productoId, descuentoTipo, descuentoValor) => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) => {
      if (p.id !== pestanaActiva) return p;
      return {
        ...p,
        productos: p.productos.map((x) =>
          x.productoId === productoId
            ? recalcItem({
                ...x,
                descuentoTipo: descuentoTipo || 'ninguno',
                descuentoValor: Number(descuentoValor || 0),
              })
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

  setDescuentoGeneral: (descuentoGeneralTipo, descuentoGeneralValor) => {
    const { pestanas, pestanaActiva } = get();
    const nuevas = pestanas.map((p) =>
      p.id === pestanaActiva
        ? {
            ...p,
            descuentoGeneralTipo: descuentoGeneralTipo || 'ninguno',
            descuentoGeneralValor: Number(descuentoGeneralValor || 0),
          }
        : p
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
        ? {
            ...p,
            productos: [],
            descuentoGeneralTipo: 'ninguno',
            descuentoGeneralValor: 0,
            cliente: { nombre: 'Consumidor Final', nit: 'CF', _id: null },
          }
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
    return pestana?.productos.reduce((s, p) => s + (Number(p.subtotalBruto) || 0), 0) || 0;
  },

  getDescuentoTotal: () => {
    const pestana = get().getPestanaActiva();
    const productos = pestana?.productos || [];
    const subtotalBruto = productos.reduce((s, p) => s + (Number(p.subtotalBruto) || 0), 0);
    const descuentoLineas = productos.reduce((s, p) => s + (Number(p.descuentoMonto) || 0), 0);
    const baseGeneral = Math.max(0, subtotalBruto - descuentoLineas);
    const descGeneralMonto = calcDiscountMonto({
      baseAmount: baseGeneral,
      tipo: pestana?.descuentoGeneralTipo,
      valor: pestana?.descuentoGeneralValor,
    });
    return round2(descuentoLineas + descGeneralMonto);
  },

  getTotal: () => {
    const pestana = get().getPestanaActiva();
    const sub = get().getSubtotal();
    const desc = get().getDescuentoTotal();
    return round2(sub - desc);
  },
}));
