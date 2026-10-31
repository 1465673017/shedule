const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    windowControl: (action) => ipcRenderer.send('window-control', action),
    setPageZoom: (percent) => ipcRenderer.send('set-page-zoom', percent),
    openMemoWindow: () => ipcRenderer.invoke('open-memo-window'),
    toggleMemoWindowAlwaysOnTop: () => ipcRenderer.invoke('toggle-memo-window-always-on-top'),
    readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
    loadNavigationShortcuts: () => ipcRenderer.invoke('navigation-shortcuts:load'),
    saveNavigationShortcuts: (shortcuts) => ipcRenderer.invoke('navigation-shortcuts:save', shortcuts),
    chooseNavigationShortcutIcon: () => ipcRenderer.invoke('navigation-shortcuts:choose-icon'),
    chooseNavigationShortcutTarget: (mode) => ipcRenderer.invoke('navigation-shortcuts:choose-target', mode),
    openNavigationShortcut: (target) => ipcRenderer.invoke('navigation-shortcuts:open', target),
    getNavigationShortcutFileIcon: (target) => ipcRenderer.invoke('navigation-shortcuts:file-icon', target),
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
    memos: Object.freeze({
        list: () => ipcRenderer.invoke('memos-list'),
        save: (memo) => ipcRenderer.invoke('memos-save', memo),
        remove: (memoId) => ipcRenderer.invoke('memos-delete', memoId)
    }),
    saveFile: (data, encoding, defaultName, mimeType, fileExt) => {
        return ipcRenderer.invoke('save-file', { data, encoding, defaultName, mimeType, fileExt });
    }
});
