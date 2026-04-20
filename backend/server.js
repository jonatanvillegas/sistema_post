require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const User = require('./src/modules/auth/auth.model');
const runMigrations = require('./src/migrations/runMigrations');

const PORT = process.env.PORT || 5000;

// Función para inicializar datos (Admin por defecto)
const seedDatabase = async () => {
  try {
    const allowSeed = String(process.env.SEED_ADMIN || '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';
    if (!allowSeed) {
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Test_123';

    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      await User.create({
        nombre: 'Admin Sistema',
        email: adminEmail,
        password: adminPassword,
        rol: 'admin'
      });
      console.log(`👤 Usuario admin creado: ${adminEmail}`);
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
};

// Conectar a MongoDB y luego levantar el servidor
connectDB().then(async () => {
  try {
    await runMigrations();
  } catch (error) {
    console.error('❌ Error aplicando migraciones:', error.message);
    process.exit(1);
  }
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV}`);
    console.log(`📡 API: http://localhost:${PORT}/api/health`);
  });
});
