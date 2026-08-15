const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mgAts', {
  apiBase: ipcRenderer.sendSync('mg-ats:api-base'),
});
