const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ScheduleDatabase } = require('../src/db/database');

function fullBackup() {
    return {
        schemaVersion: 1,
        appVersion: '1.2.4',
        exportedAt: '2026-08-02T10:00:00.000Z',
        type: 'class-schedule-full-backup',
        data: {
            timetableData: {
                schemaVersion: 1,
                subjects: [{ id: 'math', name: '数学', teacher: '教师甲', color: '#123456' }],
                students: [
                    { id: 's1', name: '学员甲', grade: '七年级' },
                    { id: 's2', name: '学员乙', grade: '七年级', isCompleted: true }
                ],
                periods: [{ id: 'p1', name: '第1节', time: '08:00-10:00' }],
                erpData: {
                    courseTemplates: [{ id: 'tpl1', subjectId: 'math', defaultStudentIds: ['s1', 's2'] }],
                    courseInstances: [{
                        id: 'ci1', courseTemplateId: 'tpl1', subjectId: 'math', studentIds: ['s1', 's2'],
                        weekStart: '2026-07-27', cellKey: '2-0', status: 'recurring'
                    }],
                    studentCourseRelations: [
                        { id: 'rel1', courseTemplateId: 'tpl1', studentId: 's1', relationStatus: 'active' },
                        { id: 'rel2', courseTemplateId: 'tpl1', studentId: 's2', relationStatus: 'completed' }
                    ],
                    attendanceRecords: [{ id: 'att1', courseInstanceId: 'ci1', studentId: 's1', status: 'leave', actualMinutes: 0 }],
                    repeatRules: [{ id: 'rep1', courseInstanceId: 'ci1', type: 'weekly' }],
                    exceptionRules: [{ id: 'ex1', courseInstanceId: 'ci1', type: 'move' }]
                }
            },
            timetableSettings: { theme: 'default' },
            timetableGrades: [{ id: 'g7', name: '七年级', color: '#fff' }],
            timetableSalarySettings: { basePay: 3200, starLevel: 3 },
            timetableDataBackup: null,
            timetableDataBackupAt: null
        }
    };
}

(async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-sqlite-test-'));
    const dbPath = path.join(tempDir, 'schedule.sqlite');
    const backupPath = path.join(tempDir, 'backup.sqlite');
    let database = new ScheduleDatabase(dbPath);
    try {
        const migrated = database.initializeFromLegacy(fullBackup());
        assert.strictEqual(migrated.migrated, true);
        assert.strictEqual(migrated.validation.valid, true);
        assert.deepStrictEqual(migrated.validation.counts, {
            subjects: 1, students: 2, teachers: 1, templates: 1,
            sessions: 1, relations: 2, attendance: 1
        });
        assert.deepStrictEqual(migrated.validation.statistics, { actualMinutes: 0 });
        assert.strictEqual(database.metadata('migration_completed'), '1');
        assert.match(database.metadata('legacy_backup_snapshot_key'), /^legacy-before-migration-/);
        assert.strictEqual(database.db.prepare("SELECT COUNT(*) AS count FROM app_snapshots").get().count, 2);
        assert.strictEqual(database.db.prepare('PRAGMA foreign_key_check').all().length, 0);

        const requiredTables = [
            'organizations', 'campuses', 'grades', 'head_teachers', 'teachers', 'subjects', 'classes',
            'students', 'time_periods', 'course_templates', 'student_courses', 'course_instances',
            'attendance_records', 'resources', 'schedule_versions', 'activity_sessions'
        ];
        const tables = new Set(database.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
        requiredTables.forEach(table => assert.ok(tables.has(table), `missing table ${table}`));

        const teacher = database.teachers.listByOrganization('org-default')[0];
        assert.strictEqual(teacher.name, '教师甲');
        assert.strictEqual(database.sessions.listForTeacher(teacher.id).length, 1);
        database.db.prepare(`INSERT INTO activity_sessions
            (id,organization_id,campus_id,template_id,teacher_id,resource_id,schedule_version_id,class_date,start_time,end_time,status,payload_json,created_at,updated_at)
            SELECT ?,organization_id,campus_id,template_id,teacher_id,resource_id,schedule_version_id,class_date,start_time,end_time,'DRAFT',payload_json,created_at,updated_at
            FROM activity_sessions WHERE id = ?`).run('draft-ci1', 'ci1');
        assert.strictEqual(database.sessions.listForTeacher(teacher.id, ['DRAFT']).length, 0);
        assert.throws(() => database.sessions.transition('ci1', 'DRAFT'), /Illegal session transition/);
        assert.strictEqual(database.sessions.transition('ci1', 'COMPLETED').status, 'COMPLETED');
        assert.throws(() => database.sessions.transition('ci1', 'PUBLISHED'), /Illegal session transition/);

        const beforeFailure = database.getSnapshot();
        const invalid = fullBackup();
        invalid.data.timetableData.subjects.push({ id: 'math', name: '重复主键' });
        assert.throws(() => database.replaceSnapshot(invalid), /UNIQUE|constraint/i);
        assert.deepStrictEqual(database.getSnapshot(), beforeFailure, 'failed migration must roll back its snapshot');

        await database.createBackup(backupPath);
        assert.ok(fs.statSync(backupPath).size > 0);
        database.replaceSnapshot({ ...fullBackup(), exportedAt: '2026-08-03T10:00:00.000Z' });
        const restored = await database.restoreBackup(backupPath);
        assert.strictEqual(restored.restored, true);
        assert.strictEqual(database.getSnapshot().exportedAt, '2026-08-02T10:00:00.000Z');

        const secondStart = database.initializeFromLegacy(fullBackup());
        assert.strictEqual(secondStart.migrated, false, 'migration must be idempotent after completion');
        const newerCache = fullBackup();
        newerCache.cacheUpdatedAt = '2026-08-04T10:00:00.000Z';
        const recovered = database.initializeFromLegacy(newerCache);
        assert.strictEqual(recovered.recoveredNewerCache, true, 'a newer compatibility cache should recover an interrupted write');

        database.close();
        database = new ScheduleDatabase(dbPath);
        assert.strictEqual(database.metadata('migration_completed'), '1', 'migration marker must persist after reopening SQLite');
        assert.deepStrictEqual(
            database.getSnapshot().data.timetableSalarySettings,
            { basePay: 3200, starLevel: 3 },
            'salary settings must persist in the SQLite snapshot'
        );
        console.log('SQLite data layer tests passed');
    } finally {
        if (database.db) database.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
