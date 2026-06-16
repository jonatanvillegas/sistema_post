const { Producto } = require('../inventario/producto.model');

// ─── Obtener productos para generar etiquetas ───
const getProductosEtiquetas = async (req, res) => {
  try {
    const { buscar, categoria, ids } = req.query;
    const filter = { estado: true };

    if (buscar) {
      filter.$or = [
        { nombre: { $regex: buscar, $options: 'i' } },
        { codigo: { $regex: buscar, $options: 'i' } },
      ];
    }
    if (categoria) filter.categoria = categoria;

    // Si se pasan IDs específicos
    if (ids) {
      const idArray = ids.split(',').filter(Boolean);
      filter._id = { $in: idArray };
    }

    const productos = await Producto.find(filter)
      .select('nombre codigo precioVenta precioCompra categoria stock')
      .sort({ nombre: 1 })
      .limit(200);

    res.json(productos);
  } catch (error) {
    console.error('Error getProductosEtiquetas:', error);
    res.status(500).json({ mensaje: 'Error al obtener productos para etiquetas' });
  }
};

// ─── Generar datos para impresión de etiquetas ───
const generarEtiquetas = async (req, res) => {
  try {
    const { productos, formato = '50x25', incluirPrecio = true, incluirCodigo = true, incluirCategoria = false } = req.body;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ mensaje: 'Debe seleccionar al menos un producto' });
    }

    const etiquetas = [];

    for (const item of productos) {
      const prod = await Producto.findById(item.productoId || item._id);
      if (!prod) continue;

      const cantidad = item.cantidad || 1;
      for (let i = 0; i < cantidad; i++) {
        etiquetas.push({
          productoId: prod._id,
          nombre: prod.nombre,
          codigo: prod.codigo || '',
          precioVenta: incluirPrecio ? prod.precioVenta : null,
          categoria: incluirCategoria ? prod.categoria : null,
          incluirCodigo,
        });
      }
    }

    const formatos = {
      '30x20': { width: 30, height: 20, fontSize: 8, columnas: 3 },
      '50x25': { width: 50, height: 25, fontSize: 10, columnas: 2 },
      '50x30': { width: 50, height: 30, fontSize: 11, columnas: 2 },
      '70x35': { width: 70, height: 35, fontSize: 12, columnas: 2 },
      '100x50': { width: 100, height: 50, fontSize: 14, columnas: 1 },
    };

    res.json({
      etiquetas,
      formato: formatos[formato] || formatos['50x25'],
      totalEtiquetas: etiquetas.length,
    });
  } catch (error) {
    console.error('Error generarEtiquetas:', error);
    res.status(500).json({ mensaje: 'Error al generar etiquetas' });
  }
};

module.exports = {
  getProductosEtiquetas,
  generarEtiquetas,
};
