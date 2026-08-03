'use strict';

class TeacherScheduleService {
    constructor(database) { this.database = database; }

    getMySchedule(_teacherId, range = {}) {
        return this.database.sessions.listPublished().filter(session => {
            if (range.from && session.class_date && session.class_date < range.from) return false;
            if (range.to && session.class_date && session.class_date > range.to) return false;
            return true;
        });
    }

    getSessionDetail(_teacherId, sessionId) {
        const session = this.database.sessions.getPublished(sessionId);
        if (!session) throw new Error('Session not found or not visible');
        return session;
    }

    listPublishedChanges(_teacherId, since) {
        return this.database.sessions.listPublishedChanges(since);
    }
}

module.exports = { TeacherScheduleService };
