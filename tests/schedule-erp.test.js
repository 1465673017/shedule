const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.window = global;

const erpSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-erp.js'), 'utf8');
vm.runInThisContext(erpSource, { filename: 'app-erp.js' });
global.TimetableApp = function TimetableApp() {};
const attendanceSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-attendance.js'), 'utf8');
vm.runInThisContext(attendanceSource, { filename: 'app-attendance.js' });
const statsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-stats.js'), 'utf8');
vm.runInThisContext(statsSource, { filename: 'app-stats.js' });
const exportSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-export.js'), 'utf8');
vm.runInThisContext(exportSource, { filename: 'app-export.js' });

function makeApp() {
    return {
        erpData: createEmptyErpData(),
        students: [
            { id: 's1', name: 'Alice' },
            { id: 's2', name: 'Bob' }
        ],
        subjects: [{ id: 'math', name: 'Math', color: '#fff' }],
        periods: {
            afternoon: [{ name: 'P1', time: '16:00-17:00' }]
        },
        timetable: {},
        getWeekRange(date) {
            const d = new Date(date);
            const day = d.getDay();
            const diff = day === 0 ? 6 : day - 1;
            const start = new Date(d);
            start.setDate(d.getDate() - diff);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { start, end };
        },
        formatLocalDate(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        },
        getPeriod(periodIndex) {
            return this.periods.afternoon[periodIndex] || null;
        },
        ensureUncategorizedSubject() {
            let subject = this.subjects.find(s => s && s.name === '未分类');
            if (!subject) {
                subject = { id: 'uncategorized', name: '未分类', color: '#94a3b8' };
                this.subjects.push(subject);
            }
            return subject;
        }
    };
}

function studentIds(version) {
    return version ? version.student.slice().sort() : [];
}

const statsAttendanceDateApp = makeApp();
ScheduleErpService.setCellVersion(statsAttendanceDateApp, '3-afternoon-0', '2026-07-06', 'math', ['s1']);
statsAttendanceDateApp.currentDate = new Date(2026, 6, 22);
statsAttendanceDateApp.isHistoricalDateProtected = () => false;
statsAttendanceDateApp.getAttendanceDateKeyForCell = () => '2026-07-22';
statsAttendanceDateApp.saveData = () => {};
TimetableApp.prototype.setAttendanceStatus.call(
    statsAttendanceDateApp,
    '3-afternoon-0',
    's1',
    'leave',
    { dateKey: '2026-07-08', refreshStats: false }
);
assert.strictEqual(
    statsAttendanceDateApp.erpData.attendanceRecords[0].dateKey,
    '2026-07-08',
    'attendance edited from statistics must be stored against the viewed lesson date'
);

const syncedZeroMinutesApp = makeApp();
ScheduleErpService.setCellVersion(
    syncedZeroMinutesApp, '3-afternoon-0', '2026-07-06', 'math', ['s1'],
    { source: 'course-import' }
);
const syncedZeroInstance = syncedZeroMinutesApp.erpData.courseInstances[0];
syncedZeroInstance.actualMinutesByDate = { '2026-07-08': 0 };
syncedZeroInstance.studentActualMinutesByDate = { '2026-07-08': { s1: 0 } };
syncedZeroMinutesApp.currentDate = new Date(2026, 6, 8);
syncedZeroMinutesApp.isHistoricalDateProtected = () => false;
syncedZeroMinutesApp.getAttendanceDateKeyForCell = () => '2026-07-08';
syncedZeroMinutesApp.parseCellKey = () => ({ day: 3, periodIndex: 0 });
syncedZeroMinutesApp.getPeriod = () => ({ time: '16:00-17:00' });
syncedZeroMinutesApp.timeToMinutes = value => {
    const [hours, minutes] = value.trim().split(':').map(Number);
    return hours * 60 + minutes;
};
syncedZeroMinutesApp.getCellVersion = (key, weekStart) =>
    ScheduleErpService.getCellVersion(syncedZeroMinutesApp, key, weekStart);
syncedZeroMinutesApp.saveData = () => {};
syncedZeroMinutesApp.restoreSyncedZeroMinutesForPresent =
    TimetableApp.prototype.restoreSyncedZeroMinutesForPresent;
TimetableApp.prototype.setAttendanceStatus.call(
    syncedZeroMinutesApp, '3-afternoon-0', 's1', 'present',
    { dateKey: '2026-07-08', refreshStats: false }
);
assert.strictEqual(syncedZeroInstance.actualMinutesByDate['2026-07-08'], 60);
assert.strictEqual(syncedZeroInstance.studentActualMinutesByDate['2026-07-08'].s1, 60);
assert.strictEqual(syncedZeroInstance.manualActualMinutesByDate['2026-07-08'], true);
assert.strictEqual(syncedZeroInstance.manualStudentActualMinutesByDate['2026-07-08'].s1, true);
ScheduleErpService.setCellVersion(
    syncedZeroMinutesApp, '3-afternoon-0', '2026-07-06', 'math', ['s1'],
    { source: 'course-import' }
);
const rebuiltSyncedInstance = syncedZeroMinutesApp.erpData.courseInstances.find(
    instance => instance.cellKey === '3-afternoon-0' && instance.weekStart === '2026-07-06'
);
assert.strictEqual(
    rebuiltSyncedInstance.studentActualMinutesByDate['2026-07-08'].s1,
    60,
    'rebuilding an imported course must retain locally confirmed actual minutes'
);
assert.strictEqual(rebuiltSyncedInstance.manualStudentActualMinutesByDate['2026-07-08'].s1, true);

const singleStudentEditApp = makeApp();
ScheduleErpService.setCellVersion(singleStudentEditApp, '2-afternoon-0', '2026-07-06', 'math', ['s1', 's2']);
ScheduleErpService.setSingleCellOccurrence(singleStudentEditApp, '2-afternoon-0', '2026-07-13', 'math', ['s1']);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleStudentEditApp, '2-afternoon-0', '2026-07-13')),
    ['s1'],
    'removing a student should affect only the selected lesson'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleStudentEditApp, '2-afternoon-0', '2026-07-20')),
    ['s1', 's2'],
    'the original student roster should resume on the following recurring lesson'
);
ScheduleErpService.setSingleCellOccurrence(singleStudentEditApp, '2-afternoon-0', '2026-07-20', 'math', ['s1', 's2', 's3']);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleStudentEditApp, '2-afternoon-0', '2026-07-20')),
    ['s1', 's2', 's3'],
    'adding a student should affect only the selected lesson'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleStudentEditApp, '2-afternoon-0', '2026-07-27')),
    ['s1', 's2'],
    'a student added to one lesson must not enter later recurring lessons'
);

const isolatedStudentAddApp = makeApp();
ScheduleErpService.setSingleCellOccurrence(isolatedStudentAddApp, '3-afternoon-0', '2026-07-13', 'math', ['s2']);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(isolatedStudentAddApp, '3-afternoon-0', '2026-07-13')),
    ['s2'],
    'adding a student to an empty cell should create the selected lesson'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(isolatedStudentAddApp, '3-afternoon-0', '2026-07-20'),
    null,
    'an isolated student addition should not create a new weekly recurrence'
);

const segmentedApp = makeApp();
segmentedApp.settings = {
    segmentedScheduling: true,
    stages: [
        { id: 'stage-1', startDate: '2026-01-01', endDate: '2026-03-31' },
        { id: 'stage-2', startDate: '2026-04-01', endDate: '2026-06-30' }
    ]
};
ScheduleErpService.setCellVersion(segmentedApp, '2-afternoon-0', '2026-03-23', 'math', ['s1']);
assert.ok(
    ScheduleErpService.getCellVersion(segmentedApp, '2-afternoon-0', '2026-03-23'),
    'a recurring course should remain visible through its stage end date'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(segmentedApp, '2-afternoon-0', '2026-04-06'),
    null,
    'a recurring course should automatically end when its next occurrence is after the stage end date'
);
ScheduleErpService.setCellVersion(segmentedApp, '2-afternoon-0', '2026-04-06', 'math', ['s2']);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(segmentedApp, '2-afternoon-0', '2026-04-13')),
    ['s2'],
    'an explicitly added course in the next stage should start a new stage-bounded recurrence'
);

const stageEndDayApp = makeApp();
stageEndDayApp.settings = {
    segmentedScheduling: true,
    stages: [{ id: 'stage-1', startDate: '2026-03-01', endDate: '2026-03-31' }]
};
ScheduleErpService.setCellVersion(stageEndDayApp, '2-afternoon-0', '2026-03-23', 'math', ['s1']);
assert.ok(
    ScheduleErpService.getCellVersion(stageEndDayApp, '2-afternoon-0', '2026-03-30'),
    'a course occurring exactly on the final stage day should still be included'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(stageEndDayApp, '2-afternoon-0', '2026-04-06'),
    null,
    'the same course should be completed after the final stage day'
);
assert.strictEqual(
    ScheduleErpService.completeStudentsForEndedStages(stageEndDayApp, new Date(2026, 2, 30)),
    false,
    'students should remain stopped rather than completed before the stage end date'
);
assert.strictEqual(stageEndDayApp.students[0].completed, undefined);
assert.strictEqual(
    ScheduleErpService.completeStudentsForEndedStages(stageEndDayApp, new Date(2026, 2, 31)),
    true,
    'all regular students in the stage should become completed on its final day'
);
assert.strictEqual(stageEndDayApp.students[0].completed, true);
assert.strictEqual(stageEndDayApp.students[0].accountStatus, 'completed');
const finalStageVersion = ScheduleErpService.getCellVersion(stageEndDayApp, '2-afternoon-0', '2026-03-30');
assert.strictEqual(
    ScheduleErpService.isStageFinalOccurrence(stageEndDayApp, finalStageVersion, '2026-03-30'),
    true,
    'the last actual weekly occurrence before the stage boundary should be the completed lesson'
);
assert.strictEqual(
    ScheduleErpService.isStageFinalOccurrence(stageEndDayApp, finalStageVersion, '2026-03-23'),
    false,
    'earlier backfilled lessons in the same stage should remain recurring'
);
assert.deepStrictEqual(
    stageEndDayApp.erpData.stageCompletionRecords,
    [{ key: 'stage-1|2026-03-31', studentIds: ['s1'], processedStudentIds: ['s1'] }],
    'stage completion should record only students completed automatically'
);
stageEndDayApp.students[0].completed = false;
stageEndDayApp.students[0].accountStatus = 'normal';
stageEndDayApp.erpData.stageCompletionRecords[0].studentIds = [];
stageEndDayApp.erpData.manualStageCompletionOverrides = ['s1'];
assert.strictEqual(
    ScheduleErpService.completeStudentsForEndedStages(stageEndDayApp, new Date(2026, 3, 1)),
    true,
    'manual reactivation should synchronize relation accounts without re-completing the student'
);
assert.strictEqual(stageEndDayApp.students[0].completed, false);

const nonSegmentedCompletedApp = makeApp();
nonSegmentedCompletedApp.settings = { segmentedScheduling: false, stages: [] };
nonSegmentedCompletedApp.students[0].completed = true;
ScheduleErpService.setCellVersion(nonSegmentedCompletedApp, '1-afternoon-0', '2026-03-02', 'math', ['s1']);
assert.strictEqual(
    nonSegmentedCompletedApp.erpData.studentCourseRelations[0].relationStatus,
    'temporary',
    'without segmented scheduling, adding a completed student should keep the original temporary-course behavior'
);

const segmentedCompletedApp = makeApp();
segmentedCompletedApp.settings = {
    segmentedScheduling: true,
    stages: [{ id: 'past-stage', startDate: '2026-03-01', endDate: '2026-03-31' }]
};
segmentedCompletedApp.students[0].completed = true;
ScheduleErpService.setCellVersion(segmentedCompletedApp, '1-afternoon-0', '2026-03-02', 'math', ['s1']);
assert.strictEqual(
    segmentedCompletedApp.erpData.studentCourseRelations[0].relationStatus,
    'recurring',
    'with segmented scheduling, a completed student added to a past stage should be backfilled as recurring'
);

const lateBackfillApp = makeApp();
lateBackfillApp.settings = {
    segmentedScheduling: true,
    stages: [{ id: 'past-stage', startDate: '2026-03-01', endDate: '2026-03-31' }]
};
ScheduleErpService.setCellVersion(lateBackfillApp, '1-afternoon-0', '2026-03-02', 'math', ['s1']);
ScheduleErpService.completeStudentsForEndedStages(lateBackfillApp, new Date(2026, 2, 31));
ScheduleErpService.setCellVersion(lateBackfillApp, '2-afternoon-0', '2026-03-02', 'math', ['s2']);
ScheduleErpService.completeStudentsForEndedStages(lateBackfillApp, new Date(2026, 3, 1));
assert.strictEqual(lateBackfillApp.students[1].completed, true, 'a student backfilled after the stage was processed should also complete');

const laterStageApp = makeApp();
laterStageApp.settings = {
    segmentedScheduling: true,
    stages: [
        { id: 'stage-1', startDate: '2026-03-01', endDate: '2026-03-31' },
        { id: 'stage-2', startDate: '2026-04-01', endDate: '2026-04-30' }
    ]
};
ScheduleErpService.setCellVersion(laterStageApp, '1-afternoon-0', '2026-03-02', 'math', ['s1']);
ScheduleErpService.setCellVersion(laterStageApp, '2-afternoon-0', '2026-04-06', 'math', ['s1']);
ScheduleErpService.completeStudentsForEndedStages(laterStageApp, new Date(2026, 2, 31));
assert.notStrictEqual(laterStageApp.students[0].completed, true, 'a later-stage course should keep the student in the ongoing pool');
laterStageApp.erpData.courseInstances = laterStageApp.erpData.courseInstances.filter(instance => instance.weekStart !== '2026-04-06');
ScheduleErpService.completeStudentsForEndedStages(laterStageApp, new Date(2026, 2, 31));
assert.strictEqual(laterStageApp.students[0].completed, true, 'removing the later-stage course should recalculate the student as completed');

const modeSnapshotApp = makeApp();
modeSnapshotApp.settings = {
    segmentedScheduling: true,
    stages: [{ id: 'snapshot-stage', startDate: '2026-03-01', endDate: '2026-03-31' }]
};
ScheduleErpService.setCellVersion(modeSnapshotApp, '1-afternoon-0', '2026-03-02', 'math', ['s1']);
modeSnapshotApp.settings.segmentedScheduling = false;
assert.strictEqual(
    ScheduleErpService.getCellVersion(modeSnapshotApp, '1-afternoon-0', '2026-04-06'),
    null,
    'a segmented course should retain its stage boundary after the global setting is disabled'
);
const continuousSnapshotApp = makeApp();
continuousSnapshotApp.settings = { segmentedScheduling: false, stages: [] };
ScheduleErpService.setCellVersion(continuousSnapshotApp, '1-afternoon-0', '2026-03-02', 'math', ['s1']);
continuousSnapshotApp.settings = {
    segmentedScheduling: true,
    stages: [{ id: 'later-setting', startDate: '2026-03-01', endDate: '2026-03-31' }]
};
assert.ok(
    ScheduleErpService.getCellVersion(continuousSnapshotApp, '1-afternoon-0', '2026-04-06'),
    'a continuous course should not be retroactively segmented when the setting is enabled later'
);

const app = makeApp();
ScheduleErpService.setCellVersion(app, '3-afternoon-0', '2026-07-06', 'math', ['s1', 's2']);

assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-06')),
    ['s1', 's2'],
    'initial course should contain both students'
);

ScheduleErpService.setRecurrenceStatus(app, '3-afternoon-0', 's2', 'temporary', '2026-07-06');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-06')),
    ['s1', 's2'],
    'temporary student should remain in the selected week'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-13')),
    ['s1'],
    'temporary student should not appear in following weeks'
);
ScheduleErpService.setRecurrenceStatus(app, '3-afternoon-0', 's2', 'recurring', '2026-07-06');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-13')),
    ['s1', 's2'],
    'temporary student should reappear in following weeks after switching back to recurring'
);

ScheduleErpService.setRecurrenceStatus(app, '3-afternoon-0', 's1', 'stopped', '2026-07-06');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-06')),
    ['s1', 's2'],
    'stopped recurring student should remain in the current week'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-13')),
    ['s2'],
    'paused student should be removed while other recurring students remain'
);
ScheduleErpService.setRecurrenceStatus(app, '3-afternoon-0', 's1', 'recurring', '2026-07-06');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-13')),
    ['s1', 's2'],
    'paused student should reappear after switching back to recurring'
);
assert.strictEqual(
    app.erpData.exceptionRules.some(rule =>
        rule.courseInstanceId === ScheduleErpService.getCellVersion(app, '3-afternoon-0', '2026-07-06').courseInstanceId &&
        rule.studentId === 's1' &&
        rule.type === 'pause-student' &&
        rule.weekStart >= '2026-07-13'
    ),
    false,
    'switching back to recurring should clear future pause rules for that student'
);

const appRecurring = makeApp();
ScheduleErpService.setCellVersion(appRecurring, '3-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.setRecurrenceStatus(appRecurring, '3-afternoon-0', 's1', 'temporary', '2026-07-06');
ScheduleErpService.setRecurrenceStatus(appRecurring, '3-afternoon-0', 's1', 'recurring', '2026-07-06');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(appRecurring, '3-afternoon-0', '2026-07-13')),
    ['s1'],
    'a student switched back to recurring should continue into following weeks'
);
assert.strictEqual(
    appRecurring.erpData.exceptionRules.some(rule =>
        rule.studentId === 's1' &&
        rule.type === 'temporary-student' &&
        rule.weekStart >= '2026-07-06'
    ),
    false,
    'switching back to recurring should clear temporary rules for that student'
);

const app2 = makeApp();
ScheduleErpService.setCellVersion(app2, '3-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.completeStudentFromWeek(app2, '3-afternoon-0', 's1', '2026-07-13');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app2, '3-afternoon-0', '2026-07-06')),
    ['s1'],
    'completed student should remain before completion week'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(app2, '3-afternoon-0', '2026-07-13'),
    null,
    'completed student should be filtered from completion week onward'
);

const app3 = makeApp();
ScheduleErpService.setCellVersion(app3, '3-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.deleteCourseInstancesBySignature(app3, 'math', ['s1']);
assert.strictEqual(
    ScheduleErpService.getCellVersion(app3, '3-afternoon-0', '2026-07-06'),
    null,
    'deleted course signature should no longer be projected'
);
ScheduleErpService.archiveCourseTemplate(app3, 'math', ['s1']);
let archivedTemplate = app3.erpData.courseTemplates.find(t => t.subjectId === 'math');
assert.strictEqual(archivedTemplate.archived, true, 'template should be archived after archive call');
ScheduleErpService.upsertCourseTemplate(app3, 'math', ['s1'], 'manual');
archivedTemplate = app3.erpData.courseTemplates.find(t => t.subjectId === 'math');
assert.strictEqual(archivedTemplate.archived, false, 're-adding a template should unarchive it');

const app4 = makeApp();
ScheduleErpService.setCellVersion(app4, '3-afternoon-0', '2026-07-06', 'math', ['s1', 's2']);
app4.currentDate = new Date(2026, 6, 8);
ScheduleErpService.upsertAttendance(app4, '3-afternoon-0', 's1', 'present', '2026-07-08');
assert.strictEqual(app4.erpData.attendanceRecords[0].source, 'manual');
ScheduleErpService.upsertAttendance(
    app4, '3-afternoon-0', 's1', 'absent', '2026-07-08',
    { source: 'course-sync', preserveManual: true }
);
assert.strictEqual(
    app4.erpData.attendanceRecords[0].status,
    'present',
    'automatic sync should preserve manually edited attendance'
);
ScheduleErpService.upsertAttendance(
    app4, '3-afternoon-0', 's1', 'absent', '2026-07-08',
    { source: 'course-sync', preserveManual: false }
);
assert.strictEqual(
    app4.erpData.attendanceRecords[0].status,
    'absent',
    'confirmed manual sync overwrite should replace manually edited attendance'
);
ScheduleErpService.removeStudentEverywhere(app4, 's1');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app4, '3-afternoon-0', '2026-07-06')),
    ['s2'],
    'removing one student should preserve the remaining students in the course instance'
);
assert.strictEqual(
    app4.erpData.attendanceRecords.some(record => record.studentId === 's1'),
    false,
    'removing a student should also remove their ERP attendance records'
);
assert.strictEqual(
    app4.erpData.courseTemplates.some(template => template.defaultStudentIds.includes('s1')),
    false,
    'removing a student should detach them from course templates'
);

const app5 = makeApp();
ScheduleErpService.setCellVersion(app5, '3-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.removeSubjectFromSchedule(app5, 'math');
const subjectlessVersion = ScheduleErpService.getCellVersion(app5, '3-afternoon-0', '2026-07-06');
assert.strictEqual(
    subjectlessVersion.subject,
    'uncategorized',
    'removing a subject should move scheduled students to the uncategorized subject'
);
assert.deepStrictEqual(
    studentIds(subjectlessVersion),
    ['s1'],
    'removing a subject should keep students in the scheduled cell'
);
assert.strictEqual(
    app5.erpData.courseTemplates.some(template => template.subjectId === 'math' && !template.archived),
    false,
    'removing a subject should archive matching active course templates'
);

const app6 = makeApp();
app6.currentDate = new Date(2026, 6, 8);
ScheduleErpService.setCellVersion(app6, '3-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.upsertAttendance(app6, '3-afternoon-0', 's1', 'present', '2026-07-08');
ScheduleErpService.setActualMinutes(app6, '3-afternoon-0', 80, '2026-07-08');
const movedSource = ScheduleErpService.getCellVersion(app6, '3-afternoon-0', '2026-07-06');
ScheduleErpService.setCellVersion(app6, '3-afternoon-0', '2026-07-06', null, []);
ScheduleErpService.setCellVersion(app6, '4-afternoon-0', '2026-07-06', 'math', ['s1']);
const movedTarget = ScheduleErpService.getCellVersion(app6, '4-afternoon-0', '2026-07-06');
ScheduleErpService.transferMovedCourseData(app6, movedSource, '4-afternoon-0', movedTarget);
assert.strictEqual(
    app6.erpData.attendanceRecords[0].cellKey,
    '4-afternoon-0',
    'moving a course should move ERP attendance to the target cell'
);
assert.strictEqual(
    app6.erpData.attendanceRecords[0].courseInstanceId,
    movedTarget.courseInstanceId,
    'moving a course should rebind attendance to the target course instance'
);
const movedTargetInstance = app6.erpData.courseInstances.find(ci => ci.id === movedTarget.courseInstanceId);
assert.strictEqual(
    movedTargetInstance.actualMinutesByDate['2026-07-08'],
    80,
    'moving a course should preserve actual minutes on the target instance'
);

const app7 = makeApp();
ScheduleErpService.setCellVersion(app7, '1-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.setRecurrenceStatus(app7, '1-afternoon-0', 's1', 'stopped', '2026-07-20');
const originalOccurrence = ScheduleErpService.getCellVersion(app7, '1-afternoon-0', '2026-07-13');
ScheduleErpService.setCellVersion(app7, '1-afternoon-0', '2026-07-13', null, [], { cutoff: true });
ScheduleErpService.setCellVersion(app7, '2-afternoon-0', '2026-07-13', 'math', ['s1']);
const branchedOccurrence = ScheduleErpService.getCellVersion(app7, '2-afternoon-0', '2026-07-13');
ScheduleErpService.setCellVersion(app7, '1-afternoon-0', '2026-07-20', 'math', ['s1']);
const restoredOriginalOccurrence = ScheduleErpService.getCellVersion(app7, '1-afternoon-0', '2026-07-20');
ScheduleErpService.inheritStudentBranchState(app7, originalOccurrence, restoredOriginalOccurrence, ['s1'], '2026-07-20');
ScheduleErpService.setCellVersion(app7, '2-afternoon-0', '2026-07-20', null, [], { cutoff: true });

assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app7, '1-afternoon-0', '2026-07-06')),
    ['s1'],
    'the original starting week should remain unchanged before a dragged split'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(app7, '1-afternoon-0', '2026-07-13'),
    null,
    'the original cell should stop recurring from the dragged week onward'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app7, '2-afternoon-0', '2026-07-13')),
    ['s1'],
    'the dragged week should appear at the target cell'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(app7, '2-afternoon-0', '2026-07-27'),
    null,
    'the moved lesson should not keep recurring at the target cell'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app7, '1-afternoon-0', '2026-07-20')),
    ['s1'],
    'the original cell should resume in the following week as a new recurrence start'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(app7, '1-afternoon-0', '2026-07-27'),
    null,
    'future stop rules should still apply on the restored original branch'
);

const app8 = makeApp();
ScheduleErpService.setCellVersion(app8, '1-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.setCellVersion(app8, '1-afternoon-0', '2026-07-13', null, [], { cutoff: true });
assert.strictEqual(
    ScheduleErpService.getCellVersion(app8, '1-afternoon-0', '2026-07-13'),
    null,
    'a cutoff week should hide the course before it is restored'
);
ScheduleErpService.setCellVersion(app8, '1-afternoon-0', '2026-07-13', 'math', ['s1']);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app8, '1-afternoon-0', '2026-07-13')),
    ['s1'],
    'restoring a course into a previously cut off week should clear the stale delete rule'
);

const app9 = makeApp();
ScheduleErpService.setCellVersion(app9, '1-afternoon-0', '2026-07-06', 'math', ['s1']);
const splitSource = ScheduleErpService.getCellVersion(app9, '1-afternoon-0', '2026-07-13');
ScheduleErpService.setCellVersion(app9, '1-afternoon-0', '2026-07-13', null, [], { cutoff: true });
ScheduleErpService.setCellVersion(app9, '2-afternoon-0', '2026-07-13', 'math', ['s1']);
const splitTarget = ScheduleErpService.getCellVersion(app9, '2-afternoon-0', '2026-07-13');
ScheduleErpService.setCellVersion(app9, '1-afternoon-0', '2026-07-20', 'math', ['s1']);
ScheduleErpService.inheritStudentBranchState(
    app9,
    splitSource,
    ScheduleErpService.getCellVersion(app9, '1-afternoon-0', '2026-07-20'),
    ['s1'],
    '2026-07-20'
);
ScheduleErpService.setCellVersion(app9, '2-afternoon-0', '2026-07-20', null, [], { cutoff: true });
assert.strictEqual(
    ScheduleErpService.getCellVersion(app9, '1-afternoon-0', '2026-07-13'),
    null,
    'a dragged course should stop recurring at the original cell from the dragged week onward'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app9, '1-afternoon-0', '2026-07-20')),
    ['s1'],
    'a dragged course should resume at the original cell in the following week'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(app9, '2-afternoon-0', '2026-07-20'),
    null,
    'a dragged course should not keep recurring from the target cell in following weeks'
);

const recurrenceApp = makeApp();
Object.setPrototypeOf(recurrenceApp, TimetableApp.prototype);
recurrenceApp.currentDate = new Date(2026, 6, 7);
recurrenceApp.getCellVersion = function(cellKey, weekStartStr) {
    return ScheduleErpService.getCellVersion(this, cellKey, weekStartStr);
};
ScheduleErpService.setCellVersion(recurrenceApp, '1-afternoon-0', '2026-06-29', 'math', ['s1']);
ScheduleErpService.setCellVersion(recurrenceApp, '1-afternoon-0', '2026-07-13', null, [], { cutoff: true });
ScheduleErpService.setCellVersion(recurrenceApp, '1-afternoon-0', '2026-07-20', 'math', ['s1']);
ScheduleErpService.setCellVersion(recurrenceApp, '2-afternoon-0', '2026-07-13', 'math', ['s1']);
assert.strictEqual(
    recurrenceApp.getStudentRecurrenceType('1-afternoon-0', 's1'),
    'stopped',
    'a previous lesson should show stopped when the next week at the same cell was split away'
);

const app10 = makeApp();
ScheduleErpService.setCellVersion(app10, '1-afternoon-0', '2026-06-29', 'math', ['s1']);
ScheduleErpService.setCellVersion(app10, '1-afternoon-0', '2026-07-13', null, [], { cutoff: true });
ScheduleErpService.setCellVersion(app10, '1-afternoon-0', '2026-07-20', null, [], { cutoff: true });
ScheduleErpService.setCellVersion(app10, '1-afternoon-0', '2026-07-27', 'math', ['s2']);
ScheduleErpService.setRecurrenceStatus(app10, '1-afternoon-0', 's1', 'recurring', '2026-07-06');
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app10, '1-afternoon-0', '2026-07-13')),
    ['s1'],
    'switching recurring back on should refill later empty recurring weeks from the current lesson'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app10, '1-afternoon-0', '2026-07-20')),
    ['s1'],
    'switching recurring back on should continue through consecutive empty future weeks'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(app10, '1-afternoon-0', '2026-07-27')),
    ['s2'],
    'switching recurring back on should not overwrite a later explicit course instance'
);

const singleDeleteApp = makeApp();
ScheduleErpService.setCellVersion(singleDeleteApp, '4-afternoon-0', '2026-06-29', 'math', ['s1', 's2']);
assert.strictEqual(
    ScheduleErpService.deleteSingleCellOccurrence(singleDeleteApp, '4-afternoon-0', '2026-07-13'),
    true,
    'a projected occurrence should be removable'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleDeleteApp, '4-afternoon-0', '2026-07-06')),
    ['s1', 's2'],
    'the occurrence before a single deletion should remain'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(singleDeleteApp, '4-afternoon-0', '2026-07-13'),
    null,
    'only the selected occurrence should be empty'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleDeleteApp, '4-afternoon-0', '2026-07-20')),
    ['s1', 's2'],
    'the following occurrence should restart the recurrence'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleDeleteApp, '4-afternoon-0', '2026-07-27')),
    ['s1', 's2'],
    'the restarted recurrence should continue into later weeks'
);

ScheduleErpService.deleteSingleCellOccurrence(singleDeleteApp, '4-afternoon-0', '2026-07-20');
assert.strictEqual(
    ScheduleErpService.getCellVersion(singleDeleteApp, '4-afternoon-0', '2026-07-20'),
    null,
    'a second consecutive occurrence can also be removed independently'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(singleDeleteApp, '4-afternoon-0', '2026-07-27')),
    ['s1', 's2'],
    'the recurrence should restart after consecutive removed occurrences'
);
Object.setPrototypeOf(singleDeleteApp, TimetableApp.prototype);
singleDeleteApp.getCellVersion = function(cellKey, weekStartStr) {
    return ScheduleErpService.getCellVersion(this, cellKey, weekStartStr);
};
singleDeleteApp.currentDate = new Date(2026, 6, 7);
assert.strictEqual(
    singleDeleteApp.getStudentRecurrenceType('4-afternoon-0', 's1'),
    'stopped',
    'the lesson immediately before a removed occurrence should show stopped'
);
singleDeleteApp.currentDate = new Date(2026, 6, 28);
assert.strictEqual(
    singleDeleteApp.getStudentRecurrenceType('4-afternoon-0', 's1'),
    'recurring',
    'the restored branch should show recurring at its new start'
);

const boundedInsertApp = makeApp();
ScheduleErpService.setCellVersion(boundedInsertApp, '5-afternoon-0', '2026-06-29', 'math', ['s2']);
ScheduleErpService.deleteSingleCellOccurrence(boundedInsertApp, '5-afternoon-0', '2026-07-06');
ScheduleErpService.deleteSingleCellOccurrence(boundedInsertApp, '5-afternoon-0', '2026-07-13');
ScheduleErpService.deleteSingleCellOccurrence(boundedInsertApp, '5-afternoon-0', '2026-07-20');
ScheduleErpService.setCellVersion(boundedInsertApp, '5-afternoon-0', '2026-07-06', 'math', ['s1']);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(boundedInsertApp, '5-afternoon-0', '2026-07-06')),
    ['s1'],
    'a new lesson should replace the first deleted occurrence'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(boundedInsertApp, '5-afternoon-0', '2026-07-13')),
    ['s1'],
    'a new lesson should bridge the next consecutive deleted occurrence'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(boundedInsertApp, '5-afternoon-0', '2026-07-20')),
    ['s1'],
    'an earlier inserted lesson should recur up to the week before a future explicit lesson'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(boundedInsertApp, '5-afternoon-0', '2026-07-27')),
    ['s2'],
    'the future explicit lesson should remain the recurrence boundary'
);
Object.setPrototypeOf(boundedInsertApp, TimetableApp.prototype);
boundedInsertApp.getCellVersion = function(cellKey, weekStartStr) {
    return ScheduleErpService.getCellVersion(this, cellKey, weekStartStr);
};
boundedInsertApp.currentDate = new Date(2026, 6, 21);
assert.strictEqual(
    boundedInsertApp.getStudentRecurrenceType('5-afternoon-0', 's1'),
    'stopped',
    'the final bridged occurrence should stop before the future explicit course'
);

const cleanupApp = makeApp();
ScheduleErpService.setCellVersion(cleanupApp, '2-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.setCellVersion(cleanupApp, '2-afternoon-0', '2026-07-06', null, [], { cutoff: true });
const cleanupCutoff = cleanupApp.erpData.courseInstances.find(instance =>
    instance.cellKey === '2-afternoon-0' && instance.weekStart === '2026-07-06'
);
assert.ok(cleanupCutoff && cleanupCutoff.isDeleted, 'the cutoff instance should be retained');
assert.strictEqual(
    cleanupApp.erpData.repeatRules.some(rule => rule.courseInstanceId === cleanupCutoff.id),
    false,
    'a deleted cutoff instance should not keep a repeat rule'
);
cleanupApp.erpData.studentCourseRelations.push({
    id: 'orphan-relation',
    courseInstanceId: 'missing-instance',
    studentId: 's1'
});
cleanupApp.erpData.repeatRules.push({ id: 'orphan-repeat', courseInstanceId: 'missing-instance' });
cleanupApp.erpData.exceptionRules.push({ id: 'orphan-exception', courseInstanceId: 'missing-instance' });
ScheduleErpService.pruneOrphanedErpData(cleanupApp);
assert.strictEqual(
    cleanupApp.erpData.studentCourseRelations.some(rel => rel.courseInstanceId === 'missing-instance'),
    false,
    'orphaned student relations should be pruned'
);
assert.strictEqual(
    cleanupApp.erpData.repeatRules.some(rule => rule.courseInstanceId === 'missing-instance'),
    false,
    'orphaned repeat rules should be pruned'
);
assert.strictEqual(
    cleanupApp.erpData.exceptionRules.some(rule => rule.courseInstanceId === 'missing-instance'),
    false,
    'orphaned exception rules should be pruned'
);

const dragDropSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-dragdrop.js'), 'utf8');
const timetableSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-timetable.js'), 'utf8');
vm.runInThisContext(timetableSource, { filename: 'app-timetable.js' });
assert.strictEqual(
    /addEventListener\(['"]dblclick['"]/.test(`${dragDropSource}\n${timetableSource}`),
    false,
    'the timetable should not register a double-click delete handler'
);

const blockCopyApp = Object.create(TimetableApp.prototype);
blockCopyApp.periods = [{}, {}, {}, {}];
blockCopyApp.copiedScheduleBlock = {
    type: 'day',
    sourceIndex: 1,
    sourceWeekStart: '2026-07-06',
    entries: [
        { day: 1, period: 0, subjectId: 'math', studentIds: ['s1'] },
        { day: 1, period: 2, subjectId: 'english', studentIds: ['s2'] }
    ]
};
assert.deepStrictEqual(
    blockCopyApp.getScheduleBlockTargets('day', 4).filter(entry => entry.subjectId).map(entry => [entry.day, entry.period, entry.subjectId]),
    [[4, 0, 'math'], [4, 2, 'english']],
    'column copy should preserve periods while remapping every course to the target day'
);
blockCopyApp.copiedScheduleBlock = {
    type: 'period',
    sourceIndex: 0,
    sourceWeekStart: '2026-07-06',
    entries: [
        { day: 1, period: 0, subjectId: 'math', studentIds: ['s1'] },
        { day: 5, period: 0, subjectId: 'english', studentIds: ['s2'] }
    ]
};
assert.deepStrictEqual(
    blockCopyApp.getScheduleBlockTargets('period', 3).filter(entry => entry.subjectId).map(entry => [entry.day, entry.period, entry.subjectId]),
    [[1, 3, 'math'], [5, 3, 'english']],
    'row copy should preserve days while remapping every course to the target period'
);

const durationStatsApp = Object.create(TimetableApp.prototype);
durationStatsApp.getLessonDurationMinutesForStats = () => 120;
const segmentedDuration = durationStatsApp.getLessonSegmentTypeStats({
    students: [
        { id: 'a', actualMinutes: 120 },
        { id: 'b', actualMinutes: 90 },
        { id: 'c', actualMinutes: 90 },
        { id: 'd', actualMinutes: 60 }
    ]
});
assert.deepStrictEqual(
    segmentedDuration.typeStats,
    { '1v4': 60, '1v3': 30, '1v1(0.8)': 30 },
    'student-specific durations should split one lesson across active class sizes'
);
assert.strictEqual(segmentedDuration.totalMinutes, 120, 'the lesson total should remain the longest student duration');

const lessonSheetApp = Object.create(TimetableApp.prototype);
lessonSheetApp.formatLocalDate = makeApp().formatLocalDate;
const unweightedSummary = lessonSheetApp.getLessonSheetSummaryMatrix([{
    dateKey: '2026-07-01',
    durationMinutes: 60,
    typeLabel: '1v2',
    studentDetails: [{ name: 'Senior', grade: '高三', status: 'present' }]
}]);
assert.strictEqual(
    unweightedSummary.totalValues[(3 * unweightedSummary.typeKeys.length) + 1],
    '1',
    'lesson-sheet Excel totals should preserve raw hours without grade coefficients'
);
assert.strictEqual(unweightedSummary.groups[3].label, '高三年级1.5系数', 'lesson-sheet headers should retain coefficient descriptions');

const segmentedLessonSheetSummary = lessonSheetApp.getLessonSheetSummaryMatrix([{
    dateKey: '2026-07-01',
    durationMinutes: 120,
    typeLabel: '1v4',
    studentDetails: [
        { name: 'A', grade: '高三', status: 'present', actualMinutes: 120 },
        { name: 'B', grade: '高三', status: 'present', actualMinutes: 90 },
        { name: 'C', grade: '高三', status: 'present', actualMinutes: 90 },
        { name: 'D', grade: '高三', status: 'present', actualMinutes: 60 }
    ]
}]);
const high3Offset = 3 * segmentedLessonSheetSummary.typeKeys.length;
assert.deepStrictEqual(
    [
        segmentedLessonSheetSummary.totalValues[high3Offset + 2],
        segmentedLessonSheetSummary.totalValues[high3Offset + 3],
        segmentedLessonSheetSummary.totalValues[high3Offset + 4]
    ],
    ['0.5', '1', '0.5'],
    'lesson-sheet summary should split unequal student durations across active class sizes'
);

lessonSheetApp.formatDuration = (hours, minutes) => `${hours}h${minutes ? `${minutes}min` : ''}`;
lessonSheetApp.timeToMinutes = value => {
    const [hours, minutes] = String(value).split(':').map(Number);
    return hours * 60 + minutes;
};

lessonSheetApp.erpData = {
    courseInstances: [{
        id: 'weekly-course',
        actualMinutesByDate: {
            '2026-07-17': 90
        }
    }]
};
assert.strictEqual(
    lessonSheetApp.getLessonActualMinutesForStats({
        courseInstanceId: 'weekly-course',
        dates: ['2026-07-10']
    }),
    undefined,
    'lesson actual duration must not fall back to a different occurrence date'
);
assert.strictEqual(
    lessonSheetApp.getLessonDurationMinutesForStats({
        courseInstanceId: 'weekly-course',
        dates: ['2026-07-10'],
        time: '08:00-10:00'
    }),
    120,
    'an occurrence without actual duration should use its own scheduled duration'
);
assert.strictEqual(
    lessonSheetApp.getLessonActualMinutesForStats({
        courseInstanceId: 'weekly-course',
        dates: ['2026-07-17']
    }),
    90,
    'an occurrence should use actual duration saved for its exact date'
);

const expandedStudentRows = lessonSheetApp.getLessonSheetExpandedRows([{
    dateKey: '2026-07-01',
    subject: 'Physics',
    time: '08:00-10:00',
    typeLabel: '1v3',
    durationMinutes: 120,
    actualDuration: '2h',
    studentDetails: [
        { name: 'A', status: 'present', actualMinutes: 120 },
        { name: 'B', status: 'present', actualMinutes: 90 },
        { name: 'C', status: 'absent', actualMinutes: 120 },
        { name: 'D', status: 'present', actualMinutes: 150 }
    ]
}]);
assert.deepStrictEqual(
    expandedStudentRows.map(row => [row.actualDuration, row.isUnderTwoHours, row.isOverTwoHours]),
    [
        ['2h', false, false],
        ['1h30min', true, false],
        ['0h', true, false],
        ['2h30min', false, true]
    ],
    'lesson-sheet detail rows should flag durations below and above two hours separately'
);

const perCourseCompletionApp = makeApp();
Object.setPrototypeOf(perCourseCompletionApp, TimetableApp.prototype);
perCourseCompletionApp.settings = { segmentedScheduling: false };
perCourseCompletionApp.currentDate = new Date(2026, 6, 7);
perCourseCompletionApp.getCellVersion = function(cellKey, weekStart) {
    return ScheduleErpService.getCellVersion(this, cellKey, weekStart);
};
perCourseCompletionApp.getCellLessonStart = function(_cellKey, weekStart) {
    return new Date(weekStart);
};
ScheduleErpService.setCellVersion(perCourseCompletionApp, '2-afternoon-0', '2026-07-06', 'math', ['s1']);
ScheduleErpService.setCellVersion(perCourseCompletionApp, '3-afternoon-0', '2026-07-06', 'english', ['s1']);
perCourseCompletionApp.completeStudentAfterLesson('s1', new Date(2026, 6, 7), '2-afternoon-0');
assert.strictEqual(
    perCourseCompletionApp.isStudentCourseCompleted('2-afternoon-0', 's1'),
    true,
    'completion should be stored on the selected course relation'
);
assert.strictEqual(
    ScheduleErpService.getCellVersion(perCourseCompletionApp, '2-afternoon-0', '2026-07-13'),
    null,
    'the completed course should stop after the selected lesson'
);
assert.deepStrictEqual(
    studentIds(ScheduleErpService.getCellVersion(perCourseCompletionApp, '3-afternoon-0', '2026-07-13')),
    ['s1'],
    'another course for the same student should remain ongoing'
);
assert.strictEqual(
    perCourseCompletionApp.hasOtherOngoingCourse('s1', '2-afternoon-0', new Date(2026, 6, 7)),
    true,
    'partial completion should report another ongoing course'
);

const crossStageCompletionApp = makeApp();
Object.setPrototypeOf(crossStageCompletionApp, TimetableApp.prototype);
crossStageCompletionApp.settings = {
    segmentedScheduling: true,
    stages: [
        { id: 'stage-a', startDate: '2026-01-01', endDate: '2026-03-31' },
        { id: 'stage-b', startDate: '2026-04-01', endDate: '2026-06-30' }
    ]
};
crossStageCompletionApp.currentDate = new Date(2026, 2, 10);
crossStageCompletionApp.getCellVersion = function(cellKey, weekStart) {
    return ScheduleErpService.getCellVersion(this, cellKey, weekStart);
};
crossStageCompletionApp.getCellLessonStart = function(_cellKey, weekStart) { return new Date(weekStart); };
ScheduleErpService.setCellVersion(crossStageCompletionApp, '2-afternoon-0', '2026-03-09', 'math', ['s1']);
crossStageCompletionApp.completeStudentAfterLesson('s1', new Date(2026, 2, 10), '2-afternoon-0');
assert.strictEqual(
    crossStageCompletionApp.isStudentCourseCompleted('2-afternoon-0', 's1', new Date(2026, 2, 10)),
    true,
    'the selected course instance should be completed inside its stage'
);
ScheduleErpService.setCellVersion(crossStageCompletionApp, '2-afternoon-0', '2026-04-06', 'math', ['s1']);
assert.strictEqual(
    crossStageCompletionApp.isStudentCourseCompleted('2-afternoon-0', 's1', new Date(2026, 3, 7)),
    false,
    'a new course instance in the next stage must not inherit the previous stage completion'
);

const stageAutoAfterPartialApp = makeApp();
stageAutoAfterPartialApp.settings = {
    segmentedScheduling: true,
    stages: [{ id: 'stage-only', startDate: '2026-01-01', endDate: '2026-03-31' }]
};
ScheduleErpService.setCellVersion(stageAutoAfterPartialApp, '2-afternoon-0', '2026-03-09', 'math', ['s1']);
ScheduleErpService.setCellVersion(stageAutoAfterPartialApp, '3-afternoon-0', '2026-03-09', 'english', ['s1']);
ScheduleErpService.completeStudentFromWeek(stageAutoAfterPartialApp, '2-afternoon-0', 's1', '2026-03-16');
ScheduleErpService.completeStudentsForEndedStages(stageAutoAfterPartialApp, new Date(2026, 3, 1));
assert.strictEqual(
    stageAutoAfterPartialApp.students.find(student => student.id === 's1').completed,
    true,
    'partial manual course completion must not prevent automatic completion when the stage ends'
);

console.log('Schedule ERP tests passed');
