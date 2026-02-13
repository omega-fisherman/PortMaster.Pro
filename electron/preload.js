
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (email, password) => ipcRenderer.invoke('login', email, password),
  
  // Fishers
  getAllFishers: () => ipcRenderer.invoke('get-fishers'),
  saveFisher: (fisher) => ipcRenderer.invoke('save-fisher', fisher),
  updateFisher: (fisher) => ipcRenderer.invoke('update-fisher', fisher),
  deleteFisher: (id) => ipcRenderer.invoke('delete-fisher', id),

  // Catches
  getCatches: () => ipcRenderer.invoke('get-catches'),
  saveCatch: (record) => ipcRenderer.invoke('save-catch', record),
  updateCatch: (record) => ipcRenderer.invoke('update-catch', record),

  // Logs
  getLogs: () => ipcRenderer.invoke('get-logs'),
  logScan: (log) => ipcRenderer.invoke('log-scan', log),

  // Renewals
  getRenewals: () => ipcRenderer.invoke('get-renewals'),
  saveRenewal: (record) => ipcRenderer.invoke('save-renewal', record),

  // Hardware
  scanNFC: () => ipcRenderer.invoke('scan-nfc'),
  writeNFC: (uid, data) => ipcRenderer.invoke('write-nfc', uid, data),

  // Files
  savePDF: (filename, content) => ipcRenderer.invoke('save-file', filename, content),
});
