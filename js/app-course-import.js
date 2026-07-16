// Recognize external course JSON and import it as the highest-priority schedule version.
(function () {
    const STATUS = { PRESENT: 'present', ATTENDANCE: 'present', ATTENDED: 'present', LEAVE: 'leave', ASK_FOR_LEAVE: 'leave', ABSENT: 'absent', ABSENCE: 'absent' };

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
        return Number.isNaN(result.getTime()) ? null : result;
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
        if (invalid) throw new Error(`课程 ${invalid.course.courseName || invalid.course.id || ''} 缺少有效 courseDate`);
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
        return raw ? STATUS[String(raw).toUpperCase()] || null : null;
    }

    function periodIndex(app, course) {
        const start = String(course.courseTime || '').slice(0, 5);
        const end = String(course.courseEndTime || '').slice(0, 5);
        const ordered = app.getOrderedPeriods();
        let found = ordered.find(x => {
            const range = String(x.period.time || '').split('-').map(v => v.trim().slice(0, 5));
            return range[0] === start && (!end || range[1] === end);
        });
        if (!found) found = ordered.find(x => String(x.period.time || '').startsWith(start));
        if (!found) throw new Error(`未找到与 ${start}-${end} 对应的课时，请先配置该时间段`);
        return found.index;
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
                    ? `import_student_${externalId}_${classType}`
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
            throw new Error(`课程 ${course.courseName || course.id || ''} 缺少有效 courseDate`);
        }
        const importItems = options.fromCurrentStage
            ? shiftCoursesToStageStarts(app, courses)
            : courses.map((course, index) => ({ course, date: originalDates[index] }));
        importItems.forEach(item => periodIndex(app, item.course));
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
            if (!instance.actualMinutesByDate) return;
            instance.actualMinutesByDate = Object.fromEntries(
                Object.entries(instance.actualMinutesByDate).filter(([dateKey]) =>
                    !app.isDateWithinCustomResetRange(dateKey, startDate, endDate)
                )
            );
            instance.updatedAt = new Date().toISOString();
        });
        window.ScheduleErpService.buildTimetableProjection(app);
    }

    function importCourses(app, input, options = {}) {
        const plan = options.plan || buildImportPlan(app, input, options);
        const courses = plan.courses;
        const importItems = plan.importItems;
        let studentCount = 0;
        let skippedCourseCount = 0;
        importItems.forEach(({ course, date }) => {
            if (!date) throw new Error(`课程 ${course.courseName || course.id || ''} 缺少有效 courseDate`);
            const day = date.getDay() || 7;
            const cellKey = app.buildCellKey(day, periodIndex(app, course));
            const weekStart = app.formatLocalDate(app.getWeekRange(date).start);
            if (options.skipOccupied && versionHasCourse(app.getCellVersion(cellKey, weekStart))) {
                skippedCourseCount++;
                return;
            }
            const oneToOne = isOneToOne(course);
            const sourceStudents = Array.isArray(course.students) ? course.students : [];
            const students = sourceStudents.map(s => ensureStudent(app, s, course, oneToOne));
            const subject = ensureSubject(app, course);
            window.ScheduleErpService.setCellVersion(app, cellKey, weekStart, subject.id, students.map(s => s.id), {
                source: 'course-import',
                // An overwrite may replace a cutoff carrying the old course's
                // stage metadata. Always bind imported data to its own date.
                recalculateStage: true
            });
            sourceStudents.forEach((source, i) => {
                const status = attendanceStatus(course, source);
                if (status) window.ScheduleErpService.upsertAttendance(app, cellKey, students[i].id, status, app.formatLocalDate(date));
            });
            studentCount += students.length;
        });
        app.syncRealtime({ weekRange: true });
        return { courseCount: courses.length - skippedCourseCount, skippedCourseCount, studentCount };
    }

    window.CourseDataImportService = {
        extractCourses,
        isOneToOne,
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
            if (message) message.textContent = `粘贴失败：${error.message}`;
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
                if (overwrite) clearCoursesInRange(this, plan.rangeStart, plan.rangeEnd);
            }
            const result = importCourses(this, input, {
                ...options,
                plan,
                skipOccupied: hasOldCourses && !overwrite
            });
            const skippedText = result.skippedCourseCount > 0 ? `，跳过 ${result.skippedCourseCount} 节已占用课程` : '';
            message.textContent = `导入成功：${result.courseCount} 节课程，处理 ${result.studentCount} 名学生${skippedText}`;
        } catch (error) { message.textContent = `导入失败：${error.message}`; }
    };
})();
