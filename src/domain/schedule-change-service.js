'use strict';

const crypto = require('crypto');

function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }

class ScheduleChangeService {
    constructor(database) { this.database = database; }

    submit(teacherId, input) {
        const session = this.database.sessions.getPublishedForTeacher(input.sessionId, teacherId);
        if (!session || session.status !== 'PUBLISHED') throw new Error('Only own published sessions can be changed');
        if (!input.reason || !String(input.reason).trim()) throw new Error('Change reason is required');
        const timestamp = nowIso();
        const request = {
            id: id('change'), sessionId: String(input.sessionId), teacherId: String(teacherId),
            targetDate: input.targetDate || session.class_date,
            targetStartTime: input.targetStartTime || session.start_time,
            targetEndTime: input.targetEndTime || session.end_time,
            reason: String(input.reason).trim(), status: 'PENDING', createdAt: timestamp, updatedAt: timestamp
        };
        this.database.changeRequests.create(request);
        return this.database.changeRequests.getById(request.id);
    }

    cancel(teacherId, requestId) {
        return this.database.changeRequests.transition(requestId, 'CANCELLED', { teacherId });
    }

    approve(requestId, reviewerId) {
        return this.database.transaction(() => {
            const request = this.database.changeRequests.requirePending(requestId);
            const source = this.database.sessions.getById(request.session_id);
            const timestamp = nowIso();
            const versionId = id('schedule-version');
            const draftSessionId = id('session-draft');
            this.database.db.prepare(`INSERT INTO schedule_versions
                (id,organization_id,name,status,published_at,created_at,updated_at)
                VALUES (?,?,?,'DRAFT',NULL,?,?)`)
                .run(versionId, source.organization_id, `调课申请 ${request.id}`, timestamp, timestamp);
            this.database.db.prepare(`INSERT INTO activity_sessions
                (id,organization_id,campus_id,template_id,teacher_id,resource_id,schedule_version_id,class_date,start_time,end_time,status,payload_json,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,'DRAFT',?,?,?)`)
                .run(draftSessionId, source.organization_id, source.campus_id, source.template_id, source.teacher_id,
                    source.resource_id, versionId, request.target_date, request.target_start_time, request.target_end_time,
                    source.payload_json, timestamp, timestamp);
            this.database.changeRequests.transition(requestId, 'APPROVED', { reviewerId, draftSessionId });
            return { request: this.database.changeRequests.getById(requestId), draftSessionId, scheduleVersionId: versionId };
        });
    }

    reject(requestId, reviewerId, note) {
        return this.database.changeRequests.transition(requestId, 'REJECTED', { reviewerId, reviewNote: note });
    }
}

module.exports = { ScheduleChangeService };
