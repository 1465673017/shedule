'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync, backup } = require('node:sqlite');
const { MIGRATIONS } = require('./migrations');
const { ScheduleChangeRequestRepository, ScheduleVersionRepository, SessionRepository, TeacherRepository } = require('./repositories');
const { AttendanceService } = require('../domain/attendance-service');
const { ScheduleChangeService } = require('../domain/schedule-change-service');
const { TeacherScheduleService } = require('../domain/teacher-schedule-service');

const DEFAULT_IDS = Object.freeze({
    organization: 'org-default',
    campus: 'campus-default',
    teacher: 'teacher-default',
    scheduleVersion: 'schedule-imported-v1'
});
const SNAPSHOT_KEY = 'teacher-app-full-backup';

function nowIso() { return new Date().toISOString(); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function json(value) { return JSON.stringify(value == null ? null : value); }
function stableId(prefix, value) {
    return `${prefix}-${crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16)}`;
}
function parsePeriod(period, index) {
    const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(String(period && period.time || ''));
    return {
        id: String(period && period.id || `period-${index + 1}`),
        name: String(period && period.name || `第${index + 1}节`),
        start: match ? match[1] : '00:00',
        end: match ? match[2] : '00:00'
    };
}
function sessionDate(instance) {
    if (instance.classDate) return instance.classDate;
    if (!instance.weekStart || !instance.cellKey) return null;
    const day = Number(String(instance.cellKey).split('-')[0]);
    const start = new Date(`${instance.weekStart}T00:00:00`);
    if (!Number.isInteger(day) || Number.isNaN(start.getTime())) return null;
    start.setDate(start.getDate() + day - 1);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

class ScheduleDatabase {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        this.open();
    }

    open() {
        this.db = new DatabaseSync(this.filePath);
        this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
        this.applyMigrations();
        this.teachers = new TeacherRepository(this.db);
        this.sessions = new SessionRepository(this.db);
        this.scheduleVersions = new ScheduleVersionRepository(this.db);
        this.changeRequests = new ScheduleChangeRequestRepository(this.db);
        this.teacherSchedule = new TeacherScheduleService(this);
        this.attendance = new AttendanceService(this);
        this.scheduleChanges = new ScheduleChangeService(this);
    }

    close() {
        if (this.db) this.db.close();
        this.db = null;
    }

    transaction(callback) {
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const result = callback();
            this.db.exec('COMMIT');
            return result;
        } catch (error) {
            try { this.db.exec('ROLLBACK'); } catch (_) { /* preserve original error */ }
            throw error;
        }
    }

    checkpoint() {
        return this.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    }

    applyMigrations() {
        this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
        )`);
        const applied = new Set(this.db.prepare('SELECT version FROM schema_migrations').all().map(row => Number(row.version)));
        for (const migration of MIGRATIONS) {
            if (applied.has(migration.version)) continue;
            this.transaction(() => {
                this.db.exec(migration.sql);
                this.db.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)')
                    .run(migration.version, migration.name, nowIso());
            });
        }
    }

    metadata(key) {
        const row = this.db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(String(key));
        return row ? row.value : null;
    }

    setMetadata(key, value) {
        this.db.prepare(`INSERT INTO app_metadata(key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
            .run(String(key), String(value), nowIso());
    }

    currentTeacherId() { return this.metadata('current_teacher_id'); }

    requireParticipant(sessionId, studentId) {
        const row = this.db.prepare(`SELECT 1 FROM session_participants
            WHERE session_id = ? AND student_uid = ?`).get(String(sessionId), String(studentId));
        if (!row) throw new Error('Student is not a participant of this session');
    }

    getAttendance(sessionId, studentId) {
        return this.db.prepare(`SELECT ar.* FROM attendance_records ar
            JOIN course_instances ci ON ci.id = ar.course_instance_id
            WHERE ci.activity_session_id = ? AND ar.student_uid = ?`).get(String(sessionId), String(studentId)) || null;
    }

    invalidateStatistics() {
        this.setMetadata('statistics_invalidated_at', nowIso());
    }

    getSnapshot() {
        const row = this.db.prepare('SELECT payload_json FROM app_snapshots WHERE key = ?').get(SNAPSHOT_KEY);
        return row ? JSON.parse(row.payload_json) : null;
    }

    initializeFromLegacy(fullBackup) {
        const existing = this.getSnapshot();
        if (this.metadata('migration_completed') === '1' && existing) {
            const localUpdatedAt = Date.parse(fullBackup.cacheUpdatedAt || '');
            const sqliteUpdatedAt = Date.parse(existing.cacheUpdatedAt || '');
            if (Number.isFinite(localUpdatedAt) && (!Number.isFinite(sqliteUpdatedAt) || localUpdatedAt > sqliteUpdatedAt)) {
                const validation = this.replaceSnapshot(fullBackup);
                return { migrated: false, recoveredNewerCache: true, snapshot: this.getSnapshot(), validation };
            }
            return { migrated: false, snapshot: existing, validation: this.validateSnapshot(existing) };
        }
        this.archiveLegacySnapshot(fullBackup);
        const validation = this.replaceSnapshot(fullBackup, { markMigrationComplete: true });
        return { migrated: true, snapshot: this.getSnapshot(), validation };
    }

    archiveLegacySnapshot(fullBackup) {
        const timestamp = nowIso();
        const key = `legacy-before-migration-${Date.now()}`;
        this.db.prepare(`INSERT INTO app_snapshots(key, payload_json, schema_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`)
            .run(key, json(fullBackup), Number(fullBackup.schemaVersion) || 1, timestamp, timestamp);
        this.setMetadata('legacy_backup_snapshot_key', key);
        return key;
    }

    replaceSnapshot(fullBackup, options = {}) {
        if (!fullBackup || fullBackup.type !== 'class-schedule-full-backup' || !fullBackup.data) {
            throw new Error('Invalid full backup payload');
        }
        const validation = this.transaction(() => {
            this.writeSnapshot(fullBackup);
            this.replaceNormalizedData(fullBackup);
            const result = this.validateSnapshot(fullBackup);
            if (!result.valid) throw new Error(`SQLite migration validation failed: ${result.errors.join('; ')}`);
            if (options.markMigrationComplete) this.setMetadata('migration_completed', '1');
            return result;
        });
        this.checkpoint();
        return validation;
    }

    writeSnapshot(fullBackup) {
        const timestamp = nowIso();
        const schemaVersion = Number(fullBackup.schemaVersion) || 1;
        this.db.prepare(`INSERT INTO app_snapshots(key, payload_json, schema_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET payload_json=excluded.payload_json,
                schema_version=excluded.schema_version, updated_at=excluded.updated_at`)
            .run(SNAPSHOT_KEY, json(fullBackup), schemaVersion, timestamp, timestamp);
    }

    clearBusinessTables() {
        const tables = [
            'schedule_change_requests', 'attendance_records', 'session_participants', 'exception_rules', 'recurrence_rules',
            'course_instances', 'activity_sessions', 'student_courses', 'course_templates',
            'resources', 'students', 'classes', 'subjects', 'head_teachers', 'grades',
            'time_periods', 'schedule_versions', 'teachers', 'campuses', 'organizations'
        ];
        tables.forEach(table => this.db.exec(`DELETE FROM ${table}`));
    }

    preserveTeacherDomainData() {
        const tableExists = name => this.db.prepare(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
        ).get(name);
        if (!tableExists('schedule_change_requests')) return { versions: [], sessions: [], requests: [] };
        return {
            versions: this.db.prepare("SELECT * FROM schedule_versions WHERE status='DRAFT'").all(),
            sessions: this.db.prepare("SELECT * FROM activity_sessions WHERE status='DRAFT'").all(),
            requests: this.db.prepare('SELECT * FROM schedule_change_requests').all()
        };
    }

    restoreTeacherDomainData(preserved) {
        const insertRow = (table, row) => {
            const columns = Object.keys(row);
            const placeholders = columns.map(() => '?').join(',');
            this.db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`)
                .run(...columns.map(column => row[column]));
        };
        preserved.versions.forEach(row => insertRow('schedule_versions', row));
        preserved.sessions.forEach(row => insertRow('activity_sessions', row));
        preserved.requests.forEach(row => insertRow('schedule_change_requests', row));
    }

    replaceNormalizedData(fullBackup) {
        const preservedTeacherDomain = this.preserveTeacherDomainData();
        this.clearBusinessTables();
        const data = fullBackup.data.timetableData || {};
        const settings = fullBackup.data.timetableSettings || {};
        const erp = data.erpData || {};
        const timestamp = nowIso();
        const insert = (sql, values) => this.db.prepare(sql).run(...values);

        insert('INSERT INTO organizations VALUES (?, ?, ?, ?)', [DEFAULT_IDS.organization, '默认机构', timestamp, timestamp]);
        insert('INSERT INTO campuses VALUES (?, ?, ?, ?, ?)', [DEFAULT_IDS.campus, DEFAULT_IDS.organization, '默认校区', timestamp, timestamp]);

        const teacherNames = [...new Set(asArray(data.subjects).map(subject => String(subject.teacher || '').trim()).filter(Boolean))];
        const teacherMap = new Map();
        if (!teacherNames.length) teacherNames.push('当前教师');
        teacherNames.forEach(name => {
            const id = name === '当前教师' ? DEFAULT_IDS.teacher : stableId('teacher', name);
            teacherMap.set(name, id);
            insert('INSERT INTO teachers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, DEFAULT_IDS.organization, DEFAULT_IDS.campus, name, null, 'active', name, timestamp, timestamp]);
        });
        const currentTeacherId = teacherMap.get(teacherNames[0]);
        this.setMetadata('current_teacher_id', currentTeacherId);

        asArray(fullBackup.data.timetableGrades).forEach((grade, index) => {
            insert('INSERT INTO grades VALUES (?, ?, ?, ?, ?, ?)', [String(grade.id), DEFAULT_IDS.organization, String(grade.name), index, timestamp, timestamp]);
        });
        const gradeByName = new Map(asArray(fullBackup.data.timetableGrades).map(grade => [String(grade.name), String(grade.id)]));
        asArray(data.subjects).forEach(subject => {
            insert('INSERT INTO subjects VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
                String(subject.id), DEFAULT_IDS.organization, String(subject.name || ''), subject.color || null,
                1, subject.teacher || null, timestamp, timestamp
            ]);
        });
        asArray(data.students).forEach(student => {
            const status = student.isCompleted ? 'completed' : (student.isPaused ? 'paused' : 'active');
            insert('INSERT INTO students VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                String(student.id), DEFAULT_IDS.organization, String(student.name || ''),
                gradeByName.get(String(student.grade || '')) || null, null, null, status,
                json(student), timestamp, timestamp
            ]);
        });
        asArray(data.periods).map(parsePeriod).forEach((period, index) => {
            insert('INSERT INTO time_periods VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
                period.id, DEFAULT_IDS.organization, period.name, period.start, period.end, index, timestamp, timestamp
            ]);
        });
        insert('INSERT INTO schedule_versions VALUES (?, ?, ?, ?, ?, ?, ?)', [
            DEFAULT_IDS.scheduleVersion, DEFAULT_IDS.organization, '旧版课表迁移', 'PUBLISHED', timestamp, timestamp, timestamp
        ]);

        const subjectTeacher = new Map(asArray(data.subjects).map(subject => [
            String(subject.id), teacherMap.get(String(subject.teacher || '').trim()) || currentTeacherId
        ]));
        const templateIds = new Set();
        asArray(erp.courseTemplates).forEach(template => {
            const id = String(template.id);
            templateIds.add(id);
            insert(`INSERT INTO course_templates
                (id,organization_id,subject_id,teacher_id,class_id,weekday,period_id,start_date,end_date,repeat_type,enabled,payload_json,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                id, DEFAULT_IDS.organization, template.subjectId == null ? null : String(template.subjectId),
                subjectTeacher.get(String(template.subjectId)) || currentTeacherId, null, null, null,
                template.startDate || null, template.endDate || null, template.repeatType || 'weekly',
                template.archived ? 0 : 1, json(template), template.createdAt || timestamp, template.updatedAt || timestamp
            ]);
        });

        const studentIds = new Set(asArray(data.students).map(student => String(student.id)));
        asArray(erp.studentCourseRelations).forEach(relation => {
            const templateId = String(relation.courseTemplateId || relation.templateId || '');
            const studentId = String(relation.studentId || relation.studentUid || '');
            if (!templateIds.has(templateId) || !studentIds.has(studentId)) return;
            insert(`INSERT OR REPLACE INTO student_courses
                (id,organization_id,student_uid,course_template_id,join_date,leave_date,status,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)`, [
                String(relation.id || stableId('enrollment', `${studentId}:${templateId}`)), DEFAULT_IDS.organization,
                studentId, templateId, relation.joinDate || null, relation.leaveDate || null,
                relation.relationStatus || relation.status || 'active', relation.createdAt || timestamp, relation.updatedAt || timestamp
            ]);
        });

        const sessionIds = new Set();
        const instanceIds = new Set();
        asArray(erp.courseInstances).forEach(instance => {
            if (instance.isDeleted || instance.status === 'deleted') return;
            const id = String(instance.id);
            const templateId = instance.courseTemplateId == null ? null : String(instance.courseTemplateId);
            if (templateId && !templateIds.has(templateId)) return;
            const subjectId = instance.subjectId || (templateId && asArray(erp.courseTemplates).find(item => String(item.id) === templateId)?.subjectId);
            const teacherId = subjectTeacher.get(String(subjectId)) || currentTeacherId;
            const date = sessionDate(instance);
            const periodIndex = Number(String(instance.cellKey || '').split('-').pop());
            const period = asArray(data.periods)[periodIndex];
            const parsedPeriod = period ? parsePeriod(period, periodIndex) : null;
            const startTime = instance.actualStartTime || instance.standardStartTime || (parsedPeriod && parsedPeriod.start);
            const endTime = instance.actualEndTime || instance.standardEndTime || (parsedPeriod && parsedPeriod.end);
            insert(`INSERT INTO activity_sessions
                (id,organization_id,campus_id,template_id,teacher_id,resource_id,schedule_version_id,class_date,start_time,end_time,status,payload_json,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                id, DEFAULT_IDS.organization, DEFAULT_IDS.campus, templateId, teacherId, null,
                DEFAULT_IDS.scheduleVersion, date, startTime || null, endTime || null, 'PUBLISHED',
                json(instance), instance.createdAt || timestamp, instance.updatedAt || timestamp
            ]);
            insert(`INSERT INTO course_instances
                (id,organization_id,activity_session_id,template_id,class_date,start_time,end_time,status,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`, [
                id, DEFAULT_IDS.organization, id, templateId, date, startTime || null, endTime || null,
                instance.status || 'scheduled', instance.createdAt || timestamp, instance.updatedAt || timestamp
            ]);
            sessionIds.add(id);
            instanceIds.add(id);
            asArray(instance.studentIds).filter(studentId => studentIds.has(String(studentId))).forEach(studentId => {
                insert('INSERT OR IGNORE INTO session_participants VALUES (?, ?, ?)', [id, String(studentId), timestamp]);
            });
        });

        asArray(erp.attendanceRecords).forEach(record => {
            const instanceId = String(record.courseInstanceId || '');
            const studentId = String(record.studentId || '');
            if (!instanceIds.has(instanceId) || !studentIds.has(studentId)) return;
            insert(`INSERT OR REPLACE INTO attendance_records
                (id,organization_id,student_uid,course_instance_id,status,actual_minutes,note,payload_json,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`, [
                String(record.id || stableId('attendance', `${studentId}:${instanceId}`)), DEFAULT_IDS.organization,
                studentId, instanceId, record.status || 'unknown', record.actualMinutes == null ? null : Number(record.actualMinutes),
                record.note || null, json(record), record.createdAt || timestamp, record.updatedAt || timestamp
            ]);
        });
        asArray(erp.repeatRules).forEach(rule => {
            const sessionId = String(rule.courseInstanceId || '');
            if (!sessionIds.has(sessionId)) return;
            insert('INSERT INTO recurrence_rules VALUES (?, ?, ?, ?, ?, ?)', [
                String(rule.id || stableId('recurrence', json(rule))), DEFAULT_IDS.organization, sessionId,
                json(rule), rule.createdAt || timestamp, rule.updatedAt || timestamp
            ]);
        });
        asArray(erp.exceptionRules).forEach(rule => {
            const sessionId = String(rule.courseInstanceId || '');
            if (!sessionIds.has(sessionId)) return;
            insert('INSERT INTO exception_rules VALUES (?, ?, ?, ?, ?, ?)', [
                String(rule.id || stableId('exception', json(rule))), DEFAULT_IDS.organization, sessionId,
                json(rule), rule.createdAt || timestamp, rule.updatedAt || timestamp
            ]);
        });
        this.restoreTeacherDomainData(preservedTeacherDomain);
        this.setMetadata('source_schema_version', String(data.schemaVersion || 0));
        this.setMetadata('settings_schema_version', String(settings.schemaVersion || 0));
    }

    validateSnapshot(fullBackup) {
        const data = fullBackup.data.timetableData || {};
        const erp = data.erpData || {};
        const count = table => Number(this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
        const importedSessionCount = () => Number(this.db.prepare(
            "SELECT COUNT(*) AS count FROM activity_sessions WHERE status <> 'DRAFT'"
        ).get().count);
        const errors = [];
        const expected = {
            subjects: asArray(data.subjects).length,
            students: asArray(data.students).length,
            templates: asArray(erp.courseTemplates).length,
            sessions: asArray(erp.courseInstances).filter(instance => !instance.isDeleted && instance.status !== 'deleted').length,
            relations: asArray(erp.studentCourseRelations).length,
            attendance: asArray(erp.attendanceRecords).length,
            actualMinutes: asArray(erp.attendanceRecords).reduce((sum, record) => {
                return sum + (record.actualMinutes == null ? 0 : Number(record.actualMinutes) || 0);
            }, 0)
        };
        if (count('subjects') !== expected.subjects) errors.push('subject count mismatch');
        if (count('students') !== expected.students) errors.push('student count mismatch');
        if (count('course_templates') !== expected.templates) errors.push('course template count mismatch');
        if (importedSessionCount() !== expected.sessions) errors.push('activity session count mismatch');
        if (count('student_courses') !== expected.relations) errors.push('student course relation count mismatch');
        if (count('attendance_records') !== expected.attendance) errors.push('attendance count mismatch');
        const actualMinutes = Number(this.db.prepare('SELECT COALESCE(SUM(actual_minutes), 0) AS total FROM attendance_records').get().total);
        if (actualMinutes !== expected.actualMinutes) errors.push('attendance actual minutes mismatch');
        const fkErrors = this.db.prepare('PRAGMA foreign_key_check').all();
        if (fkErrors.length) errors.push(`${fkErrors.length} foreign key violation(s)`);
        return {
            valid: errors.length === 0,
            errors,
            counts: {
                subjects: count('subjects'), students: count('students'), teachers: count('teachers'),
                templates: count('course_templates'), sessions: importedSessionCount(),
                relations: count('student_courses'), attendance: count('attendance_records')
            },
            statistics: { actualMinutes }
        };
    }

    async createBackup(destinationPath) {
        const target = path.resolve(destinationPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        await backup(this.db, target);
        return target;
    }

    async restoreBackup(sourcePath) {
        const source = path.resolve(sourcePath);
        const candidate = new DatabaseSync(source, { readOnly: true });
        try {
            const integrity = candidate.prepare('PRAGMA integrity_check').get();
            if (!integrity || integrity.integrity_check !== 'ok') throw new Error('SQLite backup integrity check failed');
            const version = candidate.prepare("SELECT MAX(version) AS version FROM schema_migrations").get();
            if (!version || Number(version.version) > MIGRATIONS[MIGRATIONS.length - 1].version) {
                throw new Error('SQLite backup schema is newer than this application');
            }
        } finally {
            candidate.close();
        }
        const safetyPath = `${this.filePath}.before-restore-${Date.now()}.sqlite`;
        await this.createBackup(safetyPath);
        this.close();
        fs.copyFileSync(source, this.filePath);
        this.open();
        return { restored: true, safetyPath };
    }
}

module.exports = { DEFAULT_IDS, ScheduleDatabase };
