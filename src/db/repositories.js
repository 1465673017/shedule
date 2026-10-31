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
    listPublished(statuses = ['PUBLISHED', 'COMPLETED']) {
        const allowed = statuses.filter(status => ['PUBLISHED', 'COMPLETED'].includes(status));
        if (!allowed.length) return [];
        const placeholders = allowed.map(() => '?').join(',');
        return this.database.prepare(
            `SELECT * FROM activity_sessions WHERE status IN (${placeholders}) ORDER BY class_date, start_time`
        ).all(...allowed);
    }
    listForTeacher(_teacherId, statuses = ['PUBLISHED', 'COMPLETED']) {
        return this.listPublished(statuses);
    }
    getPublished(id) {
        return this.database.prepare(`SELECT * FROM activity_sessions
            WHERE id = ? AND status IN ('PUBLISHED','COMPLETED')`)
            .get(String(id)) || null;
    }
    getPublishedForTeacher(id, _teacherId) {
        return this.getPublished(id);
    }
    listPublishedChanges(since) {
        const timestamp = since || '1970-01-01T00:00:00.000Z';
        return this.database.prepare(`SELECT * FROM activity_sessions
            WHERE status IN ('PUBLISHED','COMPLETED') AND updated_at > ?
            ORDER BY updated_at, id`).all(String(timestamp));
    }
    listChangesForTeacher(_teacherId, since) {
        return this.listPublishedChanges(since);
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

class MemoRepository {
    constructor(database) { this.database = database; }
    list(teacherId) {
        return this.database.prepare(`SELECT * FROM schedule_memos WHERE teacher_id = ?
            ORDER BY done, CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date, updated_at DESC`)
            .all(String(teacherId)).map(row => ({
                id: row.id, title: row.title, content: row.content, color: row.color,
                due: row.due_date, note: row.note, tags: JSON.parse(row.tags_json || '[]'),
                done: Boolean(row.done), cellRef: (() => { try { return row.cell_ref ? JSON.parse(row.cell_ref) : null; } catch { return row.cell_ref; } })(),
                createdAt: row.created_at, updatedAt: row.updated_at
            }));
    }
    save(teacherId, input) {
        if (!input || typeof input !== 'object') throw new TypeError('Invalid memo');
        if (!this.database.prepare('SELECT 1 FROM teachers WHERE id=?').get(String(teacherId))) throw new Error('Memo owner not found');
        const title = String(input.title || '').trim().slice(0, 160);
        if (!title) throw new TypeError('Memo title is required');
        const id = String(input.id || require('crypto').randomUUID());
        if (!/^[\w-]{1,100}$/.test(id)) throw new TypeError('Invalid memo id');
        const due = input.due == null || input.due === '' ? null : String(input.due);
        if (due && !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/.test(due)) throw new TypeError('Invalid memo date');
        const color = /^#[0-9a-f]{6}$/i.test(String(input.color || '')) ? String(input.color) : '#fff7cc';
        const tags = Array.isArray(input.tags) ? input.tags.slice(0, 20).map(tag => String(tag).slice(0, 40)) : [];
        const now = new Date().toISOString();
        this.database.prepare(`INSERT INTO schedule_memos
            (id,teacher_id,title,content,color,due_date,note,tags_json,done,cell_ref,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,content=excluded.content,color=excluded.color,due_date=excluded.due_date,
            note=excluded.note,tags_json=excluded.tags_json,done=excluded.done,cell_ref=excluded.cell_ref,updated_at=excluded.updated_at
            WHERE schedule_memos.teacher_id=excluded.teacher_id`)
            .run(id, String(teacherId), title, String(input.content || '').slice(0, 20000), color, due,
                String(input.note || '').slice(0, 2000), JSON.stringify(tags), input.done ? 1 : 0,
                input.cellRef == null ? null : JSON.stringify(input.cellRef).slice(0, 200), now, now);
        const saved = this.database.prepare('SELECT teacher_id FROM schedule_memos WHERE id=?').get(id);
        if (!saved || saved.teacher_id !== String(teacherId)) throw new Error('Memo not found');
        return this.list(teacherId).find(memo => memo.id === id);
    }
    remove(teacherId, id) {
        return this.database.prepare('DELETE FROM schedule_memos WHERE teacher_id=? AND id=?')
            .run(String(teacherId), String(id)).changes > 0;
    }
}

module.exports = { MemoRepository, ScheduleVersionRepository, SessionRepository, TeacherRepository };
