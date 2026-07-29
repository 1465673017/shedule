const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const packageConfig = JSON.parse(read('package.json'));
assert.strictEqual(
    Object.prototype.hasOwnProperty.call(packageConfig.build, 'electronDist'),
    false,
    'packaging must let electron-builder resolve/download the platform-specific Electron runtime'
);

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
assert.strictEqual(CourseDataImportService.attendanceStatus({}, { attendanceStatus: '上课', actualMinutes: 0 }), 'absent');
assert.strictEqual(CourseDataImportService.attendanceStatus({}, { attendanceStatus: '请假', actualMinutes: 0 }), 'leave');
assert.strictEqual(CourseDataImportService.attendanceStatus({}, { actualHours: 0 }), 'absent');
assert.strictEqual(
    CourseDataImportService.shouldSyncAttendance(
        new Date(2026, 6, 29),
        { endMinutes: 12 * 60 },
        new Date(2026, 6, 29, 12, 1)
    ),
    true
);
assert.strictEqual(
    CourseDataImportService.shouldSyncAttendance(
        new Date(2026, 6, 30),
        { endMinutes: 12 * 60 },
        new Date(2026, 6, 29, 12, 1)
    ),
    false
);
assert.strictEqual(
    CourseDataImportService.shouldSyncAttendance(
        new Date(2026, 6, 29),
        { endMinutes: 14 * 60 },
        new Date(2026, 6, 29, 12, 1)
    ),
    false
);
assert.strictEqual(
    CourseDataImportService.studentActualMinutesForSlot(
        { actualMinutes: 60, actualCourseTime: '10:30-11:30' },
        { startMinutes: 600, endMinutes: 660, overlapMinutes: 60 },
        { durationMinutes: 120 }
    ),
    60
);
const startMapped = CourseDataImportService.periodSlots({
    getOrderedPeriods() {
        return [
            { index: 0, period: { time: '08:00-10:00' } },
            { index: 1, period: { time: '10:30-12:00' } }
        ];
    }
}, { courseTime: '08:30', courseEndTime: '10:30' });
assert.strictEqual(startMapped.slots.length, 1);
assert.strictEqual(startMapped.slots[0].index, 0);

assert.match(read('js/app-course-import.js'), /restoreImportSnapshot/);
const coreSource = read('js/app-core.js');
assert.match(coreSource, /timetableDataBackup/);
assert.match(coreSource, /restoreRuntimeDataSnapshot/);
assert.match(coreSource, /TIMETABLE_BACKUP_INTERVAL_MS = 10 \* 60 \* 1000/);
assert.doesNotMatch(coreSource, /JSON\.parse\(previous\)/);

vm.runInThisContext(read('js/app-export.js'), { filename: 'app-export.js' });
vm.runInThisContext(read('js/app-subjects.js'), { filename: 'app-subjects.js' });
assert.strictEqual(TimetableApp.prototype.sanitizeSpreadsheetText('=1+1'), "'=1+1");
assert.strictEqual(TimetableApp.prototype.sanitizeSpreadsheetText('正常姓名'), '正常姓名');
assert.strictEqual(TimetableApp.prototype.sanitizeSpreadsheetText('-'), '-');
const expandedApp = new TimetableApp();
expandedApp.formatDuration = (hours, minutes) => hours === 0 && minutes === 0
    ? '0h'
    : `${hours}h${minutes}min`;
const leaveDetail = expandedApp.getLessonSheetExpandedRows([{
    dateKey: '2026-07-23',
    subject: '物理',
    time: '08:00-10:00',
    typeLabel: '1v1(0.8)',
    durationMinutes: 120,
    studentDetails: [{ name: '成皓', grade: '九年级', status: 'leave', actualMinutes: 0 }]
}])[0];
assert.strictEqual(leaveDetail.typeLabel, '-');
assert.strictEqual(leaveDetail.actualDuration, '0h');
assert.strictEqual(leaveDetail.isZeroDuration, true);
assert.strictEqual(leaveDetail.isUnderTwoHours, false);
assert.strictEqual(leaveDetail.isOverTwoHours, false);
const zeroDurationDetail = expandedApp.getLessonSheetExpandedRows([{
    dateKey: '2026-07-23',
    subject: '物理',
    time: '08:00-10:00',
    typeLabel: '1v2',
    durationMinutes: 120,
    studentDetails: [{ name: '成皓', grade: '九年级', status: 'present', actualMinutes: 0 }]
}])[0];
assert.strictEqual(zeroDurationDetail.typeLabel, '-');
const originalScheduleErpService = global.ScheduleErpService;
let studentPoolProjectionBuilds = 0;
let studentPoolVersionReads = 0;
global.ScheduleErpService = {
    buildTimetableProjection() {
        studentPoolProjectionBuilds++;
    },
    getCellVersionFromProjection(_app, key) {
        studentPoolVersionReads++;
        return { student: key === 'cell-a' ? ['student-a'] : ['student-b'] };
    }
};
const studentPoolApp = new TimetableApp();
studentPoolApp.currentDate = new Date(2026, 6, 29);
studentPoolApp.erpData = {
    courseInstances: [
        { id: 'instance-a', cellKey: 'cell-a', weekStart: '2026-07-27', studentIds: ['student-a'] },
        { id: 'instance-b', cellKey: 'cell-b', weekStart: '2026-07-27', studentIds: ['student-b'] }
    ],
    studentCourseRelations: [
        { courseInstanceId: 'instance-a', studentId: 'student-a', relationStatus: 'recurring' },
        { courseInstanceId: 'instance-b', studentId: 'student-b', relationStatus: 'temporary' }
    ]
};
studentPoolApp.getWeekRange = date => ({ start: date });
studentPoolApp.formatLocalDate = () => '2026-07-27';
const studentPoolSets = studentPoolApp.getStudentPoolStatusSets();
assert.strictEqual(studentPoolProjectionBuilds, 1);
assert.strictEqual(studentPoolVersionReads, 2);
assert.deepStrictEqual([...studentPoolSets.ongoingStudentIds].sort(), ['student-a', 'student-b']);
global.ScheduleErpService = originalScheduleErpService;
const shortDetail = expandedApp.getLessonSheetExpandedRows([{
    dateKey: '2026-07-23',
    subject: '物理',
    time: '08:00-10:00',
    typeLabel: '1v1(0.8)',
    durationMinutes: 80,
    studentDetails: [{ name: '成皓', grade: '九年级', status: 'present', actualMinutes: 80 }]
}])[0];
assert.strictEqual(shortDetail.isZeroDuration, false);
assert.strictEqual(shortDetail.isUnderTwoHours, true);
assert.strictEqual(shortDetail.isOverTwoHours, false);
const lessonRowsApp = new TimetableApp();
lessonRowsApp.erpData = { courseInstances: [] };
lessonRowsApp.collectLessonsForDate = () => [{
    subject: '物理',
    period: 0,
    time: '08:00-10:00',
    dates: ['2026-07-23'],
    students: [{ name: '成皓', grade: '九年级', status: 'present', actualMinutes: 80 }],
    studentCount: 1,
    leaveCount: 0,
    absentCount: 0
}];
lessonRowsApp.formatLocalDate = date => date.toISOString().slice(0, 10);
lessonRowsApp.getLessonActualMinutesForStats = () => 120;
lessonRowsApp.getLessonDurationMinutesForStats = () => 120;
lessonRowsApp.getLessonPeriodLabel = () => '上午';
lessonRowsApp.getPeriodNumber = () => 1;
lessonRowsApp.getLessonTypeKeyForStats = () => '1v1(0.8)';
lessonRowsApp.formatDuration = expandedApp.formatDuration;
const actualDurationRow = lessonRowsApp.getLessonSheetRowsByRange(
    new Date('2026-07-23T00:00:00'),
    new Date('2026-07-23T00:00:00')
)[0];
assert.strictEqual(actualDurationRow.durationMinutes, 80);
assert.strictEqual(actualDurationRow.actualDuration, '1h20min');
const summaryApp = new TimetableApp();
summaryApp.formatLocalDate = date => date.toISOString().slice(0, 10);
summaryApp.getLessonSegmentTypeStats = lesson => {
    assert.deepStrictEqual(lesson.students.map(student => student.actualMinutes), [75, 75]);
    return { typeStats: { '1v2': 75 }, totalMinutes: 75 };
};
const summary = summaryApp.getLessonSheetSummaryMatrix([{
    dateKey: '2026-07-01',
    durationMinutes: 120,
    typeLabel: '1v2',
    studentDetails: [
        { name: '学生甲', grade: '七年级', status: 'present', actualMinutes: 75 },
        { name: '学生乙', grade: '七年级', status: 'present', actualMinutes: 75 }
    ]
}]);
assert.strictEqual(summary.totalValues[1], '1.25');

console.log('Security regression tests passed');
