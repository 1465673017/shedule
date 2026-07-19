const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright');

(async () => {
    const testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebiao-electron-smoke-'));
    const launchEnv = { ...process.env };
    delete launchEnv.ELECTRON_RUN_AS_NODE;
    launchEnv.KEBIAO_E2E_USER_DATA_DIR = testUserDataDir;
    const app = await electron.launch({ args: [path.join(__dirname, '..')], env: launchEnv });
    try {
        const page = await app.firstWindow();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await page.waitForLoadState('domcontentloaded');
        assert.strictEqual(await page.evaluate(() => typeof app), 'object');
        await page.evaluate(() => app.openQuickStartModal());
        assert.notStrictEqual(await page.locator('#quickStartModal').evaluate(element => getComputedStyle(element).display), 'none');
        await page.click('#quickStartModal .modal-close');
        assert.strictEqual(await page.locator('#quickStartModal').evaluate(element => getComputedStyle(element).display), 'none');
        const relevantErrors = errors.filter(text => /content security policy|refused|uncaught|referenceerror|typeerror/i.test(text));
        assert.deepStrictEqual(relevantErrors, []);
        console.log('Electron CSP smoke test passed');
    } finally {
        await app.close();
        fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
