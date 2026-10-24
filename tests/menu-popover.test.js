// 菜单按钮弹出菜单回归测试：验证弹出菜单可见、以按钮为右上角锚定、菜单项可用、可正常关闭。
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright');

(async () => {
    const testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebiao-menu-test-'));
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
        await page.waitForTimeout(800);

        // 点击前不应存在弹出菜单
        assert.strictEqual(await page.locator('#appMenuPopover').count(), 0);

        // 点击菜单按钮 → 弹出菜单出现且可见
        const buttonBox = await page.locator('.menu-trigger').boundingBox();
        await page.click('.menu-trigger');
        const popover = page.locator('#appMenuPopover');
        await popover.waitFor({ state: 'visible', timeout: 3000 });
        assert.strictEqual(await popover.getAttribute('role'), 'menu');
        assert.strictEqual(await popover.locator('.app-menu-item').count(), 2);
        assert.deepStrictEqual(await popover.locator('.app-menu-item').evaluateAll(items => items.map(item => item.getAttribute('aria-label'))), ['课时统计', '添加导航']);
        assert.strictEqual(await page.locator('.menu-trigger').getAttribute('aria-expanded'), 'true');

        // 锚定：菜单按钮位于弹出窗口右上角（右边缘对齐、紧贴按钮下方）
        const popoverBox = await popover.boundingBox();
        assert.ok(Math.abs(popoverBox.x + popoverBox.width - (buttonBox.x + buttonBox.width)) <= 1, '右边缘应对齐按钮右边缘');
        assert.ok(Math.abs(popoverBox.y - (buttonBox.y + buttonBox.height + 8)) <= 1, '顶部应位于按钮下方 8px');
        assert.ok(popoverBox.width >= 350 && popoverBox.width <= 370 && popoverBox.height >= 250 && popoverBox.height <= 290, '仅保留一个菜单项');
        const itemBoxes = await popover.locator('.app-menu-item').evaluateAll(items => items.map(item => {
            const rect = item.getBoundingClientRect();
            return { width: rect.width, height: rect.height, direction: getComputedStyle(items[0]).flexDirection };
        }));
        assert.ok(itemBoxes.every(box => box.width >= 78 && box.width <= 82 && box.height >= 78 && box.height <= 82 && box.direction === 'column'), '菜单项图标和文字应纵向排列');

        // 点击菜单项 → 菜单关闭并打开课时统计弹窗
        await page.click('.app-menu-item:has-text("课时统计")');
        assert.strictEqual(await page.locator('#appMenuPopover').count(), 0);
        assert.strictEqual(await page.locator('#statsModal').evaluate(el => getComputedStyle(el).display), 'block');
        await page.evaluate(() => app.closeStatsModal());

        // 再次点击按钮打开，Esc 关闭
        await page.click('.menu-trigger');
        await popover.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert.strictEqual(await page.locator('#appMenuPopover').count(), 0);

        // 打开后点击外部区域关闭
        await page.click('.menu-trigger');
        await popover.waitFor({ state: 'visible' });
        await page.click('.electron-app-brand');
        assert.strictEqual(await page.locator('#appMenuPopover').count(), 0);

        // 不应有 CSP 拦截或页面脚本错误
        const relevantErrors = errors.filter(text => /content security policy|refused|uncaught|referenceerror|typeerror/i.test(text));
        assert.deepStrictEqual(relevantErrors, []);
        console.log('Menu popover test passed');
    } finally {
        await app.close();
        fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
