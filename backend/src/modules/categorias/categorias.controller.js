const Categoria = require('./categoria.model');

// @GET /api/categorias
const getCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.find({ estado: true }).sort({ nombre: 1 });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener categorías', error: error.message });
  }
};

// @POST /api/categorias (admin)
const createCategoria = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    if (!nombre) return res.status(400).json({ mensaje: 'El nombre es requerido' });

    const exists = await Categoria.findOne({ nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (exists) return res.status(409).json({ mensaje: 'La categoría ya existe' });

    const categoria = await Categoria.create({ nombre });
    res.status(201).json(categoria);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear categoría', error: error.message });
  }
};

// @PUT /api/categorias/:id (admin)
const updateCategoria = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    if (!nombre) return res.status(400).json({ mensaje: 'El nombre es requerido' });

    const categoria = await Categoria.findById(req.params.id);
    if (!categoria) return res.status(404).json({ mensaje: 'Categoría no encontrada' });

    categoria.nombre = nombre;
    await categoria.save();

    res.json({ mensaje: 'Categoría actualizada', categoria });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ mensaje: 'La categoría ya existe' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar categoría', error: error.message });
  }
};

// @DELETE /api/categorias/:id (admin) — soft delete
const deleteCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findById(req.params.id);
    if (!categoria) return res.status(404).json({ mensaje: 'Categoría no encontrada' });

    categoria.estado = false;
    await categoria.save();

    res.json({ mensaje: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar categoría', error: error.message });
  }
};

module.exports = { getCategorias, createCategoria, updateCategoria, deleteCategoria };
