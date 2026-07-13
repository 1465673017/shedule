// app-erp.js - Schedule ERP service and timetable projection

(function() {
    const SCHEMA_VERSION = 4;

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
            exceptionRules: []
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
                    relationStatus: student && (student.isAudition || student.completed) ? 'temporary' : 'recurring',
                    accountStatus: student && student.completed ? 'completed' : 'normal',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
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

    function clearFutureEmptyRecurringStops(app, cellKey, fromWeekStart) {
        if (!cellKey || !fromWeekStart) return;
        const erp = ensureErpData(app);
        const removedInstanceIds = new Set();

        erp.courseInstances = erp.courseInstances.filter(instance => {
            if (instance.cellKey !== cellKey) return true;
            if (!instance.weekStart || instance.weekStart < fromWeekStart) return true;
            const hasSubject = !!instance.subjectId;
            const hasStudents = normalizeIds(instance.studentIds).length > 0 ||
                erp.studentCourseRelations.some(rel => rel.courseInstanceId === instance.id);
            const isEmptyStop = instance.isDeleted || (!hasSubject && !hasStudents);
            if (!isEmptyStop) return true;
            removedInstanceIds.add(instance.id);
            return false;
        });

        if (removedInstanceIds.size === 0) return;

        erp.repeatRules = erp.repeatRules.filter(rule => !removedInstanceIds.has(rule.courseInstanceId));
        erp.exceptionRules = erp.exceptionRules.filter(rule => {
            if (!removedInstanceIds.has(rule.courseInstanceId)) return true;
            return rule.type !== 'delete-instance';
        });
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

    window.createEmptyErpData = createEmptyErpData;
    window.ScheduleErpService = {
        ensureErpData,
        buildTimetableProjection,

        getCellVersion(app, key, weekStartStr) {
            buildTimetableProjection(app);
            const versions = app.timetable[key];
            if (!versions || !Array.isArray(versions) || versions.length === 0) return null;
            let best = null;
            for (const v of versions) {
                if (v.weekStart <= weekStartStr && (!best || v.weekStart > best.weekStart)) {
                    best = v;
                }
            }
            if (best && (best._cutoff || (!best.subject && (!best.student || best.student.length === 0)))) return null;
            best = applyRelationRules(app, best, weekStartStr);
            if (best && (best._cutoff || (!best.subject && (!best.student || best.student.length === 0)))) return null;
            return best;
        },

        setCellVersion(app, key, weekStartStr, subjectId, studentIds, options = {}) {
            const erp = ensureErpData(app);
            const normalizedStudents = normalizeIds(studentIds);
            const normalizedSubjectId = normalizeSubjectId(app, subjectId, normalizedStudents);
            const hasContent = normalizedSubjectId !== null || normalizedStudents.length > 0;
            const template = makeTemplate(app, normalizedSubjectId, normalizedStudents, options.source || 'schedule');
            const existing = erp.courseInstances.find(instance =>
                instance.cellKey === key && instance.weekStart === weekStartStr
            );
            erp.courseInstances = erp.courseInstances.filter(instance => instance !== existing);
            if (hasContent || options.cutoff) {
                const instanceId = existing ? existing.id : makeId('ci');
                const instance = {
                    id: instanceId,
                    courseTemplateId: template.id,
                    cellKey: key,
                    weekStart: weekStartStr,
                    subjectId: normalizedSubjectId,
                    studentIds: normalizedStudents,
                    status: options.cutoff ? 'deleted' : 'recurring',
                    isDeleted: !!options.cutoff,
                    source: options.source || 'schedule',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                erp.courseInstances.push(instance);
                syncRelations(app, instance, normalizedStudents);
                makeRepeatRule(app, instance);
                syncAttendanceInstanceIds(app, existing ? existing.id : null, instance.id);
                if (!options.cutoff) {
                    clearInstanceDeletionRules(app, instance.id, weekStartStr);
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
            buildTimetableProjection(app);
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
                    clearFutureEmptyRecurringStops(app, cellKey, effectiveWeekStart);
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
            buildTimetableProjection(app);
        },

        upsertAttendance(app, cellKey, studentId, status, dateKey) {
            const erp = ensureErpData(app);
            const weekStartStr = app.formatLocalDate(app.getWeekRange(app.currentDate).start);
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
