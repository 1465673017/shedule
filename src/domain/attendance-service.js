'use strict';

const crypto = require('crypto');

function nowIso() { return new Date().toISOString(); }
function attendanceId(sessionId, studentId) {
    return `attendance-${crypto.createHash('sha256').update(`${sessionId}:${studentId}`).digest('hex').slice(0, 16)}`;
}

class AttendanceService {
    constructor(database) { this.database = database; }

    requireEditableSession(sessionId) {
        const session = this.database.sessions.getPublished(sessionId);
        if (!session) throw new Error('Session not found or not editable');
        if (session.status === 'COMPLETED') throw new Error('Completed session cannot be modified');
        return session;
    }

    markAttendance(teacherId, sessionId, studentId, status) {
        if (!['present', 'absent', 'leave', 'audition', 'unknown'].includes(status)) {
            throw new Error(`Invalid attendance status: ${status}`);
        }
        return this.database.transaction(() => {
            this.requireEditableSession(sessionId);
            this.database.requireParticipant(sessionId, studentId);
            const timestamp = nowIso();
            this.database.db.prepare(`INSERT INTO attendance_records
                (id,organization_id,student_uid,course_instance_id,status,actual_minutes,note,payload_json,created_at,updated_at)
                SELECT ?,organization_id,?,id,?,NULL,NULL,NULL,?,? FROM course_instances WHERE id = ?
                ON CONFLICT(student_uid,course_instance_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`)
                .run(attendanceId(sessionId, studentId), String(studentId), status, timestamp, timestamp, String(sessionId));
            this.database.invalidateStatistics();
            return this.database.getAttendance(sessionId, studentId);
        });
    }

    setActualMinutes(teacherId, sessionId, studentId, actualMinutes) {
        const value = Number(actualMinutes);
        if (!Number.isInteger(value) || value < 0 || value > 24 * 60) throw new Error('Invalid actual minutes');
        return this.database.transaction(() => {
            this.requireEditableSession(sessionId);
            this.database.requireParticipant(sessionId, studentId);
            const timestamp = nowIso();
            this.database.db.prepare(`INSERT INTO attendance_records
                (id,organization_id,student_uid,course_instance_id,status,actual_minutes,note,payload_json,created_at,updated_at)
                SELECT ?,organization_id,?,id,'unknown',?,NULL,NULL,?,? FROM course_instances WHERE id = ?
                ON CONFLICT(student_uid,course_instance_id) DO UPDATE SET actual_minutes=excluded.actual_minutes,updated_at=excluded.updated_at`)
                .run(attendanceId(sessionId, studentId), String(studentId), value, timestamp, timestamp, String(sessionId));
            this.database.invalidateStatistics();
            return this.database.getAttendance(sessionId, studentId);
        });
    }

    completeSession(teacherId, sessionId) {
        return this.database.transaction(() => {
            this.requireEditableSession(sessionId);
            const session = this.database.sessions.transition(sessionId, 'COMPLETED');
            this.database.invalidateStatistics();
            return session;
        });
    }
}

module.exports = { AttendanceService };
