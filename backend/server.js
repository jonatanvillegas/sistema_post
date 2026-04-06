require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const User = require('./src/modules/auth/auth.model');

const PORT = process.env.PORT || 5000;

// Función para inicializar datos (Admin por defecto)
const seedDatabase = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@admin.com' });
    if (!adminExists) {
      await User.create({
        nombre: 'Admin Sistema',
        email: 'admin@admin.com',
        password: 'Test_123',
        rol: 'admin'
      });
      console.log('👤 Usuario admin creado: admin@admin.com / Test_123');
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
};

// Conectar a MongoDB y luego levantar el servidor
connectDB().then(async () => {
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV}`);
    console.log(`📡 API: http://localhost:${PORT}/api/health`);
  });
});
