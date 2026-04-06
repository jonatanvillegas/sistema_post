const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        mensaje: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
      });
    }
    next();
  };
};

module.exports = { authorizeRoles };
