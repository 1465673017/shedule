// app-attendance.js - Attendance and recurrence
// Auto-split from script.js

TimetableApp.prototype.openAttendanceModal = function(cell) {
        this.selectedCell = cell;
        const modal = document.getElementById('attendanceModal');

        const day = cell.dataset.day;
        const period = cell.dataset.period;
        const key = this.buildCellKey(day, period);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const version = this.getCellVersion(key, weekStartStr);

        const subject = version && version.subject
            ? this.subjects.find(s => s.id == version.subject)
            : null;

        const studentIds = version && version.student && Array.isArray(version.student)
            ? version.student
            : [];
        
        const students = studentIds.map(id => this.students.find(s => s.id == id)).filter(Boolean);
        
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dayIndex = parseInt(day);
        const dayName = dayIndex >= 0 && dayIndex <= 6 ? dayNames[dayIndex] : '';
        
        const periodInfo = this.getPeriod(period);
        const periodLabel = periodInfo && periodInfo.name
            ? periodInfo.name
            : `第${this.getPeriodNumber(period)}节`;
        const weekRange = this.getWeekRange(this.currentDate);
        const classDate = new Date(weekRange.start);
        classDate.setDate(weekRange.start.getDate() + (dayIndex - 1));
        const formatLocalDate = d => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const dateKey = formatLocalDate(classDate);
        
        const lessonInfo = document.getElementById('attendanceLessonInfo');
        const scheduledMinutes = periodInfo ? this.timeToMinutes(periodInfo.time.split('-')[1]) - this.timeToMinutes(periodInfo.time.split('-')[0]) : 120;
        const courseInstance = version && version.courseInstanceId && this.erpData
            ? (this.erpData.courseInstances || []).find(item => item.id === version.courseInstanceId)
            : null;
        const hasNonStandardTime = !!(
            courseInstance
            && courseInstance.isNonStandardTime
            && courseInstance.actualStartTime
            && courseInstance.actualEndTime
        );
        const actualCourseMinutes = hasNonStandardTime
            ? Math.max(0, this.timeToMinutes(courseInstance.actualEndTime) - this.timeToMinutes(courseInstance.actualStartTime))
            : scheduledMinutes;
        const hasManualActual = !!(
            courseInstance
            && courseInstance.manualActualMinutesByDate
            && courseInstance.manualActualMinutesByDate[dateKey]
        );
        const erpActualMin = window.ScheduleErpService.getActualMinutes(this, key, dateKey);
        let actualMin = hasNonStandardTime && !hasManualActual
            ? actualCourseMinutes
            : erpActualMin !== undefined
            ? erpActualMin
            : scheduledMinutes;
        const studentActualValues = students.map(student =>
            window.ScheduleErpService.getStudentActualMinutes(this, key, student.id, dateKey)
        );
        if (studentActualValues.some(value => value !== undefined)) {
            actualMin = Math.max(...studentActualValues.map(value =>
                value !== undefined ? Math.max(0, Number(value) || 0) : actualMin
            ));
        }
        const attendanceTime = hasNonStandardTime
            ? `${courseInstance.actualStartTime}-${courseInstance.actualEndTime}`
            : (periodInfo ? periodInfo.time : '');
        const actualDisplay = this.formatDuration(Math.floor(actualMin / 60), actualMin % 60);

        lessonInfo.innerHTML = `
            <div class="attendance-lesson-summary">
                <div class="attendance-lesson-main">
                    <strong class="attendance-lesson-period">${dayName} ${periodLabel}</strong>
                    <span class="attendance-lesson-subject">${this.escapeHtml(subject ? subject.name : '无科目')}</span>
                    <button type="button" class="attendance-lesson-time attendance-lesson-time-button" title="点击调整上课时间"><span class="attendance-lesson-time-value">${attendanceTime}</span></button>
                </div>
                <div class="actual-duration-display" title="点击设置每个学生的实际上课时长">
                    <span class="actual-duration-label">实上</span>
                    <span class="actual-duration-value">${actualDisplay}</span>
                    <span class="actual-duration-edit-icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16"><path d="M4 6L8 10L12 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                </div>
            </div>
        `;
        lessonInfo.querySelector('.actual-duration-display')?.addEventListener('click', event => {
            this.showDurationEditor(event, key);
        });
        lessonInfo.querySelector('.attendance-lesson-time-button')?.addEventListener('click', event => {
            this.showLessonTimeEditor(event, key);
        });
        
        this._attModalClassFinished = this.isClassFinished(key, classDate);
        this._attModalDateKey = dateKey;
        this._attModalClassDate = classDate;
        this._attModalCourseInstanceId = version ? version.courseInstanceId : null;
        this._attModalDefaultMinutes = actualMin;
        this._attModalScheduledMinutes = scheduledMinutes;
        this._attModalHasNonStandardTime = hasNonStandardTime;
        this._attModalCourseInstance = courseInstance;

        this._attModalKey = key;
        this._attModalStudents = students;
        this._attModalCellKey = key;

        // 预计算每个学生的重复类型
        this._attModalRecurrence = {};
        students.forEach(student => {
            this._attModalRecurrence[student.id] = this.getStudentRecurrenceType(key, student.id);
        });

        this.renderAttendanceStudentList(students, key);
        this.renderAttendanceRecords(students, key);

        modal.style.display = 'block';
    }

TimetableApp.prototype.getAttendanceStatusForModal = function(key, studentId) {
        const dateKey = this._attModalDateKey || '';
        if (this.erpData && Array.isArray(this.erpData.attendanceRecords)) {
            const erpRecord = this.erpData.attendanceRecords.find(record =>
                record.studentId === String(studentId) &&
                record.dateKey === dateKey &&
                (
                    (this._attModalCourseInstanceId && record.courseInstanceId === this._attModalCourseInstanceId) ||
                    record.cellKey === key
                )
            );
            if (erpRecord) return erpRecord.status;
        }
        return null;
    }

TimetableApp.prototype.closeAttendanceModal = function() {
        document.getElementById('attendanceModal').style.display = 'none';
        this.selectedCell = null;
        this._attModalClassFinished = null;
        this._attModalDateKey = null;
        this._attModalCellKey = null;
        this._attModalCourseInstanceId = null;
        this._attModalDefaultMinutes = null;
        this._attModalScheduledMinutes = null;
        this._attModalHasNonStandardTime = null;
        this._attModalCourseInstance = null;
        this._attModalRecurrence = null;
        this.hideLessonTimeEditor();
        this.hideDurationEditor();
    }

TimetableApp.prototype.formatSliderTime = function(minutes) {
    const normalized = Math.max(0, Math.min(1439, Number(minutes) || 0));
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

TimetableApp.prototype.hideLessonTimeEditor = function() {
    const editor = document.getElementById('lessonTimeEditorDropdown');
    if (editor) editor.remove();
    if (this._lessonTimeDocClickHandler) {
        document.removeEventListener('click', this._lessonTimeDocClickHandler);
        this._lessonTimeDocClickHandler = null;
    }
}

TimetableApp.prototype.showLessonTimeEditor = function(event, key) {
    event.stopPropagation();
    const displayEl = event.currentTarget;
    const existing = document.getElementById('lessonTimeEditorDropdown');
    if (existing && existing.parentElement === displayEl) {
        this.hideLessonTimeEditor();
        return;
    }
    this.hideDurationEditor();
    this.hideLessonTimeEditor();

    const parsed = this.parseCellKey(key);
    const periodInfo = parsed ? this.getPeriod(parsed.periodIndex) : null;
    const parts = String(periodInfo && periodInfo.time || '').split('-');
    if (parts.length !== 2) return;
    const standardStart = this.timeToMinutes(parts[0]);
    const standardEnd = this.timeToMinutes(parts[1]);
    const instance = this._attModalCourseInstance;
    const savedStart = instance && instance.actualStartTime ? this.timeToMinutes(instance.actualStartTime) : standardStart;
    const savedEnd = instance && instance.actualEndTime ? this.timeToMinutes(instance.actualEndTime) : standardEnd;
    const startValue = Math.max(standardStart, Math.min(standardEnd, savedStart));
    const endLimit = Math.min(1439, standardEnd + 120);
    const endValue = Math.max(standardEnd, Math.min(endLimit, savedEnd));

    const editor = document.createElement('div');
    editor.id = 'lessonTimeEditorDropdown';
    editor.className = 'duration-editor-dropdown lesson-time-editor-dropdown';
    editor.innerHTML = `
        <div class="duration-editor-header">调整实际上课时间</div>
        <div class="duration-editor-body lesson-time-slider-body">
            <div class="lesson-time-slider-row">
                <div class="lesson-time-slider-heading"><span>开始时间</span><strong id="lessonStartTimeValue">${this.formatSliderTime(startValue)}</strong></div>
                <input type="range" id="lessonStartTimeRange" class="duration-range" min="${standardStart}" max="${standardEnd}" step="5" value="${startValue}">
                <small>可选范围 ${this.formatSliderTime(standardStart)}–${this.formatSliderTime(standardEnd)}</small>
            </div>
            <div class="lesson-time-slider-row">
                <div class="lesson-time-slider-heading"><span>结束时间</span><strong id="lessonEndTimeValue">${this.formatSliderTime(endValue)}</strong></div>
                <input type="range" id="lessonEndTimeRange" class="duration-range" min="${standardEnd}" max="${endLimit}" step="5" value="${endValue}">
                <small>可选范围 ${this.formatSliderTime(standardEnd)}–${this.formatSliderTime(endLimit)}</small>
            </div>
        </div>
    `;
    displayEl.appendChild(editor);
    ['click', 'mousedown', 'pointerdown'].forEach(eventName => {
        editor.addEventListener(eventName, editorEvent => editorEvent.stopPropagation());
    });
    const startRange = editor.querySelector('#lessonStartTimeRange');
    const endRange = editor.querySelector('#lessonEndTimeRange');
    const startLabel = editor.querySelector('#lessonStartTimeValue');
    const endLabel = editor.querySelector('#lessonEndTimeValue');
    let acceptedStart = Number(startRange.value);
    let acceptedEnd = Number(endRange.value);
    const refresh = () => {
        startLabel.textContent = this.formatSliderTime(startRange.value);
        endLabel.textContent = this.formatSliderTime(endRange.value);
    };
    const commit = () => {
        let start = Number(startRange.value);
        let end = Number(endRange.value);
        if (end <= start) {
            end = Math.min(endLimit, start + 5);
            endRange.value = String(end);
        }
        if (!this.saveAttendanceLessonTime(key, start, end)) {
            startRange.value = String(acceptedStart);
            endRange.value = String(acceptedEnd);
        } else {
            acceptedStart = start;
            acceptedEnd = end;
        }
        refresh();
    };
    [startRange, endRange].forEach(range => {
        range.addEventListener('input', refresh);
        range.addEventListener('change', commit);
        range.addEventListener('wheel', wheelEvent => {
            wheelEvent.preventDefault();
            wheelEvent.stopPropagation();
            const direction = wheelEvent.deltaY > 0 ? 1 : -1;
            range.value = String(Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + direction * 5)));
            commit();
        }, { passive: false });
    });
    setTimeout(() => {
        this._lessonTimeDocClickHandler = clickEvent => {
            if (!editor.contains(clickEvent.target) && clickEvent.target !== displayEl) {
                this.hideLessonTimeEditor();
            }
        };
        document.addEventListener('click', this._lessonTimeDocClickHandler);
    }, 0);
}

TimetableApp.prototype.saveAttendanceLessonTime = function(key, startMinutes, endMinutes) {
    const instance = this._attModalCourseInstance;
    if (!instance || endMinutes <= startMinutes) return false;
    const parsed = this.parseCellKey(key);
    const day = parsed ? String(parsed.day) : String(key).split('-')[0];
    const conflicts = (this.erpData && this.erpData.courseInstances || []).filter(other => {
        if (!other || other.isDeleted || other.id === instance.id || other.weekStart !== instance.weekStart) return false;
        if (String(other.cellKey || '').split('-')[0] !== day) return false;
        const otherPeriod = this.getPeriod(String(other.cellKey || '').split('-')[1]);
        const otherParts = String(otherPeriod && otherPeriod.time || '').split('-');
        const otherStart = this.timeToMinutes(other.actualStartTime || otherParts[0]);
        const otherEnd = this.timeToMinutes(other.actualEndTime || otherParts[1]);
        return startMinutes < otherEnd && endMinutes > otherStart;
    });
    if (conflicts.length) {
        const conflict = conflicts[0];
        const otherPeriod = this.getPeriod(String(conflict.cellKey || '').split('-')[1]);
        const otherParts = String(otherPeriod && otherPeriod.time || '').split('-');
        alert(`调整后的时间与 ${conflict.actualStartTime || otherParts[0]}-${conflict.actualEndTime || otherParts[1]} 的课程重叠。`);
        return false;
    }

    const periodInfo = parsed ? this.getPeriod(parsed.periodIndex) : null;
    const standardParts = String(periodInfo && periodInfo.time || '').split('-');
    const start = this.formatSliderTime(startMinutes);
    const end = this.formatSliderTime(endMinutes);
    const duration = endMinutes - startMinutes;
    instance.actualStartTime = start;
    instance.actualEndTime = end;
    instance.standardStartTime = standardParts[0];
    instance.standardEndTime = standardParts[1];
    instance.isNonStandardTime = start !== standardParts[0] || end !== standardParts[1];
    instance.timeSource = 'manual';
    instance.timeManuallyAdjusted = true;
    instance.importSourceTime = `${start}-${end}`;
    instance.importTotalMinutes = duration;
    instance.actualMinutesByDate = { ...(instance.actualMinutesByDate || {}), [this._attModalDateKey]: duration };
    instance.manualActualMinutesByDate = { ...(instance.manualActualMinutesByDate || {}), [this._attModalDateKey]: true };
    instance.studentActualMinutesByDate = { ...(instance.studentActualMinutesByDate || {}) };
    instance.studentActualMinutesByDate[this._attModalDateKey] = { ...(instance.studentActualMinutesByDate[this._attModalDateKey] || {}) };
    (this._attModalStudents || []).forEach(student => {
        const manual = instance.manualStudentActualMinutesByDate
            && instance.manualStudentActualMinutesByDate[this._attModalDateKey]
            && instance.manualStudentActualMinutesByDate[this._attModalDateKey][String(student.id)];
        if (!manual) instance.studentActualMinutesByDate[this._attModalDateKey][String(student.id)] = duration;
    });
    instance.updatedAt = new Date().toISOString();
    this._attModalDefaultMinutes = duration;
    this._attModalHasNonStandardTime = instance.isNonStandardTime;
    const timeValue = document.querySelector('.attendance-lesson-time-value');
    if (timeValue) timeValue.textContent = `${start}-${end}`;
    const durationValue = document.querySelector('.actual-duration-value');
    if (durationValue) durationValue.textContent = this.formatDuration(Math.floor(duration / 60), duration % 60);
    this.saveData();
    this.renderTimetable();
    return true;
}

TimetableApp.prototype.showDurationEditor = function(event, key) {
    event.stopPropagation();
    const displayEl = event.currentTarget.closest('.actual-duration-display');
    const existingEditor = document.getElementById('durationEditorDropdown');
    if (existingEditor && existingEditor.parentElement === displayEl) {
        this.hideDurationEditor();
        return;
    }
    // Close an editor opened from another duration control.
    this.hideLessonTimeEditor();
    this.hideDurationEditor();

        const scheduledMinutes = this._attModalScheduledMinutes !== undefined
            ? this._attModalScheduledMinutes
            : this.getScheduledMinutes(key);
        const erpActualMin = window.ScheduleErpService.getActualMinutes(this, key, this._attModalDateKey);
        const currentMin = this._attModalDefaultMinutes !== undefined
            ? this._attModalDefaultMinutes
            : erpActualMin !== undefined
            ? erpActualMin
            : scheduledMinutes;
        const students = this._attModalStudents || [];
        const studentDurations = students.map(student => {
            const saved = window.ScheduleErpService.getStudentActualMinutes(this, key, student.id, this._attModalDateKey);
            const instance = this._attModalCourseInstance;
            const isManual = !!(
                instance
                && instance.manualStudentActualMinutesByDate
                && instance.manualStudentActualMinutesByDate[this._attModalDateKey]
                && instance.manualStudentActualMinutesByDate[this._attModalDateKey][String(student.id)]
            );
            const shouldUseCourseDuration = this._attModalHasNonStandardTime
                && !isManual;
            return Math.max(0, shouldUseCourseDuration ? currentMin : (saved !== undefined ? saved : currentMin));
        });
        const masterMinutes = studentDurations.length ? Math.max(...studentDurations) : Math.max(0, currentMin);
        const rangeMax = Math.max(240, masterMinutes, currentMin);

        const editor = document.createElement('div');
        editor.className = 'duration-editor-dropdown';
        editor.id = 'durationEditorDropdown';
        editor.onclick = (e) => e.stopPropagation();
        editor.innerHTML = `
            <div class="duration-editor-header">设置学生实际上课时长</div>
            <div class="duration-editor-body student-duration-editor-body">
                ${students.length ? `<div class="student-duration-master-row">
                    <input type="range" class="duration-range student-duration-master-range" min="0" max="${rangeMax}" step="5" value="${masterMinutes}">
                </div>` : ''}
                ${students.map((student, index) => {
                    const minutes = studentDurations[index];
                    return `<div class="student-duration-row">
                        <span class="student-duration-name">${this.escapeHtml(student.name)}</span>
                        <input type="range" class="duration-range student-duration-range" data-student-id="${this.escapeHtml(student.id)}" min="0" max="${rangeMax}" step="5" value="${minutes}">
                        <span class="duration-slider-val" id="studentDurationVal-${this.escapeHtml(student.id)}">${this.formatDuration(Math.floor(minutes / 60), minutes % 60)}</span>
                    </div>`;
                }).join('') || '<div class="text-muted">暂无学生</div>'}
            </div>
        `;
        displayEl.appendChild(editor);
        editor.querySelector('.student-duration-master-range')?.addEventListener('input', event => {
            this.syncAllStudentActualDurations(key, event.currentTarget.value);
        });
        editor.querySelectorAll('.student-duration-range').forEach(range => {
            range.addEventListener('input', () => this.syncStudentActualDuration(key, range.dataset.studentId, range.value));
            range.addEventListener('wheel', (wheelEvent) => {
                wheelEvent.preventDefault();
                const direction = wheelEvent.deltaY > 0 ? 1 : -1;
                range.value = String(Math.max(0, Math.min(rangeMax, Number(range.value) + direction * 5)));
                this.syncStudentActualDuration(key, range.dataset.studentId, range.value);
            }, { passive: false });
        });
        const masterRange = editor.querySelector('.student-duration-master-range');
        if (masterRange) {
            masterRange.addEventListener('wheel', (wheelEvent) => {
                wheelEvent.preventDefault();
                const direction = wheelEvent.deltaY > 0 ? 1 : -1;
                masterRange.value = String(Math.max(0, Math.min(rangeMax, Number(masterRange.value) + direction * 5)));
                this.syncAllStudentActualDurations(key, masterRange.value);
            }, { passive: false });
        }

        this._durationEditorKey = key;

        // Close dropdown when clicking outside
        setTimeout(() => {
            this._docClickHandler = (e) => {
                if (!editor.contains(e.target) && e.target !== displayEl && !displayEl.contains(e.target)) {
                    this.hideDurationEditor();
                }
            };
            document.addEventListener('click', this._docClickHandler);
        }, 0);
    }

TimetableApp.prototype.syncActualDuration = function(key) {
        const hourSlider = document.getElementById('durationHourSlider');
        const minSlider = document.getElementById('durationMinSlider');
        const hourVal = document.getElementById('durationHourVal');
        const minVal = document.getElementById('durationMinVal');
        if (!hourSlider || !minSlider) return;

        const hours = parseInt(hourSlider.value);
        const mins = parseInt(minSlider.value);
        if (hourVal) hourVal.textContent = hours;
        if (minVal) minVal.textContent = mins;

        const totalMinutes = hours * 60 + mins;            window.ScheduleErpService.setActualMinutes(this, key, totalMinutes, this._attModalDateKey);

        this.saveData();

        // Update the display badge in real-time
        const display = this.formatDuration(hours, mins);
        const valueEl = document.querySelector('.actual-duration-value');
        if (valueEl) valueEl.textContent = display;
    }

TimetableApp.prototype.syncStudentActualDuration = function(key, studentId, value, markAll = false) {
        if (this.isHistoricalDateProtected(this._attModalDateKey)) {
            this.showHistoryProtectionNotice();
            this.hideDurationEditor();
            return false;
        }
        const ranges = Array.from(document.querySelectorAll('.student-duration-range'));
        ranges.forEach(range => {
            window.ScheduleErpService.setStudentActualMinutes(this, key, range.dataset.studentId, Number(range.value), this._attModalDateKey);
        });
        const instance = this._attModalCourseInstance;
        if (instance) {
            instance.manualStudentActualMinutesByDate = instance.manualStudentActualMinutesByDate || {};
            instance.manualStudentActualMinutesByDate[this._attModalDateKey] =
                instance.manualStudentActualMinutesByDate[this._attModalDateKey] || {};
            const manualIds = markAll ? ranges.map(range => range.dataset.studentId) : [studentId];
            manualIds.forEach(id => {
                instance.manualStudentActualMinutesByDate[this._attModalDateKey][String(id)] = true;
            });
        }
        const totalMinutes = Math.max(0, ...ranges.map(range => Number(range.value) || 0));
        window.ScheduleErpService.setActualMinutes(this, key, totalMinutes, this._attModalDateKey);
        this.saveData();

        const minutes = Math.max(0, Number(value) || 0);
        const studentValue = document.getElementById(`studentDurationVal-${studentId}`);
        if (studentValue) studentValue.textContent = this.formatDuration(Math.floor(minutes / 60), minutes % 60);
        const totalValue = document.querySelector('.actual-duration-value');
        if (totalValue) totalValue.textContent = this.formatDuration(Math.floor(totalMinutes / 60), totalMinutes % 60);
        this.renderAttendanceStudentList(this._attModalStudents || [], key);
        this.renderAttendanceRecords(this._attModalStudents || [], key);
        return true;
    }

TimetableApp.prototype.syncAllStudentActualDurations = function(key, value) {
        const masterRange = document.querySelector('.student-duration-master-range');
        const rangeMax = masterRange ? Number(masterRange.max) : Math.max(240, Number(value) || 0);
        const minutes = Math.max(0, Math.min(rangeMax, Number(value) || 0));
        const ranges = Array.from(document.querySelectorAll('.student-duration-range'));
        ranges.forEach(range => {
            range.value = String(minutes);
            const studentValue = document.getElementById(`studentDurationVal-${range.dataset.studentId}`);
            if (studentValue) studentValue.textContent = this.formatDuration(Math.floor(minutes / 60), minutes % 60);
        });
        if (!ranges.length) return false;
        return this.syncStudentActualDuration(key, ranges[0].dataset.studentId, minutes, true);
    }

TimetableApp.prototype.getStudentActualDurationDisplay = function(key, studentId) {
        const status = this.getAttendanceStatusForModal(key, studentId);
        if (status === 'leave' || status === 'absent') return '0h';
        const saved = window.ScheduleErpService.getStudentActualMinutes(this, key, studentId, this._attModalDateKey);
        const total = saved !== undefined
            ? saved
            : (window.ScheduleErpService.getActualMinutes(this, key, this._attModalDateKey) ?? this.getScheduledMinutes(key));
        return Number(total) === 0 ? '0h' : this.formatDuration(Math.floor(total / 60), total % 60);
    }

TimetableApp.prototype.formatDuration = function(hours, mins) {
        if (hours === 0 && mins === 0) return '0h';
        if (hours === 0) return `${mins}min`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h${mins}min`;
    }

TimetableApp.prototype.hideDurationEditor = function() {
        const editor = document.getElementById('durationEditorDropdown');
        if (editor) editor.remove();
        this._durationEditorKey = null;
        if (this._docClickHandler) {
            document.removeEventListener('click', this._docClickHandler);
            this._docClickHandler = null;
        }
    }

TimetableApp.prototype.getScheduledMinutes = function(key) {
        const parsed = this.parseCellKey(key);
        if (!parsed) return 120;
        const periodInfo = this.getPeriod(parsed.periodIndex);
        if (periodInfo && periodInfo.time) {
            const timeParts = periodInfo.time.split('-');
            if (timeParts.length === 2) {
                return this.timeToMinutes(timeParts[1]) - this.timeToMinutes(timeParts[0]);
            }
        }
        return 120;
    }

TimetableApp.prototype.renderAttendanceStudentList = function(students, key) {
        const container = document.getElementById('attendanceStudentList');
        // Attendance state is resolved through CourseInstance-aware records first.
        const att = {};

        students.forEach(student => {
            att[student.id] = this.getAttendanceStatusForModal(key, student.id);
        });

        if (students.length === 0) {
            container.innerHTML = '<div class="text-muted">该单元格暂无学生</div>';
            return;
        }

        let html = '';
        students.forEach(student => {
            let recType = (this._attModalRecurrence && this._attModalRecurrence[student.id]) || 'recurring';
            if (student.isAudition) {
                recType = 'temporary';
            }
            const isStageAutoCompleted = window.ScheduleErpService.isStudentStageAutoCompleted(this, student.id);
            const courseCompleted = this.isStudentCourseCompleted(key, student.id, this._attModalClassDate);
            const isCompleted = courseCompleted || recType === 'completed' || (!!student.completed && !isStageAutoCompleted);
            const allCoursesCompleted = isCompleted && !this.hasOtherOngoingCourse(student.id, key, this._attModalClassDate);
            const completionClass = isCompleted ? (allCoursesCompleted ? 'active completed' : 'active course-completed') : '';
            const completionTitle = isCompleted ? (allCoursesCompleted ? '所有课程结课' : '本课程结课') : '结课';
            const auditionDisabled = student.isAudition ? 'disabled disabled-btn' : '';
            const completedDisabled = isCompleted ? 'disabled disabled-btn' : '';
            html += `
                <div class="lps-item">
                    <div class="lps-identity">
                        <span class="lps-name">${this.escapeHtml(student.name)}</span>
                        <span class="lps-grade">${this.escapeHtml(student.teacher || '')}</span>
                    </div>
                    <div class="lps-leave">
                        <button class="recurrence-btn ${recType === 'recurring' ? 'active recurring' : ''} ${auditionDisabled} ${completedDisabled}"
                                data-sid="${this.escapeHtml(student.id)}"
                                data-recurrence="recurring">循环</button>
                        <button class="recurrence-btn ${recType === 'stopped' ? 'active stopped' : ''} ${auditionDisabled} ${completedDisabled}"
                                data-sid="${this.escapeHtml(student.id)}"
                                data-recurrence="stopped">中止</button>
                        <button class="recurrence-btn ${recType === 'temporary' ? 'active temporary' : ''} ${completedDisabled}"
                                data-sid="${this.escapeHtml(student.id)}"
                                data-recurrence="temporary">临时</button>
                        <button class="recurrence-btn ${completionClass} ${auditionDisabled}" title="${completionTitle}"
                                data-sid="${this.escapeHtml(student.id)}"
                                data-action="complete">结课</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        container.querySelectorAll('.recurrence-btn[data-recurrence]').forEach(button => {
            button.addEventListener('click', () => this.setStudentRecurrenceUI(key, button.dataset.sid, button.dataset.recurrence, button));
        });
        container.querySelectorAll('.recurrence-btn[data-action="complete"]').forEach(button => {
            button.addEventListener('click', () => this.toggleStudentCompleted(button.dataset.sid, button));
        });
    }

TimetableApp.prototype.renderAttendanceRecords = function(students, key) {
        const container = document.getElementById('attendanceRecords');
        // Attendance state is resolved through CourseInstance-aware records first.
        const att = {};

        students.forEach(student => {
            att[student.id] = this.getAttendanceStatusForModal(key, student.id);
        });

        if (students.length === 0) {
            container.innerHTML = '<div class="text-muted">暂无学生</div>';
            return;
        }

        // Finished classes auto-fill unmarked students as present.
        if (this._attModalClassFinished) {
            let autoSaved = false;
            students.forEach(student => {
                if (!att[student.id]) {
                    this.setAttendanceStatus(key, student.id, 'present');
                    att[student.id] = 'present';
                    autoSaved = true;
                }
            });
            if (autoSaved) {
                this.renderAttendanceStudentList(students, key);
            }
        }

        // 课程未结束时不自动选择任何选项；课程已结束时默认出勤
        const defaultStatus = this._attModalClassFinished ? 'present' : '';

        let html = '';
        students.forEach(student => {
            const status = att[student.id] || defaultStatus;
            html += `
                <div class="att-row">
                    <span style="font-size: 13px;">${this.escapeHtml(student.name)}<small class="student-actual-duration">实上 ${this.escapeHtml(this.getStudentActualDurationDisplay(key, student.id))}</small></span>
                    <div class="att-status">
                        <button class="att-btn ${status === 'present' ? 'present' : ''}" data-student-id="${this.escapeHtml(student.id)}" data-status="present">出勤</button>
                        <button class="att-btn ${status === 'leave' ? 'leave' : ''}" data-student-id="${this.escapeHtml(student.id)}" data-status="leave">请假</button>
                        <button class="att-btn ${status === 'absent' ? 'absent' : ''}" data-student-id="${this.escapeHtml(student.id)}" data-status="absent">缺勤</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        container.querySelectorAll('.att-btn[data-status]').forEach(button => {
            button.addEventListener('click', () => this.setAttendance(key, button.dataset.studentId, button.dataset.status, button));
        });
    }

TimetableApp.prototype.setAttendance = function(key, studentId, status, btn) {
        if (!this.setAttendanceStatus(key, studentId, status)) return;
        
        const row = btn.closest('.att-row');
        row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('present', 'leave', 'absent'));
        btn.classList.add(status);
        
    }

TimetableApp.prototype.setAttendanceStatus = function(key, studentId, status) {
        const dateKey = this.getAttendanceDateKeyForCell(key);
        if (this.isHistoricalDateProtected(dateKey)) {
            this.showHistoryProtectionNotice();
            return false;
        }
        window.ScheduleErpService.upsertAttendance(this, key, studentId, status, dateKey);
        this.saveData();
        return true;
    }

TimetableApp.prototype.getAttendanceDateKeyForCell = function(key) {
        const [dayStr] = key.split('-');
        const dayNum = parseInt(dayStr);

        const weekRange = this.getWeekRange(this.currentDate);
        const startDate = weekRange.start;
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + (dayNum - 1));
        targetDate.setHours(0, 0, 0, 0);

        const formatLocalDate = d => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        return formatLocalDate(targetDate);
    }

TimetableApp.prototype.getStudentAttendance = function(studentId, startDate = null, endDate = null) {
        const result = {
            present: 0,
            leave: 0,
            absent: 0,
            records: {}
        };

        if (this.erpData && Array.isArray(this.erpData.attendanceRecords)) {
            this.erpData.attendanceRecords
                .filter(record => record.studentId === String(studentId))
                .forEach(record => {
                    const recordDate = new Date(record.dateKey);
                    if (startDate && recordDate < startDate) return;
                    if (endDate && recordDate > endDate) return;

                    if (!result.records[record.dateKey]) {
                        result.records[record.dateKey] = {
                            present: 0,
                            leave: 0,
                            absent: 0,
                            records: {}
                        };
                    }

                    if (record.status === 'leave') result.leave++;
                    else if (record.status === 'absent') result.absent++;
                    else result.present++;

                    result.records[record.dateKey][record.status]++;
                    result.records[record.dateKey].records[record.cellKey] = record.status;
                });
            return result;
        }
        return result;
    }

    // ========== 学生课程重复类型（循环/中止循环/临时）——基于版本操作 ==========

TimetableApp.prototype.getStudentRecurrenceType = function(cellKey, studentId) {
        const weekRange = this.getWeekRange(this.currentDate);
        const currentWeekStr = this.formatLocalDate(weekRange.start);
        const currentVersion = this.getCellVersion(cellKey, currentWeekStr);
        const isInCurrentVersion = currentVersion && Array.isArray(currentVersion.student) &&
            currentVersion.student.includes(String(studentId));
        if (isInCurrentVersion && window.ScheduleErpService.isStageFinalOccurrence(this, currentVersion, currentWeekStr)) {
            return 'completed';
        }

        if (this.erpData && Array.isArray(this.erpData.studentCourseRelations)) {
            const version = currentVersion;
            const relation = version ? this.erpData.studentCourseRelations.find(rel =>
                rel.courseInstanceId === version.courseInstanceId && rel.studentId === String(studentId)
            ) : null;
            if (relation) {
                if (relation.relationStatus === 'temporary') return 'temporary';
                if (relation.relationStatus === 'paused' || relation.relationStatus === 'ended') return 'stopped';
            }
        }

        // 通过版本传播判断：找到当前有效版本和下一个版本。
        // 如果下一个版本科目不同或不包含该学生，则中止循环。
        const curVersion = currentVersion;

        const inCurrent = curVersion && curVersion.student && curVersion.student.includes(studentId);
        if (!inCurrent) {
            return 'none';
        }

        const nextWeekDate = new Date(weekRange.start);
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        const nextWeekStr = this.formatLocalDate(this.getWeekRange(nextWeekDate).start);
        const nextVersion = this.getCellVersion(cellKey, nextWeekStr);
        if (!nextVersion) return 'stopped';

        const sameSubject = curVersion.subject === nextVersion.subject;
        const inNext = nextVersion.student && nextVersion.student.includes(studentId);

        if (!sameSubject || !inNext) return 'stopped';

        return 'recurring';
    }

TimetableApp.prototype.setStudentRecurrence = function(cellKey, studentId, type, classDate) {
        const protectedDate = classDate || this.getAttendanceDateKeyForCell(cellKey);
        if (this.isHistoricalDateProtected(protectedDate)) {
            this.showHistoryProtectionNotice();
            return false;
        }
        const weekRange = this.getWeekRange(classDate || this.currentDate);
        const currentWeekStr = this.formatLocalDate(weekRange.start);
        window.ScheduleErpService.setRecurrenceStatus(this, cellKey, studentId, type, currentWeekStr);
        this.saveData();
    }

TimetableApp.prototype.setStudentRecurrenceUI = function(cellKey, studentId, type, btn) {
        const student = this.students.find(s => s.id === studentId);
        if (student && student.isAudition && type !== 'temporary') {
            return;
        }
        const classDate = this._attModalClassDate || this.getAttendanceDateKeyForCell(cellKey);
        if (this.isHistoricalDateProtected(classDate)) {
            this.showHistoryProtectionNotice();
            return false;
        }
        if (student && student.completed && type !== 'temporary') {
            student.completed = false;
            student.accountStatus = 'normal';
        }
        this.setStudentRecurrence(cellKey, studentId, type, this._attModalClassDate);
        // 更新 _attModalRecurrence 缓存
        if (!this._attModalRecurrence) this._attModalRecurrence = {};
        this._attModalRecurrence[studentId] = type;
        const row = btn.closest('.lps-leave');
        if (row) {
            row.querySelectorAll('.recurrence-btn').forEach(b => {
                b.classList.remove('active', 'recurring', 'stopped', 'temporary', 'completed');
            });
        }
        btn.classList.add('active', type);
        this.renderTimetable();
        this.renderSubjects();  // 同步刷新学生池（取消结课时需要）
        if (this._attModalStudents && this._attModalKey) {
            this.renderAttendanceStudentList(this._attModalStudents, this._attModalKey);
        }
    }

TimetableApp.prototype.isStudentOngoing = function(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student && student.completed) return false;
        if (student && student.isAudition) return false;

        const instances = this.erpData && Array.isArray(this.erpData.courseInstances)
            ? this.erpData.courseInstances
            : [];

        const hasScheduledCourse = instances.some(instance => {
            if (!instance || !instance.cellKey || !instance.weekStart || instance.isDeleted) return false;
            const version = this.getCellVersion(instance.cellKey, instance.weekStart);
            return !!(version && Array.isArray(version.student) && version.student.includes(String(studentId)));
        });

        if (hasScheduledCourse) return true;

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const relations = this.erpData && Array.isArray(this.erpData.studentCourseRelations)
            ? this.erpData.studentCourseRelations
            : [];

        return relations.some(rel => {
            if (rel.studentId !== String(studentId)) return false;
            if (rel.relationStatus && rel.relationStatus !== 'recurring' && rel.relationStatus !== 'temporary') return false;
            const instance = instances.find(ci => ci.id === rel.courseInstanceId);
            return instance && instance.weekStart >= weekStartStr && !instance.isDeleted;
        });
    }

TimetableApp.prototype.isStudentCompleted = function(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student && student.completed) return true;
        const relations = this.erpData && Array.isArray(this.erpData.studentCourseRelations)
            ? this.erpData.studentCourseRelations
            : [];
        const hasHistory = relations.some(rel => rel.studentId === String(studentId));
        if (!hasHistory) return false;
        return !this.isStudentOngoing(studentId);
    }

TimetableApp.prototype.getCellLessonStart = function(cellKey, weekStartDate) {
        const parsed = this.parseCellKey(cellKey);
        if (!parsed) return null;

        const day = parsed.day;
        const period = this.getPeriod(parsed.periodIndex);
        if (!day || !period || !period.time) return null;

        const startTime = period.time.split('-')[0] || '00:00';
        const [hour, minute] = startTime.split(':').map(Number);
        const lessonStart = new Date(weekStartDate);
        lessonStart.setDate(weekStartDate.getDate() + day - 1);
        lessonStart.setHours(hour || 0, minute || 0, 0, 0);
        return lessonStart;
    }

TimetableApp.prototype.completeStudentAfterLesson = function(studentId, classDate, currentCellKey) {
        const weekRange = this.getWeekRange(classDate || this.currentDate);
        const currentWeekStr = this.formatLocalDate(weekRange.start);
        const nextWeekDate = new Date(weekRange.start);
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        const nextWeekStr = this.formatLocalDate(nextWeekDate);
        const clickedLessonStart = this.getCellLessonStart(currentCellKey, weekRange.start) || new Date(classDate || this.currentDate);

        const lessonStart = this.getCellLessonStart(currentCellKey, weekRange.start);
        const cutoffWeekStr = lessonStart && lessonStart > clickedLessonStart
            ? currentWeekStr
            : nextWeekStr;
        window.ScheduleErpService.completeStudentFromWeek(this, currentCellKey, studentId, cutoffWeekStr);
    }

TimetableApp.prototype.isStudentCourseCompleted = function(cellKey, studentId, classDate) {
        const erp = this.erpData || {};
        const weekStart = this.formatLocalDate(this.getWeekRange(classDate || this.currentDate).start);
        const version = this.getCellVersion(cellKey, weekStart);
        if (!version || !version.courseInstanceId) return false;
        return (erp.exceptionRules || []).some(rule =>
            rule && rule.type === 'complete-student' &&
            rule.courseInstanceId === version.courseInstanceId &&
            rule.cellKey === cellKey &&
            String(rule.studentId) === String(studentId)
        );
    }

TimetableApp.prototype.hasOtherOngoingCourse = function(studentId, excludedCellKey, classDate) {
        const erp = this.erpData || {};
        const instances = Array.isArray(erp.courseInstances) ? erp.courseInstances : [];
        const referenceWeek = this.formatLocalDate(this.getWeekRange(classDate || this.currentDate).start);
        const candidateWeeks = new Set([referenceWeek]);
        instances.forEach(instance => {
            if (instance && instance.weekStart >= referenceWeek) candidateWeeks.add(instance.weekStart);
        });
        const cellKeys = [...new Set(instances
            .filter(instance => instance && !instance.isDeleted && instance.cellKey && instance.cellKey !== excludedCellKey)
            .map(instance => instance.cellKey))];
        return cellKeys.some(cellKey => [...candidateWeeks].some(weekStart => {
            const version = this.getCellVersion(cellKey, weekStart);
            return !!(version && Array.isArray(version.student) && version.student.map(String).includes(String(studentId)));
        }));
    }

TimetableApp.prototype.toggleStudentCompleted = function(studentId, btn) {
        const student = this.students.find(s => s.id === studentId);
        if (!student || student.isAudition) return; // 试听学生不能结课

        const cellKey = this._attModalCellKey;
        const classDate = this._attModalClassDate || (cellKey
            ? this.getAttendanceDateKeyForCell(cellKey)
            : this.currentDate);
        if (this.isHistoricalDateProtected(classDate)) {
            this.showHistoryProtectionNotice();
            return false;
        }

        const courseCompleted = cellKey && this.isStudentCourseCompleted(cellKey, studentId, classDate);

        if (!courseCompleted) {
            if (cellKey) {
                this.completeStudentAfterLesson(studentId, this._attModalClassDate, cellKey);
                if (!this._attModalRecurrence) this._attModalRecurrence = {};
                this._attModalRecurrence[studentId] = 'stopped';
            }
        } else {
            this.setStudentRecurrence(cellKey, studentId, 'recurring', this._attModalClassDate);
            if (this._attModalRecurrence && cellKey) {
                this._attModalRecurrence[studentId] = 'recurring';
            }
        }

        window.ScheduleErpService.buildTimetableProjection(this);
        const allCoursesCompleted = !this.hasOtherOngoingCourse(studentId, courseCompleted ? null : cellKey, classDate);
        student.completed = !courseCompleted && allCoursesCompleted;
        student.accountStatus = student.completed ? 'completed' : 'normal';
        if (student.completed) student.manualCompletionDate = this.formatLocalDate(new Date(classDate));
        else delete student.manualCompletionDate;

        if (this.erpData && Array.isArray(this.erpData.studentCourseRelations)) {
            this.erpData.studentCourseRelations.forEach(rel => {
                if (rel.studentId === String(studentId)) {
                    rel.accountStatus = student.accountStatus;
                    rel.updatedAt = new Date().toISOString();
                }
            });
        }

        this.saveData();
        this.renderTimetable();
        this.renderSubjects();  // 同步刷新学生池
        // 刷新点名弹窗列表
        if (this._attModalStudents && this._attModalKey) {
            this.renderAttendanceStudentList(this._attModalStudents, this._attModalKey);
        }
        return true;
    }
