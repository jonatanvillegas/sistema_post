const Migration = require('./migration.model');

const migrations = [
  {
    id: '2026-04-13_add_controlaStock_to_productos',
    description: 'Agrega controlaStock=true a productos existentes (si no existe).',
    run: async () => {
      const { Producto } = require('../modules/inventario/producto.model');
      await Producto.updateMany(
        { controlaStock: { $exists: false } },
        { $set: { controlaStock: true } }
      );
    },
  },
  {
    id: '2026-06-15_add_stock_danado_y_estado_devoluciones',
    description: 'Inicializa stockDanado en productos y estadoProducto en devoluciones.',
    run: async () => {
      const { Producto } = require('../modules/inventario/producto.model');
      const Devolucion = require('../modules/devoluciones/devolucion.model');

      await Producto.updateMany(
        { stockDanado: { $exists: false } },
        { $set: { stockDanado: 0 } }
      );

      await Devolucion.updateMany(
        { stockDanadoRegistrado: { $exists: false } },
        { $set: { stockDanadoRegistrado: false } }
      );

      await Devolucion.collection.updateMany(
        { 'productos.estadoProducto': { $exists: false } },
        { $set: { 'productos.$[].estadoProducto': 'bueno' } }
      );
    },
  },
];

const runMigrations = async () => {
  const applied = await Migration.find({}).select('_id').lean();
  const appliedIds = new Set(applied.map((m) => m._id));

  const pending = migrations.filter((m) => !appliedIds.has(m.id));
  if (pending.length === 0) {
    console.log('🧩 Migraciones: no hay pendientes');
    return { applied: 0 };
  }

  console.log(`🧩 Migraciones pendientes: ${pending.length}`);

  let count = 0;
  for (const m of pending) {
    console.log(`➡️  Aplicando migración: ${m.id} — ${m.description}`);
    await m.run();
    await Migration.create({ _id: m.id, description: m.description, appliedAt: new Date() });
    count += 1;
    console.log(`✅ Migración aplicada: ${m.id}`);
  }

  return { applied: count };
};

module.exports = runMigrations;
