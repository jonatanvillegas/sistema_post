const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

let restoreInProgress = false;

const getDbNameFromMongoUri = (mongoUri) => {
  if (!mongoUri || typeof mongoUri !== 'string') return null;
  // Captura el segmento de DB después del último '/'
  const m = mongoUri.match(/\/([^/?]+)(?:\?|$)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

const existsDir = (p) => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const listBsonFiles = (dir) => {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.bson'))
      .map((d) => path.join(dir, d.name));
  } catch {
    return [];
  }
};

const findDumpLayout = (folderPath) => {
  // Soporta:
  // 1) folderPath/<db>/<collection>.bson
  // 2) folderPath/<collection>.bson  (dump solo de DB)
  const directBson = listBsonFiles(folderPath);
  if (directBson.length > 0) {
    return { layout: 'dbDir', dbDir: folderPath, rootDir: null, dbName: null };
  }

  const subdirs = fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const name of subdirs) {
    const candidate = path.join(folderPath, name);
    const bson = listBsonFiles(candidate);
    if (bson.length > 0) {
      return { layout: 'rootDir', rootDir: folderPath, dbDir: candidate, dbName: name };
    }
  }

  return { layout: 'unknown', rootDir: null, dbDir: null, dbName: null };
};

const safeStringify = (obj, limit = 300) => {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= limit) return s;
    return `${s.slice(0, limit)}…`;
  } catch {
    return '';
  }
};

const readBsonStatsAndSamples = async (filePath, { sampleLimit = 2 } = {}) => {
  // Parse por longitud (int32 little-endian) + doc bytes
  // Evitamos cargar el archivo completo en memoria.
  const { BSON, EJSON } = require('bson');

  const samples = [];
  let count = 0;

  const fd = fs.openSync(filePath, 'r');
  try {
    const fileSize = fs.statSync(filePath).size;
    let offset = 0;

    const lenBuf = Buffer.allocUnsafe(4);

    while (offset + 4 <= fileSize) {
      const readLen = fs.readSync(fd, lenBuf, 0, 4, offset);
      if (readLen !== 4) break;
      const docLength = lenBuf.readInt32LE(0);
      if (!Number.isFinite(docLength) || docLength <= 0) break;
      if (offset + docLength > fileSize) break;

      if (samples.length < sampleLimit) {
        const docBuf = Buffer.allocUnsafe(docLength);
        const readDoc = fs.readSync(fd, docBuf, 0, docLength, offset);
        if (readDoc === docLength) {
          try {
            const doc = BSON.deserialize(docBuf);
            const json = EJSON.stringify(doc);
            samples.push(json.length > 2000 ? `${json.slice(0, 2000)}…` : json);
          } catch {
            // ignore sample parse errors
          }
        }
      }

      count += 1;
      offset += docLength;
    }
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // noop
    }
  }

  return { count, samples };
};

const findMongoRestoreExe = () => {
  let restoreExe = 'mongorestore';
  const defaultWinPath = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe';
  if (process.platform === 'win32' && fs.existsSync(defaultWinPath)) {
    restoreExe = `"${defaultWinPath}"`;
  }
  return restoreExe;
};

/**
 * Crea un backup de la base de datos MongoDB y lo guarda en C:\Respaldo
 */
exports.crearBackupManual = async (req, res) => {
  try {
    const mongoUri = process.env.MONGO_URI;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `Respaldo_POS_${timestamp}`;
    const backupFolder = 'C:\\Respaldo';
    const dumpPath = path.join(backupFolder, backupName);

    // 1. Asegurar que existe la carpeta C:\Respaldo
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    console.log(`🚀 Iniciando backup: ${backupName}`);

    if (fs.existsSync(dumpPath)) {
      fs.rmSync(dumpPath, { recursive: true, force: true });
    }

    // 2. Ejecutar mongodump directamente dentro de C:\Respaldo
    // Intentamos encontrar el ejecutable en la ruta por defecto de Windows si no está en el PATH
    let dumpExe = 'mongodump';
    const defaultWinPath = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe';
    
    if (process.platform === 'win32' && fs.existsSync(defaultWinPath)) {
      dumpExe = `"${defaultWinPath}"`;
    }

    const dumpCommand = `${dumpExe} --uri="${mongoUri}" --out="${dumpPath}"`;
    
    try {
      await execPromise(dumpCommand);
    } catch (error) {
      console.error('Error en mongodump:', error);
      return res.status(500).json({ 
        mensaje: 'Error al ejecutar mongodump. Asegúrate de que las herramientas de MongoDB esten instaladas.',
        error: error.message 
      });
    }

    // 3. Comprimir la carpeta usando PowerShell (más confiable en Windows que dependencias externas)
    // Compress-Archive -Path "C:\temp\backup" -DestinationPath "C:\Desktop\backup.zip"
    res.json({
      ok: true,
      mensaje: 'Backup creado exitosamente en C:\\Respaldo',
      archivo: backupName,
      ruta: dumpPath
    });

  } catch (error) {
    console.error('Error general en backup:', error);
    res.status(500).json({ 
      mensaje: 'Error interno al procesar el backup',
      error: error.message 
    });
  }
};

// @POST /api/admin/backup/preview
// body: { folderPath }
exports.previewRestore = async (req, res) => {
  try {
    const { folderPath } = req.body || {};
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ mensaje: 'folderPath es requerido' });
    }
    if (!existsDir(folderPath)) {
      return res.status(400).json({ mensaje: 'La ruta no existe o no es una carpeta' });
    }

    const layout = findDumpLayout(folderPath);
    if (layout.layout === 'unknown' || !layout.dbDir) {
      return res.status(400).json({
        mensaje: 'No se encontraron archivos .bson en la carpeta indicada (ni en subcarpetas directas).',
      });
    }

    const mongoUri = process.env.MONGO_URI;
    const currentDbName = getDbNameFromMongoUri(mongoUri);

    // Determinar DB a restaurar para el caso dbDir (directo)
    const inferredDbName = layout.layout === 'rootDir' ? layout.dbName : currentDbName;
    if (!inferredDbName) {
      return res.status(500).json({
        mensaje: 'No se pudo inferir el nombre de la base de datos desde MONGO_URI.',
      });
    }

    const bsonFiles = listBsonFiles(layout.dbDir);
    if (bsonFiles.length === 0) {
      return res.status(400).json({ mensaje: 'No se encontraron colecciones (.bson) en la carpeta' });
    }

    const collections = [];
    for (const file of bsonFiles) {
      const base = path.basename(file);
      const collectionName = base.replace(/\.bson$/i, '');
      const { count, samples } = await readBsonStatsAndSamples(file, { sampleLimit: 2 });
      collections.push({
        database: inferredDbName,
        collection: collectionName,
        file: base,
        documents: count,
        samples,
      });
    }

    collections.sort((a, b) => a.collection.localeCompare(b.collection));

    res.json({
      ok: true,
      folderPath,
      layout: layout.layout,
      dbName: inferredDbName,
      collections,
      warning: 'Restaurar eliminará la información actual y reemplazará con el respaldo seleccionado.',
      hint: safeStringify({
        expectedPaths: ['<dumpRoot>/<db>/<collection>.bson', '<dbDir>/<collection>.bson'],
      }),
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al previsualizar respaldo', error: error.message });
  }
};

// @POST /api/admin/backup/restore
// body: { folderPath, confirmText }
exports.restoreFromFolder = async (req, res) => {
  try {
    if (restoreInProgress) {
      return res.status(409).json({ mensaje: 'Ya hay una restauración en progreso' });
    }

    const { folderPath, confirmText } = req.body || {};
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ mensaje: 'folderPath es requerido' });
    }
    if (confirmText !== 'RESTAURAR') {
      return res.status(400).json({ mensaje: 'Confirmación inválida. Escriba RESTAURAR para continuar.' });
    }
    if (!existsDir(folderPath)) {
      return res.status(400).json({ mensaje: 'La ruta no existe o no es una carpeta' });
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      return res.status(500).json({ mensaje: 'MONGO_URI no está configurado en el servidor' });
    }

    const layout = findDumpLayout(folderPath);
    if (layout.layout === 'unknown') {
      return res.status(400).json({ mensaje: 'No se encontraron archivos .bson en la carpeta indicada' });
    }

    const restoreExe = findMongoRestoreExe();
    const dbName = getDbNameFromMongoUri(mongoUri);
    if (!dbName) {
      return res.status(500).json({ mensaje: 'No se pudo inferir el nombre de la base de datos desde MONGO_URI' });
    }

    // Si es dbDir directo, restauramos a la DB actual explícitamente
    const restoreCommand =
      layout.layout === 'dbDir'
        ? `${restoreExe} --uri="${mongoUri}" --drop --db="${dbName}" --dir="${folderPath}"`
        : `${restoreExe} --uri="${mongoUri}" --drop --dir="${folderPath}"`;

    restoreInProgress = true;
    console.log('🧯 RESTORE: iniciando mongorestore...');
    console.log('CMD:', restoreCommand);
    try {
      const { stdout, stderr } = await execPromise(restoreCommand, { maxBuffer: 10 * 1024 * 1024 });
      console.log('mongorestore stdout:', stdout);
      console.error('mongorestore stderr:', stderr);
    } catch (error) {
      console.error('Error en mongorestore:', error);
      return res.status(500).json({
        mensaje:
          'Error al ejecutar mongorestore. Asegúrate de que las herramientas de MongoDB estén instaladas (MongoDB Database Tools).',
        error: error.message,
      });
    } finally {
      restoreInProgress = false;
    }

    res.json({
      ok: true,
      mensaje: 'Restauración completada. Se recomienda reiniciar el sistema POS para recargar datos.',
    });
  } catch (error) {
    restoreInProgress = false;
    res.status(500).json({ mensaje: 'Error al restaurar respaldo', error: error.message });
  }
};
