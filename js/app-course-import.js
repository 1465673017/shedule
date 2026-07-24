// Recognize external course JSON and import it as the highest-priority schedule version.
(function () {
    const STATUS = { PRESENT: 'present', ATTENDANCE: 'present', ATTENDED: 'present', LEAVE: 'leave', ASK_FOR_LEAVE: 'leave', ABSENT: 'absent', ABSENCE: 'absent' };
    const STAGE_IMPORT_MARKER = '大橙子yyds';

    function normalizeMarkedInput(input) {
        const text = String(input || '').trim();
        const hasStageMarker = text.endsWith(STAGE_IMPORT_MARKER);
        return {
            text: hasStageMarker ? text.slice(0, -STAGE_IMPORT_MARKER.length).trimEnd() : text,
            hasStageMarker
        };
    }

    function extractCourses(input) {
        const value = typeof input === 'string' ? JSON.parse(input) : input;
        return walkCourses(value);
    }

    function walkCourses(value) {
        if (Array.isArray(value)) {
            const directCourses = value.filter(item => item && typeof item === 'object' && item.courseDate && Array.isArray(item.students));
            if (directCourses.length) return directCourses;
            return value.flatMap(walkCourses);
        }
        if (!value || typeof value !== 'object') return [];
        if (value.courseDate && Array.isArray(value.students)) return [value];
        return Object.values(value).flatMap(walkCourses);
    }

    function localDate(text) {
        const p = String(text || '').split('-').map(Number);
        if (p.length !== 3 || p.some(n => !Number.isFinite(n))) return null;
        const result = new Date(p[0], p[1] - 1, p[2]);
        if (Number.isNaN(result.getTime()) || result.getFullYear() !== p[0] || result.getMonth() !== p[1] - 1 || result.getDate() !== p[2]) return null;
        return result;
    }

    function stageOccurrenceForDate(app, referenceDate) {
        if (!app.settings || !app.settings.segmentedScheduling) return null;
        const stages = Array.isArray(app.settings.stages) ? app.settings.stages : [];
        for (const stage of stages) {
            const configuredStart = localDate(stage && stage.startDate);
            const configuredEnd = localDate(stage && stage.endDate);
            if (!configuredStart || !configuredEnd || configuredStart > configuredEnd) continue;
            const approximateShift = referenceDate.getFullYear() - configuredStart.getFullYear();
            for (let shift = approximateShift - 1; shift <= approximateShift + 1; shift++) {
                const start = new Date(configuredStart);
                const end = new Date(configuredEnd);
                start.setFullYear(start.getFullYear() + shift);
                end.setFullYear(end.getFullYear() + shift);
                if (referenceDate >= start && referenceDate <= end) return { stage, start, end };
            }
        }
        return null;
    }

    function shiftCoursesToStageStarts(app, courses) {
        const datedCourses = courses.map(course => ({ course, date: localDate(course.courseDate) }));
        const invalid = datedCourses.find(item => !item.date);
        if (invalid) throw new Error(`课程 ${invalid.course.courseName || invalid.course.id || ''} 缺少有效的课程日期`);
        const groups = new Map();
        datedCourses.forEach(item => {
            const occurrence = stageOccurrenceForDate(app, item.date);
            if (!occurrence) {
                throw new Error(`课程日期 ${app.formatLocalDate(item.date)} 不属于任何已配置阶段，请先检查阶段设置`);
            }
            const key = `${app.formatLocalDate(occurrence.start)}|${app.formatLocalDate(occurrence.end)}`;
            if (!groups.has(key)) groups.set(key, { occurrence, items: [] });
            groups.get(key).items.push(item);
        });

        const shiftedItems = [];
        groups.forEach(({ occurrence, items }) => {
            const scheduleSlots = new Map();
            items.forEach(item => {
                const slotKey = `${item.date.getDay()}-${periodIndex(app, item.course)}`;
                if (!scheduleSlots.has(slotKey)) scheduleSlots.set(slotKey, []);
                scheduleSlots.get(slotKey).push(item);
            });

            scheduleSlots.forEach(slotItems => {
                slotItems.sort((a, b) => a.date - b.date);
                const firstDate = slotItems[0].date;
                const targetFirstDate = new Date(occurrence.start);
                targetFirstDate.setDate(targetFirstDate.getDate() + ((firstDate.getDay() - occurrence.start.getDay() + 7) % 7));
                const shiftDays = Math.round((targetFirstDate - firstDate) / 86400000);
                slotItems.forEach(item => {
                    const date = new Date(item.date);
                    date.setDate(date.getDate() + shiftDays);
                    shiftedItems.push({ course: item.course, date });
                });
            });
        });
        return shiftedItems.sort((a, b) => a.date - b.date);
    }

    function isOneToOne(course) {
        const tags = Array.isArray(course.tags) ? course.tags.map(t => t && (t.name || t)) : [];
        const text = [course.courseName, course.type, ...tags].join(' ');
        return String(course.type || '').toUpperCase() === 'ONE_ON_ONE_COURSE'
            || /(^|[^0-9a-z])1\s*v\s*1([^0-9]|$)/i.test(text)
            || /一对一|1\s*对\s*1/.test(text);
    }

    function attendanceStatus(course, source) {
        const details = Array.isArray(course.attendentDetail) ? course.attendentDetail : [];
        const detail = details.find(d => String(d.studentId || d.id || '') === String(source.id));
        const raw = (detail && (detail.status || detail.attendentStatus || detail.attendanceStatus)) || source.attendentStatus || source.attendanceStatus;
        if (source.isLeave || (detail && detail.isLeave)) return 'leave';
        if (!raw) return null;
        const normalized = String(raw).trim();
        const chineseStatuses = {
            '上课': 'present', '已上课': 'present', '出勤': 'present', '正常': 'present',
            '请假': 'leave', '病假': 'leave', '事假': 'leave',
            '未上课': 'absent', '缺勤': 'absent', '旷课': 'absent'
        };
        return chineseStatuses[normalized] || STATUS[normalized.toUpperCase()] || null;
    }

    function sourceActualMinutes(source) {
        if (source.actualMinutes !== undefined && source.actualMinutes !== null) return Math.max(0, Number(source.actualMinutes) || 0);
        if (source.actualHours !== undefined && source.actualHours !== null) return Math.max(0, (Number(source.actualHours) || 0) * 60);
        if (source.actualCourseHours !== undefined && source.actualCourseHours !== null) return Math.max(0, (Number(source.actualCourseHours) || 0) * 40);
        return undefined;
    }

    function studentActualMinutesForSlot(source, slot, range) {
        const explicitMinutes = sourceActualMinutes(source);
        if (explicitMinutes === undefined) return undefined;
        const actualTime = String(source.actualCourseTime || '').trim();
        const match = actualTime.match(/^(\d{1,2}:\d{2})\s*[-–—~至]\s*(\d{1,2}:\d{2})$/);
        if (match) {
            const actualStart = appTimeToMinutes(match[1]);
            const actualEnd = appTimeToMinutes(match[2]);
            if (Number.isFinite(actualStart) && Number.isFinite(actualEnd) && actualEnd > actualStart) {
                return Math.max(0, Math.min(actualEnd, slot.endMinutes) - Math.max(actualStart, slot.startMinutes));
            }
        }
        if (explicitMinutes === 0 || range.durationMinutes <= 0) return 0;
        return Math.max(0, Math.round(explicitMinutes * slot.overlapMinutes / range.durationMinutes));
    }

    function courseTimeRange(course) {
        const start = String(course.courseTime || '').slice(0, 5);
        const end = String(course.courseEndTime || '').slice(0, 5);
        const startMinutes = appTimeToMinutes(start);
        const endMinutes = appTimeToMinutes(end);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
            throw new Error(`课程 ${course.courseName || course.id || ''} 缺少有效的上课时间`);
        }
        return { start, end, startMinutes, endMinutes, durationMinutes: endMinutes - startMinutes };
    }

    function appTimeToMinutes(value) {
        const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return NaN;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : NaN;
    }

    function periodSlots(app, course) {
        const range = courseTimeRange(course);
        const ordered = app.getOrderedPeriods();
        const slots = ordered.map(x => {
            const parts = String(x.period.time || '').split('-').map(v => appTimeToMinutes(v.trim().slice(0, 5)));
            if (parts.length !== 2 || parts.some(value => !Number.isFinite(value))) return null;
            const overlapMinutes = Math.max(0, Math.min(range.endMinutes, parts[1]) - Math.max(range.startMinutes, parts[0]));
            return overlapMinutes > 0 ? { ...x, startMinutes: parts[0], endMinutes: parts[1], overlapMinutes } : null;
        }).filter(Boolean);
        if (!slots.length) throw new Error(`未找到与 ${range.start}-${range.end} 重叠的课时，请先配置对应时间段`);
        return { range, slots };
    }

    function periodIndex(app, course) {
        return periodSlots(app, course).slots[0].index;
    }

    function ensureSubject(app, course) {
        const name = String(course.subject && course.subject.name || '未分类').trim();
        let subject = app.subjects.find(s => String(s.name).trim() === name);
        if (!subject) {
            subject = { id: `import_subject_${course.subject && course.subject.id || Date.now()}`, name, teacher: course.teacher && course.teacher.name || '', color: '#E5E7EB' };
            app.subjects.push(subject);
        }
        return subject;
    }

    function ensureStudent(app, source, course, oneToOne) {
        const externalId = String(source.id || '');
        const externalIdHash = Array.from(externalId).reduce((hash, char) => ((hash * 31) + char.codePointAt(0)) >>> 0, 0).toString(36);
        const safeExternalId = externalId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) + '_' + externalIdHash;
        const grade = String(course.grade && course.grade.name || '').trim();
        const classType = oneToOne ? '1v1' : '1vN';
        const studentClassType = student => student.classType || (student.is1v1 ? '1v1' : '1vN');
        let student = app.students.find(s =>
            externalId &&
            String(s.externalStudentId || '') === externalId &&
            studentClassType(s) === classType
        ) || app.students.find(s =>
            s.name === source.name &&
            s.grade === grade &&
            studentClassType(s) === classType &&
            (!externalId || !s.externalStudentId)
        );
        if (!student) {
            student = {
                id: externalId
                    ? `import_student_${safeExternalId}_${classType}`
                    : `import_student_${Date.now()}_${classType}_${Math.random().toString(36).slice(2, 7)}`,
                name: source.name,
                grade
            };
            app.students.push(student);
        }
        student.externalStudentId = externalId || student.externalStudentId;
        student.grade = grade || student.grade;
        student.is1v1 = !!oneToOne;
        student.classType = classType;
        return student;
    }

    function buildImportPlan(app, input, options = {}) {
        const courses = extractCourses(input);
        if (!courses.length) throw new Error('没有识别到有效课程数据');
        const originalDates = courses.map(course => localDate(course.courseDate));
        const invalidIndex = originalDates.findIndex(date => !date);
        if (invalidIndex >= 0) {
            const course = courses[invalidIndex];
            throw new Error(`课程 ${course.courseName || course.id || ''} 缺少有效的课程日期`);
        }
        const importItems = options.fromCurrentStage
            ? shiftCoursesToStageStarts(app, courses)
            : courses.map((course, index) => ({ course, date: originalDates[index] }));
        importItems.forEach(item => periodSlots(app, item.course));
        return {
            courses,
            importItems,
            // Conflict detection and overwrite must cover the dates that will
            // actually be written. Stage import can shift them away from the
            // source JSON dates.
            rangeStart: new Date(Math.min(...importItems.map(item => item.date.getTime()))),
            rangeEnd: new Date(Math.max(...importItems.map(item => item.date.getTime())))
        };
    }

    function versionHasCourse(version) {
        return !!(version && !version._cutoff && (version.subject || (Array.isArray(version.student) && version.student.length > 0)));
    }

    function hasCoursesInRange(app, startDate, endDate) {
        const erp = window.ScheduleErpService.ensureErpData(app);
        const keys = [...new Set((erp.courseInstances || []).map(instance => instance.cellKey).filter(Boolean))];
        for (const key of keys) {
            const firstDate = app.getFirstOccurrenceOnOrAfter(key, startDate);
            if (!firstDate || firstDate > endDate) continue;
            for (let date = new Date(firstDate); date <= endDate; date = app.addDays(date, 7)) {
                const weekStart = app.getWeekStartStrForDate(date);
                if (versionHasCourse(app.getCellVersion(key, weekStart))) return true;
            }
        }
        return false;
    }

    function clearCoursesInRange(app, startDate, endDate) {
        const erp = window.ScheduleErpService.ensureErpData(app);
        const cellKeys = [...new Set((erp.courseInstances || []).map(instance => instance.cellKey).filter(Boolean))];

        cellKeys.forEach(cellKey => {
            const firstCandidateDate = app.getFirstOccurrenceOnOrAfter(cellKey, startDate);
            const lastCandidateDate = app.getLastOccurrenceOnOrBefore(cellKey, endDate);
            if (!firstCandidateDate || !lastCandidateDate || firstCandidateDate > lastCandidateDate) return;

            const searchFromWeekStart = app.getWeekStartStrForDate(firstCandidateDate);
            const searchToWeekStart = app.getWeekStartStrForDate(lastCandidateDate);
            const firstAffectedWeekStart = app.findFirstWeekWithContent(cellKey, searchFromWeekStart, searchToWeekStart);
            if (!firstAffectedWeekStart) return;
            const lastAffectedWeekStart = app.findLastWeekWithContent(cellKey, firstAffectedWeekStart, searchToWeekStart);
            if (!lastAffectedWeekStart) return;

            const restoreWeekStart = app.getWeekStartStrForDate(app.addDays(app.parseDateInputValue(lastAffectedWeekStart), 7));
            const restoreSnapshot = app.cloneVersionSnapshot(app.getCellVersion(cellKey, restoreWeekStart));
            app.setCellVersion(cellKey, firstAffectedWeekStart, null, [], { cutoff: true });

            if (restoreSnapshot && (restoreSnapshot.subject || restoreSnapshot.student.length > 0)) {
                const restoredVersion = window.ScheduleErpService.restoreCellSnapshot(app, cellKey, restoreWeekStart, restoreSnapshot);
                const restoredInstance = restoredVersion
                    ? window.ScheduleErpService.getCourseInstanceForVersion(app, restoredVersion)
                    : null;
                if (restoredInstance && restoreSnapshot.actualMinutesByDate) {
                    restoredInstance.actualMinutesByDate = Object.fromEntries(
                        Object.entries(restoreSnapshot.actualMinutesByDate).filter(([dateKey]) =>
                            !app.isDateWithinCustomResetRange(dateKey, startDate, endDate)
                        )
                    );
                }
            }
        });

        erp.attendanceRecords = (erp.attendanceRecords || []).filter(record =>
            !app.isDateWithinCustomResetRange(record.dateKey, startDate, endDate)
        );
        (erp.courseInstances || []).forEach(instance => {
            if (instance.actualMinutesByDate) {
                instance.actualMinutesByDate = Object.fromEntries(
                    Object.entries(instance.actualMinutesByDate).filter(([dateKey]) =>
                        !app.isDateWithinCustomResetRange(dateKey, startDate, endDate)
                    )
                );
            }
            if (instance.studentActualMinutesByDate) {
                instance.studentActualMinutesByDate = Object.fromEntries(
                    Object.entries(instance.studentActualMinutesByDate).filter(([dateKey]) =>
                        !app.isDateWithinCustomResetRange(dateKey, startDate, endDate)
                    )
                );
            }
            instance.updatedAt = new Date().toISOString();
        });
        window.ScheduleErpService.buildTimetableProjection(app);
    }

    function createImportSnapshot(app) {
        return JSON.parse(JSON.stringify({
            subjects: app.subjects || [],
            students: app.students || [],
            erpData: app.erpData || null
        }));
    }

    function restoreImportSnapshot(app, snapshot) {
        if (!snapshot) return;
        app.subjects = snapshot.subjects;
        app.students = snapshot.students;
        app.erpData = snapshot.erpData;
        window.ScheduleErpService.ensureErpData(app);
        window.ScheduleErpService.buildTimetableProjection(app);
        app.saveData();
    }

    function importCourses(app, input, options = {}) {
        const plan = options.plan || buildImportPlan(app, input, options);
        const courses = plan.courses;
        const importItems = plan.importItems;
        let studentCount = 0;
        let skippedCourseCount = 0;
        importItems.forEach(({ course, date }) => {
            if (!date) throw new Error(`课程 ${course.courseName || course.id || ''} 缺少有效的课程日期`);
            const day = date.getDay() || 7;
            const weekStart = app.formatLocalDate(app.getWeekRange(date).start);
            const { range, slots } = periodSlots(app, course);
            const occupied = slots.some(slot => versionHasCourse(app.getCellVersion(app.buildCellKey(day, slot.index), weekStart)));
            if (options.skipOccupied && occupied) {
                skippedCourseCount++;
                return;
            }
            const oneToOne = isOneToOne(course);
            const sourceStudents = Array.isArray(course.students) ? course.students : [];
            const students = sourceStudents.map(s => ensureStudent(app, s, course, oneToOne));
            const subject = ensureSubject(app, course);
            const importGroupId = `course_import_${course.id || app.formatLocalDate(date)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            slots.forEach((slot, slotIndex) => {
                const cellKey = app.buildCellKey(day, slot.index);
                const previousVersion = app.getCellVersion(cellKey, weekStart);
                const previousInstance = previousVersion && previousVersion.courseInstanceId
                    ? window.ScheduleErpService.ensureErpData(app).courseInstances.find(item => item.id === previousVersion.courseInstanceId)
                    : null;
                const preserveManualRoster = !!options.preserveManual
                    && previousInstance
                    && previousInstance.source !== 'course-import';
                const importedStudentIds = preserveManualRoster
                    ? (previousVersion.student || []).map(String)
                    : students.map(s => String(s.id));
                window.ScheduleErpService.setCellVersion(app, cellKey, weekStart, subject.id, importedStudentIds, {
                    source: preserveManualRoster ? previousInstance.source : 'course-import',
                    recalculateStage: true
                });
                const erp = window.ScheduleErpService.ensureErpData(app);
                const instance = erp.courseInstances.find(item => item.cellKey === cellKey && item.weekStart === weekStart);
                if (instance) {
                    const dateKey = app.formatLocalDate(date);
                    instance.importGroupId = importGroupId;
                    instance.importPartIndex = slotIndex;
                    instance.importPartCount = slots.length;
                    instance.importSourceTime = `${range.start}-${range.end}`;
                    instance.importTotalMinutes = range.durationMinutes;
                    const preserveLocalActual = !!options.preserveManual
                        && instance.manualActualMinutesByDate
                        && instance.manualActualMinutesByDate[dateKey];
                    if (!preserveLocalActual) {
                        instance.actualMinutesByDate = {
                            ...(instance.actualMinutesByDate || {}),
                            [dateKey]: slot.overlapMinutes
                        };
                        if (instance.manualActualMinutesByDate) {
                            delete instance.manualActualMinutesByDate[dateKey];
                        }
                    }
                    if (!options.preserveManual) {
                        if (instance.studentActualMinutesByDate) {
                            delete instance.studentActualMinutesByDate[dateKey];
                        }
                        if (instance.manualStudentActualMinutesByDate) {
                            delete instance.manualStudentActualMinutesByDate[dateKey];
                        }
                    }
                    const studentMinutes = {};
                    sourceStudents.forEach((source, i) => {
                        const minutes = studentActualMinutesForSlot(source, slot, range);
                        const studentId = String(students[i].id);
                        const preserveLocalStudentActual = !!options.preserveManual
                            && instance.manualStudentActualMinutesByDate
                            && instance.manualStudentActualMinutesByDate[dateKey]
                            && instance.manualStudentActualMinutesByDate[dateKey][studentId];
                        if (minutes !== undefined && !preserveLocalStudentActual) {
                            studentMinutes[studentId] = minutes;
                            if (instance.manualStudentActualMinutesByDate
                                && instance.manualStudentActualMinutesByDate[dateKey]) {
                                delete instance.manualStudentActualMinutesByDate[dateKey][studentId];
                            }
                        }
                    });
                    if (Object.keys(studentMinutes).length) {
                        instance.studentActualMinutesByDate = { ...(instance.studentActualMinutesByDate || {}) };
                        instance.studentActualMinutesByDate[dateKey] = {
                            ...(instance.studentActualMinutesByDate[dateKey] || {}),
                            ...studentMinutes
                        };
                    }
                }
                if (!options.preserveManual) {
                    const dateKey = app.formatLocalDate(date);
                    const erp = window.ScheduleErpService.ensureErpData(app);
                    erp.attendanceRecords = (erp.attendanceRecords || []).filter(record =>
                        !(record.cellKey === cellKey && record.dateKey === dateKey)
                    );
                }
                sourceStudents.forEach((source, i) => {
                    const status = attendanceStatus(course, source);
                    if (status) window.ScheduleErpService.upsertAttendance(
                        app,
                        cellKey,
                        students[i].id,
                        status,
                        app.formatLocalDate(date),
                        { source: 'course-sync', preserveManual: !!options.preserveManual }
                    );
                });
            });
            studentCount += students.length;
        });
        app.syncRealtime({ weekRange: true });
        return { courseCount: courses.length - skippedCourseCount, skippedCourseCount, studentCount };
    }

    window.CourseDataImportService = {
        extractCourses,
        normalizeMarkedInput,
        isOneToOne,
        attendanceStatus,
        sourceActualMinutes,
        studentActualMinutesForSlot,
        periodSlots,
        importCourses,
        shiftCoursesToStageStarts,
        buildImportPlan,
        hasCoursesInRange,
        clearCoursesInRange
    };
    TimetableApp.prototype.syncCourseImportStageStartToggle = function () {
        const button = document.getElementById('courseImportStageStartToggle');
        if (!button) return;
        const enabled = !!(this.settings && this.settings.segmentedScheduling);
        if (!enabled) this._courseImportFromCurrentStage = false;
        button.style.display = enabled ? 'inline-flex' : 'none';
        button.classList.toggle('active', !!this._courseImportFromCurrentStage);
        button.setAttribute('aria-pressed', this._courseImportFromCurrentStage ? 'true' : 'false');
        button.textContent = this._courseImportFromCurrentStage ? '✓ 阶段导入' : '阶段导入';
    };
    TimetableApp.prototype.toggleCourseImportStageStart = function () {
        this._courseImportFromCurrentStage = !this._courseImportFromCurrentStage;
        this.syncCourseImportStageStartToggle();
    };
    TimetableApp.prototype.openCourseDataImportModal = function () {
        this._courseImportFromCurrentStage = false;
        this.syncCourseImportStageStartToggle();
        document.getElementById('courseDataImportModal').style.display = 'block';
    };
    TimetableApp.prototype.closeCourseDataImportModal = function () { document.getElementById('courseDataImportModal').style.display = 'none'; };
    TimetableApp.prototype.clearCourseDataImportText = function () {
        const input = document.getElementById('courseDataImportText');
        const message = document.getElementById('courseDataImportMessage');
        if (input) {
            input.value = '';
            input.focus();
        }
        if (message) message.textContent = '';
    };
    TimetableApp.prototype.pasteCourseDataImportText = async function () {
        const input = document.getElementById('courseDataImportText');
        const message = document.getElementById('courseDataImportMessage');
        if (!input) return;
        try {
            let text;
            if (window.electronAPI && typeof window.electronAPI.readClipboardText === 'function') {
                text = await window.electronAPI.readClipboardText();
            } else if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
                text = await navigator.clipboard.readText();
            } else {
                throw new Error('当前环境不支持读取剪贴板');
            }
            if (!text) {
                if (message) message.textContent = '剪贴板中没有可粘贴的文本';
                input.focus();
                return;
            }
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            if (message) message.textContent = '已粘贴剪贴板内容';
        } catch (error) {
            if (message) message.textContent = '粘贴失败：无法读取剪贴板，请检查剪贴板权限后重试。';
        }
    };
    TimetableApp.prototype.importCourseDataText = async function (input, message, trusted = false, importOptions = {}) {
        message = message || { textContent: '' };
        try {
            const markedInput = trusted
                ? { text: typeof input === 'string' ? input : JSON.stringify(input), hasStageMarker: false }
                : normalizeMarkedInput(input);
            const segmentedScheduling = !!(this.settings && this.settings.segmentedScheduling);
            if (!trusted && !markedInput.hasStageMarker) {
                throw new Error('请输入口令后再导入。');
            }
            const markerStageImport = !trusted && segmentedScheduling;
            const options = {
                fromCurrentStage: markerStageImport,
                preserveManual: trusted && importOptions.preserveManual !== false
            };
            const plan = buildImportPlan(this, markedInput.text, options);
            const hasOldCourses = hasCoursesInRange(this, plan.rangeStart, plan.rangeEnd);
            let overwrite = false;
            const updateExisting = trusted && !!importOptions.updateExisting;
            if (hasOldCourses && !updateExisting) {
                overwrite = await window.showAppConfirm(
                    `本周有旧数据未清理，是否覆盖旧数据？\n\n确定：清理 ${this.formatLocalDate(plan.rangeStart)} 至 ${this.formatLocalDate(plan.rangeEnd)} 内的所有课程后导入。\n取消：保留原课程，只在空课位新增数据。`
                );
                var importSnapshot = overwrite ? createImportSnapshot(this) : null;
                if (overwrite) clearCoursesInRange(this, plan.rangeStart, plan.rangeEnd);
            }
            let result;
            try {
                result = importCourses(this, markedInput.text, {
                    ...options,
                    plan,
                    skipOccupied: hasOldCourses && !overwrite && !updateExisting
                });
            } catch (error) {
                if (importSnapshot) restoreImportSnapshot(this, importSnapshot);
                throw error;
            }
            const skippedText = result.skippedCourseCount > 0 ? `，跳过 ${result.skippedCourseCount} 节已占用课程` : '';
            const stageText = markerStageImport ? '，已按阶段起点导入' : '';
            message.textContent = `导入成功：${result.courseCount} 节课程，处理 ${result.studentCount} 名学生${skippedText}${stageText}`;
        } catch (error) {
            const detail = String(error && error.message ? error.message : '');
            if (detail === '请先打开阶段排课') {
                message.textContent = detail;
                return;
            }
            if (this.settings && this.settings.segmentedScheduling) {
                message.textContent = '导入失败';
                return;
            }
            const chineseDetail = /[\u3400-\u9fff]/.test(detail) ? detail : '数据格式不正确或内容无法读取，请检查后重试。';
            message.textContent = `导入失败：${chineseDetail}`;
        }
    };
    TimetableApp.prototype.submitCourseDataImport = async function (event) {
        event.preventDefault();
        const message = document.getElementById('courseDataImportMessage');
        try {
            const input = document.getElementById('courseDataImportText').value;
            const options = {
                fromCurrentStage: !!this._courseImportFromCurrentStage
            };
            const plan = buildImportPlan(this, input, options);
            const hasOldCourses = hasCoursesInRange(this, plan.rangeStart, plan.rangeEnd);
            let overwrite = false;
            if (hasOldCourses) {
                overwrite = await window.showAppConfirm(
                    `本周有旧数据未清理，是否覆盖旧数据？\n\n确定：清理 ${this.formatLocalDate(plan.rangeStart)} 至 ${this.formatLocalDate(plan.rangeEnd)} 内的所有课程后导入。\n取消：保留原课程，只在空课位新增数据。`
                );
                var importSnapshot = overwrite ? createImportSnapshot(this) : null;
                if (overwrite) clearCoursesInRange(this, plan.rangeStart, plan.rangeEnd);
            }
            let result;
            try {
                result = importCourses(this, input, {
                    ...options,
                    plan,
                    skipOccupied: hasOldCourses && !overwrite
                });
            } catch (error) {
                if (importSnapshot) restoreImportSnapshot(this, importSnapshot);
                throw error;
            }
            const skippedText = result.skippedCourseCount > 0 ? `，跳过 ${result.skippedCourseCount} 节已占用课程` : '';
            message.textContent = `导入成功：${result.courseCount} 节课程，处理 ${result.studentCount} 名学生${skippedText}`;
        } catch (error) {
            const detail = String(error && error.message ? error.message : '');
            const chineseDetail = /[\u3400-\u9fff]/.test(detail) ? detail : '数据格式不正确或内容无法读取，请检查后重试。';
            message.textContent = `导入失败：${chineseDetail}`;
        }
    };
})();
