const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.window = global;

const erpSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-erp.js'), 'utf8');
vm.runInThisContext(erpSource, { filename: 'app-erp.js' });

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
assert.strictEqual(subjectlessVersion.subject, null, 'removing a subject should clear it from projected courses');
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

console.log('Schedule ERP tests passed');

