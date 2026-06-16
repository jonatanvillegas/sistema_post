const OrdenCompra = require('./ordenCompra.model');
const { Producto, Kardex } = require('../inventario/producto.model');

// ─── Obtener todas las órdenes ───
const getOrdenes = async (req, res) => {
  try {
    const { estado, buscar, proveedorId, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (estado && estado !== 'todas') filter.estado = estado;
    if (proveedorId) filter.proveedorId = proveedorId;

    if (buscar) {
      filter.$or = [
        { numeroOrden: { $regex: buscar, $options: 'i' } },
        { 'proveedor.nombre': { $regex: buscar, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [ordenes, total] = await Promise.all([
      OrdenCompra.find(filter)
        .populate('proveedorId', 'nombre telefono email')
        .populate('usuarioId', 'nombre')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      OrdenCompra.countDocuments(filter),
    ]);

    res.json({ ordenes, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    console.error('Error getOrdenes:', error);
    res.status(500).json({ mensaje: 'Error al obtener órdenes de compra' });
  }
};

// ─── Obtener una orden por ID ───
const getOrdenById = async (req, res) => {
  try {
    const orden = await OrdenCompra.findById(req.params.id)
      .populate('proveedorId', 'nombre telefono email direccion')
      .populate('usuarioId', 'nombre')
      .populate('recepciones.usuarioId', 'nombre');

    if (!orden) return res.status(404).json({ mensaje: 'Orden no encontrada' });
    res.json(orden);
  } catch (error) {
    console.error('Error getOrdenById:', error);
    res.status(500).json({ mensaje: 'Error al obtener orden' });
  }
};

// ─── Crear orden de compra ───
const createOrden = async (req, res) => {
  try {
    const { proveedorId, proveedor, productos, impuestos, descuento, notas, fechaEstimadaEntrega } = req.body;

    if (!proveedorId) return res.status(400).json({ mensaje: 'Debe seleccionar un proveedor' });
    if (!productos || productos.length === 0) return res.status(400).json({ mensaje: 'Debe agregar al menos un producto' });

    let subtotal = 0;
    const productosFinales = [];

    for (const item of productos) {
      const prod = await Producto.findById(item.productoId);
      if (!prod) continue;

      const precio = item.precioUnitario || prod.precioCompra;
      const cantidad = item.cantidadSolicitada || item.cantidad || 1;
      const itemSubtotal = precio * cantidad;
      subtotal += itemSubtotal;

      productosFinales.push({
        productoId: prod._id,
        nombre: prod.nombre,
        codigo: prod.codigo || '',
        cantidadSolicitada: cantidad,
        cantidadRecibida: 0,
        precioUnitario: precio,
        subtotal: itemSubtotal,
      });
    }

    const total = subtotal + Number(impuestos || 0) - Number(descuento || 0);

    const orden = new OrdenCompra({
      proveedorId,
      proveedor: proveedor || { nombre: 'Sin nombre' },
      productos: productosFinales,
      subtotal,
      impuestos: Number(impuestos || 0),
      descuento: Number(descuento || 0),
      total: total > 0 ? total : 0,
      notas: notas || '',
      fechaEstimadaEntrega: fechaEstimadaEntrega || null,
      usuarioId: req.user._id,
    });

    await orden.save();

    const populated = await OrdenCompra.findById(orden._id)
      .populate('proveedorId', 'nombre telefono email')
      .populate('usuarioId', 'nombre');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error createOrden:', error);
    res.status(500).json({ mensaje: 'Error al crear orden de compra' });
  }
};

// ─── Actualizar orden ───
const updateOrden = async (req, res) => {
  try {
    const orden = await OrdenCompra.findById(req.params.id);
    if (!orden) return res.status(404).json({ mensaje: 'Orden no encontrada' });

    if (['recibida', 'cancelada'].includes(orden.estado)) {
      return res.status(400).json({ mensaje: 'No se puede editar una orden recibida o cancelada' });
    }

    const { productos, impuestos, descuento, notas, fechaEstimadaEntrega, estado } = req.body;

    if (productos && productos.length > 0) {
      let subtotal = 0;
      const productosFinales = [];

      for (const item of productos) {
        const prod = await Producto.findById(item.productoId);
        if (!prod) continue;

        const precio = item.precioUnitario || prod.precioCompra;
        const cantidad = item.cantidadSolicitada || item.cantidad || 1;
        const itemSubtotal = precio * cantidad;
        subtotal += itemSubtotal;

        productosFinales.push({
          productoId: prod._id,
          nombre: prod.nombre,
          codigo: prod.codigo || '',
          cantidadSolicitada: cantidad,
          cantidadRecibida: item.cantidadRecibida || 0,
          precioUnitario: precio,
          subtotal: itemSubtotal,
        });
      }

      orden.productos = productosFinales;
      orden.subtotal = subtotal;
      orden.impuestos = impuestos !== undefined ? Number(impuestos) : orden.impuestos;
      orden.descuento = descuento !== undefined ? Number(descuento) : orden.descuento;
      orden.total = orden.subtotal + orden.impuestos - orden.descuento;
    }

    if (notas !== undefined) orden.notas = notas;
    if (fechaEstimadaEntrega !== undefined) orden.fechaEstimadaEntrega = fechaEstimadaEntrega;
    if (estado) orden.estado = estado;

    await orden.save();

    const populated = await OrdenCompra.findById(orden._id)
      .populate('proveedorId', 'nombre telefono email')
      .populate('usuarioId', 'nombre');

    res.json(populated);
  } catch (error) {
    console.error('Error updateOrden:', error);
    res.status(500).json({ mensaje: 'Error al actualizar orden' });
  }
};

// ─── Recibir mercadería ───
const recibirMercaderia = async (req, res) => {
  try {
    const orden = await OrdenCompra.findById(req.params.id);
    if (!orden) return res.status(404).json({ mensaje: 'Orden no encontrada' });

    if (['recibida', 'cancelada'].includes(orden.estado)) {
      return res.status(400).json({ mensaje: 'Esta orden ya está cerrada' });
    }

    const { productos, observaciones } = req.body;
    if (!productos || productos.length === 0) {
      return res.status(400).json({ mensaje: 'Debe indicar los productos recibidos' });
    }

    const recepcion = {
      fecha: new Date(),
      productos: [],
      observaciones: observaciones || '',
      usuarioId: req.user._id,
    };

    for (const item of productos) {
      const idx = orden.productos.findIndex((p) => String(p.productoId) === String(item.productoId));
      if (idx === -1) continue;

      const ordenItem = orden.productos[idx];
      const cantRecibir = Number(item.cantidadRecibida || 0);
      if (cantRecibir <= 0) continue;

      const totalRecibido = ordenItem.cantidadRecibida + cantRecibir;
      if (totalRecibido > ordenItem.cantidadSolicitada) {
        return res.status(400).json({
          mensaje: `Cantidad excedida para "${ordenItem.nombre}". Solicitado: ${ordenItem.cantidadSolicitada}, Ya recibido: ${ordenItem.cantidadRecibida}`,
        });
      }

      orden.productos[idx].cantidadRecibida = totalRecibido;

      // Ingresar al stock
      const prod = await Producto.findById(item.productoId);
      if (prod) {
        const stockAnterior = prod.stock;
        prod.stock += cantRecibir;

        // Actualizar precio de compra si viene
        if (item.precioUnitario) {
          prod.precioCompra = item.precioUnitario;
        }

        await prod.save();

        await Kardex.create({
          productoId: prod._id,
          tipo: 'entrada',
          cantidad: cantRecibir,
          stockAnterior,
          stockNuevo: prod.stock,
          motivo: `Recepción OC ${orden.numeroOrden}`,
          usuarioId: req.user._id,
        });
      }

      recepcion.productos.push({
        productoId: item.productoId,
        nombre: ordenItem.nombre,
        cantidadRecibida: cantRecibir,
      });
    }

    orden.recepciones.push(recepcion);

    // Determinar estado
    const todosRecibidos = orden.productos.every((p) => p.cantidadRecibida >= p.cantidadSolicitada);
    const algunoRecibido = orden.productos.some((p) => p.cantidadRecibida > 0);

    if (todosRecibidos) {
      orden.estado = 'recibida';
    } else if (algunoRecibido) {
      orden.estado = 'parcial';
    }

    await orden.save();

    const populated = await OrdenCompra.findById(orden._id)
      .populate('proveedorId', 'nombre telefono email')
      .populate('usuarioId', 'nombre')
      .populate('recepciones.usuarioId', 'nombre');

    res.json({ mensaje: 'Mercadería recibida exitosamente', orden: populated });
  } catch (error) {
    console.error('Error recibirMercaderia:', error);
    res.status(500).json({ mensaje: 'Error al recibir mercadería' });
  }
};

// ─── Cancelar orden ───
const cancelarOrden = async (req, res) => {
  try {
    const orden = await OrdenCompra.findById(req.params.id);
    if (!orden) return res.status(404).json({ mensaje: 'Orden no encontrada' });

    if (orden.estado === 'recibida') {
      return res.status(400).json({ mensaje: 'No se puede cancelar una orden ya recibida completamente' });
    }

    orden.estado = 'cancelada';
    if (req.body.motivo) orden.notas = `${orden.notas}\nCancelación: ${req.body.motivo}`.trim();
    await orden.save();

    res.json({ mensaje: 'Orden cancelada', orden });
  } catch (error) {
    console.error('Error cancelarOrden:', error);
    res.status(500).json({ mensaje: 'Error al cancelar orden' });
  }
};

// ─── Eliminar orden ───
const deleteOrden = async (req, res) => {
  try {
    const orden = await OrdenCompra.findById(req.params.id);
    if (!orden) return res.status(404).json({ mensaje: 'Orden no encontrada' });

    if (orden.estado !== 'borrador') {
      return res.status(400).json({ mensaje: 'Solo se pueden eliminar órdenes en borrador' });
    }

    await OrdenCompra.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Orden eliminada' });
  } catch (error) {
    console.error('Error deleteOrden:', error);
    res.status(500).json({ mensaje: 'Error al eliminar orden' });
  }
};

module.exports = {
  getOrdenes,
  getOrdenById,
  createOrden,
  updateOrden,
  recibirMercaderia,
  cancelarOrden,
  deleteOrden,
};
