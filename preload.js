const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    windowControl: (action) => ipcRenderer.send('window-control', action),
    openMemoWindow: () => ipcRenderer.invoke('open-memo-window'),
    toggleMemoWindowAlwaysOnTop: () => ipcRenderer.invoke('toggle-memo-window-always-on-top'),
    setPageZoom: (percent) => ipcRenderer.send('set-page-zoom', percent),
    readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
    loadNavigationShortcuts: () => ipcRenderer.invoke('navigation-shortcuts:load'),
    saveNavigationShortcuts: (shortcuts) => ipcRenderer.invoke('navigation-shortcuts:save', shortcuts),
    chooseNavigationShortcutIcon: () => ipcRenderer.invoke('navigation-shortcuts:choose-icon'),
    chooseNavigationShortcutTarget: (mode) => ipcRenderer.invoke('navigation-shortcuts:choose-target', mode),
    openNavigationShortcut: (target) => ipcRenderer.invoke('navigation-shortcuts:open', target),
    getNavigationShortcutFileIcon: (target) => ipcRenderer.invoke('navigation-shortcuts:file-icon', target),
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
