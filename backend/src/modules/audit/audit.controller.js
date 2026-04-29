const AuditLog = require('./audit.model');

// @GET /api/audit
const getAuditLogs = async (req, res) => {
  try {
    const { modulo, usuarioId, desde, hasta, page = 1, limit = 50 } = req.query;
    const filtro = {};

    if (modulo) filtro.modulo = modulo;
    if (usuarioId) filtro.usuarioId = usuarioId;

    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = new Date(`${desde}T00:00:00`);
      if (hasta) filtro.fecha.$lte = new Date(`${hasta}T23:59:59.999`);
    }

    const total = await AuditLog.countDocuments(filtro);
    const logs = await AuditLog.find(filtro)
      .populate('usuarioId', 'nombre rol')
      .sort({ fecha: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ total, pagina: Number(page), logs });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener registros de auditoría', error: error.message });
  }
};

// Helper function to record logs internally
const recordAudit = async ({ usuarioId, accion, modulo, detalle, metadata, req }) => {
  try {
    const ip = req ? req.ip || req.connection.remoteAddress : '';
    await AuditLog.create({
      usuarioId,
      accion,
      modulo,
      detalle,
      metadata: metadata || {},
      ip,
    });
  } catch (error) {
    console.error('Error recording audit log:', error.message);
  }
};

module.exports = { getAuditLogs, recordAudit };
