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

console.log('Schedule ERP tests passed');

