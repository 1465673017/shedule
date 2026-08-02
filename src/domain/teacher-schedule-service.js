'use strict';

class TeacherScheduleService {
    constructor(database) { this.database = database; }

    requireTeacher(teacherId) {
        const currentTeacherId = this.database.metadata('current_teacher_id');
        if (!teacherId || String(teacherId) !== String(currentTeacherId)) {
            throw new Error('Teacher access denied');
        }
        return String(teacherId);
    }

    getMySchedule(teacherId, range = {}) {
        const id = this.requireTeacher(teacherId);
        return this.database.sessions.listForTeacher(id).filter(session => {
            if (range.from && session.class_date && session.class_date < range.from) return false;
            if (range.to && session.class_date && session.class_date > range.to) return false;
            return true;
        });
    }

    getSessionDetail(teacherId, sessionId) {
        const id = this.requireTeacher(teacherId);
        const session = this.database.sessions.getPublishedForTeacher(sessionId, id);
        if (!session) throw new Error('Session not found or not visible');
        return session;
    }

    listPublishedChanges(teacherId, since) {
        const id = this.requireTeacher(teacherId);
        return this.database.sessions.listChangesForTeacher(id, since);
    }
}

module.exports = { TeacherScheduleService };
