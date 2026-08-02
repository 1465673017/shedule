const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { _electron: electron } = require('playwright');

(async () => {
    const testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oragshedule-electron-smoke-'));
    const launchEnv = { ...process.env };
    delete launchEnv.ELECTRON_RUN_AS_NODE;
    launchEnv.ORAGSCHEDULE_E2E_USER_DATA_DIR = testUserDataDir;
    const app = await electron.launch({
        args: [
            path.join(__dirname, '..'),
            '--oragshedule-disable-gpu',
            '--disable-gpu',
            '--disable-gpu-compositing',
            '--no-sandbox'
        ],
        env: launchEnv
    });
    let page;
    try {
        page = await app.firstWindow();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await page.waitForLoadState('domcontentloaded');
        assert.strictEqual(await page.evaluate(() => typeof app), 'object');
        assert.strictEqual(
            await page.evaluate(() => document.documentElement.dataset.storageSource),
            'sqlite',
            'Electron must initialize the teacher app from SQLite'
        );
        const activeUserDataDir = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
        assert.strictEqual(path.resolve(activeUserDataDir), path.resolve(testUserDataDir));
        const liveDatabase = new DatabaseSync(path.join(activeUserDataDir, 'schedule.sqlite'), { readOnly: true });
        try {
            const liveMarker = liveDatabase.prepare("SELECT value FROM app_metadata WHERE key='migration_completed'").get();
            assert.strictEqual(liveMarker && liveMarker.value, '1', 'migration marker must be durable while Electron is running');
        } finally {
            liveDatabase.close();
        }
        await page.evaluate(() => app.openQuickStartModal());
        assert.notStrictEqual(await page.locator('#quickStartModal').evaluate(element => getComputedStyle(element).display), 'none');
        await page.click('#quickStartModal .modal-close');
        assert.strictEqual(await page.locator('#quickStartModal').evaluate(element => getComputedStyle(element).display), 'none');

        await page.evaluate(() => {
            const cell = document.querySelector('#timetableBody .cell[data-day][data-period]');
            if (!cell) throw new Error('Attendance smoke test could not find a timetable cell');
            app.openAttendanceModal(cell);
        });
        await page.click('#attendanceLessonInfo .actual-duration-display');
        assert.strictEqual(await page.locator('#durationEditorDropdown').count(), 1);
        await page.evaluate(() => app.closeAttendanceModal());

        const relevantErrors = errors.filter(text => /content security policy|refused|uncaught|referenceerror|typeerror/i.test(text));
        assert.deepStrictEqual(relevantErrors, []);
        console.log('Electron CSP smoke test passed');
    } finally {
        if (page && !page.isClosed()) {
            const closed = app.waitForEvent('close');
            await page.close();
            await closed;
        } else {
            await app.close();
        }
        fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
