const Config = require('./config.model');
const { recordAudit } = require('../audit/audit.controller');

// Obtener la configuración (si no existe, crea la default)
const getConfig = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = await Config.create({});
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener configuración', error: error.message });
  }
};

// Actualizar configuración (Solo Admin)
const updateConfig = async (req, res) => {
  try {
    const updates = req.body;
    let config = await Config.findOne();
    
    if (!config) {
      config = new Config(updates);
    } else {
      Object.assign(config, updates);
    }

    await config.save();

    await recordAudit({
      usuarioId: req.user._id,
      accion: 'UPDATE_CONFIG',
      modulo: 'CONFIG',
      detalle: `Configuración actualizada: ${JSON.stringify(updates)}`,
      metadata: { updates },
      req,
    });

    res.json({ mensaje: 'Configuración actualizada correctamente', config });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar configuración', error: error.message });
  }
};

module.exports = {
  getConfig,
  updateConfig,
};
