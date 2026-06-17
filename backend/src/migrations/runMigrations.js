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
  {
    id: '2026-06-16_add_cambios_en_devoluciones',
    description: 'Agrega campos para cambios de producto y diferencias monetarias en devoluciones.',
    run: async () => {
      const Devolucion = require('../modules/devoluciones/devolucion.model');

      await Devolucion.updateMany(
        { productosCambio: { $exists: false } },
        {
          $set: {
            productosCambio: [],
            totalCambio: 0,
            diferenciaMonto: 0,
            diferenciaTipo: 'sin_diferencia',
          },
        }
      );

      await Devolucion.updateMany(
        {
          $or: [
            { totalCambio: { $exists: false } },
            { diferenciaMonto: { $exists: false } },
            { diferenciaTipo: { $exists: false } },
          ],
        },
        {
          $set: {
            totalCambio: 0,
            diferenciaMonto: 0,
            diferenciaTipo: 'sin_diferencia',
          },
        }
      );
    },
  },
  {
    id: '2026-06-16_add_ingreso_caja_en_devoluciones',
    description: 'Inicializa el registro de ingreso en caja para devoluciones con diferencia a favor de la tienda.',
    run: async () => {
      const Devolucion = require('../modules/devoluciones/devolucion.model');

      await Devolucion.updateMany(
        { ingresoCaja: { $exists: false } },
        {
          $set: {
            ingresoCaja: {
              registrado: false,
              cajaId: null,
              monto: 0,
              concepto: '',
            },
          },
        }
      );
    },
  },
  {
    id: '2026-06-16_remove_sobrante_obra_from_devoluciones',
    description: 'Elimina referencias de sobrante de obra en devoluciones existentes.',
    run: async () => {
      const Devolucion = require('../modules/devoluciones/devolucion.model');

      await Devolucion.updateMany(
        { tipo: 'sobrante_obra' },
        { $set: { tipo: 'devolucion' } }
      );

      await Devolucion.collection.updateMany(
        { 'productos.motivo': 'sobrante_obra' },
        { $set: { 'productos.$[item].motivo': 'otro' } },
        { arrayFilters: [{ 'item.motivo': 'sobrante_obra' }] }
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
