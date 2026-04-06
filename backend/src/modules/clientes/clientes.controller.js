const Cliente = require('./cliente.model');

// @GET /api/clientes
const getClientes = async (req, res) => {
  try {
    const { buscar, estado } = req.query;
    const query = {};

    if (estado !== undefined) query.estado = estado === 'true';
    if (buscar) {
      query.nombre = { $regex: buscar, $options: 'i' };
    }

    const clientes = await Cliente.find(query).sort({ nombre: 1 });
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener clientes', error: error.message });
  }
};

// @GET /api/clientes/:id
const getClienteById = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener cliente', error: error.message });
  }
};

// @POST /api/clientes
const createCliente = async (req, res) => {
  try {
    const { nombre, nit, telefono, direccion, limiteCredito } = req.body;

    const existe = await Cliente.findOne({ nit });
    if (existe) return res.status(400).json({ mensaje: 'Ya existe un cliente con ese NIT/Cédula' });

    const cliente = await Cliente.create({
      nombre,
      nit,
      telefono,
      direccion,
      limiteCredito: Number(limiteCredito) || 0,
    });

    res.status(201).json(cliente);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear cliente', error: error.message });
  }
};

// @PUT /api/clientes/:id
const updateCliente = async (req, res) => {
  try {
    const { nombre, nit, telefono, direccion, limiteCredito, estado } = req.body;
    
    const cliente = await Cliente.findByIdAndUpdate(
      req.params.id,
      { nombre, nit, telefono, direccion, limiteCredito, estado },
      { new: true, runValidators: true }
    );

    if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar cliente', error: error.message });
  }
};

// @DELETE /api/clientes/:id (Soft delete)
const deleteCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, { estado: false }, { new: true });
    if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    res.json({ mensaje: 'Cliente desactivado correctamente', cliente });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al desactivar cliente', error: error.message });
  }
};

module.exports = {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
};
