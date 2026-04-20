const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let serverProcess;

let logFilePath;

function initLogging() {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    logFilePath = path.join(logsDir, 'main.log');
  } catch {
    // Si falla, nos quedamos con console.*
  }
}

function log(level, ...args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}\n`;

  if (level === 'ERROR') console.error(...args);
  else if (level === 'WARN') console.warn(...args);
  else console.log(...args);

  if (!logFilePath) return;
  try {
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch {
    // noop
  }
}

function waitForBackendReady({ url, timeoutMs }) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const elapsed = Date.now() - start;
      if (elapsed > timeoutMs) {
        reject(new Error(`Timeout esperando backend: ${url}`));
        return;
      }

      const req = http.get(url, (res) => {
        // Cualquier 2xx/3xx lo tomamos como "listo"
        const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 400;
        res.resume();
        if (ok) resolve();
        else setTimeout(tryOnce, 250);
      });

      req.on('error', () => {
        setTimeout(tryOnce, 250);
      });

      req.setTimeout(1500, () => {
        req.destroy();
        setTimeout(tryOnce, 250);
      });
    };

    tryOnce();
  });
}

function createWindow() {
  const isDev = !app.isPackaged;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: !isDev, // Pantalla completa solo en producción
    kiosk: !isDev,      // Modo kiosko solo en producción
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'pos_system_icon.png')
  });

  // Hooks de diagnóstico para pantalla en blanco
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log('ERROR', 'did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('ERROR', 'render-process-gone', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    log('WARN', 'Renderer unresponsive');
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // level: 0=debug,1=info,2=warn,3=error
    const mapped = level >= 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
    log(mapped, 'renderer:', message, `(line ${line})`, sourceId || '');
  });

  // Pantalla de carga mientras el backend inicia (Mongo + seed)
  mainWindow.loadURL(
    `data:text/html,
      <body style="background:#101010;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div style="text-align:center;max-width:520px">
          <h2 style="margin:0 0 12px">Iniciando Sistema POS…</h2>
          <p style="margin:0;opacity:.8">Preparando servicios, por favor espera.</p>
        </div>
      </body>`
  );

  // Cargar el frontend construido (cuando backend esté listo)
  const indexPath = path.join(__dirname, 'front', 'sistema-pos-front', 'dist', 'index.html');

  if (!fs.existsSync(indexPath)) {
    log('ERROR', 'No se encontró index.html', indexPath);
    mainWindow.loadURL(`data:text/html,
      <body style="background: #1a1a1a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
        <h1 style="color: #ff4d4f">🛑 Error de Carga</h1>
        <p>No se encontró el build del frontend. Ejecuta: <b>npm run dist</b> (ahora ya hace el build automáticamente).</p>
        <code style="background: #333; padding: 10px; border-radius: 5px;">${indexPath}</code>
      </body>
    `);
  } else {
    waitForBackendReady({ url: 'http://localhost:5000/api/health', timeoutMs: 120000 })
      .then(() => {
        log('INFO', 'Backend listo. Cargando UI…');
        return mainWindow.loadFile(indexPath);
      })
      .catch((err) => {
        log('ERROR', 'Backend no respondió a tiempo:', err.message);
        mainWindow.loadURL(`data:text/html,
          <body style="background: #1a1a1a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
            <h1 style="color: #ffcc00">⚠️ Backend no disponible</h1>
            <p>No se pudo iniciar el servidor interno (API) a tiempo.</p>
            <p style="opacity:.8">Revisa el log en: <code>${logFilePath || '(no disponible)'}</code></p>
          </body>
        `);
      });
  }

  // Abrir DevTools solo si no está empaquetado (evita kiosko en producción)
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

async function printReceiptHtml({ html, options }) {
  if (!html || typeof html !== 'string') {
    throw new Error('HTML de recibo inválido');
  }

  const printWindow = new BrowserWindow({
    show: false,
    width: 400,
    height: 600,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const safeOptions = {
    silent: Boolean(options?.silent),
    printBackground: true,
  };
  if (typeof options?.deviceName === 'string' && options.deviceName.trim()) {
    safeOptions.deviceName = options.deviceName.trim();
  }
  if (Number.isInteger(options?.copies) && options.copies > 0) {
    safeOptions.copies = options.copies;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (err) => {
      if (settled) return;
      settled = true;
      try {
        if (!printWindow.isDestroyed()) printWindow.close();
      } catch {
        // noop
      }
      if (err) reject(err);
      else resolve(true);
    };

    printWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      settle(new Error(`Falló carga de recibo: ${errorCode} ${errorDescription}`));
    });

    printWindow.webContents.on('did-finish-load', () => {
      // Pequeño delay para asegurar layout/render antes de imprimir
      setTimeout(() => {
        try {
          printWindow.webContents.print(safeOptions, (success, failureReason) => {
            if (!success) settle(new Error(failureReason || 'Falló impresión'));
            else settle();
          });
        } catch (err) {
          settle(err);
        }
      }, 150);
    });

    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    printWindow.loadURL(url).catch((err) => settle(err));
  });
}

// Iniciar el Backend como un proceso hijo
function startBackend() {
  log('INFO', 'Iniciando backend...');
  const serverPath = path.join(__dirname, 'backend', 'server.js');
  const envPath = path.join(__dirname, 'backend', '.env');
  
  let backendEnv = { 
    ...process.env, 
    NODE_ENV: 'production', 
    PORT: 5000 
  };

  // Cargar variables desde .env manualmente si existe
  if (fs.existsSync(envPath)) {
    try {
      const dotenvContent = fs.readFileSync(envPath, 'utf8');
      dotenvContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/(^"|"$)/g, '');
          backendEnv[key.trim()] = value;
        }
      });
      log('INFO', 'Variables de entorno cargadas desde .env');
    } catch (err) {
      log('ERROR', 'Error leyendo .env:', err);
    }
  }

  serverProcess = fork(serverPath, [], {
    env: backendEnv,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (data) => log('INFO', `[backend] ${data}`.trimEnd()));
  }
  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (data) => log('ERROR', `[backend] ${data}`.trimEnd()));
  }

  serverProcess.on('message', (msg) => {
    log('INFO', 'Mensaje del backend:', msg);
  });

  serverProcess.on('error', (err) => {
    log('ERROR', 'Error en proceso backend:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    log('ERROR', 'Backend terminó', { code, signal });
  });
}

app.whenReady().then(() => {
  initLogging();
  log('INFO', 'App ready', { isPackaged: app.isPackaged, appPath: app.getAppPath() });

  process.on('uncaughtException', (err) => log('ERROR', 'uncaughtException', err?.stack || err));
  process.on('unhandledRejection', (reason) => log('ERROR', 'unhandledRejection', reason));

  startBackend();
  createWindow();

  ipcMain.handle('print-receipt', async (_event, payload) => {
    try {
      log('INFO', 'print-receipt request');
      await printReceiptHtml(payload || {});
      return { ok: true };
    } catch (err) {
      log('ERROR', 'print-receipt failed', err?.message || err);
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('select-backup-folder', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Seleccionar carpeta de respaldo (contiene .bson/.json)',
        properties: ['openDirectory'],
      });
      if (result.canceled || !result.filePaths?.[0]) return { ok: true, canceled: true };
      return { ok: true, canceled: false, folderPath: result.filePaths[0] };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Registrar atajo para cerrar la app con Esc SOLO en producción (kiosko)
  // En desarrollo es muy fácil presionarlo y parecerá “pantalla en blanco”.
  if (app.isPackaged) {
    globalShortcut.register('Escape', () => {
      log('INFO', 'Atajo Esc detectado - Cerrando aplicación');
      app.quit();
    });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    // Matar el servidor al cerrar la app
    if (serverProcess) {
      log('INFO', 'Matando proceso backend...');
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('will-quit', () => {
  // Desregistrar atajos
  globalShortcut.unregisterAll();
});

app.on('quit', () => {
  if (serverProcess) serverProcess.kill();
});
