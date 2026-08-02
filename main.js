const { app, BrowserWindow, dialog, ipcMain, Menu, clipboard, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ScheduleDatabase } = require('./src/db/database');
const isMac = process.platform === 'darwin';
const appIconPath = path.join(__dirname, 'icon', isMac ? 'orange.png' : 'orange.ico');
const APP_NAME = 'A大橙子课时统计';
const LEGACY_APP_NAME = 'A大橙子课时统计（内测版）';
const appDataPath = app.getPath('appData');
app.setName(APP_NAME);
const formalUserDataPath = path.join(appDataPath, APP_NAME);
const isolatedTestDataPath = process.env.ORAGSCHEDULE_E2E_USER_DATA_DIR;
const portableRoot = (() => {
    if (process.env.ORAGSCHEDULE_PORTABLE_DIR) return path.resolve(process.env.ORAGSCHEDULE_PORTABLE_DIR);
    if (!isMac || !app.isPackaged) return null;
    const bundleParent = path.dirname(path.dirname(path.dirname(path.dirname(process.execPath))));
    return fs.existsSync(path.join(bundleParent, '.oragshedule-portable')) ? bundleParent : null;
})();
const portableUserDataPath = portableRoot ? path.join(portableRoot, 'data') : null;
app.setPath('userData', isolatedTestDataPath
    ? path.resolve(isolatedTestDataPath)
    : (portableUserDataPath || formalUserDataPath));

// A renderer crash on a small number of Windows graphics drivers used to look
// like the application simply did not start. A crash-triggered relaunch adds
// this flag once; it is deliberately not enabled for every user.
const GPU_FALLBACK_ARG = '--oragshedule-disable-gpu';
if (process.argv.includes(GPU_FALLBACK_ARG)) app.disableHardwareAcceleration();

// Acquire the lock before touching a potentially large Chromium profile. This
// also prevents two launches from attempting the one-time migration together.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
}

let staleUserDataPath = null;
let scheduleDatabase = null;

function migrateLegacyUserDataDirectory() {
    if (isolatedTestDataPath || portableUserDataPath) {
        return;
    }
    const legacyPath = path.join(appDataPath, LEGACY_APP_NAME);
    const formalPath = formalUserDataPath;
    if (!fs.existsSync(legacyPath)) {
        app.setPath('userData', formalPath);
        return;
    }

    let displacedFormalPath = null;
    try {
        // A formal-version directory may have been created by an earlier empty
        // launch. Move it aside first so the complete legacy Chromium profile
        // (including Local Storage/LevelDB) can be renamed as one unit.
        if (fs.existsSync(formalPath)) {
            displacedFormalPath = `${formalPath}.migration-${Date.now()}`;
            fs.renameSync(formalPath, displacedFormalPath);
        }
        fs.renameSync(legacyPath, formalPath);
        app.setPath('userData', formalPath);
        console.log(`已将内测版数据目录迁移为正式版：${formalPath}`);
    } catch (error) {
        console.error('内测版数据目录改名失败，继续使用原数据目录:', error);
        if (!fs.existsSync(formalPath) && displacedFormalPath && fs.existsSync(displacedFormalPath)) {
            try {
                fs.renameSync(displacedFormalPath, formalPath);
                displacedFormalPath = null;
            } catch (restoreError) {
                console.error('恢复正式版目录失败:', restoreError);
            }
        }
        // Never start with an empty profile merely because migration failed.
        app.setPath('userData', legacyPath);
        return;
    }

    if (displacedFormalPath && fs.existsSync(displacedFormalPath)) {
        try {
            // Cleanup is intentionally deferred until after a window exists.
            staleUserDataPath = displacedFormalPath;
        } catch (_) {
            staleUserDataPath = null;
        }
    }
}

if (gotSingleInstanceLock) migrateLegacyUserDataDirectory();

function appendStartupLog(message, error) {
    try {
        const detail = error && (error.stack || error.message || String(error));
        const line = `[${new Date().toISOString()}] ${message}${detail ? `: ${detail}` : ''}\n`;
        fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), line, 'utf8');
    } catch (_) {
        // Diagnostics must never become another startup failure.
    }
}

function cleanupStaleUserDataDirectory() {
    if (!staleUserDataPath) return;
    const cleanupPath = staleUserDataPath;
    staleUserDataPath = null;
    fs.promises.rm(cleanupPath, { recursive: true, force: true }).catch(error => {
        appendStartupLog(`Failed to clean migrated profile ${cleanupPath}`, error);
    });
}

function requireAppIcon() {
    if (fs.existsSync(appIconPath)) return true;
    const message = `缺少必需的应用图标：${appIconPath}\n请恢复 ${path.basename(appIconPath)} 后重新启动。`;
    console.error(message);
    dialog.showErrorBox('无法启动A大橙子课时统计', message);
    return false;
}

// Apply the branded icon to every window opened by a link, including links
// opened from an existing external document window.
app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\//i.test(url)) shell.openExternal(url).catch(console.error);
        return { action: 'deny' };
    });
});

function createWindow() {
    if (!requireAppIcon()) {
        app.quit();
        return null;
    }
    const win = new BrowserWindow({
        icon: appIconPath,
        frame: isMac,
        ...(isMac ? {
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: 18, y: 23 }
        } : {}),
        autoHideMenuBar: true,
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            zoomFactor: 0.9
        }
    });

    const appPageUrl = pathToFileURL(path.join(__dirname, 'index.html')).toString();
    let gpuFallbackStarted = false;
    win.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
        if (isMainFrame) appendStartupLog(`Main page failed to load (${code}) ${description} ${validatedURL}`);
    });
    win.webContents.on('render-process-gone', (_event, details) => {
        appendStartupLog(`Renderer exited: ${details.reason} (${details.exitCode})`);
        if (gpuFallbackStarted || process.argv.includes(GPU_FALLBACK_ARG) || details.reason === 'clean-exit') return;
        gpuFallbackStarted = true;
        app.relaunch({ args: process.argv.slice(1).concat(GPU_FALLBACK_ARG) });
        app.exit(0);
    });
    win.webContents.on('will-navigate', (event, targetUrl) => {
        if (targetUrl !== appPageUrl) event.preventDefault();
    });
    win.loadURL(appPageUrl).catch(error => appendStartupLog('loadURL rejected', error));
    win.webContents.once('did-finish-load', cleanupStaleUserDataDirectory);
}

ipcMain.handle('save-file', async (_event, { data, encoding, defaultName, fileExt }) => {
    if (typeof data !== 'string') throw new TypeError('Invalid file data');
    if (encoding !== 'base64' && encoding !== 'utf-8' && encoding !== 'utf8') throw new TypeError('Unsupported file encoding');
    const normalizedExt = String(fileExt || path.extname(String(defaultName || '')).slice(1)).toLowerCase();
    const allowedExtensions = new Set(['doc', 'xls', 'png', 'json', 'txt']);
    if (!allowedExtensions.has(normalizedExt)) throw new TypeError('Unsupported file extension');
    const estimatedBytes = encoding === 'base64' ? Math.ceil(data.length * 0.75) : Buffer.byteLength(data, 'utf8');
    if (estimatedBytes > 50 * 1024 * 1024) throw new RangeError('File data exceeds the 50 MB limit');
    const safeDefaultName = path.basename(String(defaultName || `课程表.${normalizedExt}`))
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .slice(0, 180);
    const result = await dialog.showSaveDialog({
        defaultPath: safeDefaultName,
        filters: [{ name: normalizedExt.toUpperCase(), extensions: [normalizedExt] }]
    });

    if (result.canceled || !result.filePath) {
        return { canceled: true };
    }

    const content = encoding === 'base64' ? Buffer.from(data, 'base64') : data;
    await fs.promises.writeFile(result.filePath, content, encoding === 'base64' ? undefined : 'utf8');
    return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('read-clipboard-text', () => clipboard.readText());

function requireDatabase() {
    if (!scheduleDatabase) throw new Error('Schedule database is not ready');
    return scheduleDatabase;
}

function validateBackupPayload(payload) {
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > 50 * 1024 * 1024) {
        throw new RangeError('Backup payload exceeds the 50 MB limit');
    }
    if (!payload || payload.type !== 'class-schedule-full-backup') throw new TypeError('Invalid backup payload');
    return payload;
}

ipcMain.handle('storage-initialize', (_event, payload) => {
    const result = requireDatabase().initializeFromLegacy(validateBackupPayload(payload));
    return { source: 'sqlite', migrated: result.migrated, snapshot: result.snapshot, validation: result.validation };
});

ipcMain.handle('storage-save-snapshot', (_event, payload) => {
    const validation = requireDatabase().replaceSnapshot(validateBackupPayload(payload));
    return { saved: true, validation };
});

ipcMain.handle('storage-replace-snapshot', (_event, payload) => {
    const validation = requireDatabase().replaceSnapshot(validateBackupPayload(payload));
    return { restored: true, validation };
});

ipcMain.handle('storage-create-database-backup', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog({
        defaultPath: `课时统计完整备份-${stamp}.oragshedule-backup`,
        filters: [{ name: '课时统计完整备份', extensions: ['oragshedule-backup'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await requireDatabase().createBackup(result.filePath);
    return { canceled: false, created: true, filePath: result.filePath };
});

ipcMain.handle('storage-restore-database-backup', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: '课时统计备份', extensions: ['oragshedule-backup', 'sqlite', 'db'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const sourcePath = result.filePaths[0];
    const sourceFile = await fs.promises.open(sourcePath, 'r');
    const header = Buffer.alloc(16);
    try {
        await sourceFile.read(header, 0, header.length, 0);
    } finally {
        await sourceFile.close();
    }
    if (header.toString('utf8') !== 'SQLite format 3\0') {
        throw new TypeError('请选择有效的完整备份或 SQLite 数据库文件');
    }
    const restored = await requireDatabase().restoreBackup(sourcePath);
    return { canceled: false, format: 'sqlite', ...restored, snapshot: requireDatabase().getSnapshot() };
});

function teacherContext() {
    const database = requireDatabase();
    const teacherId = database.currentTeacherId();
    if (!teacherId) throw new Error('Current teacher is not configured');
    return { database, teacherId };
}

ipcMain.handle('teacher-get-schedule', (_event, range = {}) => {
    const { database, teacherId } = teacherContext();
    return database.teacherSchedule.getMySchedule(teacherId, {
        from: typeof range.from === 'string' ? range.from : null,
        to: typeof range.to === 'string' ? range.to : null
    });
});

ipcMain.handle('teacher-get-session-detail', (_event, sessionId) => {
    const { database, teacherId } = teacherContext();
    return database.teacherSchedule.getSessionDetail(teacherId, String(sessionId));
});

ipcMain.handle('teacher-list-published-changes', (_event, since) => {
    const { database, teacherId } = teacherContext();
    return database.teacherSchedule.listPublishedChanges(teacherId, typeof since === 'string' ? since : null);
});

ipcMain.handle('teacher-mark-attendance', (_event, input) => {
    const { database, teacherId } = teacherContext();
    return database.attendance.markAttendance(teacherId, input.sessionId, input.studentId, input.status);
});

ipcMain.handle('teacher-set-actual-minutes', (_event, input) => {
    const { database, teacherId } = teacherContext();
    return database.attendance.setActualMinutes(teacherId, input.sessionId, input.studentId, input.actualMinutes);
});

ipcMain.handle('teacher-complete-session', (_event, sessionId) => {
    const { database, teacherId } = teacherContext();
    return database.attendance.completeSession(teacherId, String(sessionId));
});

ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    if (action === 'minimize') win.minimize();
    if (action === 'maximize') {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
    if (action === 'close') win.close();
});

ipcMain.on('set-page-zoom', (event, percent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    const normalizedPercent = Math.max(75, Math.min(125, Number(percent) || 100));
    // Preserve the app's original 90% visual baseline while using Chromium's
    // viewport-aware zoom so fixed 100vh layouts still fill the window.
    win.webContents.setZoomFactor(0.9 * normalizedPercent / 100);
});

if (gotSingleInstanceLock) {
    app.on('second-instance', () => {
        const [win] = BrowserWindow.getAllWindows();
        if (!win) {
            createWindow();
            return;
        }

        if (win.isMinimized()) win.restore();
        if (!win.isVisible()) win.show();
        win.focus();
    });

    app.whenReady().then(() => {
        scheduleDatabase = new ScheduleDatabase(path.join(app.getPath('userData'), 'schedule.sqlite'));
        if (!isMac) Menu.setApplicationMenu(null);
        if (isMac && app.dock) app.dock.setIcon(appIconPath);
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    }).catch(error => {
        appendStartupLog('Application readiness failed', error);
        dialog.showErrorBox('无法启动A大橙子课时统计', `启动失败，请将 startup.log 发给开发者。\n${error.message || error}`);
        app.quit();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            if (scheduleDatabase) {
                scheduleDatabase.checkpoint();
                scheduleDatabase.close();
                scheduleDatabase = null;
            }
            app.quit();
        }
    });
}
