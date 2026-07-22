const { app, BrowserWindow, dialog, ipcMain, Menu, clipboard, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const isMac = process.platform === 'darwin';
const appIconPath = path.join(__dirname, 'icon', isMac ? 'orange.png' : 'orange.ico');
const APP_NAME = 'A大橙子课时统计定制版';
const appDataPath = app.getPath('appData');
app.setName(APP_NAME);
const customUserDataPath = path.join(appDataPath, APP_NAME);
const isolatedTestDataPath = process.env.KEBIAO_E2E_USER_DATA_DIR;
const portableRoot = (() => {
    if (process.env.KEBIAO_PORTABLE_DIR) return path.resolve(process.env.KEBIAO_PORTABLE_DIR);
    if (!isMac || !app.isPackaged) return null;
    const bundleParent = path.dirname(path.dirname(path.dirname(path.dirname(process.execPath))));
    return fs.existsSync(path.join(bundleParent, '.kebiao-portable')) ? bundleParent : null;
})();
const portableUserDataPath = portableRoot ? path.join(portableRoot, 'data') : null;
app.setPath('userData', isolatedTestDataPath
    ? path.resolve(isolatedTestDataPath)
    : (portableUserDataPath || customUserDataPath));

// A renderer crash on a small number of Windows graphics drivers used to look
// like the application simply did not start. A crash-triggered relaunch adds
// this flag once; it is deliberately not enabled for every user.
const GPU_FALLBACK_ARG = '--kebiao-disable-gpu';
if (process.argv.includes(GPU_FALLBACK_ARG)) app.disableHardwareAcceleration();

// Acquire the lock before opening the isolated custom-edition profile.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
}

function appendStartupLog(message, error) {
    try {
        const detail = error && (error.stack || error.message || String(error));
        const line = `[${new Date().toISOString()}] ${message}${detail ? `: ${detail}` : ''}\n`;
        fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), line, 'utf8');
    } catch (_) {
        // Diagnostics must never become another startup failure.
    }
}

function requireAppIcon() {
    if (fs.existsSync(appIconPath)) return true;
    const message = `缺少必需的应用图标：${appIconPath}\n请恢复 ${path.basename(appIconPath)} 后重新启动。`;
    console.error(message);
    dialog.showErrorBox(`无法启动${APP_NAME}`, message);
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

let courseLoginProcess = null;
let courseLoginOwner = null;
function resolveCourseBridgePath() {
    const bridgeName = process.platform === 'win32' ? 'course-sync-bridge.exe' : 'course-sync-bridge';
    const candidates = [
        path.join(process.resourcesPath, 'python-dist', bridgeName),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'python-dist', bridgeName),
        path.join(process.resourcesPath, 'build', 'python-dist', bridgeName),
        path.join(path.dirname(app.getAppPath()), 'app.asar.unpacked', 'build', 'python-dist', bridgeName)
    ];
    return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}
function ensureCourseBridge(event) {
    if (courseLoginProcess && !courseLoginProcess.killed) return courseLoginProcess;
    const scriptPath = path.join(app.getAppPath(), 'main.py');
    const packagedBridge = resolveCourseBridgePath();
    const bridgeCwd = app.isPackaged ? path.dirname(packagedBridge) : path.dirname(scriptPath);
    const bridgeCommand = app.isPackaged
        ? packagedBridge
        : (process.platform === 'win32' ? 'python' : 'python3');
    const bridgeArgs = app.isPackaged ? ['--bridge'] : [scriptPath, '--bridge'];
    const child = spawn(bridgeCommand, bridgeArgs, {
        cwd: bridgeCwd,
        windowsHide: true,
        env: {
            ...process.env,
            COURSE_SYNC_DATA_DIR: path.join(app.getPath('userData'), 'course-sync')
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    courseLoginProcess = child;
    courseLoginOwner = event.sender;
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
        output += chunk;
        const lines = output.split(/\r?\n/);
        output = lines.pop() || '';
        lines.forEach(line => {
            if (!line.startsWith('COURSE_SYNC:')) return;
            try {
                const data = JSON.parse(Buffer.from(line.slice(12), 'base64').toString('utf8'));
                if (courseLoginOwner && !courseLoginOwner.isDestroyed()) courseLoginOwner.send('course-sync-event', data);
            } catch (error) {
                appendStartupLog('Failed to decode course sync event', error);
            }
        });
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => appendStartupLog('Course login helper', String(chunk).trim()));
    child.once('error', error => {
        appendStartupLog(`Failed to start course sync bridge from ${bridgeCommand}`, error);
        courseLoginProcess = null;
        if (courseLoginOwner && !courseLoginOwner.isDestroyed()) courseLoginOwner.send('course-sync-event', { type: 'error', message: `无法启动同步服务：${error.message}` });
    });
    child.once('exit', () => {
        courseLoginProcess = null;
        courseLoginOwner = null;
    });
    return child;
}
function sendCourseBridgeCommand(event, command) {
    const child = ensureCourseBridge(event);
    child.stdin.write(`${JSON.stringify(command)}\n`);
    return { started: true };
}
ipcMain.handle('course-login', (event, credentials) => {
    return sendCourseBridgeCommand(event, { action: 'login', ...(credentials || {}) });
});
ipcMain.handle('course-restore-login', event => {
    return sendCourseBridgeCommand(event, { action: 'restore' });
});
ipcMain.handle('start-course-sync', (event, options) => {
    if (!courseLoginProcess || courseLoginProcess.killed) return { started: false, message: '请先登录' };
    courseLoginProcess.stdin.write(`${JSON.stringify({ action: 'sync', ...(options || {}) })}\n`);
    return { started: true };
});
ipcMain.handle('stop-course-sync', () => {
    if (courseLoginProcess && !courseLoginProcess.killed) courseLoginProcess.stdin.write(`${JSON.stringify({ action: 'stop' })}\n`);
    return { stopped: true };
});
ipcMain.handle('course-logout', () => {
    if (courseLoginProcess && !courseLoginProcess.killed) {
        const child = courseLoginProcess;
        child.stdin.write(`${JSON.stringify({ action: 'logout' })}\n`);
        setTimeout(() => { if (!child.killed) child.kill(); }, 250);
    }
    return { loggedOut: true };
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
        dialog.showErrorBox(`无法启动${APP_NAME}`, `启动失败，请将 startup.log 发给开发者。\n${error.message || error}`);
        app.quit();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
