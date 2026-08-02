'use strict';

class TeacherRepository {
    constructor(database) { this.database = database; }
    getById(id) {
        return this.database.prepare('SELECT * FROM teachers WHERE id = ?').get(String(id)) || null;
    }
    listByOrganization(organizationId) {
        return this.database.prepare('SELECT * FROM teachers WHERE organization_id = ? ORDER BY name').all(String(organizationId));
    }
}

class SessionRepository {
    constructor(database) { this.database = database; }
    getById(id) {
        return this.database.prepare('SELECT * FROM activity_sessions WHERE id = ?').get(String(id)) || null;
    }
    listForTeacher(teacherId, statuses = ['PUBLISHED', 'COMPLETED']) {
        const allowed = statuses.filter(status => ['PUBLISHED', 'COMPLETED'].includes(status));
        if (!allowed.length) return [];
        const placeholders = allowed.map(() => '?').join(',');
        return this.database.prepare(
            `SELECT * FROM activity_sessions WHERE teacher_id = ? AND status IN (${placeholders}) ORDER BY class_date, start_time`
        ).all(String(teacherId), ...allowed);
    }
    getPublishedForTeacher(id, teacherId) {
        return this.database.prepare(`SELECT * FROM activity_sessions
            WHERE id = ? AND teacher_id = ? AND status IN ('PUBLISHED','COMPLETED')`)
            .get(String(id), String(teacherId)) || null;
    }
    listChangesForTeacher(teacherId, since) {
        const timestamp = since || '1970-01-01T00:00:00.000Z';
        return this.database.prepare(`SELECT * FROM activity_sessions
            WHERE teacher_id = ? AND status IN ('PUBLISHED','COMPLETED') AND updated_at > ?
            ORDER BY updated_at, id`).all(String(teacherId), String(timestamp));
    }
    transition(id, targetStatus) {
        const session = this.getById(id);
        if (!session) throw new Error(`Session not found: ${id}`);
        const transitions = { DRAFT: ['PUBLISHED'], PUBLISHED: ['COMPLETED'], COMPLETED: [] };
        if (!transitions[session.status].includes(targetStatus)) {
            throw new Error(`Illegal session transition: ${session.status} -> ${targetStatus}`);
        }
        const now = new Date().toISOString();
        this.database.prepare('UPDATE activity_sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run(targetStatus, now, String(id));
        return this.getById(id);
    }
}

class ScheduleVersionRepository {
    constructor(database) { this.database = database; }
    getById(id) {
        return this.database.prepare('SELECT * FROM schedule_versions WHERE id = ?').get(String(id)) || null;
    }
    listByOrganization(organizationId) {
        return this.database.prepare('SELECT * FROM schedule_versions WHERE organization_id = ? ORDER BY created_at DESC')
            .all(String(organizationId));
    }
}

module.exports = { ScheduleVersionRepository, SessionRepository, TeacherRepository };
