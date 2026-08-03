const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    windowControl: (action) => ipcRenderer.send('window-control', action),
    setPageZoom: (percent) => ipcRenderer.send('set-page-zoom', percent),
    readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
    storage: Object.freeze({
        initialize: (backup) => ipcRenderer.invoke('storage-initialize', backup),
        cacheSnapshot: (backup) => ipcRenderer.send('storage-cache-snapshot', backup),
        replaceSnapshot: (backup) => ipcRenderer.invoke('storage-replace-snapshot', backup)
    }),
    teacher: Object.freeze({
        getSchedule: (range) => ipcRenderer.invoke('teacher-get-schedule', range),
        getSessionDetail: (sessionId) => ipcRenderer.invoke('teacher-get-session-detail', sessionId),
        listPublishedChanges: (since) => ipcRenderer.invoke('teacher-list-published-changes', since),
        markAttendance: (input) => ipcRenderer.invoke('teacher-mark-attendance', input),
        setActualMinutes: (input) => ipcRenderer.invoke('teacher-set-actual-minutes', input),
        completeSession: (sessionId) => ipcRenderer.invoke('teacher-complete-session', sessionId)
    }),
    saveFile: (data, encoding, defaultName, mimeType, fileExt) => {
        return ipcRenderer.invoke('save-file', { data, encoding, defaultName, mimeType, fileExt });
    }
});
