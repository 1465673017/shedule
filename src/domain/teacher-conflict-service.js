'use strict';

function minutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function overlaps(left, right) {
    if (!left.classDate || left.classDate !== right.classDate) return false;
    const leftStart = minutes(left.startTime);
    const leftEnd = minutes(left.endTime);
    const rightStart = minutes(right.startTime);
    const rightEnd = minutes(right.endTime);
    return [leftStart, leftEnd, rightStart, rightEnd].every(Number.isFinite)
        && leftStart < rightEnd && rightStart < leftEnd;
}

function conflict(code, message, sessions = []) {
    return { code, message, conflictingSessionIds: sessions.map(session => String(session.id)) };
}

class TeacherConflictService {
    check(candidate, existingSessions = [], options = {}) {
        const conflicts = [];
        const participants = [...new Set((candidate.studentIds || []).map(String))];
        const capacity = Number(options.capacity || candidate.capacity || 4);
        if (participants.length > capacity) {
            conflicts.push(conflict('CAPACITY_EXCEEDED', `课程人数不能超过 ${capacity} 人`));
        }
        if (candidate.is1v1 && participants.length !== 1) {
            conflicts.push(conflict('ONE_TO_ONE_REQUIRES_ONE_STUDENT', '1对1课程必须且只能有一名学员'));
        }
        const auditionIds = (candidate.auditionStudentIds || []).map(String);
        if (new Set(auditionIds).size > 1) {
            conflicts.push(conflict('MULTIPLE_AUDITION_STUDENTS', '同一课程只能安排一名试听学员'));
        }

        const overlapping = existingSessions.filter(session =>
            String(session.id) !== String(candidate.id || '')
            && String(session.teacherId) === String(candidate.teacherId)
            && overlaps(candidate, session)
        );
        if (overlapping.length) {
            conflicts.push(conflict('TEACHER_TIME_OVERLAP', '教师在该时段已有课程', overlapping));
        }
        return conflicts;
    }
}

module.exports = { TeacherConflictService, overlaps };
