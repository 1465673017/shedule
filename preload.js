const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    windowControl: (action) => ipcRenderer.send('window-control', action),
    setPageZoom: (percent) => ipcRenderer.send('set-page-zoom', percent),
    readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
    courseLogin: (credentials) => ipcRenderer.invoke('course-login', credentials),
    courseRestoreLogin: () => ipcRenderer.invoke('course-restore-login'),
    startCourseSync: (options) => ipcRenderer.invoke('start-course-sync', options),
    stopCourseSync: () => ipcRenderer.invoke('stop-course-sync'),
    courseLogout: () => ipcRenderer.invoke('course-logout'),
    onCourseSyncEvent: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('course-sync-event', listener);
        return () => ipcRenderer.removeListener('course-sync-event', listener);
    },
    saveFile: (data, encoding, defaultName, mimeType, fileExt) => {
        return ipcRenderer.invoke('save-file', { data, encoding, defaultName, mimeType, fileExt });
    }
});
