// app-erp.js - Schedule ERP service and timetable projection

(function() {
    const SCHEMA_VERSION = 5;

    const makeId = (prefix) => {
        const rand = Math.random().toString(36).slice(2, 8);
        return `${prefix}_${Date.now().toString(36)}_${rand}`;
    };

    const normalizeIds = (ids) => Array.isArray(ids) ? ids.map(id => String(id)) : [];

    function normalizeSubjectId(app, subjectId, studentIds) {
        if (subjectId !== null && subjectId !== undefined && subjectId !== '') {
            return String(subjectId);
        }

        const normalizedStudents = normalizeIds(studentIds);
        if (normalizedStudents.length === 0) return null;

        if (app && typeof app.ensureUncategorizedSubject === 'function') {
            const subject = app.ensureUncategorizedSubject();
            if (subject && subject.id !== undefined && subject.id !== null) {
                return String(subject.id);
            }
        }

        const fallback = app && Array.isArray(app.subjects)
            ? app.subjects.find(s => s && s.name === '未分类')
            : null;
        return fallback && fallback.id !== undefined && fallback.id !== null
            ? String(fallback.id)
            : null;
    }

    const sortVersions = (versions) => versions.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    function createEmptyErpData() {
        return {
            schemaVersion: SCHEMA_VERSION,
            courseTemplates: [],
            courseInstances: [],
            studentCourseRelations: [],
            attendanceRecords: [],
            repeatRules: [],
            exceptionRules: [],
            completedStageOccurrences: [],
            stageCompletionRecords: [],
            manualStageCompletionOverrides: []
        };
    }

    function ensureErpData(app) {
        if (!app.erpData) app.erpData = createEmptyErpData();
        app.erpData.schemaVersion = SCHEMA_VERSION;
        app.erpData.courseTemplates = app.erpData.courseTemplates || [];
        app.erpData.courseInstances = app.erpData.courseInstances || [];
        app.erpData.studentCourseRelations = app.erpData.studentCourseRelations || [];
        app.erpData.attendanceRecords = app.erpData.attendanceRecords || [];
        app.erpData.repeatRules = app.erpData.repeatRules || [];
        app.erpData.exceptionRules = app.erpData.exceptionRules || [];
        app.erpData.completedStageOccurrences = app.erpData.completedStageOccurrences || [];
        app.erpData.stageCompletionRecords = app.erpData.stageCompletionRecords || [];
        app.erpData.manualStageCompletionOverrides = app.erpData.manualStageCompletionOverrides || [];
        return app.erpData;
    }

    function makeTemplate(app, subjectId, studentIds, source) {
        const erp = ensureErpData(app);
        const normalizedSubjectId = normalizeSubjectId(app, subjectId, studentIds);
        const sorted = normalizeIds(studentIds).sort().join(',');
        const key = `${normalizedSubjectId || ''}::${sorted}`;
        let template = erp.courseTemplates.find(t => t.templateKey === key);
        if (!template) {
            template = {
                id: makeId('tpl'),
                templateKey: key,
                subjectId: normalizedSubjectId,
                defaultStudentIds: normalizeIds(studentIds),
                source: source || 'schedule',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            erp.courseTemplates.push(template);
        } else {
            template.subjectId = normalizedSubjectId;
            template.defaultStudentIds = normalizeIds(studentIds);
            template.archived = false;
            template.updatedAt = new Date().toISOString();
        }
        return template;
    }

    function cellKeyParts(cellKey) {
        const parts = String(cellKey || '').split('-');
        if (parts.length === 2) {
            return {
                day: parseInt(parts[0], 10),
                period: parseInt(parts[1], 10)
            };
        }
        return {
            day: parseInt(parts[0], 10),
            period: parseInt(parts[2], 10)
        };
    }

    function parseLocalDate(dateStr) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        date.setHours(0, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getCellOccurrenceDate(cellKey, weekStartStr) {
        const weekStart = parseLocalDate(weekStartStr);
        const day = cellKeyParts(cellKey).day;
        if (!weekStart || !Number.isInteger(day) || day < 1 || day > 7) return null;
        const occurrence = new Date(weekStart);
        occurrence.setDate(weekStart.getDate() + day - 1);
        return occurrence;
    }

    // Stage dates are stored for one school year. Shift them together by whole
    // years so the same N-stage layout can also describe subsequent years.
    function getStageOccurrenceForDate(app, date) {
        if (!app || !app.settings || !app.settings.segmentedScheduling || !date) return null;
        const stages = Array.isArray(app.settings.stages) ? app.settings.stages : [];
        for (const stage of stages) {
            const configuredStart = parseLocalDate(stage && stage.startDate);
            const configuredEnd = parseLocalDate(stage && stage.endDate);
            if (!configuredStart || !configuredEnd || configuredStart > configuredEnd) continue;
            const approximateShift = date.getFullYear() - configuredStart.getFullYear();
            for (let shift = approximateShift - 1; shift <= approximateShift + 1; shift++) {
                const start = new Date(configuredStart);
                const end = new Date(configuredEnd);
                start.setFullYear(configuredStart.getFullYear() + shift);
                end.setFullYear(configuredEnd.getFullYear() + shift);
                if (date >= start && date <= end) return { stage, start, end };
            }
        }
        return null;
    }

    function getVersionStageOccurrence(app, version) {
        if (!version) return null;
        if (version.schedulingMode === 'continuous') return null;
        if (version.schedulingMode === 'segmented') {
            const start = parseLocalDate(version.stageStartDate);
            const end = parseLocalDate(version.stageEndDate);
            if (!start || !end) return null;
            return { stage: { id: version.stageId || 'stage' }, start, end };
        }
        const firstOccurrence = getCellOccurrenceDate(version.cellKey, version.weekStart);
        return getStageOccurrenceForDate(app, firstOccurrence);
    }

    function isVersionWithinItsSchedulingStage(app, version, requestedWeekStart) {
        if (!version) return true;
        const requestedOccurrence = getCellOccurrenceDate(version.cellKey, requestedWeekStart);
        const stageOccurrence = getVersionStageOccurrence(app, version);
        // Only courses newly created inside a configured stage are bounded.
        if (!stageOccurrence || !requestedOccurrence) return true;
        return requestedOccurrence >= stageOccurrence.start && requestedOccurrence <= stageOccurrence.end;
    }

    function getLastOccurrenceInStage(cellKey, stageEnd) {
        const day = cellKeyParts(cellKey).day;
        if (!stageEnd || !Number.isInteger(day) || day < 1 || day > 7) return null;
        const endDay = stageEnd.getDay() === 0 ? 7 : stageEnd.getDay();
        const lastOccurrence = new Date(stageEnd);
        lastOccurrence.setDate(stageEnd.getDate() - ((endDay - day + 7) % 7));
        lastOccurrence.setHours(0, 0, 0, 0);
        return lastOccurrence;
    }

    function isStageFinalOccurrence(app, version, requestedWeekStart) {
        if (!version) return false;
        const requestedOccurrence = getCellOccurrenceDate(version.cellKey, requestedWeekStart);
        const stageOccurrence = getVersionStageOccurrence(app, version);
        if (!stageOccurrence || !requestedOccurrence) return false;
        const lastOccurrence = getLastOccurrenceInStage(version.cellKey, stageOccurrence.end);
        return !!lastOccurrence && requestedOccurrence.getTime() === lastOccurrence.getTime();
    }

    function isStudentStageAutoCompleted(app, studentId) {
        const erp = ensureErpData(app);
        return (erp.stageCompletionRecords || []).some(record =>
            Array.isArray(record.studentIds) && record.studentIds.some(id => String(id) === String(studentId))
        );
    }

    function hydrateLegacySchedulingModes(app) {
        const erp = ensureErpData(app);
        let changed = false;
        erp.courseInstances.forEach(instance => {
            if (instance.schedulingMode) return;
            const firstOccurrence = getCellOccurrenceDate(instance.cellKey, instance.weekStart);
            const stageOccurrence = app.settings && app.settings.segmentedScheduling
                ? getStageOccurrenceForDate(app, firstOccurrence)
                : null;
            instance.schedulingMode = stageOccurrence ? 'segmented' : 'continuous';
            instance.stageId = stageOccurrence ? (stageOccurrence.stage.id || stageOccurrence.stage.name || null) : null;
            instance.stageStartDate = stageOccurrence ? formatLocalDate(stageOccurrence.start) : null;
            instance.stageEndDate = stageOccurrence ? formatLocalDate(stageOccurrence.end) : null;
            changed = true;
        });
        return changed;
    }

    function formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function completeStudentsForEndedStages(app, asOfDate = new Date()) {
        if (!app) return false;
        const cutoff = asOfDate instanceof Date ? new Date(asOfDate) : parseLocalDate(asOfDate);
        if (!cutoff || Number.isNaN(cutoff.getTime())) return false;
        cutoff.setHours(23, 59, 59, 999);

        const erp = ensureErpData(app);
        const metadataChanged = hydrateLegacySchedulingModes(app);
        const previousAutoIds = new Set((erp.stageCompletionRecords || [])
            .flatMap(record => Array.isArray(record.studentIds) ? record.studentIds : [])
            .map(String));
        const manualOverrideIds = new Set((erp.manualStageCompletionOverrides || []).map(String));
        const endedOccurrences = new Map();

        erp.courseInstances.forEach(instance => {
            if (!instance || instance.isDeleted || !instance.cellKey || !instance.weekStart) return;
            const stageOccurrence = getVersionStageOccurrence(app, instance);
            if (!stageOccurrence || cutoff < stageOccurrence.end) return;
            const stageId = stageOccurrence.stage.id || stageOccurrence.stage.name || 'stage';
            const occurrenceKey = `${stageId}|${formatLocalDate(stageOccurrence.end)}`;
            if (!endedOccurrences.has(occurrenceKey)) {
                endedOccurrences.set(occurrenceKey, { end: stageOccurrence.end, studentIds: new Set() });
            }
            const relationIds = erp.studentCourseRelations
                .filter(relation => relation.courseInstanceId === instance.id)
                .map(relation => String(relation.studentId));
            const studentIds = relationIds.length ? relationIds : normalizeIds(instance.studentIds);
            studentIds.forEach(studentId => endedOccurrences.get(occurrenceKey).studentIds.add(studentId));
        });

        const nextRecords = [];
        const desiredAutoIds = new Set();
        endedOccurrences.forEach((occurrence, occurrenceKey) => {
            const automaticallyCompletedIds = [];
            const processedStudentIds = [];
            occurrence.studentIds.forEach(studentId => {
                const student = Array.isArray(app.students)
                    ? app.students.find(item => String(item.id) === studentId)
                    : null;
                if (!student || student.isAudition) return;
                processedStudentIds.push(studentId);
                const hasLaterCourse = erp.courseInstances.some(instance => {
                    if (!instance || instance.isDeleted) return false;
                    const occurrenceDate = getCellOccurrenceDate(instance.cellKey, instance.weekStart);
                    if (!occurrenceDate || occurrenceDate <= occurrence.end) return false;
                    const relationIds = erp.studentCourseRelations
                        .filter(relation => relation.courseInstanceId === instance.id)
                        .map(relation => String(relation.studentId));
                    const ids = relationIds.length ? relationIds : normalizeIds(instance.studentIds);
                    return ids.includes(studentId);
                });
                if (hasLaterCourse) return;
                if (manualOverrideIds.has(studentId)) return;
                const isManuallyCompleted = !!student.completed && !previousAutoIds.has(studentId);
                if (isManuallyCompleted) return;
                desiredAutoIds.add(studentId);
                automaticallyCompletedIds.push(studentId);
            });
            nextRecords.push({ key: occurrenceKey, studentIds: automaticallyCompletedIds, processedStudentIds });
        });

        let changed = metadataChanged || JSON.stringify(erp.stageCompletionRecords || []) !== JSON.stringify(nextRecords);
        (app.students || []).forEach(student => {
            if (!student || student.isAudition) return;
            const studentId = String(student.id);
            const wasAutoCompleted = previousAutoIds.has(studentId);
            const shouldAutoComplete = desiredAutoIds.has(studentId);
            if (wasAutoCompleted && !shouldAutoComplete) {
                student.completed = false;
                student.accountStatus = 'normal';
                changed = true;
            } else if (shouldAutoComplete && (!student.completed || student.accountStatus !== 'completed')) {
                student.completed = true;
                student.accountStatus = 'completed';
                changed = true;
            }
        });
        erp.studentCourseRelations.forEach(relation => {
            const student = (app.students || []).find(item => String(item.id) === String(relation.studentId));
            const nextStatus = student && student.completed ? 'completed' : 'normal';
            if (relation.accountStatus !== nextStatus) {
                relation.accountStatus = nextStatus;
                relation.updatedAt = new Date().toISOString();
                changed = true;
            }
        });
        erp.stageCompletionRecords = nextRecords;
        erp.completedStageOccurrences = nextRecords.map(record => record.key);
        return changed;
    }

    function makeRepeatRule(app, instance) {
        const erp = ensureErpData(app);
        const existing = erp.repeatRules.find(r => r.courseInstanceId === instance.id);
        const parts = cellKeyParts(instance.cellKey);
        const periodInfo = app.getPeriod(parts.period);
        const timeRange = periodInfo ? periodInfo.time : '';
        const payload = {
            id: existing ? existing.id : makeId('rr'),
            courseInstanceId: instance.id,
            frequency: 'weekly',
            dayOfWeek: parts.day,
            periodIndex: parts.period,
            timeRange,
            startDate: instance.weekStart,
            status: instance.status || 'recurring',
            updatedAt: new Date().toISOString()
        };
        if (existing) Object.assign(existing, payload);
        else erp.repeatRules.push({ ...payload, createdAt: new Date().toISOString() });
    }

    function syncRelations(app, instance, studentIds) {
        const erp = ensureErpData(app);
        const next = new Set(normalizeIds(studentIds));
        erp.studentCourseRelations = erp.studentCourseRelations.filter(rel => {
            if (rel.courseInstanceId !== instance.id) return true;
            return next.has(rel.studentId);
        });
        next.forEach(studentId => {
            const existing = erp.studentCourseRelations.find(rel =>
                rel.courseInstanceId === instance.id && rel.studentId === studentId
            );
            if (existing) {
                existing.status = existing.status || 'recurring';
                existing.updatedAt = new Date().toISOString();
            } else {
                const student = app.students.find(s => String(s.id) === String(studentId));
                erp.studentCourseRelations.push({
                    id: makeId('rel'),
                    courseInstanceId: instance.id,
                    studentId,
                    studentType: student && student.isAudition ? 'audition' : student && student.is1v1 ? '1v1' : '1vN',
                    relationStatus: student && (student.isAudition || (student.completed && !(app.settings && app.settings.segmentedScheduling))) ? 'temporary' : 'recurring',
                    accountStatus: student && student.completed ? 'completed' : 'normal',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        });
    }

    function reactivateStudentsForOpenStage(app, instance, studentIds) {
        const stageOccurrence = getVersionStageOccurrence(app, instance);
        if (!stageOccurrence) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (stageOccurrence.end <= today) return;

        normalizeIds(studentIds).forEach(studentId => {
            const student = app.students.find(item => String(item.id) === studentId);
            if (!student || student.isAudition || !student.completed) return;
            student.completed = false;
            student.accountStatus = 'normal';
            const erp = ensureErpData(app);
            erp.manualStageCompletionOverrides = erp.manualStageCompletionOverrides
                .filter(id => String(id) !== studentId);
            const relation = erp.studentCourseRelations.find(item =>
                item.courseInstanceId === instance.id && String(item.studentId) === studentId
            );
            if (relation) relation.accountStatus = 'normal';
        });
    }

    function syncAttendanceInstanceIds(app, oldInstanceId, newInstanceId) {
        if (!oldInstanceId || !newInstanceId || oldInstanceId === newInstanceId) return;
        const erp = ensureErpData(app);
        erp.attendanceRecords.forEach(record => {
            if (record.courseInstanceId === oldInstanceId) {
                record.courseInstanceId = newInstanceId;
            }
        });
    }

    function getInstanceForVersion(app, version) {
        const erp = ensureErpData(app);
        if (!version) return null;
        if (version.courseInstanceId) {
            const byId = erp.courseInstances.find(instance => instance.id === version.courseInstanceId);
            if (byId) return byId;
        }
        return erp.courseInstances.find(instance =>
            instance.cellKey === version.cellKey &&
            instance.weekStart === version.weekStart
        ) || null;
    }

    function setRelationStatus(app, cellKey, studentId, relationStatus, weekStart) {
        const erp = ensureErpData(app);
        const version = window.ScheduleErpService.getCellVersion(app, cellKey, weekStart);
        const instance = version ? erp.courseInstances.find(ci => ci.id === version.courseInstanceId) : null;
        if (!instance) return;

        let relation = erp.studentCourseRelations.find(rel =>
            rel.courseInstanceId === instance.id && rel.studentId === String(studentId)
        );
        if (!relation) {
            const student = app.students.find(s => String(s.id) === String(studentId));
            relation = {
                id: makeId('rel'),
                courseInstanceId: instance.id,
                studentId: String(studentId),
                studentType: student && student.isAudition ? 'audition' : student && student.is1v1 ? '1v1' : '1vN',
                accountStatus: student && student.completed ? 'completed' : 'normal',
                createdAt: new Date().toISOString()
            };
            erp.studentCourseRelations.push(relation);
        }
        relation.relationStatus = relationStatus;
        relation.updatedAt = new Date().toISOString();
    }

    function upsertExceptionRule(app, payload) {
        const erp = ensureErpData(app);
        const key = [
            payload.courseInstanceId || '',
            payload.cellKey || '',
            payload.weekStart || '',
            payload.studentId || '',
            payload.type || ''
        ].join('|');
        let rule = erp.exceptionRules.find(item => item.exceptionKey === key);
        if (!rule) {
            rule = {
                id: makeId('ex'),
                exceptionKey: key,
                createdAt: new Date().toISOString()
            };
            erp.exceptionRules.push(rule);
        }
        Object.assign(rule, payload, { updatedAt: new Date().toISOString() });
        return rule;
    }

    function clearInstanceDeletionRules(app, courseInstanceId, weekStartStr) {
        if (!courseInstanceId || !weekStartStr) return;
        const erp = ensureErpData(app);
        erp.exceptionRules = erp.exceptionRules.filter(rule => {
            if (rule.courseInstanceId !== courseInstanceId) return true;
            if (rule.weekStart !== weekStartStr) return true;
            return rule.type !== 'delete-instance';
        });
    }

    function clearStudentRecurrenceExceptions(app, courseInstanceId, studentId, fromWeekStart) {
        if (!courseInstanceId || !studentId || !fromWeekStart) return;
        const erp = ensureErpData(app);
        const clearableRuleTypes = new Set([
            'pause-student',
            'temporary-student',
            'complete-student'
        ]);
        erp.exceptionRules = erp.exceptionRules.filter(rule => {
            if (rule.courseInstanceId !== courseInstanceId) return true;
            if (String(rule.studentId || '') !== String(studentId)) return true;
            if (!clearableRuleTypes.has(rule.type)) return true;
            if (!rule.weekStart) return true;
            return rule.weekStart < fromWeekStart;
        });
    }

    function removeInstanceGraph(app, instanceIds) {
        const erp = ensureErpData(app);
        const ids = instanceIds instanceof Set ? instanceIds : new Set(instanceIds || []);
        if (ids.size === 0) return;
        erp.courseInstances = erp.courseInstances.filter(instance => !ids.has(instance.id));
        erp.repeatRules = erp.repeatRules.filter(rule => !ids.has(rule.courseInstanceId));
        erp.studentCourseRelations = erp.studentCourseRelations.filter(rel => !ids.has(rel.courseInstanceId));
        erp.exceptionRules = erp.exceptionRules.filter(rule => !ids.has(rule.courseInstanceId));
    }

    function pruneOrphanedErpData(app) {
        const erp = ensureErpData(app);
        const instanceIds = new Set(erp.courseInstances.map(instance => instance.id));
        erp.studentCourseRelations = erp.studentCourseRelations.filter(rel => instanceIds.has(rel.courseInstanceId));
        erp.repeatRules = erp.repeatRules.filter(rule => instanceIds.has(rule.courseInstanceId));
        erp.exceptionRules = erp.exceptionRules.filter(rule =>
            !rule.courseInstanceId || instanceIds.has(rule.courseInstanceId)
        );
    }

    function removeSubjectOnlyCourses(app) {
        const erp = ensureErpData(app);
        const validStudentIds = new Set((app.students || []).map(student => String(student.id)));
        const removedIds = new Set();

        erp.courseInstances.forEach(instance => {
            if (!instance || instance.isDeleted || !instance.subjectId) return;
            const relationIds = erp.studentCourseRelations
                .filter(relation => relation.courseInstanceId === instance.id)
                .map(relation => String(relation.studentId));
            const studentIds = relationIds.length ? relationIds : normalizeIds(instance.studentIds);
            if (!studentIds.some(studentId => validStudentIds.has(studentId))) {
                removedIds.add(instance.id);
            }
        });

        if (removedIds.size === 0) return false;
        removeInstanceGraph(app, removedIds);
        erp.attendanceRecords = erp.attendanceRecords.filter(record =>
            !record.courseInstanceId || !removedIds.has(record.courseInstanceId)
        );
        return true;
    }

    function clearEmptyRecurringStops(app, cellKey, fromWeekStart, mode = 'until-next-course') {
        if (!cellKey || !fromWeekStart) return;
        const erp = ensureErpData(app);
        const futureInstances = erp.courseInstances
            .filter(instance =>
                instance.cellKey === cellKey &&
                instance.weekStart &&
                (mode === 'all-future-empty'
                    ? instance.weekStart >= fromWeekStart
                    : instance.weekStart > fromWeekStart)
            )
            .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
        const removedInstanceIds = new Set();

        for (const instance of futureInstances) {
            const hasSubject = !!instance.subjectId;
            const hasStudents = normalizeIds(instance.studentIds).length > 0 ||
                erp.studentCourseRelations.some(rel => rel.courseInstanceId === instance.id);
            const isEmptyStop = instance.isDeleted || (!hasSubject && !hasStudents);

            // A real explicit course is the boundary for the newly inserted
            // recurrence. Never clear that course or any versions after it.
            if (!isEmptyStop) {
                if (mode === 'until-next-course') break;
                continue;
            }
            removedInstanceIds.add(instance.id);
        }

        removeInstanceGraph(app, removedInstanceIds);
    }

    function findNextExplicitVersionWeek(app, cellKey, fromWeekStart) {
        const erp = ensureErpData(app);
        let nextWeek = null;
        erp.courseInstances.forEach(instance => {
            if (instance.cellKey !== cellKey) return;
            if (!instance.weekStart || instance.weekStart <= fromWeekStart) return;
            if (!nextWeek || instance.weekStart < nextWeek) {
                nextWeek = instance.weekStart;
            }
        });
        return nextWeek;
    }

    function getExplicitVersionAtWeek(app, cellKey, weekStart) {
        const erp = ensureErpData(app);
        const instance = erp.courseInstances.find(item =>
            item.cellKey === cellKey && item.weekStart === weekStart
        );
        if (!instance) return null;
        return {
            weekStart: instance.weekStart,
            subject: instance.subjectId || null,
            student: normalizeIds(instance.studentIds),
            _cutoff: instance.isDeleted || undefined,
            cellKey: instance.cellKey,
            courseInstanceId: instance.id,
            courseTemplateId: instance.courseTemplateId || null,
            schedulingMode: instance.schedulingMode,
            stageId: instance.stageId,
            stageStartDate: instance.stageStartDate,
            stageEndDate: instance.stageEndDate,
            actualMinutesByDate: instance.actualMinutesByDate ? { ...instance.actualMinutesByDate } : undefined
        };
    }

    function ensureRecurringStudentFuture(app, cellKey, studentId, weekStart) {
        if (!cellKey || !studentId || !weekStart) return;

        const normalizedStudentId = String(studentId);
        const currentVersion = window.ScheduleErpService.getCellVersion(app, cellKey, weekStart);
        if (!currentVersion || !normalizeIds(currentVersion.student).includes(normalizedStudentId)) return;

        const stopWeekExclusive = findNextExplicitVersionWeek(app, cellKey, weekStart);
        if (!stopWeekExclusive) return;
        let cursorWeek = addWeeks(weekStart, 1);

        while (cursorWeek < stopWeekExclusive) {
            const explicitVersion = getExplicitVersionAtWeek(app, cellKey, cursorWeek);
            const existingStudents = explicitVersion ? normalizeIds(explicitVersion.student) : [];
            if (existingStudents.includes(normalizedStudentId)) {
                cursorWeek = addWeeks(cursorWeek, 1);
                continue;
            }

            const nextStudents = [...new Set([...existingStudents, normalizedStudentId])];
            const nextSubject = explicitVersion && explicitVersion.subject
                ? explicitVersion.subject
                : (currentVersion.subject || null);

            window.ScheduleErpService.setCellVersion(app, cellKey, cursorWeek, nextSubject, nextStudents);

            if (explicitVersion && existingStudents.length > 0) {
                const updatedVersion = window.ScheduleErpService.getCellVersion(app, cellKey, cursorWeek);
                if (updatedVersion) {
                    copyStudentBranchState(
                        app,
                        explicitVersion.courseInstanceId,
                        updatedVersion.courseInstanceId,
                        existingStudents,
                        cursorWeek,
                        updatedVersion.cellKey
                    );
                    buildTimetableProjection(app);
                }
            }

            cursorWeek = addWeeks(cursorWeek, 1);
        }
    }

    function copyStudentBranchState(app, fromInstanceId, toInstanceId, studentIds, fromWeekStart, targetCellKey) {
        if (!fromInstanceId || !toInstanceId || fromInstanceId === toInstanceId) return;
        const erp = ensureErpData(app);
        const ids = new Set(normalizeIds(studentIds));
        if (ids.size === 0) return;

        const sourceRelations = erp.studentCourseRelations.filter(rel =>
            rel.courseInstanceId === fromInstanceId && ids.has(String(rel.studentId))
        );
        const targetRelations = erp.studentCourseRelations.filter(rel =>
            rel.courseInstanceId === toInstanceId && ids.has(String(rel.studentId))
        );

        targetRelations.forEach(targetRel => {
            const sourceRel = sourceRelations.find(rel => rel.studentId === targetRel.studentId);
            if (!sourceRel) return;
            targetRel.studentType = sourceRel.studentType;
            targetRel.relationStatus = sourceRel.relationStatus;
            targetRel.accountStatus = sourceRel.accountStatus;
            targetRel.updatedAt = new Date().toISOString();
        });

        const copyableRuleTypes = new Set([
            'pause-student',
            'temporary-student',
            'complete-student',
            'remove-student'
        ]);

        erp.exceptionRules = erp.exceptionRules.filter(rule => {
            if (rule.courseInstanceId !== toInstanceId) return true;
            if (!copyableRuleTypes.has(rule.type)) return true;
            if (!rule.weekStart || rule.weekStart < fromWeekStart) return true;
            return !ids.has(String(rule.studentId || ''));
        });

        erp.exceptionRules
            .filter(rule =>
                rule.courseInstanceId === fromInstanceId &&
                copyableRuleTypes.has(rule.type) &&
                rule.weekStart &&
                rule.weekStart >= fromWeekStart &&
                ids.has(String(rule.studentId || ''))
            )
            .forEach(rule => {
                upsertExceptionRule(app, {
                    courseInstanceId: toInstanceId,
                    cellKey: targetCellKey,
                    weekStart: rule.weekStart,
                    studentId: String(rule.studentId),
                    type: rule.type,
                    scope: rule.scope,
                    reason: rule.reason
                });
            });
    }

    function addWeeks(dateStr, count) {
        const parts = String(dateStr || '').split('-').map(Number);
        const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
        d.setDate(d.getDate() + count * 7);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function restoreCellSnapshot(app, cellKey, weekStart, snapshot) {
        if (!snapshot || (!snapshot.subject && normalizeIds(snapshot.student).length === 0)) return null;
        const studentIds = normalizeIds(snapshot.student);
        window.ScheduleErpService.setCellVersion(app, cellKey, weekStart, snapshot.subject, studentIds);
        const restoredVersion = window.ScheduleErpService.getCellVersion(app, cellKey, weekStart);
        if (!restoredVersion) return null;

        copyStudentBranchState(
            app,
            snapshot.courseInstanceId,
            restoredVersion.courseInstanceId,
            studentIds,
            weekStart,
            cellKey
        );
        const restoredInstance = getInstanceForVersion(app, restoredVersion);
        if (restoredInstance && snapshot.actualMinutesByDate) {
            restoredInstance.actualMinutesByDate = { ...snapshot.actualMinutesByDate };
        }
        return restoredVersion;
    }

    function isDateKeyInWeek(dateKey, weekStartStr) {
        if (!dateKey || !weekStartStr) return false;
        if (dateKey === weekStartStr) return true;
        const parts = String(weekStartStr).split('-').map(Number);
        const start = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        const dateParts = String(dateKey).split('-').map(Number);
        if (dateParts.length !== 3 || dateParts.some(n => Number.isNaN(n))) return false;
        const date = new Date(dateParts[0], (dateParts[1] || 1) - 1, dateParts[2] || 1);
        date.setHours(0, 0, 0, 0);
        return date >= start && date < end;
    }

    function applyRelationRules(app, version, requestedWeekStart) {
        if (!version || !version.courseInstanceId) return version;
        const erp = ensureErpData(app);
        const clone = {
            ...version,
            student: normalizeIds(version.student)
        };
        const hadStudentsBeforeRules = clone.student.length > 0;
        const relations = erp.studentCourseRelations.filter(rel => rel.courseInstanceId === clone.courseInstanceId);
        if (relations.length === 0) return clone;

        clone.student = clone.student.filter(studentId => {
            const rel = relations.find(item => item.studentId === String(studentId));
            if (!rel) return true;
            if (rel.relationStatus === 'temporary') {
                const ex = erp.exceptionRules.find(rule =>
                    rule.courseInstanceId === clone.courseInstanceId &&
                    rule.studentId === String(studentId) &&
                    rule.type === 'temporary-student' &&
                    rule.weekStart
                );
                return requestedWeekStart === (ex ? ex.weekStart : clone.weekStart);
            }
            if (rel.relationStatus === 'paused' || rel.relationStatus === 'ended') {
                const ex = erp.exceptionRules.find(rule =>
                    rule.courseInstanceId === clone.courseInstanceId &&
                    rule.studentId === String(studentId) &&
                    (rule.type === 'pause-student' || rule.type === 'complete-student') &&
                    rule.weekStart
                );
                if (!ex) return false;
                return requestedWeekStart < ex.weekStart;
            }
            return true;
        });

        if (hadStudentsBeforeRules && clone.student.length === 0) {
            clone.subject = null;
            clone._cutoff = true;
        }

        const deleted = erp.exceptionRules.some(rule =>
            rule.courseInstanceId === clone.courseInstanceId &&
            (rule.type === 'delete-instance' || rule.type === 'delete-course') &&
            rule.weekStart &&
            requestedWeekStart >= rule.weekStart
        );
        if (deleted) {
            clone.subject = null;
            clone.student = [];
            clone._cutoff = true;
        }
        return clone;
    }

    function buildTimetableProjection(app) {
        const erp = ensureErpData(app);
        const projected = {};
        erp.courseInstances.forEach(instance => {
            if (!instance.cellKey || !instance.weekStart) return;
            if (!projected[instance.cellKey]) projected[instance.cellKey] = [];
            const rels = erp.studentCourseRelations.filter(rel => rel.courseInstanceId === instance.id);
            const studentIds = rels.length > 0 ? rels.map(rel => rel.studentId) : normalizeIds(instance.studentIds);
            projected[instance.cellKey].push({
                weekStart: instance.weekStart,
                subject: instance.subjectId || null,
                student: normalizeIds(studentIds),
                _cutoff: instance.isDeleted || undefined,
                cellKey: instance.cellKey,
                courseInstanceId: instance.id,
                courseTemplateId: instance.courseTemplateId || null,
                schedulingMode: instance.schedulingMode,
                stageId: instance.stageId,
                stageStartDate: instance.stageStartDate,
                stageEndDate: instance.stageEndDate,
                actualMinutesByDate: instance.actualMinutesByDate ? { ...instance.actualMinutesByDate } : undefined
            });
        });
        Object.keys(projected).forEach(key => {
            projected[key] = sortVersions(projected[key]).filter(v =>
                v._cutoff || v.subject || (v.student && v.student.length > 0)
            );
            if (projected[key].length === 0) delete projected[key];
        });
        app.timetable = projected;
        return projected;
    }

    function getProjectedCellVersion(app, key, weekStartStr) {
        const versions = app.timetable && app.timetable[key];
        if (!versions || !Array.isArray(versions) || versions.length === 0) return null;
        let best = null;
        for (const version of versions) {
            if (version.weekStart <= weekStartStr && (!best || version.weekStart > best.weekStart)) {
                best = version;
            }
        }
        if (best && (best._cutoff || (!best.subject && (!best.student || best.student.length === 0)))) return null;
        if (best && !isVersionWithinItsSchedulingStage(app, best, weekStartStr)) return null;
        best = applyRelationRules(app, best, weekStartStr);
        if (best && (best._cutoff || (!best.subject && (!best.student || best.student.length === 0)))) return null;
        return best;
    }

    window.createEmptyErpData = createEmptyErpData;
    window.ScheduleErpService = {
        ensureErpData,
        buildTimetableProjection,
        pruneOrphanedErpData,
        removeSubjectOnlyCourses,
        completeStudentsForEndedStages,
        isStageFinalOccurrence,
        isStudentStageAutoCompleted,

        restoreCellSnapshot(app, cellKey, weekStart, snapshot) {
            return restoreCellSnapshot(app, cellKey, weekStart, snapshot);
        },

        getCellVersion(app, key, weekStartStr) {
            buildTimetableProjection(app);
            return getProjectedCellVersion(app, key, weekStartStr);
        },

        getProjectedCellVersion(app, key, weekStartStr) {
            return getProjectedCellVersion(app, key, weekStartStr);
        },

        setCellVersion(app, key, weekStartStr, subjectId, studentIds, options = {}) {
            const erp = ensureErpData(app);
            const normalizedStudents = normalizeIds(studentIds);
            const normalizedSubjectId = normalizeSubjectId(app, subjectId, normalizedStudents);
            const subjectOnly = normalizedSubjectId !== null && normalizedStudents.length === 0;
            const hasContent = normalizedStudents.length > 0;
            if (subjectOnly) options = { ...options, cutoff: true };
            const existing = erp.courseInstances.find(instance =>
                instance.cellKey === key && instance.weekStart === weekStartStr
            );
            const template = hasContent
                ? makeTemplate(app, normalizedSubjectId, normalizedStudents, options.source || 'schedule')
                : null;
            const firstOccurrence = getCellOccurrenceDate(key, weekStartStr);
            const configuredStage = app.settings && app.settings.segmentedScheduling
                ? getStageOccurrenceForDate(app, firstOccurrence)
                : null;
            const recalculateStage = !!options.recalculateStage;
            const schedulingMode = !recalculateStage && existing && existing.schedulingMode
                ? existing.schedulingMode
                : (configuredStage ? 'segmented' : 'continuous');
            erp.courseInstances = erp.courseInstances.filter(instance => instance !== existing);
            if (hasContent || options.cutoff) {
                const instanceId = existing ? existing.id : makeId('ci');
                const instance = {
                    id: instanceId,
                    courseTemplateId: template ? template.id : (existing ? existing.courseTemplateId : null),
                    cellKey: key,
                    weekStart: weekStartStr,
                    subjectId: normalizedSubjectId,
                    studentIds: normalizedStudents,
                    status: options.cutoff ? 'deleted' : 'recurring',
                    isDeleted: !!options.cutoff,
                    source: options.source || 'schedule',
                    schedulingMode,
                    stageId: !recalculateStage && existing && existing.stageId || (configuredStage && (configuredStage.stage.id || configuredStage.stage.name)) || null,
                    stageStartDate: !recalculateStage && existing && existing.stageStartDate || (configuredStage ? formatLocalDate(configuredStage.start) : null),
                    stageEndDate: !recalculateStage && existing && existing.stageEndDate || (configuredStage ? formatLocalDate(configuredStage.end) : null),
                    actualStartTime: existing && existing.actualStartTime,
                    actualEndTime: existing && existing.actualEndTime,
                    standardStartTime: existing && existing.standardStartTime,
                    standardEndTime: existing && existing.standardEndTime,
                    isNonStandardTime: existing && !!existing.isNonStandardTime,
                    timeSource: existing && existing.timeSource,
                    timeManuallyAdjusted: existing && !!existing.timeManuallyAdjusted,
                    importSourceTime: existing && existing.importSourceTime,
                    importTotalMinutes: existing && existing.importTotalMinutes,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                erp.courseInstances.push(instance);
                syncRelations(app, instance, normalizedStudents);
                reactivateStudentsForOpenStage(app, instance, normalizedStudents);
                if (options.cutoff) {
                    erp.repeatRules = erp.repeatRules.filter(rule => rule.courseInstanceId !== instance.id);
                } else {
                    makeRepeatRule(app, instance);
                }
                syncAttendanceInstanceIds(app, existing ? existing.id : null, instance.id);
                if (!options.cutoff) {
                    clearInstanceDeletionRules(app, instance.id, weekStartStr);
                    if (options.source !== 'course-import') {
                        clearEmptyRecurringStops(app, key, weekStartStr, 'until-next-course');
                    }
                }
                if (options.cutoff) {
                    upsertExceptionRule(app, {
                        courseInstanceId: instance.id,
                        cellKey: key,
                        weekStart: weekStartStr,
                        type: 'delete-instance',
                        scope: 'from-week',
                        reason: 'legacy-delete'
                    });
                }
            }
            pruneOrphanedErpData(app);
            buildTimetableProjection(app);
        },

        setSingleCellOccurrence(app, key, weekStartStr, subjectId, studentIds) {
            const currentVersion = this.getCellVersion(app, key, weekStartStr);
            const nextWeekStart = addWeeks(weekStartStr, 1);
            const nextVersion = this.getCellVersion(app, key, nextWeekStart);
            const nextSnapshot = nextVersion ? {
                ...nextVersion,
                student: normalizeIds(nextVersion.student),
                actualMinutesByDate: nextVersion.actualMinutesByDate
                    ? { ...nextVersion.actualMinutesByDate }
                    : undefined
            } : null;
            const normalizedStudents = normalizeIds(studentIds);

            if (subjectId || normalizedStudents.length > 0) {
                restoreCellSnapshot(app, key, weekStartStr, {
                    ...(currentVersion || {}),
                    subject: subjectId || null,
                    student: normalizedStudents
                });
            } else {
                this.setCellVersion(app, key, weekStartStr, null, [], { cutoff: true });
            }

            if (nextSnapshot && (nextSnapshot.subject || nextSnapshot.student.length > 0)) {
                restoreCellSnapshot(app, key, nextWeekStart, nextSnapshot);
            } else {
                this.setCellVersion(app, key, nextWeekStart, null, [], { cutoff: true });
            }

            return this.getCellVersion(app, key, weekStartStr);
        },

        deleteSingleCellOccurrence(app, key, weekStartStr) {
            const currentVersion = this.getCellVersion(app, key, weekStartStr);
            if (!currentVersion) return false;

            // A projected weekly lesson has no explicit instance of its own.  Split
            // the recurrence around the removed week so the cutoff only occupies
            // that week and the following occurrence becomes a fresh branch.
            const nextWeekStart = addWeeks(weekStartStr, 1);
            const nextVersion = this.getCellVersion(app, key, nextWeekStart);
            const nextSnapshot = nextVersion ? {
                ...nextVersion,
                student: normalizeIds(nextVersion.student),
                actualMinutesByDate: nextVersion.actualMinutesByDate
                    ? { ...nextVersion.actualMinutesByDate }
                    : undefined
            } : null;

            this.setCellVersion(app, key, weekStartStr, null, [], { cutoff: true });

            if (nextSnapshot && (nextSnapshot.subject || nextSnapshot.student.length > 0)) {
                restoreCellSnapshot(app, key, nextWeekStart, nextSnapshot);
            }

            return true;
        },

        setRelationStatus(app, cellKey, studentId, relationStatus, weekStart) {
            setRelationStatus(app, cellKey, studentId, relationStatus, weekStart);
        },

        setRecurrenceStatus(app, cellKey, studentId, type, weekStart) {
            const erp = ensureErpData(app);
            const version = this.getCellVersion(app, cellKey, weekStart);
            const instance = version ? erp.courseInstances.find(ci => ci.id === version.courseInstanceId) : null;
            const relationStatus = type === 'stopped' ? 'paused' : type === 'temporary' ? 'temporary' : 'recurring';
            setRelationStatus(app, cellKey, studentId, relationStatus, weekStart);

            if (instance) {
                const effectiveWeekStart = type === 'stopped' ? addWeeks(weekStart, 1) : weekStart;
                clearStudentRecurrenceExceptions(app, instance.id, studentId, effectiveWeekStart);
                if (type === 'stopped' || type === 'temporary') {
                    upsertExceptionRule(app, {
                        courseInstanceId: instance.id,
                        cellKey,
                        weekStart: effectiveWeekStart,
                        studentId: String(studentId),
                        type: type === 'stopped' ? 'pause-student' : 'temporary-student',
                        scope: type === 'stopped' ? 'future' : 'single-week',
                        reason: 'attendance-recurrence'
                    });
                } else if (type === 'recurring') {
                    clearEmptyRecurringStops(app, cellKey, effectiveWeekStart, 'all-future-empty');
                    ensureRecurringStudentFuture(app, cellKey, studentId, weekStart);
                }
            }
            buildTimetableProjection(app);
        },

        completeStudentFromWeek(app, cellKey, studentId, weekStart) {
            const erp = ensureErpData(app);
            const version = this.getCellVersion(app, cellKey, weekStart);
            const instance = version ? erp.courseInstances.find(ci => ci.id === version.courseInstanceId) : null;
            if (!instance) return;
            setRelationStatus(app, cellKey, studentId, 'ended', weekStart);
            upsertExceptionRule(app, {
                courseInstanceId: instance.id,
                cellKey,
                weekStart,
                studentId: String(studentId),
                type: 'complete-student',
                scope: 'future',
                reason: 'student-completed'
            });
        },

        upsertExceptionRule(app, payload) {
            return upsertExceptionRule(app, payload);
        },

        upsertCourseTemplate(app, subjectId, studentIds, source = 'manual') {
            return makeTemplate(app, subjectId || null, normalizeIds(studentIds), source);
        },

        archiveCourseTemplate(app, subjectId, studentIds) {
            const erp = ensureErpData(app);
            const sorted = normalizeIds(studentIds).sort().join(',');
            const key = `${subjectId || ''}::${sorted}`;
            erp.courseTemplates
                .filter(template => template.templateKey === key)
                .forEach(template => {
                    template.archived = true;
                    template.updatedAt = new Date().toISOString();
                });
        },

        archiveTemplatesBySubject(app, subjectId) {
            const erp = ensureErpData(app);
            erp.courseTemplates
                .filter(template => template.subjectId === subjectId)
                .forEach(template => {
                    template.archived = true;
                    template.updatedAt = new Date().toISOString();
                });
        },

        removeSubjectFromSchedule(app, subjectId) {
            const erp = ensureErpData(app);
            this.archiveTemplatesBySubject(app, subjectId);
            erp.courseInstances.forEach(instance => {
                if (instance.subjectId !== subjectId) return;
                const relationStudentIds = erp.studentCourseRelations
                    .filter(rel => rel.courseInstanceId === instance.id)
                    .map(rel => rel.studentId);
                const nextStudentIds = relationStudentIds.length > 0
                    ? relationStudentIds
                    : normalizeIds(instance.studentIds);
                const nextSubjectId = normalizeSubjectId(app, null, nextStudentIds);
                const template = makeTemplate(app, nextSubjectId, nextStudentIds, instance.source || 'schedule');
                instance.subjectId = nextSubjectId;
                instance.courseTemplateId = template.id;
                instance.studentIds = nextStudentIds;
                instance.updatedAt = new Date().toISOString();
                upsertExceptionRule(app, {
                    courseInstanceId: instance.id,
                    cellKey: instance.cellKey,
                    weekStart: instance.weekStart,
                    type: 'remove-subject',
                    scope: 'instance',
                    reason: 'delete-subject'
                });
            });
            erp.courseInstances = erp.courseInstances.filter(instance =>
                instance.subjectId || erp.studentCourseRelations.some(rel => rel.courseInstanceId === instance.id)
            );
            buildTimetableProjection(app);
        },

        removeStudentEverywhere(app, studentId) {
            const erp = ensureErpData(app);
            const removedRelationInstanceIds = new Set();
            erp.studentCourseRelations = erp.studentCourseRelations.filter(rel => {
                if (rel.studentId !== String(studentId)) return true;
                removedRelationInstanceIds.add(rel.courseInstanceId);
                return false;
            });
            erp.attendanceRecords = erp.attendanceRecords.filter(record => record.studentId !== String(studentId));
            erp.courseTemplates.forEach(template => {
                template.defaultStudentIds = normalizeIds(template.defaultStudentIds).filter(id => id !== String(studentId));
                const sorted = template.defaultStudentIds.slice().sort().join(',');
                template.templateKey = `${template.subjectId || ''}::${sorted}`;
                template.updatedAt = new Date().toISOString();
            });
            erp.courseInstances.forEach(instance => {
                instance.studentIds = normalizeIds(instance.studentIds).filter(id => id !== String(studentId));
                if (removedRelationInstanceIds.has(instance.id)) {
                    upsertExceptionRule(app, {
                        courseInstanceId: instance.id,
                        cellKey: instance.cellKey,
                        weekStart: instance.weekStart,
                        studentId: String(studentId),
                        type: 'remove-student',
                        scope: 'all',
                        reason: 'delete-student'
                    });
                }
            });
            erp.courseInstances = erp.courseInstances.filter(instance =>
                instance.subjectId || normalizeIds(instance.studentIds).length > 0 ||
                erp.studentCourseRelations.some(rel => rel.courseInstanceId === instance.id)
            );
            buildTimetableProjection(app);
        },

        deleteCourseInstancesBySignature(app, subjectId, studentIds) {
            const erp = ensureErpData(app);
            const target = normalizeIds(studentIds).sort().join(',');
            const removedIds = new Set();
            erp.courseInstances = erp.courseInstances.filter(instance => {
                if (instance.subjectId !== subjectId) return true;
                const rels = erp.studentCourseRelations
                    .filter(rel => rel.courseInstanceId === instance.id)
                    .map(rel => rel.studentId);
                const ids = rels.length > 0 ? rels : normalizeIds(instance.studentIds);
                if (ids.slice().sort().join(',') !== target) return true;
                removedIds.add(instance.id);
                upsertExceptionRule(app, {
                    courseInstanceId: instance.id,
                    cellKey: instance.cellKey,
                    weekStart: instance.weekStart,
                    type: 'delete-course',
                    scope: 'all-matching',
                    reason: 'course-pool-delete'
                });
                return false;
            });
            erp.studentCourseRelations = erp.studentCourseRelations.filter(rel => !removedIds.has(rel.courseInstanceId));
            erp.repeatRules = erp.repeatRules.filter(rule => !removedIds.has(rule.courseInstanceId));
            buildTimetableProjection(app);
        },

        getCourseInstanceForVersion(app, version) {
            return getInstanceForVersion(app, version);
        },

        transferMovedCourseData(app, sourceVersion, targetKey, targetVersion, weekStartStr = null) {
            if (!sourceVersion || !targetVersion) return;
            const erp = ensureErpData(app);
            const sourceInstance = getInstanceForVersion(app, sourceVersion);
            const targetInstance = getInstanceForVersion(app, targetVersion);
            const sourceInstanceId = sourceInstance ? sourceInstance.id : sourceVersion.courseInstanceId;
            const targetInstanceId = targetInstance ? targetInstance.id : targetVersion.courseInstanceId;
            if (!sourceInstanceId || !targetInstanceId) return;

            erp.attendanceRecords.forEach(record => {
                const matchesWeek = !weekStartStr || isDateKeyInWeek(record.dateKey, weekStartStr);
                if (matchesWeek && (record.courseInstanceId === sourceInstanceId || record.cellKey === sourceVersion.cellKey)) {
                    record.courseInstanceId = targetInstanceId;
                    record.cellKey = targetKey;
                    record.updatedAt = new Date().toISOString();
                }
            });

            const movedActualMinutes = sourceInstance && sourceInstance.actualMinutesByDate
                ? sourceInstance.actualMinutesByDate
                : sourceVersion.actualMinutesByDate;
            if (targetInstance && movedActualMinutes) {
                const scopedActualMinutes = Object.fromEntries(
                    Object.entries(movedActualMinutes).filter(([dateKey]) =>
                        !weekStartStr || isDateKeyInWeek(dateKey, weekStartStr)
                    )
                );
                if (Object.keys(scopedActualMinutes).length === 0) return;
                targetInstance.actualMinutesByDate = {
                    ...(targetInstance.actualMinutesByDate || {}),
                    ...scopedActualMinutes
                };
                targetInstance.updatedAt = new Date().toISOString();
            }
        },

        inheritStudentBranchState(app, fromVersion, toVersion, studentIds, fromWeekStart) {
            if (!fromVersion || !toVersion) return;
            copyStudentBranchState(
                app,
                fromVersion.courseInstanceId,
                toVersion.courseInstanceId,
                studentIds,
                fromWeekStart,
                toVersion.cellKey
            );
        },

        upsertAttendance(app, cellKey, studentId, status, dateKey) {
            const erp = ensureErpData(app);
            const dateParts = String(dateKey || '').split('-').map(Number);
            const attendanceDate = dateParts.length === 3 && dateParts.every(Number.isFinite)
                ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
                : app.currentDate;
            const weekStartStr = app.formatLocalDate(app.getWeekRange(attendanceDate).start);
            const version = this.getCellVersion(app, cellKey, weekStartStr);
            const courseInstanceId = version ? version.courseInstanceId : null;
            const existing = erp.attendanceRecords.find(record =>
                record.courseInstanceId === courseInstanceId &&
                record.cellKey === cellKey &&
                record.studentId === String(studentId) &&
                record.dateKey === dateKey
            );
            const payload = {
                courseInstanceId,
                cellKey,
                studentId: String(studentId),
                dateKey,
                status,
                updatedAt: new Date().toISOString()
            };
            if (existing) Object.assign(existing, payload);
            else erp.attendanceRecords.push({ id: makeId('att'), ...payload, createdAt: new Date().toISOString() });
        },

        setActualMinutes(app, cellKey, minutes, dateKey = null) {
            const erp = ensureErpData(app);
            const weekStartStr = app.formatLocalDate(app.getWeekRange(app.currentDate).start);
            const version = this.getCellVersion(app, cellKey, weekStartStr);
            const instance = version ? erp.courseInstances.find(ci => ci.id === version.courseInstanceId) : null;
            if (!instance) return;
            if (!instance.actualMinutesByDate) instance.actualMinutesByDate = {};
            const key = dateKey || weekStartStr;
            instance.actualMinutesByDate[key] = minutes;
            instance.updatedAt = new Date().toISOString();
        },

        setStudentActualMinutes(app, cellKey, studentId, minutes, dateKey = null) {
            const erp = ensureErpData(app);
            const weekStartStr = app.formatLocalDate(app.getWeekRange(app.currentDate).start);
            const version = this.getCellVersion(app, cellKey, weekStartStr);
            const instance = version ? erp.courseInstances.find(ci => ci.id === version.courseInstanceId) : null;
            if (!instance) return;
            if (!instance.studentActualMinutesByDate) instance.studentActualMinutesByDate = {};
            const key = dateKey || weekStartStr;
            if (!instance.studentActualMinutesByDate[key]) instance.studentActualMinutesByDate[key] = {};
            instance.studentActualMinutesByDate[key][String(studentId)] = Math.max(0, Number(minutes) || 0);
            instance.updatedAt = new Date().toISOString();
        },

        getStudentActualMinutes(app, cellKey, studentId, dateKey = null) {
            const erp = ensureErpData(app);
            const weekStartStr = app.formatLocalDate(app.getWeekRange(app.currentDate).start);
            const version = this.getCellVersion(app, cellKey, weekStartStr);
            const instance = version ? erp.courseInstances.find(ci => ci.id === version.courseInstanceId) : null;
            if (!instance || !instance.studentActualMinutesByDate) return undefined;
            const keys = dateKey ? [dateKey, weekStartStr] : [weekStartStr];
            for (const key of keys) {
                const values = instance.studentActualMinutesByDate[key];
                if (values && values[String(studentId)] !== undefined) return values[String(studentId)];
            }
            return undefined;
        },

        getActualMinutes(app, cellKey, dateKey = null) {
            const erp = ensureErpData(app);
            const weekStartStr = app.formatLocalDate(app.getWeekRange(app.currentDate).start);
            const version = this.getCellVersion(app, cellKey, weekStartStr);
            const instance = version ? erp.courseInstances.find(ci => ci.id === version.courseInstanceId) : null;
            if (!instance || !instance.actualMinutesByDate) return undefined;
            const keys = dateKey ? [dateKey, weekStartStr] : [weekStartStr];
            for (const key of keys) {
                if (instance.actualMinutesByDate[key] !== undefined) return instance.actualMinutesByDate[key];
            }
            return undefined;
        }
    };
})();
