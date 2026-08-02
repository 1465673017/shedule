'use strict';

const MIGRATIONS = [{
    version: 1,
    name: 'shared_schedule_foundation',
    sql: `
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_snapshots (
            key TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS campuses (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (organization_id, name)
        );
        CREATE TABLE IF NOT EXISTS grades (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (organization_id, name)
        );
        CREATE TABLE IF NOT EXISTS head_teachers (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phone TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS teachers (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            campus_id TEXT REFERENCES campuses(id),
            name TEXT NOT NULL,
            phone TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
            legacy_name TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (organization_id, name)
        );
        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            color TEXT,
            enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
            legacy_teacher_name TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS classes (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            capacity INTEGER NOT NULL DEFAULT 4 CHECK (capacity > 0),
            grade_id TEXT REFERENCES grades(id),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS students (
            uid TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            grade_id TEXT REFERENCES grades(id),
            class_id TEXT REFERENCES classes(id),
            head_teacher_id TEXT REFERENCES head_teachers(id),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
            payload_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS time_periods (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (organization_id, sort_order)
        );
        CREATE TABLE IF NOT EXISTS resources (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            campus_id TEXT NOT NULL REFERENCES campuses(id),
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'classroom',
            capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
            enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schedule_versions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','COMPLETED')),
            published_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS course_templates (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            subject_id TEXT REFERENCES subjects(id),
            teacher_id TEXT NOT NULL REFERENCES teachers(id),
            class_id TEXT REFERENCES classes(id),
            weekday INTEGER CHECK (weekday BETWEEN 1 AND 7),
            period_id TEXT REFERENCES time_periods(id),
            start_date TEXT,
            end_date TEXT,
            repeat_type TEXT NOT NULL DEFAULT 'weekly',
            enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
            payload_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS student_courses (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            student_uid TEXT NOT NULL REFERENCES students(uid) ON DELETE CASCADE,
            course_template_id TEXT NOT NULL REFERENCES course_templates(id) ON DELETE CASCADE,
            join_date TEXT,
            leave_date TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (student_uid, course_template_id)
        );
        CREATE TABLE IF NOT EXISTS activity_sessions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            campus_id TEXT NOT NULL REFERENCES campuses(id),
            template_id TEXT REFERENCES course_templates(id),
            teacher_id TEXT NOT NULL REFERENCES teachers(id),
            resource_id TEXT REFERENCES resources(id),
            schedule_version_id TEXT NOT NULL REFERENCES schedule_versions(id),
            class_date TEXT,
            start_time TEXT,
            end_time TEXT,
            status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','COMPLETED')),
            payload_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS course_instances (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            activity_session_id TEXT NOT NULL UNIQUE REFERENCES activity_sessions(id) ON DELETE CASCADE,
            template_id TEXT REFERENCES course_templates(id),
            class_date TEXT,
            start_time TEXT,
            end_time TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS session_participants (
            session_id TEXT NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
            student_uid TEXT NOT NULL REFERENCES students(uid) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            PRIMARY KEY (session_id, student_uid)
        );
        CREATE TABLE IF NOT EXISTS attendance_records (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            student_uid TEXT NOT NULL REFERENCES students(uid) ON DELETE CASCADE,
            course_instance_id TEXT NOT NULL REFERENCES course_instances(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            actual_minutes INTEGER,
            note TEXT,
            payload_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (student_uid, course_instance_id)
        );
        CREATE TABLE IF NOT EXISTS recurrence_rules (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            activity_session_id TEXT NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
            rule_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS exception_rules (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            activity_session_id TEXT NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
            rule_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_teachers_organization ON teachers(organization_id);
        CREATE INDEX IF NOT EXISTS idx_students_organization ON students(organization_id);
        CREATE INDEX IF NOT EXISTS idx_templates_teacher ON course_templates(teacher_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_teacher_date ON activity_sessions(teacher_id, class_date);
        CREATE INDEX IF NOT EXISTS idx_sessions_version_status ON activity_sessions(schedule_version_id, status);
        CREATE INDEX IF NOT EXISTS idx_participants_student ON session_participants(student_uid);
        CREATE INDEX IF NOT EXISTS idx_attendance_instance ON attendance_records(course_instance_id);
    `
}, {
    version: 2,
    name: 'teacher_domain_services',
    sql: `SELECT 1;`
}, {
    version: 3,
    name: 'remove_schedule_change_requests',
    sql: `DROP TABLE IF EXISTS schedule_change_requests;`
}];

module.exports = { MIGRATIONS };
