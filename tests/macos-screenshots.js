const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(process.env.SCREENSHOT_DIR || path.join(rootDir, 'artifacts', 'macos-screenshots'));
const themes = ['default', 'dark', 'mint'];
const views = [
    { name: 'main', title: '主界面', action: 'main' },
    { name: 'subject-add', title: '添加科目', action: 'subject' },
    { name: 'student-add', title: '添加学生', action: 'student' },
    { name: 'student-batch', title: '批量添加学生', action: 'studentBatch' },
    { name: 'course-import', title: '批量导入课程', action: 'courseImport' },
    { name: 'period-edit', title: '编辑课时时间', action: 'time' },
    { name: 'lesson-add', title: '添加课程', action: 'lesson' },
    { name: 'course-manual', title: '手动添加课程', action: 'manualCourse' },
    { name: 'attendance', title: '出勤记录', action: 'attendance' },
    ...['day', 'week', 'month', 'year'].map(tab => ({
        name: `stats-chart-${tab}`, title: `图表统计-${tab}`, action: 'statsChart', arg: tab
    })),
    ...['day', 'week', 'month', 'year'].map(tab => ({
        name: `stats-text-${tab}`, title: `文字统计-${tab}`, action: 'statsText', arg: tab
    })),
    ...['theme', 'grade', 'stage', 'time'].map(tab => ({
        name: `settings-${tab}`, title: `设置-${tab}`, action: 'settings', arg: tab
    })),
    { name: 'grade-add', title: '添加年级', action: 'grade' },
    { name: 'reset', title: '重置数据', action: 'reset' },
    { name: 'export', title: '导出数据', action: 'export' },
    { name: 'quick-start', title: '快速开始', action: 'quickStart' },
    { name: 'message', title: '应用消息', action: 'message' }
];

async function prepareView(page, view) {
    await page.evaluate(({ action, arg }) => {
        document.querySelectorAll('.modal').forEach(modal => { modal.style.display = 'none'; });
        document.querySelectorAll('*').forEach(element => {
            element.getAnimations().forEach(animation => animation.finish());
        });

        const show = (id, display = 'block') => {
            const element = document.getElementById(id);
            if (element) element.style.display = display;
        };
        const safely = (callback, fallbackId, display) => {
            try { callback(); } catch (error) {
                console.warn(`Screenshot setup fallback for ${fallbackId}:`, error);
                show(fallbackId, display);
            }
        };

        switch (action) {
        case 'main':
            break;
        case 'subject':
            safely(() => app.openSubjectModal(), 'subjectModal', 'flex');
            break;
        case 'student':
            safely(() => app.openStudentModal(), 'subjectModal', 'flex');
            break;
        case 'studentBatch':
            safely(() => app.openStudentBatchModal(), 'studentBatchModal', 'flex');
            break;
        case 'courseImport':
            safely(() => app.openCourseDataImportModal(), 'courseDataImportModal', 'flex');
            break;
        case 'time':
            safely(() => app.openTimeModal(null, 0), 'timeModal', 'flex');
            break;
        case 'lesson':
            safely(() => app.openAddLessonModal(document.querySelector('.cell')), 'addLessonModal', 'flex');
            break;
        case 'manualCourse':
            safely(() => app.openManualCourseModal(), 'addLessonModal', 'flex');
            break;
        case 'attendance':
            safely(() => app.openAttendanceModal(document.querySelector('.cell')), 'attendanceModal', 'flex');
            break;
        case 'statsChart':
            safely(() => {
                app.openStatsModal(new Date());
                app.switchStatsTab(arg);
            }, 'statsModal', 'block');
            break;
        case 'statsText':
            safely(() => {
                app.openTextStatsModal(new Date());
                app.switchTextStatsTab(arg);
            }, 'textStatsModal', 'block');
            break;
        case 'settings':
            safely(() => app.openSettingsModal(arg), 'settingsModal', 'block');
            break;
        case 'grade':
            safely(() => app.addGrade(), 'gradeModal', 'block');
            break;
        case 'reset':
            safely(() => app.openResetModal(), 'resetModal', 'block');
            break;
        case 'export':
            safely(() => app.openExportModal(), 'exportModal', 'block');
            break;
        case 'quickStart':
            safely(() => app.openQuickStartModal(), 'quickStartModal', 'flex');
            break;
        case 'message': {
            const title = document.getElementById('appMessageTitle');
            const text = document.getElementById('appMessageText');
            if (title) title.textContent = '操作提示';
            if (text) text.textContent = '这是 macOS 自动化截图使用的消息弹窗示例。';
            show('appMessageModal', 'flex');
            break;
        }
        }
    }, view);
    await page.waitForTimeout(250);
}

(async () => {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const appProcess = await electron.launch({ args: [rootDir] });
    const page = await appProcess.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof app !== 'undefined' && app && document.querySelector('.timetable'));
    await page.evaluate(() => localStorage.removeItem('timetableSettings'));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });

    const manifest = [];
    try {
        for (const theme of themes) {
            await page.evaluate(selectedTheme => app.applyPredefinedTheme(selectedTheme), theme);
            await page.waitForTimeout(150);

            for (const view of views) {
                await prepareView(page, view);
                const relativePath = path.join(theme, `${view.name}.png`);
                const screenshotPath = path.join(outputDir, relativePath);
                fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
                await page.screenshot({ path: screenshotPath, animations: 'disabled' });
                manifest.push({ theme, view: view.name, title: view.title, file: relativePath.replace(/\\/g, '/') });
                console.log(`Captured ${theme}/${view.name}`);
            }
        }
    } finally {
        await appProcess.close();
    }

    fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify({
        platform: process.platform,
        generatedAt: new Date().toISOString(),
        count: manifest.length,
        screenshots: manifest
    }, null, 2));
    console.log(`Created ${manifest.length} screenshots in ${outputDir}`);
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
