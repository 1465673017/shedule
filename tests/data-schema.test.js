const assert = require('assert');
const fs = require('fs');
const path = require('path');
const schema = require('../js/data-schema.js');

function memoryStorage(initial = {}, failOnKey = '') {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem(key, value) {
            if (key === failOnKey) throw new Error('quota exceeded');
            values.set(key, String(value));
        },
        removeItem: key => values.delete(key)
    };
}

const legacy = schema.normalizeTimetableData({ subjects: [{ id: 's1' }] });
assert.strictEqual(legacy.schemaVersion, schema.SCHEMA_VERSION, 'unversioned data should migrate to v1');
assert.strictEqual(legacy.appVersion, schema.APP_VERSION);

const current = schema.normalizeTimetableData({ schemaVersion: 1, appVersion: '1.2.4', students: [] });
assert.deepStrictEqual(current.students, []);
assert.throws(
    () => schema.normalizeTimetableData({ schemaVersion: 2 }),
    /高于当前支持的版本/,
    'unknown future versions must fail closed'
);

const source = memoryStorage({
    timetableData: JSON.stringify({ students: [{ id: 'p1', attendance: 'leave' }], erpData: { courses: [{ id: 'c1' }] } }),
    timetableSettings: JSON.stringify({ theme: 'dark', segmentedScheduling: true }),
    timetableGrades: JSON.stringify([{ id: 'g1', name: '一年级' }]),
    timetableSalarySettings: JSON.stringify({ basePay: 3200, starLevel: 3 }),
    timetableDataBackup: JSON.stringify({ students: [] }),
    timetableDataBackupAt: '1234'
});
const backup = schema.createFullBackup(source, new Date('2026-08-02T10:00:00.000Z'));
assert.strictEqual(backup.type, 'class-schedule-full-backup');
assert.strictEqual(backup.data.timetableData.students[0].attendance, 'leave');

const target = memoryStorage({ timetableData: 'old', timetableSettings: 'old-settings' });
schema.restoreFullBackup(target, JSON.stringify(backup));
assert.deepStrictEqual(JSON.parse(target.getItem('timetableGrades')), backup.data.timetableGrades);
assert.deepStrictEqual(JSON.parse(target.getItem('timetableSettings')), backup.data.timetableSettings);
assert.deepStrictEqual(JSON.parse(target.getItem('timetableSalarySettings')), backup.data.timetableSalarySettings);
assert.strictEqual(JSON.parse(target.getItem('timetableData')).erpData.courses[0].id, 'c1');

const rollbackTarget = memoryStorage({ timetableData: 'original', timetableSettings: 'original-settings' }, 'timetableGrades');
assert.throws(() => schema.restoreFullBackup(rollbackTarget, backup), /quota exceeded/);
assert.strictEqual(rollbackTarget.getItem('timetableData'), 'original', 'failed restore should roll back primary data');
assert.strictEqual(rollbackTarget.getItem('timetableSettings'), 'original-settings', 'failed restore should roll back settings');

const legacyBackupWithoutSalary = JSON.parse(JSON.stringify(backup));
delete legacyBackupWithoutSalary.data.timetableSalarySettings;
const legacyTarget = memoryStorage({ timetableSalarySettings: JSON.stringify({ basePay: 999 }) });
schema.restoreFullBackup(legacyTarget, legacyBackupWithoutSalary);
assert.deepStrictEqual(JSON.parse(legacyTarget.getItem('timetableSalarySettings')), {}, 'old snapshots should restore default salary settings');

const fixturePath = path.join(__dirname, 'fixtures', 'teacher-migration-v1.json');
const fixture = schema.normalizeFullBackup(fs.readFileSync(fixturePath, 'utf8'));
const fixtureTarget = memoryStorage();
schema.restoreFullBackup(fixtureTarget, fixture);
const fixtureData = JSON.parse(fixtureTarget.getItem('timetableData'));
assert.ok(fixtureData.erpData.courses.some(course => course.recurrence === 'weekly'), 'fixture must include a weekly course');
assert.ok(fixtureData.erpData.courses.some(course => course.recurrence === 'temporary'), 'fixture must include a temporary course');
assert.ok(fixtureData.erpData.courses.some(course => course.exceptionType === 'rescheduled'), 'fixture must include a cross-week exception');
assert.ok(fixtureData.erpData.attendance.some(item => item.status === 'leave' && item.actualMinutes === 0), 'fixture must include leave with zero actual minutes');
assert.ok(fixtureData.students.some(student => student.isAudition), 'fixture must include an audition student');
assert.ok(fixtureData.students.some(student => student.isCompleted), 'fixture must include a completed student');

console.log('Data schema and full-backup tests passed');
