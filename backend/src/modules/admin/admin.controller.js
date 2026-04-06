const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Crea un backup de la base de datos MongoDB y lo guarda en el escritorio como ZIP
 */
exports.crearBackupManual = async (req, res) => {
  try {
    const mongoUri = process.env.MONGO_URI;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `Respaldo_POS_${timestamp}`;
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const backupFolder = path.join(desktopPath, 'POS_Backups');
    const tempDir = path.join(os.tmpdir(), backupName);
    const zipPath = path.join(backupFolder, `${backupName}.zip`);

    // 1. Asegurar que existe la carpeta en el escritorio
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    console.log(`🚀 Iniciando backup: ${backupName}`);

    // 2. Ejecutar mongodump a una carpeta temporal
    // Intentamos encontrar el ejecutable en la ruta por defecto de Windows si no está en el PATH
    let dumpExe = 'mongodump';
    const defaultWinPath = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe';
    
    if (process.platform === 'win32' && fs.existsSync(defaultWinPath)) {
      dumpExe = `"${defaultWinPath}"`;
    }

    const dumpCommand = `${dumpExe} --uri="${mongoUri}" --out="${tempDir}"`;
    
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
    const zipCommand = `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    
    try {
      await execPromise(zipCommand);
    } catch (error) {
      console.error('Error al comprimir:', error);
      return res.status(500).json({ 
        mensaje: 'Error al comprimir el backup.',
        error: error.message 
      });
    }

    // 4. Limpiar carpeta temporal
    fs.rmSync(tempDir, { recursive: true, force: true });

    res.json({
      ok: true,
      mensaje: 'Backup creado exitosamente en el escritorio',
      archivo: `${backupName}.zip`,
      ruta: zipPath
    });

  } catch (error) {
    console.error('Error general en backup:', error);
    res.status(500).json({ 
      mensaje: 'Error interno al procesar el backup',
      error: error.message 
    });
  }
};
