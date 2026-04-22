const jwt = require('jsonwebtoken');
const User = require('./auth.model');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
};

// @POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    if (!user.estado) {
      return res.status(401).json({ mensaje: 'Usuario desactivado' });
    }

    const match = await user.matchPassword(password);
    if (!match) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    res.json({
      token: generateToken(user._id),
      usuario: {
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        estado: user.estado,
        puedeAplicarDescuento: user.puedeAplicarDescuento,
      },
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// @POST /api/auth/register  (solo Admin)
const register = async (req, res) => {
  try {
    const { nombre, email, password, rol, puedeAplicarDescuento } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: 'Nombre, email y contraseña son requeridos' });
    }

    const existe = await User.findOne({ email });
    if (existe) {
      return res.status(400).json({ mensaje: 'El email ya está registrado' });
    }

    const nextRol = rol || 'cajero';
    const flag = nextRol === 'cajero' ? Boolean(puedeAplicarDescuento) : true;
    const user = await User.create({ nombre, email, password, rol: nextRol, puedeAplicarDescuento: flag });

    res.status(201).json({
      mensaje: 'Usuario creado correctamente',
      usuario: {
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        estado: user.estado,
        puedeAplicarDescuento: user.puedeAplicarDescuento,
      },
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear usuario', error: error.message });
  }
};

// @GET /api/auth/me
const getMe = async (req, res) => {
  res.json({
    _id: req.user._id,
    nombre: req.user.nombre,
    email: req.user.email,
    rol: req.user.rol,
    estado: req.user.estado,
    puedeAplicarDescuento: req.user.puedeAplicarDescuento,
  });
};

// @GET /api/auth/usuarios  (solo Admin)
const getUsuarios = async (req, res) => {
  try {
    const usuarios = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
  }
};

// @PUT /api/auth/usuarios/:id  (solo Admin)
const updateUsuario = async (req, res) => {
  try {
    const { nombre, email, rol, estado, password, puedeAplicarDescuento } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const nextRol = rol ?? user.rol;

    user.nombre = nombre ?? user.nombre;
    user.email = email ?? user.email;
    user.rol = nextRol;
    user.estado = estado ?? user.estado;
    if (password) user.password = password;

    if (nextRol === 'cajero') {
      if (puedeAplicarDescuento !== undefined) {
        user.puedeAplicarDescuento = Boolean(puedeAplicarDescuento);
      } else if (user.puedeAplicarDescuento === undefined) {
        user.puedeAplicarDescuento = false;
      }
    } else {
      user.puedeAplicarDescuento = true;
    }

    await user.save();

    res.json({
      mensaje: 'Usuario actualizado',
      usuario: {
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        estado: user.estado,
        puedeAplicarDescuento: user.puedeAplicarDescuento,
      },
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar usuario', error: error.message });
  }
};

// @DELETE /api/auth/usuarios/:id  (solo Admin)
const deleteUsuario = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    await user.deleteOne();
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar usuario', error: error.message });
  }
};

module.exports = { login, register, getMe, getUsuarios, updateUsuario, deleteUsuario };
