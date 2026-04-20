// Preload script para Electron
// Se puede expandir para exponer APIs seguras al frontend si es necesario.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Aquí puedes añadir llamadas IPC si el frontend las necesita
  // Ejemplo: sendBackupCommand: () => ipcRenderer.send('crear-backup')
  printReceipt: (html, options = {}) => ipcRenderer.invoke('print-receipt', { html, options }),
  selectBackupFolder: () => ipcRenderer.invoke('select-backup-folder'),
});

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded for Electron');
});
