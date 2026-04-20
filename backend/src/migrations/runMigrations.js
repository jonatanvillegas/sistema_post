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
