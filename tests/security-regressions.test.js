const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const mainSource = read('main.js');
assert.match(mainSource, /setWindowOpenHandler/);
assert.match(mainSource, /action:\s*'deny'/);
assert.doesNotMatch(mainSource, /action:\s*'allow'/);
assert.match(mainSource, /will-navigate/);
assert.match(mainSource, /50 \* 1024 \* 1024/);
assert.match(mainSource, /APP_NAME = 'A大橙子课时统计定制版'/);
assert.match(mainSource, /path\.join\(appDataPath, APP_NAME\)/);
assert.doesNotMatch(mainSource, /LEGACY_APP_NAME|migrateLegacyUserDataDirectory/);
assert.match(mainSource, /\.kebiao-portable/);
assert.match(mainSource, /path\.join\(portableRoot, 'data'\)/);
assert.match(mainSource, /portableUserDataPath \|\| customUserDataPath/);
assert.match(mainSource, /build',\s*'python-dist'/);
assert.match(mainSource, /resourcesPath,\s*'python-dist'/);
assert.match(mainSource, /course-sync-bridge\.exe/);
assert.match(mainSource, /app\.asar\.unpacked/);
assert.match(mainSource, /resolveCourseBridgePath/);
assert.match(mainSource, /const bridgeCwd = app\.isPackaged \? path\.dirname\(packagedBridge\) : path\.dirname\(scriptPath\)/);
assert.doesNotMatch(mainSource, /spawn\(bridgeCommand, bridgeArgs, \{\s*cwd: path\.dirname\(scriptPath\)/s);
assert.match(mainSource, /COURSE_SYNC_DATA_DIR/);
const indexSource = read('index.html');
const macScreenshotSource = read('tests/macos-screenshots.js');
assert.match(macScreenshotSource, /name: 'salary-settings'/);
assert.match(macScreenshotSource, /app\.openSalarySettings\(\)/);
assert.match(macScreenshotSource, /name: 'salary-rule'/);
assert.match(macScreenshotSource, /app\.openSalaryRuleModal\(\)/);
assert.match(macScreenshotSource, /content\.scrollHeight/);
assert.match(indexSource, /Content-Security-Policy/);
assert.match(indexSource, /connect-src 'none'/);
assert.match(indexSource, /script-src 'self';/);
assert.doesNotMatch(indexSource, /script-src[^;]*unsafe-inline/);
assert.doesNotMatch(indexSource, /\son(?:click|input|change|submit|mousedown|keydown)=/);

const courseSource = read('js/app-courses.js');
assert.doesNotMatch(courseSource, /<span class="sc-name">\$\{student\.name\}/);
assert.doesNotMatch(courseSource, /<span class="sc-name">\$\{subject\.name\}/);
for (const file of fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js'))) {
    assert.doesNotMatch(read(path.join('js', file)), /\son(?:click|input|change|submit|mousedown|keydown)=/, `${file} must not create inline handlers`);
}

global.window = global;
global.TimetableApp = function TimetableApp() {};
vm.runInThisContext(read('js/app-course-import.js'), { filename: 'app-course-import.js' });
assert.throws(
    () => CourseDataImportService.buildImportPlan({}, [{ courseDate: '2026-02-31', students: [] }]),
    /日期/
);
assert.strictEqual(CourseDataImportService.attendanceStatus({}, { attendanceStatus: '上课' }), 'present');
assert.strictEqual(CourseDataImportService.attendanceStatus({}, { attendanceStatus: '未上课' }), 'absent');
assert.strictEqual(CourseDataImportService.attendanceStatus({}, { isLeave: true, attendanceStatus: '未上课' }), 'leave');
assert.strictEqual(CourseDataImportService.sourceActualMinutes({ actualMinutes: 75 }), 75);
assert.strictEqual(CourseDataImportService.sourceActualMinutes({ actualHours: 1.5 }), 90);
assert.strictEqual(
    CourseDataImportService.studentActualMinutesForSlot(
        { actualMinutes: 60, actualCourseTime: '10:30-11:30' },
        { startMinutes: 600, endMinutes: 660, overlapMinutes: 60 },
        { durationMinutes: 120 }
    ),
    30
);

assert.match(read('js/app-course-import.js'), /restoreImportSnapshot/);
const coreSource = read('js/app-core.js');
assert.match(coreSource, /timetableDataBackup/);
assert.match(coreSource, /restoreRuntimeDataSnapshot/);
assert.match(coreSource, /TIMETABLE_BACKUP_INTERVAL_MS = 10 \* 60 \* 1000/);
assert.doesNotMatch(coreSource, /JSON\.parse\(previous\)/);

vm.runInThisContext(read('js/app-export.js'), { filename: 'app-export.js' });
assert.strictEqual(TimetableApp.prototype.sanitizeSpreadsheetText('=1+1'), "'=1+1");
assert.strictEqual(TimetableApp.prototype.sanitizeSpreadsheetText('正常姓名'), '正常姓名');

console.log('Security regression tests passed');
