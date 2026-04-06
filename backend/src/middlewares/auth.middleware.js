const jwt = require('jsonwebtoken');
const User = require('../modules/auth/auth.model');

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ mensaje: 'No autorizado, token requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    if (req.user.estado === false) {
      return res.status(401).json({ mensaje: 'Usuario desactivado' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

module.exports = { protect };
