/*
  Script manual para MongoDB.
  Ejecutar sobre la base de datos del sistema si se desea aplicar
  la actualización fuera del runner de migraciones del backend.
*/

db.productos.updateMany(
  { stockDanado: { $exists: false } },
  { $set: { stockDanado: 0 } }
);

db.devolucions.updateMany(
  { stockDanadoRegistrado: { $exists: false } },
  { $set: { stockDanadoRegistrado: false } }
);

db.devolucions.updateMany(
  { 'productos.estadoProducto': { $exists: false } },
  { $set: { 'productos.$[].estadoProducto': 'bueno' } }
);
