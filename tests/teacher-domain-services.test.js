'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ScheduleDatabase } = require('../src/db/database');
const { TeacherConflictService } = require('../src/domain/teacher-conflict-service');

function backup() {
    return {
        schemaVersion: 1,
        appVersion: '1.3.0',
        exportedAt: '2026-08-02T10:00:00.000Z',
        type: 'class-schedule-full-backup',
        data: {
            timetableData: {
                schemaVersion: 1,
                subjects: [
                    { id: 'math', name: '数学', teacher: '教师甲', color: '#123456' },
                    { id: 'english', name: '英语', teacher: '旧数据中的其他教师文本', color: '#654321' }
                ],
                students: [{ id: 's1', name: '学员甲', grade: '七年级' }],
                periods: [{ id: 'p1', name: '第1节', time: '08:00-10:00' }],
                erpData: {
                    courseTemplates: [{ id: 'tpl1', subjectId: 'math', defaultStudentIds: ['s1'] }],
                    courseInstances: [{
                        id: 'ci1', courseTemplateId: 'tpl1', subjectId: 'math', studentIds: ['s1'],
                        weekStart: '2026-07-27', cellKey: '2-0', status: 'recurring'
                    }],
                    studentCourseRelations: [{ id: 'rel1', courseTemplateId: 'tpl1', studentId: 's1' }],
                    attendanceRecords: [], repeatRules: [], exceptionRules: []
                }
            },
            timetableSettings: {},
            timetableGrades: [{ id: 'g7', name: '七年级' }],
            timetableSalarySettings: {},
            timetableDataBackup: null,
            timetableDataBackupAt: null
        }
    };
}

(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-domain-test-'));
    const database = new ScheduleDatabase(path.join(tempDir, 'schedule.sqlite'));
    try {
        const sourceBackup = backup();
        database.initializeFromLegacy(sourceBackup);
        const teacherId = database.currentTeacherId();
        assert.ok(teacherId);
        assert.strictEqual(database.teachers.listByOrganization('org-default').length, 1,
            'single-teacher data must not create teachers from every legacy subject label');

        assert.strictEqual(database.teacherSchedule.getMySchedule(teacherId).length, 1);
        assert.strictEqual(database.teacherSchedule.getMySchedule('another-teacher').length, 1,
            'teacher identity must not restrict schedule access');
        assert.strictEqual(database.teacherSchedule.getSessionDetail(teacherId, 'ci1').status, 'PUBLISHED');

        database.db.prepare(`INSERT INTO activity_sessions
            (id,organization_id,campus_id,template_id,teacher_id,resource_id,schedule_version_id,class_date,start_time,end_time,status,payload_json,created_at,updated_at)
            SELECT 'draft-hidden',organization_id,campus_id,template_id,teacher_id,resource_id,schedule_version_id,
                class_date,start_time,end_time,'DRAFT',payload_json,created_at,updated_at FROM activity_sessions WHERE id='ci1'`).run();
        assert.strictEqual(database.teacherSchedule.getMySchedule(teacherId).length, 1, 'drafts must remain hidden');
        assert.throws(() => database.teacherSchedule.getSessionDetail(teacherId, 'draft-hidden'), /not visible/);

        const conflictService = new TeacherConflictService();
        const conflicts = conflictService.check({
            id: 'candidate', teacherId, classDate: '2026-07-28', startTime: '09:00', endTime: '10:30',
            studentIds: ['s1', 's2'], is1v1: true, auditionStudentIds: ['s1', 's2']
        }, [{ id: 'existing', teacherId, classDate: '2026-07-28', startTime: '08:00', endTime: '10:00' }]);
        assert.deepStrictEqual(conflicts.map(item => item.code), [
            'ONE_TO_ONE_REQUIRES_ONE_STUDENT', 'MULTIPLE_AUDITION_STUDENTS', 'TEACHER_TIME_OVERLAP'
        ]);
        assert.deepStrictEqual(conflicts[2].conflictingSessionIds, ['existing']);

        database.replaceSnapshot({ ...sourceBackup, exportedAt: '2026-08-03T10:00:00.000Z' });
        assert.strictEqual(database.sessions.getById('draft-hidden').status, 'DRAFT', 'compatibility sync must preserve drafts');

        assert.strictEqual(database.attendance.markAttendance(teacherId, 'ci1', 's1', 'present').status, 'present');
        assert.strictEqual(database.attendance.markAttendance('another-teacher', 'ci1', 's1', 'leave').status, 'leave',
            'teacher identity must not restrict attendance edits');
        assert.strictEqual(database.attendance.setActualMinutes(teacherId, 'ci1', 's1', 75).actual_minutes, 75);
        assert.throws(() => database.attendance.markAttendance(teacherId, 'ci1', 'missing', 'present'), /not a participant/);
        assert.strictEqual(database.attendance.completeSession(teacherId, 'ci1').status, 'COMPLETED');
        assert.throws(() => database.attendance.setActualMinutes(teacherId, 'ci1', 's1', 60), /cannot be modified/);
        assert.ok(database.metadata('statistics_invalidated_at'));

        database.db.prepare('UPDATE teachers SET name = ? WHERE id = ?').run('教师甲（新名称）', teacherId);
        assert.strictEqual(database.teacherSchedule.getMySchedule(teacherId)[0].teacher_id, teacherId,
            'teacher rename must not break historical session ownership');
        console.log('Teacher domain service tests passed');
    } finally {
        database.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
})();
