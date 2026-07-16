const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    windowControl: (action) => ipcRenderer.send('window-control', action),
    saveFile: (data, encoding, defaultName, mimeType, fileExt) => {
        return ipcRenderer.invoke('save-file', { data, encoding, defaultName, mimeType, fileExt });
    }
});
