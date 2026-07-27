// app-stats.js - Statistics views
// Auto-split from script.js

TimetableApp.prototype.closeStatsModal = function () {
    document.getElementById('statsModal').style.display = 'none';
    this.closeStatsDatePicker();
}

TimetableApp.prototype.openTextStatsModal = function (date) {
    this._textStatsTab = this._textStatsTab || 'day';
    this._textStatsAnchorDate = new Date(date || new Date());
    this._textStatsAnchorDate.setHours(0, 0, 0, 0);
    const summaryHead = document.querySelector('.text-stats-summary-head');
    const headerTools = document.querySelector('.text-stats-header-tools');
    if (summaryHead && headerTools && headerTools.parentElement !== summaryHead) {
        summaryHead.appendChild(headerTools);
    }
    document.getElementById('textStatsModal').style.display = 'block';
    this.switchTextStatsTab(this._textStatsTab, { preserveDate: true });
}

TimetableApp.prototype.closeTextStatsModal = function () {
    document.getElementById('textStatsModal').style.display = 'none';
    this._expandedTextStatsLessonKey = null;
}

TimetableApp.prototype.switchTextStatsTab = function (tab, options) {
    const opts = options || {};
    if (!opts.preserveDate) this._expandedTextStatsLessonKey = null;
    this._textStatsTab = tab;

    document.querySelectorAll('#textStatsTabs .stats-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Keep the originally selected date when switching between day/week/month/year tabs.
    // Only fall back to today if we truly do not have an anchor yet.
    if (!this._textStatsAnchorDate) {
        this._textStatsAnchorDate = new Date();
        this._textStatsAnchorDate.setHours(0, 0, 0, 0);
    }

    this.renderTextStatsModal();
}

TimetableApp.prototype.changeTextStatsRange = function (delta) {
    this._expandedTextStatsLessonKey = null;
    if (!this._textStatsAnchorDate) {
        this._textStatsAnchorDate = new Date();
        this._textStatsAnchorDate.setHours(0, 0, 0, 0);
    }

    const nextDate = new Date(this._textStatsAnchorDate);
    switch (this._textStatsTab) {
        case 'day':
            nextDate.setDate(nextDate.getDate() + delta);
            break;
        case 'week':
            nextDate.setDate(nextDate.getDate() + (delta * 7));
            break;
        case 'month':
            nextDate.setMonth(nextDate.getMonth() + delta, 1);
            break;
        case 'year':
            nextDate.setFullYear(nextDate.getFullYear() + delta, 0, 1);
            break;
    }

    nextDate.setHours(0, 0, 0, 0);
    this._textStatsAnchorDate = nextDate;
    this.renderTextStatsModal();
}

TimetableApp.prototype.setTextStatsDate = function (value) {
    const nextDate = this.parseStatsInputDate(value);
    if (!nextDate || Number.isNaN(nextDate.getTime())) return;
    nextDate.setHours(0, 0, 0, 0);
    this._expandedTextStatsLessonKey = null;
    this._textStatsAnchorDate = nextDate;
    this.renderTextStatsModal();
}

TimetableApp.prototype.formatStatsInputDate = function (date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

TimetableApp.prototype.parseStatsInputDate = function (value) {
    return value ? new Date(value + 'T00:00:00') : null;
}

TimetableApp.prototype.formatStatsRangeLabel = function (startDate, endDate) {
    const format = d => `${d.getFullYear()}年${d.getMonth() + 1}月${String(d.getDate()).padStart(2, '0')}日`;
    return `${format(startDate)}-${format(endDate)}`;
}

TimetableApp.prototype.setStatsDateRange = function (startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const rangeStart = start <= end ? start : end;
    const rangeEnd = start <= end ? end : start;

    document.getElementById('statsStartDate').value = this.formatStatsInputDate(rangeStart);
    document.getElementById('statsEndDate').value = this.formatStatsInputDate(rangeEnd);
    const label = document.getElementById('statsDateRangeText');
    if (label) label.textContent = this.formatStatsRangeLabel(rangeStart, rangeEnd);
}

TimetableApp.prototype.toggleStatsDatePicker = function () {
    const popover = document.getElementById('statsDatePopover');
    if (!popover) return;
    if (popover.style.display === 'none' || !popover.style.display) {
        const start = this.parseStatsInputDate(document.getElementById('statsStartDate').value) || new Date();
        this._statsCalendarMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        this._pendingStatsStartDate = null;
        popover.style.display = 'block';
        this.renderStatsDatePicker();
        setTimeout(() => this.bindStatsDatePickerOutsideClick(), 0);
    } else {
        this.closeStatsDatePicker();
    }
}

TimetableApp.prototype.closeStatsDatePicker = function () {
    const popover = document.getElementById('statsDatePopover');
    if (popover) popover.style.display = 'none';
    this._pendingStatsStartDate = null;
    if (this._statsDatePickerOutsideHandler) {
        document.removeEventListener('mousedown', this._statsDatePickerOutsideHandler);
        this._statsDatePickerOutsideHandler = null;
    }
}

TimetableApp.prototype.bindStatsDatePickerOutsideClick = function () {
    if (this._statsDatePickerOutsideHandler) {
        document.removeEventListener('mousedown', this._statsDatePickerOutsideHandler);
    }
    this._statsDatePickerOutsideHandler = (event) => {
        const picker = document.getElementById('statsCustomRange');
        const popover = document.getElementById('statsDatePopover');
        if (!popover || popover.style.display === 'none') return;
        if (picker && picker.contains(event.target)) return;
        this.closeStatsDatePicker();
    };
    document.addEventListener('mousedown', this._statsDatePickerOutsideHandler);
}

TimetableApp.prototype.changeStatsCalendarMonth = function (delta) {
    const base = this._statsCalendarMonth || new Date();
    this._statsCalendarMonth = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    this.renderStatsDatePicker();
}

TimetableApp.prototype.renderStatsDatePicker = function () {
    const title = document.getElementById('statsCalendarTitle');
    const grid = document.getElementById('statsCalendarGrid');
    if (!title || !grid) return;

    const month = this._statsCalendarMonth || new Date();
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const startDate = this._pendingStatsStartDate || this.parseStatsInputDate(document.getElementById('statsStartDate').value);
    const endDate = this._pendingStatsStartDate ? this._pendingStatsStartDate : this.parseStatsInputDate(document.getElementById('statsEndDate').value);

    title.textContent = `${month.getFullYear()}年${month.getMonth() + 1}月`;
    grid.innerHTML = '';

    for (let i = 0; i < 42; i++) {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + i);
        day.setHours(0, 0, 0, 0);
        const dayKey = this.formatStatsInputDate(day);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'stats-calendar-day';
        btn.textContent = String(day.getDate());
        btn.dataset.date = dayKey;
        if (day.getMonth() !== month.getMonth()) btn.classList.add('other-month');
        if (startDate && endDate && day >= startDate && day <= endDate) btn.classList.add('in-range');
        if ((startDate && day.getTime() === startDate.getTime()) || (endDate && day.getTime() === endDate.getTime())) {
            btn.classList.add('range-edge');
        }
        btn.addEventListener('click', () => this.selectStatsCalendarDate(dayKey));
        grid.appendChild(btn);
    }
}

TimetableApp.prototype.selectStatsCalendarDate = function (dateValue) {
    const picked = this.parseStatsInputDate(dateValue);
    if (!picked) return;

    if (!this._pendingStatsStartDate) {
        this._pendingStatsStartDate = picked;
        const label = document.getElementById('statsDateRangeText');
        if (label) label.textContent = `${picked.getFullYear()}年${picked.getMonth() + 1}月${String(picked.getDate()).padStart(2, '0')}日-请选择结束日期`;
        this.renderStatsDatePicker();
        return;
    }

    this.setStatsDateRange(this._pendingStatsStartDate, picked);
    this._statsDate = new Date(picked);
    this._statsDate.setHours(0, 0, 0, 0);
    this.closeStatsDatePicker();
    this.onStatsDateChange();
}

TimetableApp.prototype.switchStatsTab = function (tab) {
    this.closeStatsDatePicker();
    const previousTab = this._statsTab;
    const isRepeatedWeekClick = previousTab === 'week' && tab === 'week';
    this._statsTab = tab;

    if (tab === 'week') {
        this._statsWeekMode = isRepeatedWeekClick && this._statsWeekMode === 'monthWeeks'
            ? 'naturalWeeks'
            : 'monthWeeks';
    } else {
        this._statsWeekMode = 'monthWeeks';
    }

    document.querySelectorAll('.stats-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    this.updateStatsWeekModeBadge();

    // Always show the date range picker for all tabs
    document.getElementById('statsCustomRange').style.display = 'flex';

    const now = new Date();
    // Set default date range based on tab
    switch (tab) {
        case 'day':
            // Default: current month
            this.setStatsDateRange(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0));
            this.renderDayStats();
            break;
        case 'week':
            if (previousTab !== 'week') {
                this.setStatsDateRange(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0));
            }
            this.renderWeekStats();
            break;
        case 'month':
            // Default: current year (Jan 1 - Dec 31)
            this.setStatsDateRange(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31));
            this.renderMonthStats();
            break;
        case 'year':
            // Default: current year (Jan 1 - Dec 31)
            this.setStatsDateRange(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31));
            this.renderYearStats();
            break;
    }
}

TimetableApp.prototype.updateStatsWeekModeBadge = function () {
    var badge = document.getElementById('statsWeekModeBadge');
    if (!badge) return;
    badge.hidden = !(this._statsTab === 'week' && this._statsWeekMode === 'naturalWeeks');
};

TimetableApp.prototype.formatStatsChartAxisDate = function (date) {
    return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
};

TimetableApp.prototype.onStatsDateChange = function () {
    // Unified handler for date input changes — routes to the active tab's renderer
    switch (this._statsTab) {
        case 'day': this.renderDayStats(); break;
        case 'week': this.renderWeekStats(); break;
        case 'month': this.renderMonthStats(); break;
        case 'year': this.renderYearStats(); break;
    }
}

TimetableApp.prototype.getTextStatsRange = function () {
    const anchor = new Date(this._textStatsAnchorDate || new Date());
    anchor.setHours(0, 0, 0, 0);

    switch (this._textStatsTab) {
        case 'day':
            return { start: new Date(anchor), end: new Date(anchor) };
        case 'week': {
            const week = this.getWeekRange(anchor);
            const start = new Date(week.start);
            const end = new Date(week.end);
            end.setDate(end.getDate() - 1);
            end.setHours(0, 0, 0, 0);
            return { start, end };
        }
        case 'month':
            return {
                start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
                end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
            };
        case 'year':
            return {
                start: new Date(anchor.getFullYear(), 0, 1),
                end: new Date(anchor.getFullYear(), 11, 31)
            };
        default:
            return { start: new Date(anchor), end: new Date(anchor) };
    }
}

TimetableApp.prototype.getTextStatsRangeLabel = function (range) {
    const start = range.start;
    const end = range.end;
    const formatMD = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

    switch (this._textStatsTab) {
        case 'day':
            return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`;
        case 'week':
            return `${formatMD(start)}（周一）— ${formatMD(end)}（周日）`;
        case 'month':
            return `${start.getFullYear()}年${start.getMonth() + 1}月`;
        case 'year':
            return `${start.getFullYear()}年`;
        default:
            return `${formatMD(start)} - ${formatMD(end)}`;
    }
}

TimetableApp.prototype.getTextStatsTitle = function () {
    return '课时统计';
}

TimetableApp.prototype.updateTextStatsNavButtons = function () {
    const labelMap = {
        day: ['上一日', '下一日'],
        week: ['上一周', '下一周'],
        month: ['上一月', '下一月'],
        year: ['上一年', '下一年']
    };
    const [prevLabel, nextLabel] = labelMap[this._textStatsTab] || ['上一项', '下一项'];
    const prevBtn = document.getElementById('textStatsPrevBtn');
    const nextBtn = document.getElementById('textStatsNextBtn');
    if (prevBtn) {
        prevBtn.setAttribute('aria-label', prevLabel);
        prevBtn.title = prevLabel;
        prevBtn.innerHTML = '<span class="text-stats-nav-icon" aria-hidden="true">‹</span>';
    }
    if (nextBtn) {
        nextBtn.setAttribute('aria-label', nextLabel);
        nextBtn.title = nextLabel;
        nextBtn.innerHTML = '<span class="text-stats-nav-icon" aria-hidden="true">›</span>';
    }
}

TimetableApp.prototype.renderTextStatsModal = function () {
    const range = this.getTextStatsRange();
    const lessons = this.aggregateLessons(range.start, range.end);
    const isDayView = this._textStatsTab === 'day';

    const title = document.getElementById('textStatsTitle');
    const dateInput = document.getElementById('textStatsDateInput');
    const subtitle = document.getElementById('textStatsSubtitle');
    const summaryNote = document.getElementById('textStatsSummaryNote');
    const detailCount = document.getElementById('textStatsDetailCount');
    if (title) title.textContent = this.getTextStatsTitle(range);
    if (dateInput) dateInput.value = this.formatStatsInputDate(new Date(this._textStatsAnchorDate || range.start));
    if (subtitle) subtitle.textContent = isDayView ? '查看当天已完成课程的课时与到课情况。' : '按当前范围汇总课程、课时、试听和到课情况。';
    this.updateTextStatsNavButtons();

    const summary = this.renderStatsCards(lessons, {
        targetId: 'textStatsCards',
        showClassDays: !isDayView,
        compact: true,
        legacy: true,
        emptyText: '当前范围内暂无有效课时'
    });
    if (summaryNote) {
        summaryNote.textContent = summary.empty
            ? '当前范围暂无可统计课程。'
            : `${summary.lessonCount} 门课程 · ${summary.totalHours}h · 到课 ${summary.totalPresentStudents}/${summary.totalScheduledStudents}`;
    }
    if (detailCount) {
        detailCount.textContent = `${summary.empty ? 0 : summary.lessonCount} 条`;
    }
    this.renderStatsByGrade(lessons, {
        targetId: 'textStatsByGrade',
        showDates: true,
        emptyText: '当前范围内暂无课程明细'
    });
}

TimetableApp.prototype.invalidateStatsCache = function () {
    this._statsDataRevision = (this._statsDataRevision || 0) + 1;
    this._statsDailyLessonCache = new Map();
    this._statsDailySalaryCache = new Map();
    this._statsAggregateCache = new Map();
    this._statsChartSeriesCache = new Map();
    this._statsLookupIndex = null;
    this._linkedChartSeriesData = null;
};

TimetableApp.prototype.getStatsDateCacheKey = function (date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

TimetableApp.prototype.getStatsLookupIndex = function () {
    var revision = this._statsDataRevision || 0;
    if (this._statsLookupIndex && this._statsLookupIndex.revision === revision) return this._statsLookupIndex;
    var students = new Map();
    (this.students || []).forEach(function (student) { students.set(String(student.id), student); });
    var courseInstances = new Map();
    var attendanceByInstance = new Map();
    var attendanceByCell = new Map();
    var erp = this.erpData || {};
    (erp.courseInstances || []).forEach(function (instance) { courseInstances.set(String(instance.id), instance); });
    (erp.attendanceRecords || []).forEach(function (record) {
        var prefix = String(record.studentId) + '|';
        var suffix = '|' + String(record.dateKey || '');
        if (record.courseInstanceId !== undefined && record.courseInstanceId !== null) {
            attendanceByInstance.set(prefix + String(record.courseInstanceId) + suffix, record.status);
        }
        if (record.cellKey) attendanceByCell.set(prefix + String(record.cellKey) + suffix, record.status);
    });
    this._statsLookupIndex = {
        revision: revision,
        students: students,
        courseInstances: courseInstances,
        attendanceByInstance: attendanceByInstance,
        attendanceByCell: attendanceByCell
    };
    return this._statsLookupIndex;
};

TimetableApp.prototype.collectLessonsForDate = function (date) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const cacheKey = this.getStatsDateCacheKey(normalizedDate);
    if (!this._statsDailyLessonCache) this._statsDailyLessonCache = new Map();
    const now = new Date();
    const isToday = cacheKey === this.getStatsDateCacheKey(now);
    const minuteStamp = isToday
        ? `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`
        : 'stable';
    const cached = this._statsDailyLessonCache.get(cacheKey);
    if (cached && cached.revision === (this._statsDataRevision || 0) && cached.minuteStamp === minuteStamp) {
        return cached.lessons;
    }

    date = normalizedDate;
    const dayIndex = date.getDay();
    const dayNum = dayIndex === 0 ? 7 : dayIndex;
    const formatLocalDate = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const dateKey = formatLocalDate(date);

    const cells = document.querySelectorAll(`[data-day="${dayNum}"]`);
    const lessons = [];

    cells.forEach(cell => {
        const period = cell.dataset.period;
        const key = this.buildCellKey(dayNum, period);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(date).start);
        const cellData = this.getCellVersion(key, weekStartStr);

        const lesson = this.buildLessonStats(cellData, { key, period, date, dateKey });
        if (lesson) {
            lessons.push({
                ...lesson,
                dates: [dateKey]
            });
        }
    });

    this._statsDailyLessonCache.set(cacheKey, {
        revision: this._statsDataRevision || 0,
        minuteStamp: minuteStamp,
        lessons: lessons
    });
    return lessons;
}

TimetableApp.prototype.buildLessonStats = function (cellData, { key, period, date, dateKey }) {
    if (!cellData) return null;

    // 统计课时只统计当前时间之前已上完的课程，后续未上的课程不统计
    if (!this.isClassFinished(key, date)) return null;

    const studentIds = cellData.student && Array.isArray(cellData.student) ? cellData.student : [];
    if (studentIds.length === 0) return null;

    // 课程已结束（过去的日期），即使没有考勤记录也纳入统计
    // 没有记录的学生默认视为"出勤"

    const lookup = this.getStatsLookupIndex();
    const subject = cellData.subject ? this.subjects.find(s => s.id == cellData.subject) : null;
    const periodInfo = this.getPeriod(period);

    let studentCount = 0, leaveCount = 0, absentCount = 0;
    let presentNonAuditionCount = 0, auditionStudentCount = 0;
    const students = studentIds.map(id => {
        const student = lookup.students.get(String(id));
        if (!student) return null;
        const status = this.getAttendanceStatusForStats(
            { key, courseInstanceId: cellData.courseInstanceId },
            id,
            dateKey
        );
        if (status === 'leave') leaveCount++;
        else if (status === 'absent') absentCount++;
        else studentCount++;
        if (student.isAudition && (!status || (status !== 'leave' && status !== 'absent'))) {
            auditionStudentCount++;
        } else if (!status || status !== 'leave' && status !== 'absent') {
            presentNonAuditionCount++;
        }
        return { ...student, status };
    }).filter(Boolean);
    const weekStartStr = this.formatLocalDate(this.getWeekRange(date).start);
    const isStageFinalLesson = window.ScheduleErpService.isStageFinalOccurrence(this, cellData, weekStartStr);
    const completedStudentCount = students.filter(student => {
        const isStageAutoCompleted = window.ScheduleErpService.isStudentStageAutoCompleted(this, student.id);
        if (isStageAutoCompleted) return isStageFinalLesson;
        if (!student.completed) return false;
        return !student.manualCompletionDate || student.manualCompletionDate <= dateKey;
    }).length;
    const courseInstance = lookup.courseInstances.get(String(cellData.courseInstanceId)) || null;
    const scheduledMinutes = periodInfo && periodInfo.time
        ? Math.max(0, this.timeToMinutes(periodInfo.time.split('-')[1]) - this.timeToMinutes(periodInfo.time.split('-')[0]))
        : 0;
    const lessonActualMinutes = courseInstance && courseInstance.actualMinutesByDate && courseInstance.actualMinutesByDate[dateKey] !== undefined
        ? courseInstance.actualMinutesByDate[dateKey]
        : scheduledMinutes;
    const studentMinutes = courseInstance && courseInstance.studentActualMinutesByDate
        ? courseInstance.studentActualMinutesByDate[dateKey]
        : null;
    students.forEach(student => {
        student.actualMinutes = student.status === 'leave' || student.status === 'absent'
            ? 0
            : (studentMinutes && studentMinutes[String(student.id)] !== undefined
                ? studentMinutes[String(student.id)]
                : lessonActualMinutes);
    });

    return {
        subject: subject ? subject.name : '未分类',
        color: subject ? subject.color : '#888',
        time: courseInstance && courseInstance.actualStartTime && courseInstance.actualEndTime
            ? `${courseInstance.actualStartTime}-${courseInstance.actualEndTime}`
            : (periodInfo ? periodInfo.time : ''),
        isNonStandardTime: !!(courseInstance && courseInstance.isNonStandardTime),
        studentCount,
        leaveCount,
        absentCount,
        presentNonAuditionCount,
        auditionStudentCount,
        completedStudentCount,
        period,
        key,
        courseInstanceId: cellData.courseInstanceId || null,
        studentIds,
        students
    };
}

TimetableApp.prototype.getLessonActualMinutesForStats = function (lesson) {
    if (this.erpData && Array.isArray(this.erpData.courseInstances)) {
        const instance = this.getStatsLookupIndex().courseInstances.get(String(lesson.courseInstanceId));
        if (instance && instance.actualMinutesByDate) {
            const dates = lesson.dates || [];
            for (const dateKey of dates) {
                if (instance.actualMinutesByDate[dateKey] !== undefined) {
                    return instance.actualMinutesByDate[dateKey];
                }
            }
        }
    }
    return undefined;
}

TimetableApp.prototype.getLessonDurationMinutesForStats = function (lesson) {
    const actualMinutes = this.getLessonActualMinutesForStats(lesson);
    if (actualMinutes !== undefined) {
        return Math.max(0, actualMinutes);
    }
    if (lesson.time) {
        const parts = lesson.time.split('-');
        if (parts.length === 2) {
            return Math.max(0, this.timeToMinutes(parts[1]) - this.timeToMinutes(parts[0]));
        }
    }
    return 0;
}

// 模式二按每名学生的实际上课时间累计学生课时。
TimetableApp.prototype.getLessonStudentMinutesForUnitStats = function (lesson) {
    const fallbackMinutes = this.getLessonDurationMinutesForStats(lesson);
    const students = Array.isArray(lesson.students) ? lesson.students : [];
    if (students.length > 0) {
        return students.reduce(function (total, student) {
            if (!student || student.status === 'leave' || student.status === 'absent') return total;
            const minutes = student.actualMinutes !== undefined
                ? Number(student.actualMinutes)
                : fallbackMinutes;
            return total + Math.max(0, Number.isFinite(minutes) ? minutes : 0);
        }, 0);
    }
    return fallbackMinutes * Math.max(0, Number(lesson.studentCount) || 0);
}

TimetableApp.prototype.getLessonSegmentTypeStats = function (lesson) {
    const presentStudents = (lesson.students || []).filter(student =>
        student && !student.isAudition && student.status !== 'leave' && student.status !== 'absent'
    ).map(student => ({
        student,
        minutes: Math.max(0, Number(student.actualMinutes !== undefined
            ? student.actualMinutes
            : this.getLessonDurationMinutesForStats(lesson)) || 0)
    }));
    const boundaries = [...new Set(presentStudents.map(item => item.minutes).filter(minutes => minutes > 0))].sort((a, b) => a - b);
    const typeStats = {};
    let previous = 0;
    boundaries.forEach(boundary => {
        const active = presentStudents.filter(item => item.minutes > previous);
        const segmentMinutes = boundary - previous;
        if (active.length > 0 && segmentMinutes > 0) {
            const type = active.length === 1
                ? (active[0].student.is1v1 ? '1v1' : '1v1(0.8)')
                : `1v${active.length}`;
            typeStats[type] = (typeStats[type] || 0) + segmentMinutes;
        }
        previous = boundary;
    });
    return {
        typeStats,
        totalMinutes: boundaries.length ? boundaries[boundaries.length - 1] : 0
    };
}

TimetableApp.prototype.getLessonTypeKeyForStats = function (lesson) {
    const presentNonAuditionCount = lesson.presentNonAuditionCount || 0;
    if (presentNonAuditionCount <= 0) return '';

    if (presentNonAuditionCount === 1) {
        const presentStudent = lesson.students ? lesson.students.find(student =>
            student && !student.isAudition && (!student.status || (student.status !== 'leave' && student.status !== 'absent'))
        ) : null;
        return presentStudent && presentStudent.is1v1 ? '1v1' : '1v1(0.8)';
    }

    return `1v${presentNonAuditionCount}`;
}

TimetableApp.prototype.getAttendanceStatusForStats = function (lesson, studentId, dateKey) {
    if (this.erpData && Array.isArray(this.erpData.attendanceRecords)) {
        const dates = dateKey ? [dateKey] : (lesson.dates || []);
        const lookup = this.getStatsLookupIndex();
        for (const day of dates) {
            const prefix = String(studentId) + '|';
            const suffix = '|' + String(day || '');
            const byInstance = lookup.attendanceByInstance.get(prefix + String(lesson.courseInstanceId) + suffix);
            if (byInstance) return byInstance;
            const byCell = lookup.attendanceByCell.get(prefix + String(lesson.key) + suffix);
            if (byCell) return byCell;
        }
    }
    return null;
}

TimetableApp.prototype.aggregateLessons = function (startDate, endDate) {
    const aggregated = {};

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    if (!this._statsAggregateCache) this._statsAggregateCache = new Map();
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const includesToday = current <= today && end >= today;
    const liveStamp = includesToday ? `${now.getHours()}:${now.getMinutes()}` : 'stable';
    const aggregateCacheKey = `${this.getStatsDateCacheKey(current)}|${this.getStatsDateCacheKey(end)}|${liveStamp}`;
    const cachedAggregate = this._statsAggregateCache.get(aggregateCacheKey);
    if (cachedAggregate && cachedAggregate.revision === (this._statsDataRevision || 0)) {
        return cachedAggregate.lessons;
    }

    const formatLocalDate = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    while (current <= end) {
        const dateStr = formatLocalDate(current);
        const lessons = this.collectLessonsForDate(current);
        lessons.forEach(lesson => {
            const typeKey = this.getLessonTypeKeyForStats(lesson);
            const aggKey = `${lesson.key}::${typeKey || 'untyped'}`;
            if (!aggregated[aggKey]) {
                aggregated[aggKey] = {
                    subject: lesson.subject,
                    color: lesson.color,
                    time: lesson.time,
                    isNonStandardTime: !!lesson.isNonStandardTime,
                    studentCount: 0,
                    leaveCount: 0,
                    absentCount: 0,
                    presentNonAuditionCount: 0,
                    auditionStudentCount: 0,
                    completedStudentCount: 0,
                    perSessionStudents: lesson.studentCount + lesson.leaveCount + lesson.absentCount,
                    statsTypeKey: typeKey,
                    period: lesson.period,
                    key: lesson.key,
                    courseInstanceId: lesson.courseInstanceId || null,
                    studentIds: [...lesson.studentIds],
                    students: [...(lesson.students || [])],
                    typeStats: {},
                    sessionTypeCounts: {},
                    actualDurationMinutes: 0,
                    lessonCount: 0,
                    dates: []
                };
            }
            aggregated[aggKey].studentCount += lesson.studentCount;
            aggregated[aggKey].leaveCount += lesson.leaveCount;
            aggregated[aggKey].absentCount += lesson.absentCount;
            aggregated[aggKey].presentNonAuditionCount += lesson.presentNonAuditionCount || 0;
            aggregated[aggKey].auditionStudentCount += lesson.auditionStudentCount || 0;
            aggregated[aggKey].completedStudentCount += lesson.completedStudentCount || 0;
            aggregated[aggKey].isNonStandardTime = aggregated[aggKey].isNonStandardTime || !!lesson.isNonStandardTime;
            if (lesson.students) {
                lesson.students.forEach(s => {
                    if (!aggregated[aggKey].students.find(existing => existing.id === s.id)) {
                        aggregated[aggKey].students.push(s);
                    }
                });
            }
            const segmented = this.getLessonSegmentTypeStats(lesson);
            const attendingStudents = (lesson.students || []).filter(student =>
                student && student.status !== 'leave' && student.status !== 'absent'
            );
            const studentActualDurations = attendingStudents
                .map(student => Number(student.actualMinutes))
                .filter(Number.isFinite)
                .map(minutes => Math.max(0, minutes));
            const sessionActualMinutes = studentActualDurations.length > 0
                ? Math.max(...studentActualDurations)
                : (attendingStudents.length === 0 && (lesson.leaveCount > 0 || lesson.absentCount > 0)
                    ? 0
                    : this.getLessonDurationMinutesForStats(lesson));
            aggregated[aggKey].actualDurationMinutes += Math.max(0, Number(sessionActualMinutes) || 0);
            Object.entries(segmented.typeStats).forEach(([segmentType, minutes]) => {
                aggregated[aggKey].sessionTypeCounts[segmentType] = (aggregated[aggKey].sessionTypeCounts[segmentType] || 0) + 1;
                aggregated[aggKey].typeStats[segmentType] = (aggregated[aggKey].typeStats[segmentType] || 0) + minutes;
            });
            aggregated[aggKey].lessonCount++;
            aggregated[aggKey].dates.push(dateStr);
        });
        current.setDate(current.getDate() + 1);
    }

    const result = Object.values(aggregated);
    this._statsAggregateCache.set(aggregateCacheKey, {
        revision: this._statsDataRevision || 0,
        lessons: result
    });
    return result;
}

TimetableApp.prototype.showDayStats = function (date) {
    this._textStatsTab = 'day';
    this.openTextStatsModal(date);
}

TimetableApp.prototype.getAttendanceSuffix = function (lesson) {
    const total = lesson.studentCount + (lesson.leaveCount || 0) + (lesson.absentCount || 0);
    if (total === 0) return '';

    const leave = lesson.leaveCount || 0;
    const absent = lesson.absentCount || 0;

    // 全部出勤 → 只显示绿色色块
    if (leave === 0 && absent === 0) {
        return ` <span class="att-dot dot-green" title="全部出勤"></span>`;
    }

    // 否则显示黄色(请假)和/或红色(缺勤)色块，不显示绿色
    let html = '';
    if (leave > 0) {
        html += ` <span class="att-dot dot-yellow" title="请假${leave}人"></span>`;
    }
    if (absent > 0) {
        html += ` <span class="att-dot dot-red" title="缺勤${absent}人"></span>`;
    }
    return html;
}

TimetableApp.prototype.getInlineAuditionBadge = function () {
    return '<span style="display:inline-flex;align-items:center;justify-content:center;margin-left:4px;padding:0 4px;min-width:16px;height:16px;border-radius:8px;background:#1890ff;color:#fff;font-size:10px;font-weight:700;line-height:1;">试</span>';
}

TimetableApp.prototype.getStatsStudentLabel = function (lesson) {
    const lessonCount = lesson.lessonCount || 1;
    let studentLabel = '';
    const typeOrder = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];

    if (lesson.sessionTypeCounts && Object.keys(lesson.sessionTypeCounts).length > 0) {
        studentLabel = typeOrder
            .filter(type => lesson.sessionTypeCounts[type] > 0)
            .map(type => lesson.sessionTypeCounts[type] > 1 ? `${type}×${lesson.sessionTypeCounts[type]}` : type)
            .join(' + ');
    } else {
        const typeKey = this.getLessonTypeKeyForStats(lesson);
        if (typeKey) {
            studentLabel = typeKey;
            if (lessonCount > 1) {
                studentLabel += ` 脳${lessonCount}`;
            }
        }
    }

    return studentLabel ? `(${studentLabel})` : '';
}

TimetableApp.prototype.getStatsRowNameHtml = function (lesson, expanded = false) {
    const studentLabel = this.getStatsStudentLabel(lesson);
    const auditionBadge = (lesson.auditionStudentCount || 0) > 0 ? this.getInlineAuditionBadge() : '';
    const suffix = this.getAttendanceSuffix(lesson);

    return `
            <span class="grade-expand-icon" style="display:inline-block;width:16px;text-align:center;margin-right:4px;font-size:10px;transition:transform 0.2s;">${expanded ? '▼' : '▶'}</span>
            <span class="stats-subject-dot${lesson.isNonStandardTime ? ' is-non-standard' : ''}" style="background:${lesson.isNonStandardTime ? '#ef4444' : lesson.color}" title="${lesson.isNonStandardTime ? '非标准上课时间' : ''}"></span>
            ${this.escapeHtml(lesson.subject)} ${studentLabel}${auditionBadge}${suffix}
        `;
}

TimetableApp.prototype.syncLessonAttendanceSummary = function (lesson) {
    let studentCount = 0;
    let leaveCount = 0;
    let absentCount = 0;
    let presentNonAuditionCount = 0;
    let auditionStudentCount = 0;
    (lesson.students || []).forEach(student => {
        if (!student) return;
        const status = this.getAttendanceStatusForStats(lesson, student.id);
        student.status = status;
        if (status === 'leave') leaveCount++;
        else if (status === 'absent') absentCount++;
        else studentCount++;

        if (student.isAudition && (!status || (status !== 'leave' && status !== 'absent'))) {
            auditionStudentCount++;
        } else if (!status || (status !== 'leave' && status !== 'absent')) {
            presentNonAuditionCount++;
        }
    });

    lesson.studentCount = studentCount;
    lesson.leaveCount = leaveCount;
    lesson.absentCount = absentCount;
    lesson.presentNonAuditionCount = presentNonAuditionCount;
    lesson.auditionStudentCount = auditionStudentCount;
}

TimetableApp.prototype.renderStatsByGrade = function (lessons, options) {
    const config = typeof options === 'boolean'
        ? { showDates: options }
        : (options || {});
    const showDates = config.showDates !== false;
    const container = document.getElementById(config.targetId || 'statsByGrade');
    if (!container) return;

    if (lessons.length === 0) {
        container.innerHTML = `<div class="text-muted">${config.emptyText || '暂无课时明细'}</div>`;
        return;
    }

    container.innerHTML = '';
    lessons.forEach((lesson, index) => {
        const lessonCount = lesson.lessonCount || 1;
        const scheduledDuration = this.getLessonDuration(lesson.time);
        const actualMin = this.getLessonActualMinutesForStats(lesson);
        const totalActualMin = Number.isFinite(Number(lesson.actualDurationMinutes))
            ? Math.max(0, Number(lesson.actualDurationMinutes))
            : (actualMin !== undefined ? actualMin * lessonCount : null);
        const totalScheduled = parseFloat(scheduledDuration) * 60 * lessonCount;
        const durationDisplay = totalActualMin !== null
            ? this.formatDuration(Math.floor(totalActualMin / 60), totalActualMin % 60)
            : (totalScheduled >= 60 ? `${(totalScheduled / 60).toFixed(1).replace('.0', '')}h` : `${totalScheduled}min`);
        const perActualMinutes = totalActualMin !== null
            ? Math.round(totalActualMin / lessonCount)
            : null;
        const perDisplay = perActualMinutes !== null
            ? this.formatDuration(Math.floor(perActualMinutes / 60), perActualMinutes % 60)
            : `${scheduledDuration}h`;
        const durationTitle = totalActualMin !== null
            ? `实上${perDisplay}/次 × ${lessonCount}次 = ${durationDisplay}（原定${scheduledDuration}h/次）`
            : `按${scheduledDuration}h/次 × ${lessonCount}次 = ${durationDisplay}`;

        let datesDisplay = '';
        let dateTitle = '';
        if (showDates) {
            const dates = lesson.dates || [];
            datesDisplay = dates.length > 0
                ? dates.map(d => {
                    const dateObj = new Date(d);
                    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                }).join(', ')
                : '';
            dateTitle = dates.length > 0 ? `上课日期：${dates.join(', ')}` : '';
        }

        const row = document.createElement('div');
        row.className = 'grade-row';
        row.style.cursor = 'pointer';
        row.title = '点击展开/收起出勤记录';
        let expanded = this._expandedTextStatsLessonKey === lesson.key;
        row.dataset.expanded = expanded ? 'true' : 'false';
        row.innerHTML = `
                <div class="gr-name">
                    ${this.getStatsRowNameHtml(lesson, expanded)}
                </div>
                <div class="gr-hours" title="${durationTitle}${dateTitle ? ' · ' + dateTitle : ''}">
                    ${lesson.time} · ${durationDisplay}
                    ${datesDisplay ? `<span class="gr-dates">${datesDisplay}</span>` : ''}
                </div>
            `;

        // 学生出勤详情面板（初始隐藏）
        const detailPanel = document.createElement('div');
        detailPanel.className = 'grade-detail';
        detailPanel.style.display = expanded ? 'block' : 'none';
        container.appendChild(row);
        container.appendChild(detailPanel);

        if (expanded) {
            this.renderLessonAttendanceDetail(detailPanel, lesson);
        }
        row.addEventListener('click', () => {
            expanded = !expanded;
            row.dataset.expanded = expanded ? 'true' : 'false';
            this._expandedTextStatsLessonKey = expanded ? lesson.key : null;
            const icon = row.querySelector('.grade-expand-icon');
            if (expanded) {
                icon.textContent = '▼';
                icon.style.transform = 'rotate(0deg)';
                this.renderLessonAttendanceDetail(detailPanel, lesson);
                detailPanel.style.display = 'block';
            } else {
                icon.textContent = '▶';
                icon.style.transform = 'rotate(0deg)';
                detailPanel.style.display = 'none';
            }
        });
    });
}

TimetableApp.prototype.renderLessonAttendanceDetail = function (panel, lesson) {
    const key = lesson.key;
    const studentIds = lesson.studentIds || [];
    if (studentIds.length === 0) {
        panel.innerHTML = '<div style="color:#999;font-size:13px;padding:6px 0;">该节课暂无学生</div>';
        return;
    }

    // 统计各状态人数
    let presentCount = 0, leaveCount = 0, absentCount = 0;
    studentIds.forEach(id => {
        const status = this.getAttendanceStatusForStats(lesson, id);
        if (status === 'leave') leaveCount++;
        else if (status === 'absent') absentCount++;
        else presentCount++;
    });

    let html = '<div style="font-size:12px;color:#888;margin-bottom:6px;">';
    html += `共${studentIds.length}人 · `;
    html += `<span style="color:#4caf50;">出勤${presentCount}</span> `;
    if (leaveCount > 0) html += `<span style="color:#ff9800;">请假${leaveCount}</span> `;
    if (absentCount > 0) html += `<span style="color:#f44336;">缺勤${absentCount}</span>`;
    html += '</div>';

    // 检查该课程是否已结束；未结束的课程不默认选中任何考勤状态
    const lessonDates = lesson.dates || [];
    const primaryDate = lessonDates.length > 0 ? new Date(lessonDates[0] + 'T00:00:00') : new Date();
    const classFinished = this.isClassFinished(key, primaryDate);
    const defaultAttStatus = classFinished ? 'present' : '';

    studentIds.forEach(id => {
        const student = this.students.find(s => s.id == id);
        const name = student ? student.name : '未知';
        const auditionBadge = student && student.isAudition ? this.getInlineAuditionBadge() : '';
        const oneV1Badge = student && student.is1v1 ? this.getInlineOneV1Badge() : '';
        const status = this.getAttendanceStatusForStats(lesson, id) || defaultAttStatus;
        const detailStudent = (lesson.students || []).find(item => item && String(item.id) === String(id));
        const detailMinutes = status === 'leave' || status === 'absent'
            ? 0
            : (detailStudent && detailStudent.actualMinutes !== undefined
                ? detailStudent.actualMinutes
                : this.getLessonDurationMinutesForStats(lesson));
        const detailDuration = Number(detailMinutes) === 0
            ? '0h'
            : this.formatDuration(Math.floor(detailMinutes / 60), detailMinutes % 60);
        const durationBadge = `<small class="student-actual-duration">实上 ${detailDuration}</small>`;
        html += `
                <div class="att-inline-row" style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
                    <span style="display:inline-flex;align-items:center;">${this.escapeHtml(name)}${oneV1Badge}${auditionBadge}${durationBadge}</span>
                    <div class="att-inline-btns" style="display:flex;gap:4px;">
                        <button class="att-inline-btn ${status === 'present' ? 'active' : ''}"
                            data-key="${key}" data-sid="${id}" data-status="present"
                            style="padding:2px 8px;border:1px solid #ddd;border-radius:3px;font-size:11px;cursor:pointer;
                            ${status === 'present' ? 'background:#4caf50;color:#fff;border-color:#4caf50;' : 'background:#fff;color:#666;'}">
                            出勤
                        </button>
                        <button class="att-inline-btn ${status === 'leave' ? 'active' : ''}"
                            data-key="${key}" data-sid="${id}" data-status="leave"
                            style="padding:2px 8px;border:1px solid #ddd;border-radius:3px;font-size:11px;cursor:pointer;
                            ${status === 'leave' ? 'background:#ff9800;color:#fff;border-color:#ff9800;' : 'background:#fff;color:#666;'}">
                            请假
                        </button>
                        <button class="att-inline-btn ${status === 'absent' ? 'active' : ''}"
                            data-key="${key}" data-sid="${id}" data-status="absent"
                            style="padding:2px 8px;border:1px solid #ddd;border-radius:3px;font-size:11px;cursor:pointer;
                            ${status === 'absent' ? 'background:#f44336;color:#fff;border-color:#f44336;' : 'background:#fff;color:#666;'}">
                            缺勤
                        </button>
                    </div>
                </div>
            `;
    });

    panel.innerHTML = html;

    // 绑定出勤按钮事件
    panel.querySelectorAll('.att-inline-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const btnKey = btn.dataset.key;
            const sid = btn.dataset.sid;
            const newStatus = btn.dataset.status;

            this.setAttendanceStatus(btnKey, sid, newStatus);
            this.syncLessonAttendanceSummary(lesson);
            this._expandedTextStatsLessonKey = lesson.key;

            // 刷新当前行标题、1vN 文案和色块
            const row = panel.previousElementSibling;
            if (row && row.classList.contains('grade-row')) {
                const grName = row.querySelector('.gr-name');
                if (grName) {
                    const expanded = row.dataset.expanded === 'true';
                    grName.innerHTML = this.getStatsRowNameHtml(lesson, expanded);
                }
            }

            // 刷新详情面板和统计卡片
            this.renderLessonAttendanceDetail(panel, lesson);
            this.refreshStatsAfterAttendanceChange();
        });
    });
}

TimetableApp.prototype.refreshStatsAfterAttendanceChange = function () {
    const textStatsModal = document.getElementById('textStatsModal');
    if (textStatsModal && textStatsModal.style.display === 'block') {
        this.renderTextStatsModal();
        return;
    }

    if (!this.currentStatsDate) return;

    const formatLocalDate = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // 重新统计当前日期的课程数据
    const dayIndex = this.currentStatsDate.getDay();
    const dayNum = dayIndex === 0 ? 7 : dayIndex;
    const date = this.currentStatsDate;
    const dateKey = formatLocalDate(date);

    const cells = document.querySelectorAll(`[data-day="${dayNum}"]`);
    const lessons = [];

    cells.forEach(cell => {
        const period = cell.dataset.period;
        const key = this.buildCellKey(dayNum, period);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(date).start);
        const cellData = this.getCellVersion(key, weekStartStr);

        const lesson = this.buildLessonStats(cellData, { key, period, date, dateKey });
        if (lesson) {
            lessons.push(lesson);
        }
    });

    this.renderStatsCards(lessons, { showClassDays: false });
}

TimetableApp.prototype.getInlineOneV1Badge = function () {
    return '<span style="display:inline-flex;align-items:center;justify-content:center;margin-left:4px;padding:0 4px;min-width:16px;height:16px;border-radius:8px;background:linear-gradient(135deg,#4caf50 0%,#66bb6a 100%);color:#fff;font-size:10px;font-weight:700;line-height:1;">1v1</span>';
}

// ========== 图形统计系统 ==========

// Keep bar-chart tooltips on one horizontal rail.  The default Chart.js
// position follows the hovered stack segment, which makes the box jump up and
// down while the pointer moves across a stacked bar.
if (typeof Chart !== 'undefined' && Chart.Tooltip && Chart.Tooltip.positioners) {
    Chart.Tooltip.positioners.statsTopRail = function (items) {
        if (!items || !items.length) return false;
        return {
            x: items[0].element.x,
            y: this.chart.chartArea.top + 6
        };
    };

    // Data refreshes and continuous window-resize events share one restrained
    // motion policy, so every statistics chart behaves consistently.
    Chart.defaults.animation.duration = 420;
    Chart.defaults.animation.easing = 'easeOutQuart';
    Chart.defaults.resizeDelay = 140;
    Chart.defaults.plugins.tooltip.position = 'statsTopRail';
    Chart.defaults.plugins.tooltip.yAlign = 'top';
    Chart.defaults.plugins.tooltip.animation = {
        duration: 140,
        easing: 'easeOutCubic'
    };
    if (Chart.defaults.transitions && Chart.defaults.transitions.resize) {
        Chart.defaults.transitions.resize.animation = {
            duration: 260,
            easing: 'easeOutQuart'
        };
    }
}

TimetableApp.prototype.destroyCharts = function () {
    if (this._chartInstances) {
        Object.keys(this._chartInstances).forEach(function (key) {
            if (this._chartInstances[key]) {
                this._chartInstances[key].destroy();
                this._chartInstances[key] = null;
            }
        }, this);
    } else if (this._chartInstance) {
        this._chartInstance.destroy();
    }
    this._chartInstance = null;
    this._chartInstances = {};
    this._activeChartSliceIndex = null;
};

TimetableApp.prototype.setChartLegendNote = function (text) {
    var targetId = this._chartNoteTarget || 'chartLegendNote';
    var target = document.getElementById(targetId);
    if (target) target.textContent = text;
};

TimetableApp.prototype.getChartLegendOptions = function (textColor, extraOptions) {
    var baseOptions = {
        position: 'bottom',
        labels: {
            color: textColor,
            boxWidth: 14,
            boxHeight: 6,
            padding: 8,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            pointStyleWidth: 14,
            font: {
                size: 10,
                weight: '500'
            }
        }
    };

    if (!extraOptions) {
        return baseOptions;
    }

    return Object.assign({}, baseOptions, extraOptions, {
        labels: Object.assign({}, baseOptions.labels, extraOptions.labels || {})
    });
};

TimetableApp.prototype.animateStatsCards = function (container, isEmpty) {
    if (!container) return;
    var nextState = isEmpty ? 'empty' : 'ready';
    var previousState = container.dataset.statsDataState;
    container.dataset.statsDataState = nextState;
    // Hover-linked card updates remain still; only the meaningful transition
    // between no data and available data gets the entrance motion.
    if (previousState && previousState === nextState) return;
    container.classList.remove('stats-cards-entering');
    // Force the previous animation state to be committed so repeated range
    // changes also get a transition.
    void container.offsetWidth;
    container.classList.add('stats-cards-entering');
    window.setTimeout(function () {
        container.classList.remove('stats-cards-entering');
    }, 520);
};

TimetableApp.prototype.getLinePointSizes = function (labelCount) {
    if (labelCount > 90) return { radius: 0, hoverRadius: 2.5 };
    if (labelCount > 60) return { radius: 0.6, hoverRadius: 2.5 };
    if (labelCount > 35) return { radius: 1, hoverRadius: 3 };
    if (labelCount > 20) return { radius: 1.4, hoverRadius: 3.5 };
    return { radius: 2, hoverRadius: 4 };
};

TimetableApp.prototype.getChartSliceData = function (data, index) {
    if (index === null || index === undefined || index < 0 || index >= data.labels.length) {
        return data;
    }

    var typeMinutes = data.typeMinutesByGroup[index] || {};
    return {
        labels: [data.labels[index]],
        presentData: [data.presentData[index] || 0],
        presentNonAuditionData: [data.presentNonAuditionData[index] || 0],
        leaveData: [data.leaveData[index] || 0],
        absentData: [data.absentData[index] || 0],
        totalStudentsData: [data.totalStudentsData[index] || 0],
        auditionData: [data.auditionData[index] || 0],
        totalMinutesData: [data.totalMinutesData[index] || 0],
        typeMinutes: Object.assign({}, typeMinutes),
        typeMinutesByGroup: [typeMinutes],
        groupStartDates: data.groupStartDates ? [data.groupStartDates[index]] : [],
        groupEndDates: data.groupEndDates ? [data.groupEndDates[index]] : [],
        granularity: data.granularity,
        rangeDayCount: data.rangeDayCount,
        selectedLabel: data.labels[index]
    };
};

TimetableApp.prototype.switchChartCategory = function (category) {
    var isRepeatedDurationClick = category === 'duration' && this._currentChartCategory === 'duration';
    this._durationUnitMode = isRepeatedDurationClick ? !this._durationUnitMode : false;
    this._currentChartCategory = category;
    document.querySelectorAll('.chart-category-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.category === category);
        btn.classList.toggle('lesson-unit-active', btn.dataset.category === 'duration' && !!this._durationUnitMode);
    }, this);
    if (this._statsBaseCardLessons && this._statsBaseCardStart && this._statsBaseCardEnd) {
        this.renderStatsCards(this._statsBaseCardLessons, {
            startDate: this._statsBaseCardStart,
            endDate: this._statsBaseCardEnd
        });
    }
    if (this._lastChartLessons && this._lastChartStart && this._lastChartEnd) {
        this.renderCharts(this._lastChartLessons, this._lastChartStart, this._lastChartEnd);
    }
};

TimetableApp.prototype.switchChartType = function (type) {
    if (this._lastChartLessons && this._lastChartStart && this._lastChartEnd) {
        this.renderCharts(this._lastChartLessons, this._lastChartStart, this._lastChartEnd);
    }
};

TimetableApp.prototype.collectChartSeriesData = function (startDate, endDate, forcedGranularity) {
    var formatLocalDate = function (d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    };

    var msPerDay = 24 * 60 * 60 * 1000;
    var dayCount = Math.round((endDate - startDate) / msPerDay) + 1;

    var granularity;
    if (forcedGranularity) {
        granularity = forcedGranularity;
    } else if (this._chartGranularity) {
        granularity = this._chartGranularity;
    } else if (dayCount <= 14) {
        granularity = 'day';
    } else if (dayCount <= 90) {
        granularity = 'week';
    } else {
        granularity = 'month';
    }

    var groups = {};
    var groupOrder = [];
    var self = this;
    var weekMode = this._statsWeekMode || 'monthWeeks';
    if (!this._statsChartSeriesCache) this._statsChartSeriesCache = new Map();
    var chartNow = new Date();
    var chartTodayKey = formatLocalDate(chartNow);
    var chartStartKey = formatLocalDate(startDate);
    var chartEndKey = formatLocalDate(endDate);
    var containsToday = chartStartKey <= chartTodayKey && chartEndKey >= chartTodayKey;
    var chartLiveStamp = containsToday ? chartNow.getHours() + ':' + chartNow.getMinutes() : 'stable';
    var chartCacheKey = [chartStartKey, chartEndKey, granularity, weekMode, this._durationUnitMode ? 'unit' : 'hours', chartLiveStamp].join('|');
    var cachedSeries = this._statsChartSeriesCache.get(chartCacheKey);
    if (cachedSeries && cachedSeries.revision === (this._statsDataRevision || 0)) return cachedSeries.data;

    var current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    var end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        var groupKey;
        if (granularity === 'day') {
            groupKey = formatLocalDate(current);
        } else if (granularity === 'week') {
            // Both modes use Monday-Sunday buckets. monthWeeks clips the
            // outer buckets; naturalWeeks expands the range to complete weeks.
            var dayOfWeek = current.getDay();
            var diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            var monday = new Date(current);
            monday.setDate(current.getDate() - diffToMonday);
            groupKey = formatLocalDate(monday);
        } else if (granularity === 'month') {
            groupKey = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0');
        } else {
            groupKey = String(current.getFullYear());
        }

        if (!groups[groupKey]) {
            groups[groupKey] = {
                present: 0, leave: 0, absent: 0,
                audition: 0, totalMinutes: 0,
                typeMinutes: {},
                startDate: new Date(current),
                endDate: new Date(current)
            };
            groupOrder.push(groupKey);
        } else {
            groups[groupKey].endDate = new Date(current);
        }

        var lessons = this.collectLessonsForDate(current);
        lessons.forEach(function (lesson) {
            groups[groupKey].present += lesson.studentCount || 0;
            groups[groupKey].leave += lesson.leaveCount || 0;
            groups[groupKey].absent += lesson.absentCount || 0;
            groups[groupKey].audition += lesson.auditionStudentCount || 0;

            var lessonCount = lesson.lessonCount || 1;
            var segmented = self.getLessonSegmentTypeStats(lesson);
            groups[groupKey].totalMinutes += (self._durationUnitMode
                ? self.getLessonStudentMinutesForUnitStats(lesson)
                : segmented.totalMinutes) * lessonCount;
            Object.keys(segmented.typeStats).forEach(function (typeKey) {
                groups[groupKey].typeMinutes[typeKey] = (groups[groupKey].typeMinutes[typeKey] || 0)
                    + segmented.typeStats[typeKey] * lessonCount;
            });
        });

        current.setDate(current.getDate() + 1);
    }

    // Build output arrays
    var labels = [];
    var presentData = [];
    var presentNonAuditionData = [];
    var leaveData = [];
    var absentData = [];
    var totalStudentsData = [];
    var auditionData = [];
    var totalMinutesData = [];
    var aggregatedTypeMinutes = {};
    var typeMinutesByGroup = [];
    var groupStartDates = [];
    var groupEndDates = [];

    var formatAxisDateLabel = function (d) {
        return self.formatStatsChartAxisDate(d);
    };

    groupOrder.forEach(function (key) {
        var g = groups[key];
        var label;
        if (granularity === 'week' && weekMode === 'monthWeeks') {
            var weekNames = ['第一周', '第二周', '第三周', '第四周', '第五周'];
            var weekIndex = groupOrder.indexOf(key);
            label = weekNames[weekIndex] || ('第' + (weekIndex + 1) + '周');
        } else if (granularity === 'week' && weekMode === 'naturalWeeks') {
            label = formatAxisDateLabel(g.startDate) + '-' + formatAxisDateLabel(g.endDate);
        } else if (granularity === 'month') {
            label = g.startDate.getFullYear() + '/' + (g.startDate.getMonth() + 1);
        } else if (granularity === 'year') {
            label = String(g.startDate.getFullYear());
        } else {
            label = formatAxisDateLabel(g.startDate);
        }

        labels.push(label);
        presentData.push(g.present);
        presentNonAuditionData.push(Math.max(0, g.present - g.audition));
        leaveData.push(g.leave);
        absentData.push(g.absent);
        totalStudentsData.push(g.present + g.leave + g.absent);
        auditionData.push(g.audition);
        totalMinutesData.push(g.totalMinutes);
        typeMinutesByGroup.push(g.typeMinutes);
        groupStartDates.push(new Date(g.startDate));
        groupEndDates.push(new Date(g.endDate));

        Object.keys(g.typeMinutes).forEach(function (tk) {
            if (!aggregatedTypeMinutes[tk]) aggregatedTypeMinutes[tk] = 0;
            aggregatedTypeMinutes[tk] += g.typeMinutes[tk];
        });
    });

    var result = {
        labels: labels,
        presentData: presentData,
        presentNonAuditionData: presentNonAuditionData,
        leaveData: leaveData,
        absentData: absentData,
        totalStudentsData: totalStudentsData,
        auditionData: auditionData,
        totalMinutesData: totalMinutesData,
        typeMinutes: aggregatedTypeMinutes,
        typeMinutesByGroup: typeMinutesByGroup,
        groupStartDates: groupStartDates,
        groupEndDates: groupEndDates,
        granularity: granularity,
        rangeDayCount: dayCount
    };
    this._statsChartSeriesCache.set(chartCacheKey, {
        revision: this._statsDataRevision || 0,
        data: result
    });
    return result;
};

// Final override: keep the percentage-enhanced duration pie chart as the last definition.
// ========== 人数统计 ==========

TimetableApp.prototype.renderStudentBarChart = function (ctx, data, onBarHover) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var gridColor = isDark ? '#2c2c2a' : '#e1e0d9';
    var self = this;
    var backgroundRgb = isDark ? [26, 26, 25] : [252, 252, 251];
    var colorWithOpaqueTint = function (hex, strength) {
        var value = String(hex || '').replace('#', '');
        if (value.length !== 6) return hex;
        var colorRgb = [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
        var mixed = colorRgb.map(function (channel, index) {
            return Math.round(backgroundRgb[index] + (channel - backgroundRgb[index]) * strength);
        });
        return 'rgb(' + mixed.join(',') + ')';
    };

    var totalStudents = data.totalStudentsData.reduce(function (a, b) { return a + b; }, 0);
    var totalPresent = data.presentData.reduce(function (a, b) { return a + b; }, 0);
    var totalAudition = data.auditionData.reduce(function (a, b) { return a + b; }, 0);
    var totalNonAudition = totalPresent - totalAudition;
    var totalLeave = data.leaveData.reduce(function (a, b) { return a + b; }, 0);
    var totalAbsent = data.absentData.reduce(function (a, b) { return a + b; }, 0);
    var studentStackedGradientPlugin = {
        id: 'studentStackedGradients',
        beforeDatasetsDraw: function (chart) {
            data.labels.forEach(function (_label, dataIndex) {
                var segments = [];
                chart.data.datasets.forEach(function (dataset, datasetIndex) {
                    if (!dataset.legendColor || !chart.isDatasetVisible(datasetIndex) || Number(dataset.data[dataIndex]) <= 0) return;
                    var bar = chart.getDatasetMeta(datasetIndex).data[dataIndex];
                    if (!bar || !Number.isFinite(bar.y) || !Number.isFinite(bar.base)) return;
                    segments.push({ dataset: dataset, bar: bar });
                });
                if (!segments.length) return;

                var columnTop = Math.min.apply(null, segments.map(function (segment) { return Math.min(segment.bar.y, segment.bar.base); }));
                var columnBottom = Math.max.apply(null, segments.map(function (segment) { return Math.max(segment.bar.y, segment.bar.base); }));
                var columnHeight = Math.max(1, columnBottom - columnTop);
                var gradient = chart.ctx.createLinearGradient(0, columnBottom, 0, columnTop);
                segments.forEach(function (segment, segmentIndex) {
                    var segmentBottom = Math.max(segment.bar.y, segment.bar.base);
                    var segmentTop = Math.min(segment.bar.y, segment.bar.base);
                    var bottomStop = Math.max(0, Math.min(1, (columnBottom - segmentBottom) / columnHeight));
                    var topStop = Math.max(0, Math.min(1, (columnBottom - segmentTop) / columnHeight));
                    var middleStop = bottomStop + (topStop - bottomStop) * .45;
                    var previousColor = segmentIndex > 0 ? segments[segmentIndex - 1].dataset.legendColor : segment.dataset.legendColor;
                    gradient.addColorStop(bottomStop, colorWithOpaqueTint(previousColor, .18 + bottomStop * .82));
                    gradient.addColorStop(middleStop, colorWithOpaqueTint(segment.dataset.legendColor, .18 + middleStop * .82));
                    gradient.addColorStop(topStop, colorWithOpaqueTint(segment.dataset.legendColor, .18 + topStop * .82));
                    segment.bar.options = Object.assign({}, segment.bar.options, {
                        backgroundColor: 'rgba(0,0,0,0)', borderWidth: 0, borderRadius: 0, $shared: false
                    });
                });

                var referenceBar = segments[0].bar;
                var left = referenceBar.x - referenceBar.width / 2;
                chart.ctx.save();
                chart.ctx.beginPath();
                if (typeof chart.ctx.roundRect === 'function') chart.ctx.roundRect(left, columnTop, referenceBar.width, columnHeight, [4, 4, 0, 0]);
                else chart.ctx.rect(left, columnTop, referenceBar.width, columnHeight);
                chart.ctx.fillStyle = gradient;
                chart.ctx.fill();
                chart.ctx.restore();
            });
        }
    };
    var stackedTotalLabelPlugin = {
        id: 'studentStackedTotalLabels',
        afterDatasetsDraw: function (chart) {
            if (!totalStudents || data.labels.length > 42) return;
            var drawCtx = chart.ctx;
            drawCtx.save();
            drawCtx.fillStyle = isDark ? '#e2e8f0' : '#344054';
            drawCtx.font = '700 10px sans-serif';
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'bottom';

            data.labels.forEach(function (_label, dataIndex) {
                var visibleTotal = 0;
                var topY = Infinity;
                var centerX = null;
                chart.data.datasets.forEach(function (dataset, datasetIndex) {
                    if (!chart.isDatasetVisible(datasetIndex)) return;
                    visibleTotal += Number(dataset.data[dataIndex] || 0);
                    var bar = chart.getDatasetMeta(datasetIndex).data[dataIndex];
                    if (bar) {
                        centerX = bar.x;
                        topY = Math.min(topY, bar.y);
                    }
                });
                if (centerX === null || !isFinite(topY) || visibleTotal <= 0) return;
                drawCtx.fillText(String(visibleTotal), centerX, Math.max(12, topY - 6));
            });
            drawCtx.restore();
        }
    };

    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: '出勤',
                    type: 'bar',
                    data: data.presentNonAuditionData,
                    backgroundColor: '#0ca30c',
                    borderColor: '#0ca30c',
                    legendColor: '#0ca30c',
                    borderWidth: 0,
                    borderRadius: 0,
                    borderSkipped: false,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: '试听',
                    type: 'bar',
                    data: data.auditionData,
                    backgroundColor: '#2a78d6',
                    borderColor: '#2a78d6',
                    legendColor: '#2a78d6',
                    borderWidth: 0,
                    borderRadius: 0,
                    borderSkipped: false,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: '请假',
                    type: 'bar',
                    data: data.leaveData,
                    backgroundColor: '#fab219',
                    borderColor: '#fab219',
                    legendColor: '#fab219',
                    borderWidth: 0,
                    borderRadius: 0,
                    borderSkipped: false,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: '缺勤',
                    type: 'bar',
                    data: data.absentData,
                    backgroundColor: '#d03b3b',
                    borderColor: '#d03b3b',
                    legendColor: '#d03b3b',
                    borderWidth: 0,
                    borderRadius: 0,
                    borderSkipped: false,
                    yAxisID: 'y',
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            onHover: function (event, elements, chart) {
                chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
                if (onBarHover) onBarHover(elements.length ? elements[0].index : null);
            },
            plugins: {
                legend: this.getChartLegendOptions(textColor, {
                    onClick: function (event, legendItem, legend) {
                        Chart.defaults.plugins.legend.onClick.call(this, event, legendItem, legend);
                        self.renderLinkedCharts('student', data, self._activeChartSliceIndex, { updateLine: true });
                    }
                }),
                tooltip: {
                    position: 'statsTopRail',
                    yAlign: 'top',
                    callbacks: {
                        label: function (ctx) {
                            return ctx.dataset.label + ': ' + ctx.parsed.y + '人';
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grace: '12%',
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 10 },
                        callback: function (v) { return v + '人'; }
                    }
                }
            }
        },
        plugins: [studentStackedGradientPlugin, stackedTotalLabelPlugin]
    });

    this.setChartLegendNote('');
    return chart;
};

TimetableApp.prototype.renderStudentPieChart = function (ctx, data) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var centerTextColor = isDark ? '#f8fafc' : '#0f172a';

    var totalPresent = data.presentData.reduce(function (a, b) { return a + b; }, 0);
    var totalAudition = data.auditionData.reduce(function (a, b) { return a + b; }, 0);
    var totalNonAudition = totalPresent - totalAudition;
    var totalLeave = data.leaveData.reduce(function (a, b) { return a + b; }, 0);
    var totalAbsent = data.absentData.reduce(function (a, b) { return a + b; }, 0);

    var labels = [];
    var values = [];
    var colors = [];

    if (totalNonAudition > 0) { labels.push('出勤'); values.push(totalNonAudition); colors.push('#0ca30c'); }
    if (totalAudition > 0) { labels.push('试听'); values.push(totalAudition); colors.push('#2a78d6'); }
    if (totalLeave > 0) { labels.push('请假'); values.push(totalLeave); colors.push('#fab219'); }
    if (totalAbsent > 0) { labels.push('缺勤'); values.push(totalAbsent); colors.push('#d03b3b'); }

    if (labels.length === 0) {
        labels = ['暂无数据'];
        values = [1];
        colors = ['#e1e0d9'];
    }

    var chartHasData = labels.length > 0 && labels[0] !== '暂无数据';
    var getVisibleTotalStudents = function (chart) {
        if (!chartHasData) return 0;
        return values.reduce(function (sum, value, index) {
            return chart.getDataVisibility(index) ? sum + value : sum;
        }, 0);
    };

    var doughnutLabelPlugin = {
        id: 'studentPieLabelPluginClean',
        afterDatasetsDraw: function (chart) {
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;

            var drawCtx = chart.ctx;
            var visibleTotalStudents = getVisibleTotalStudents(chart);
            drawCtx.save();

            if (chartHasData) {
                var centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                var centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                drawCtx.textAlign = 'center';
                drawCtx.textBaseline = 'middle';
                drawCtx.fillStyle = textColor;
                drawCtx.font = '600 11px sans-serif';
                drawCtx.fillText('总人数', centerX, centerY - 12);
                drawCtx.fillStyle = centerTextColor;
                drawCtx.font = '700 22px sans-serif';
                drawCtx.fillText(String(visibleTotalStudents), centerX, centerY + 10);
            }

            meta.data.forEach(function (arc, index) {
                if (!chartHasData) return;
                if (!chart.getDataVisibility(index)) return;
                var value = values[index] || 0;
                var pct = visibleTotalStudents > 0 ? (value / visibleTotalStudents * 100) : 0;
                if (pct < 8) return;

                var angle = (arc.startAngle + arc.endAngle) / 2;
                var radius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) * 0.58;
                var x = arc.x + Math.cos(angle) * radius;
                var y = arc.y + Math.sin(angle) * radius;

                drawCtx.fillStyle = '#ffffff';
                drawCtx.font = '700 12px sans-serif';
                drawCtx.shadowColor = 'rgba(15, 23, 42, 0.24)';
                drawCtx.shadowBlur = 6;
                drawCtx.fillText(Math.round(pct) + '%', x, y);
                drawCtx.shadowBlur = 0;
            });

            drawCtx.restore();
        }
    };

    var chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: isDark ? '#1a1a19' : '#fcfcfb',
                borderWidth: 2,
                hoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            radius: '76%',
            cutout: '56%',
            plugins: {
                legend: this.getChartLegendOptions(textColor, { display: false }),
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            if (labels[0] === '暂无数据') return '暂无数据';
                            var visibleTotalStudents = getVisibleTotalStudents(ctx.chart);
                            var pct = visibleTotalStudents > 0 ? (ctx.parsed / visibleTotalStudents * 100).toFixed(1) : '0';
                            return ctx.label + ': ' + ctx.parsed + '人 (' + pct + '%)';
                        }
                    }
                }
            }
        },
        plugins: [doughnutLabelPlugin]
    });

    var breakdown = document.getElementById('durationPieBreakdown');
    var statusOrder = ['出勤', '试听', '请假', '缺勤'];
    var statusColors = ['#0ca30c', '#2a78d6', '#fab219', '#d03b3b'];
    var statusValues = {
        '出勤': totalNonAudition,
        '试听': totalAudition,
        '请假': totalLeave,
        '缺勤': totalAbsent
    };
    var renderBreakdown = function () {
        if (!breakdown) return;
        var visibleTotal = getVisibleTotalStudents(chart);
        var rows = statusOrder.map(function (status, statusIndex) {
            var value = statusValues[status] || 0;
            var chartIndex = labels.indexOf(status);
            var isVisible = chartIndex >= 0 && chart.getDataVisibility(chartIndex);
            var percent = value > 0 && isVisible && visibleTotal > 0
                ? (value / visibleTotal * 100).toFixed(1) + '%'
                : '-';
            var stateClass = value <= 0 ? ' is-empty' : (isVisible ? '' : ' is-hidden');
            return '<button type="button" class="duration-breakdown-row' + stateClass + '" data-index="' + chartIndex + '"' + (chartIndex < 0 ? ' disabled' : '') + '>' +
                '<span class="duration-breakdown-type"><i style="background:' + statusColors[statusIndex] + '"></i>' + status + '</span>' +
                '<strong>' + (value > 0 ? value : '-') + '</strong><span>' + percent + '</span></button>';
        }).join('');
        breakdown.innerHTML = '<div class="duration-breakdown-head"><span>状态</span><span>人数（人次）</span><span>占比</span></div>' + rows;
        breakdown.querySelectorAll('.duration-breakdown-row').forEach(function (row) {
            row.onclick = function () {
                var itemIndex = Number(row.dataset.index);
                if (itemIndex < 0) return;
                chart.toggleDataVisibility(itemIndex);
                chart.update();
                renderBreakdown();
            };
        });
    };
    renderBreakdown();

    this.setChartLegendNote(chartHasData ? '' : '暂无人数数据');
    return chart;
};

TimetableApp.prototype.renderStudentLineChart = function (ctx, data, onPointHover) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var gridColor = isDark ? '#2c2c2a' : '#e1e0d9';

    var totalStudents = data.totalStudentsData.reduce(function (a, b) { return a + b; }, 0);
    var totalPresent = data.presentData.reduce(function (a, b) { return a + b; }, 0);
    var totalAudition = data.auditionData.reduce(function (a, b) { return a + b; }, 0);
    var totalNonAudition = totalPresent - totalAudition;
    var totalLeave = data.leaveData.reduce(function (a, b) { return a + b; }, 0);
    var pointSizes = this.getLinePointSizes(data.labels.length);

    var chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: '学生总数',
                    data: data.totalStudentsData,
                    borderColor: '#4a3aa7',
                    backgroundColor: 'rgba(74,58,167,0.06)',
                    borderWidth: 2,
                    pointRadius: pointSizes.radius,
                    pointHoverRadius: pointSizes.hoverRadius,
                    pointBackgroundColor: '#4a3aa7',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: '出勤',
                    data: data.presentNonAuditionData,
                    borderColor: '#0ca30c',
                    backgroundColor: 'rgba(12,163,12,0.06)',
                    borderWidth: 2,
                    pointRadius: pointSizes.radius,
                    pointHoverRadius: pointSizes.hoverRadius,
                    pointBackgroundColor: '#0ca30c',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: '试听',
                    data: data.auditionData,
                    borderColor: '#2a78d6',
                    backgroundColor: 'rgba(42,120,214,0.06)',
                    borderWidth: 2,
                    pointRadius: pointSizes.radius,
                    pointHoverRadius: pointSizes.hoverRadius,
                    pointBackgroundColor: '#2a78d6',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: '请假',
                    data: data.leaveData,
                    borderColor: '#fab219',
                    backgroundColor: 'rgba(250,178,25,0.06)',
                    borderWidth: 2,
                    pointRadius: pointSizes.radius,
                    pointHoverRadius: pointSizes.hoverRadius,
                    pointBackgroundColor: '#fab219',
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            onHover: function (event, elements, chart) {
                chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
                if (onPointHover) onPointHover(elements.length ? elements[0].index : null);
            },
            plugins: {
                legend: this.getChartLegendOptions(textColor),
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return ctx.dataset.label + ': ' + ctx.parsed.y + '人';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 10 },
                        callback: function (v) { return v + '人'; }
                    }
                }
            }
        }
    });

    this.setChartLegendNote('');
    return chart;
};

// ========== 课时统计 ==========

TimetableApp.prototype.renderDurationBarChart = function (ctx, data, onBarHover) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var gridColor = isDark ? '#2c2c2a' : '#e1e0d9';
    var self = this;

    if (this._durationUnitMode) {
        var unitData = data.totalMinutesData.map(function (minutes) { return minutes / 40; });
        var hasUnitData = unitData.some(function (value) { return value > 0; });
        var themeStyles = getComputedStyle(document.body);
        var primaryRgb = themeStyles.getPropertyValue('--primary-rgb').trim() || '22, 119, 255';
        var unitPanel = ctx.canvas && ctx.canvas.closest ? ctx.canvas.closest('.chart-panel') : null;
        var unitPanelBackground = unitPanel ? getComputedStyle(unitPanel).backgroundColor : '';
        var unitBackgroundMatch = String(unitPanelBackground).match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
        var unitBackgroundRgb = unitBackgroundMatch
            ? [Number(unitBackgroundMatch[1]), Number(unitBackgroundMatch[2]), Number(unitBackgroundMatch[3])]
            : (isDark ? [26, 26, 25] : [255, 255, 255]);
        var unitPrimaryParts = primaryRgb.split(',').map(function (value) { return Number(value.trim()) || 0; });
        var unitOpaqueTint = function (strength) {
            return 'rgb(' + unitPrimaryParts.map(function (channel, index) {
                return Math.round(unitBackgroundRgb[index] + (channel - unitBackgroundRgb[index]) * strength);
            }).join(',') + ')';
        };
        var unitBarGradient = function (context) {
            var chart = context.chart;
            var value = Number(context.raw);
            var yScale = chart.scales && chart.scales.y;
            if (!chart.chartArea || !yScale || !Number.isFinite(value) || value <= 0) {
                return unitOpaqueTint(.18);
            }

            // Each bar owns a full-height gradient: light at its base and the
            // current theme color at its top, regardless of the bar's value.
            var valueY = yScale.getPixelForValue(value);
            var baseY = yScale.getPixelForValue(0);
            var top = Math.min(valueY, baseY);
            var bottom = Math.max(valueY, baseY);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || top === bottom) {
                return unitOpaqueTint(.18);
            }
            var gradient = chart.ctx.createLinearGradient(0, bottom, 0, top);
            gradient.addColorStop(0, unitOpaqueTint(.18));
            gradient.addColorStop(.45, unitOpaqueTint(.55));
            gradient.addColorStop(1, unitOpaqueTint(1));
            return gradient;
        };
        var formatPd = function (value) {
            return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') + 'Pd.';
        };
        var unitTotalLabelPlugin = {
            id: 'lessonUnitTotalLabels',
            afterDatasetsDraw: function (chart) {
                // 与模式一一致：数据过密（超过 42 项）或数值为 0 时不绘制顶部数字。
                if (!hasUnitData || data.labels.length > 42) return;
                var drawCtx = chart.ctx;
                var meta = chart.getDatasetMeta(0);
                drawCtx.save();
                drawCtx.fillStyle = isDark ? '#e2e8f0' : '#344054';
                drawCtx.font = '700 10px sans-serif';
                drawCtx.textAlign = 'center';
                drawCtx.textBaseline = 'bottom';
                unitData.forEach(function (value, index) {
                    var bar = meta.data[index];
                    if (!bar || value <= 0) return;
                    drawCtx.fillText(Number(value).toFixed(1), bar.x, Math.max(12, bar.y - 6));
                });
                drawCtx.restore();
            }
        };
        var unitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: '总耗课',
                    data: unitData,
                    backgroundColor: unitBarGradient,
                    borderColor: 'rgb(' + primaryRgb + ')',
                    borderWidth: 0,
                    borderRadius: 5,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                onHover: function (_event, elements, chart) {
                    chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
                    if (onBarHover) onBarHover(elements.length ? elements[0].index : null);
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function (item) { return '总耗课: ' + formatPd(item.parsed.y); } } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: { color: textColor, callback: function (value) { return value + 'Pd.'; } }
                    }
                }
            },
            plugins: [unitTotalLabelPlugin]
        });
        var unitLegend = document.getElementById('barChartTitleLegend');
        if (unitLegend) unitLegend.innerHTML = '';
        this.setChartLegendNote(hasUnitData ? '' : '暂无课时数据');
        return unitChart;
    }

    var typeOrder = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var catColors = ['#1677ff', '#20b486', '#ff9418', '#7651c9', '#16b4c6'];
    var typeLabels = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var panelElement = ctx.canvas && ctx.canvas.closest ? ctx.canvas.closest('.chart-panel') : null;
    var panelBackground = panelElement ? getComputedStyle(panelElement).backgroundColor : '';
    var backgroundMatch = String(panelBackground).match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
    var backgroundRgb = backgroundMatch
        ? [Number(backgroundMatch[1]), Number(backgroundMatch[2]), Number(backgroundMatch[3])]
        : (isDark ? [26, 26, 25] : [255, 255, 255]);
    var colorWithOpaqueTint = function (hex, strength) {
        var value = String(hex || '').replace('#', '');
        if (value.length !== 6) return hex;
        var colorRgb = [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
        var mixed = colorRgb.map(function (channel, index) {
            return Math.round(backgroundRgb[index] + (channel - backgroundRgb[index]) * strength);
        });
        return 'rgb(' + mixed.join(',') + ')';
    };

    // Build datasets for each type that has data
    var datasets = [];
    var hasData = false;
    typeOrder.forEach(function (type, i) {
        var typeData = data.typeMinutesByGroup.map(function (g) {
            return g[type] ? (g[type] / 60) : 0; // Convert to hours
        });
        var typeTotal = typeData.reduce(function (a, b) { return a + b; }, 0);
        if (typeTotal > 0) {
            hasData = true;
            var currentColor = catColors[i];
            var previousColor = datasets.length > 0 ? datasets[datasets.length - 1].legendColor : currentColor;
            datasets.push({
                label: type,
                type: 'bar',
                data: typeData,
                backgroundColor: currentColor,
                borderColor: currentColor,
                legendColor: currentColor,
                gradientBottomColor: previousColor,
                borderWidth: 0,
                borderRadius: 0,
                borderSkipped: false,
                inflateAmount: 0,
                order: 2
            });
        }
    });

    if (!hasData) {
        datasets = [{
            label: '暂无数据',
            data: data.labels.map(function () { return 0; }),
            backgroundColor: '#e1e0d9',
            borderWidth: 0
        }];
    }

    var stackedGradientPlugin = {
        id: 'durationStackedGradients',
        beforeDatasetsDraw: function (chart) {
            data.labels.forEach(function (_label, dataIndex) {
                var segments = [];
                chart.data.datasets.forEach(function (dataset, datasetIndex) {
                    if (!dataset.legendColor || !chart.isDatasetVisible(datasetIndex) || Number(dataset.data[dataIndex]) <= 0) return;
                    var bar = chart.getDatasetMeta(datasetIndex).data[dataIndex];
                    if (!bar || !Number.isFinite(bar.y) || !Number.isFinite(bar.base)) return;
                    segments.push({ dataset: dataset, bar: bar });
                });
                if (!segments.length) return;

                var columnTop = Math.min.apply(null, segments.map(function (segment) { return Math.min(segment.bar.y, segment.bar.base); }));
                var columnBottom = Math.max.apply(null, segments.map(function (segment) { return Math.max(segment.bar.y, segment.bar.base); }));
                var columnHeight = Math.max(1, columnBottom - columnTop);
                var gradient = chart.ctx.createLinearGradient(0, columnBottom, 0, columnTop);
                segments.forEach(function (segment, segmentIndex) {
                    var segmentBottom = Math.max(segment.bar.y, segment.bar.base);
                    var segmentTop = Math.min(segment.bar.y, segment.bar.base);
                    var bottomStop = Math.max(0, Math.min(1, (columnBottom - segmentBottom) / columnHeight));
                    var topStop = Math.max(0, Math.min(1, (columnBottom - segmentTop) / columnHeight));
                    var middleStop = bottomStop + (topStop - bottomStop) * .45;
                    var bottomStrength = .18 + bottomStop * .82;
                    var middleStrength = .18 + middleStop * .82;
                    var topStrength = .18 + topStop * .82;
                    var previousColor = segmentIndex > 0 ? segments[segmentIndex - 1].dataset.legendColor : segment.dataset.legendColor;
                    gradient.addColorStop(bottomStop, colorWithOpaqueTint(previousColor, bottomStrength));
                    gradient.addColorStop(middleStop, colorWithOpaqueTint(segment.dataset.legendColor, middleStrength));
                    gradient.addColorStop(topStop, colorWithOpaqueTint(segment.dataset.legendColor, topStrength));
                    segment.bar.options = Object.assign({}, segment.bar.options, {
                        backgroundColor: 'rgba(0,0,0,0)',
                        borderWidth: 0,
                        borderRadius: 0,
                        $shared: false
                    });
                });

                var referenceBar = segments[0].bar;
                var left = referenceBar.x - referenceBar.width / 2;
                chart.ctx.save();
                chart.ctx.beginPath();
                if (typeof chart.ctx.roundRect === 'function') {
                    chart.ctx.roundRect(left, columnTop, referenceBar.width, columnHeight, [4, 4, 0, 0]);
                } else {
                    chart.ctx.rect(left, columnTop, referenceBar.width, columnHeight);
                }
                chart.ctx.fillStyle = gradient;
                chart.ctx.fill();
                chart.ctx.restore();
            });
        }
    };

    var totalHours = data.totalMinutesData.reduce(function (a, b) { return a + b; }, 0);
    var totalHoursDisplay = (totalHours / 60).toFixed(2);
    var stackedTotalLabelPlugin = {
        id: 'durationStackedTotalLabels',
        afterDatasetsDraw: function (chart) {
            if (!hasData || data.labels.length > 42) return;
            var drawCtx = chart.ctx;
            drawCtx.save();
            drawCtx.fillStyle = isDark ? '#e2e8f0' : '#344054';
            drawCtx.font = '700 10px sans-serif';
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'bottom';

            data.labels.forEach(function (_label, dataIndex) {
                var visibleTotal = 0;
                var topY = Infinity;
                var centerX = null;
                chart.data.datasets.forEach(function (dataset, datasetIndex) {
                    if (!chart.isDatasetVisible(datasetIndex) || dataset.label === '暂无数据') return;
                    visibleTotal += Number(dataset.data[dataIndex] || 0);
                    var bar = chart.getDatasetMeta(datasetIndex).data[dataIndex];
                    if (bar) {
                        centerX = bar.x;
                        topY = Math.min(topY, bar.y);
                    }
                });
                if (centerX === null || !isFinite(topY) || visibleTotal <= 0) return;
                drawCtx.fillText(visibleTotal.toFixed(1), centerX, Math.max(12, topY - 6));
            });
            drawCtx.restore();
        }
    };
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            onHover: function (event, elements, chart) {
                chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
                if (onBarHover) onBarHover(elements.length ? elements[0].index : null);
            },
            plugins: {
                legend: this.getChartLegendOptions(textColor, {
                    display: false
                }),
                tooltip: {
                    position: 'statsTopRail',
                    yAlign: 'top',
                    callbacks: {
                        label: function (ctx) {
                            if (ctx.dataset.label === '暂无数据') return '暂无数据';
                            return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + 'h';
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grace: '12%',
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 10 },
                        callback: function (v) { return v.toFixed(1) + 'h'; }
                    }
                }
            }
        },
        plugins: [stackedGradientPlugin, stackedTotalLabelPlugin]
    });

    var titleLegend = document.getElementById('barChartTitleLegend');
    if (titleLegend) {
        titleLegend.innerHTML = '';
        chart.data.datasets.forEach(function (dataset, datasetIndex) {
            if (dataset.label === '暂无数据') return;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'chart-title-legend-item';
            button.innerHTML = '<i style="background:' + (dataset.legendColor || dataset.backgroundColor) + '"></i><span>' + dataset.label + '</span>';
            button.onclick = function () {
                var visible = chart.isDatasetVisible(datasetIndex);
                chart.setDatasetVisibility(datasetIndex, !visible);
                button.classList.toggle('is-hidden', visible);
                chart.update();
                self.renderLinkedCharts('duration', data, self._activeChartSliceIndex, { updateLine: true });
            };
            titleLegend.appendChild(button);
        });
    }

    this.setChartLegendNote(hasData ? '' : '暂无课时数据');
    return chart;
};

TimetableApp.prototype.renderDurationLineChart = function (ctx, data, onPointHover) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var gridColor = isDark ? '#2c2c2a' : '#e1e0d9';

    if (this._durationUnitMode) {
        var unitData = data.totalMinutesData.map(function (minutes) { return minutes / 40; });
        var hasUnitData = unitData.some(function (value) { return value > 0; });
        var themeStyles = getComputedStyle(document.body);
        var primaryRgb = themeStyles.getPropertyValue('--primary-rgb').trim() || '22, 119, 255';
        var themeLineColor = 'rgb(' + primaryRgb + ')';
        var themeLineFill = 'rgba(' + primaryRgb + ', .12)';
        var unitChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: '总耗课',
                    data: unitData,
                    borderColor: themeLineColor,
                    backgroundColor: themeLineFill,
                    borderWidth: 2.5,
                    pointRadius: data.labels.length > 31 ? 0 : 2.5,
                    pointHoverRadius: 5,
                    pointBackgroundColor: themeLineColor,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                onHover: function (_event, elements, chart) {
                    chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
                    if (onPointHover) onPointHover(elements.length ? elements[0].index : null);
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function (item) { return '总耗课: ' + item.parsed.y.toFixed(2) + 'Pd.'; } } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: { color: textColor, callback: function (value) { return value + 'Pd.'; } }
                    }
                }
            }
        });
        var unitLegend = document.getElementById('lineChartTitleLegend');
        if (unitLegend) unitLegend.innerHTML = '';
        this.setChartLegendNote(hasUnitData ? '' : '暂无课时数据');
        return unitChart;
    }

    var typeOrder = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var catColors = ['#1677ff', '#20b486', '#ff9418', '#7651c9', '#16b4c6'];
    var pointSizes = this.getLinePointSizes(data.labels.length);

    // Build datasets for each type that has data
    var datasets = [];
    var hasData = false;
    typeOrder.forEach(function (type, i) {
        var typeData = data.typeMinutesByGroup.map(function (g) {
            return g[type] ? (g[type] / 60) : 0; // Convert to hours
        });
        var typeTotal = typeData.reduce(function (a, b) { return a + b; }, 0);
        if (typeTotal > 0) {
            hasData = true;
            datasets.push({
                label: type,
                data: typeData,
                borderColor: catColors[i],
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: Math.min(pointSizes.radius, 2),
                pointHoverRadius: pointSizes.hoverRadius,
                pointBackgroundColor: catColors[i],
                tension: 0.3,
                fill: false
            });
        }
    });

    if (!hasData) {
        datasets = [{
            label: '暂无数据',
            data: data.labels.map(function () { return 0; }),
            borderColor: '#e1e0d9',
            pointRadius: 0
        }];
    }

    var totalHours = (data.totalMinutesData.reduce(function (a, b) { return a + b; }, 0) / 60).toFixed(2);

    var chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            onHover: function (event, elements, chart) {
                chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
                if (onPointHover) onPointHover(elements.length ? elements[0].index : null);
            },
            plugins: {
                legend: this.getChartLegendOptions(textColor, { display: false }),
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            if (ctx.dataset.label === '暂无数据') return '暂无数据';
                            return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + 'h';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 10 },
                        callback: function (v) { return v.toFixed(1) + 'h'; }
                    }
                }
            }
        }
    });

    var titleLegend = document.getElementById('lineChartTitleLegend');
    if (titleLegend) {
        titleLegend.innerHTML = '';
        chart.data.datasets.forEach(function (dataset, datasetIndex) {
            if (dataset.label === '暂无数据') return;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'chart-title-legend-item line-legend-item';
            button.style.setProperty('--legend-color', dataset.borderColor);
            button.innerHTML = '<i></i><span>' + dataset.label + '</span>';
            button.onclick = function () {
                var visible = chart.isDatasetVisible(datasetIndex);
                chart.setDatasetVisibility(datasetIndex, !visible);
                button.classList.toggle('is-hidden', visible);
                chart.update();
            };
            titleLegend.appendChild(button);
        });
    }

    this.setChartLegendNote(hasData ? '' : '暂无课时数据');
    return chart;
};

TimetableApp.prototype.openStatsModal = function (date, showCharts) {
    if (showCharts === false) {
        this.openTextStatsModal(date);
        return;
    }

    // Statistics own their date anchor. The timetable's viewed week must not
    // change day/week/month/year summary cards.
    this._statsDate = new Date();
    this._statsDate.setHours(0, 0, 0, 0);
    this._statsShowCharts = true;
    this._currentChartCategory = 'duration';
    this._durationUnitMode = false;
    document.querySelectorAll('.chart-category-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.category === 'duration');
        btn.classList.remove('lesson-unit-active');
    });
    var now = new Date();
    this.setStatsDateRange(
        new Date(now.getFullYear(), now.getMonth(), 1),
        new Date(now.getFullYear(), now.getMonth() + 1, 0)
    );
    document.getElementById('statsCustomRange').style.display = 'flex';
    document.getElementById('statsModal').style.display = 'block';
    this.toggleStatsDetails(false);
    this.switchStatsTab('day');
};

TimetableApp.prototype.toggleStatsDetails = function (forceExpanded) {
    var section = document.getElementById('statsDetailSection');
    var body = document.getElementById('statsDetailBody');
    if (!section || !body) return;

    var expanded = typeof forceExpanded === 'boolean'
        ? forceExpanded
        : !section.classList.contains('expanded');
    section.classList.toggle('expanded', expanded);
    body.hidden = !expanded;
};

TimetableApp.prototype.formatStatsHeaderDate = function (date) {
    return (date.getMonth() + 1) + '/' + date.getDate();
};

TimetableApp.prototype.getStatsGranularityLabel = function (granularity) {
    var labelMap = {
        day: '按天',
        week: '按周',
        month: '按月',
        year: '按年'
    };
    return labelMap[granularity] || '按时间';
};

TimetableApp.prototype.updateStatsHeader = function (title, subtitle) {
    var titleEl = document.getElementById('statsTitle');
    var subtitleEl = document.getElementById('statsSubtitle');
    if (titleEl) titleEl.textContent = '课时统计总览';
    if (subtitleEl) subtitleEl.style.display = 'none';
};

TimetableApp.prototype.updateStatsOverview = function (summary, startDate, endDate) {
    var noteEl = document.getElementById('statsOverviewNote');
    var detailEl = document.getElementById('statsDetailSummary');

    if (this._durationUnitMode) {
        var unitRangeLabel = this.formatStatsHeaderDate(startDate) + ' - ' + this.formatStatsHeaderDate(endDate);
        if (noteEl) noteEl.textContent = summary && !summary.empty
            ? unitRangeLabel + ' · 总耗课 ' + summary.totalHours + 'Pd.（40分钟/Pd.）。'
            : unitRangeLabel + ' · 暂无可统计耗课。';
        if (detailEl) detailEl.textContent = '';
        return;
    }

    if (!summary || summary.empty) {
        if (noteEl) noteEl.textContent = '当前时间范围内还没有可统计的课程记录。';
        if (detailEl) detailEl.textContent = '暂无课程明细';
        return;
    }

    var rangeLabel = this.formatStatsHeaderDate(startDate) + ' - ' + this.formatStatsHeaderDate(endDate);
    var noteParts = [
        rangeLabel + ' 共完成 ' + summary.lessonCount + ' 节课',
        '到课 ' + summary.totalPresentStudents + '/' + summary.totalScheduledStudents + ' 人次',
        '累计 ' + summary.totalHours + 'h'
    ];
    if (summary.topType) noteParts.push('主力班型为 ' + summary.topType);
    if (summary.totalAuditionCount > 0) noteParts.push('含试听 ' + summary.totalAuditionCount + ' 人次');

    if (noteEl) noteEl.textContent = noteParts.join('，') + '。';
    if (detailEl) detailEl.textContent = '共 ' + summary.lessonCount + ' 条课程记录，点击展开查看逐次出勤。';
};

TimetableApp.prototype.getStatsViewSubtitle = function (viewLabel, startDate, endDate) {
    var range = this.formatStatsHeaderDate(startDate) + ' - ' + this.formatStatsHeaderDate(endDate);
    return '当前查看' + viewLabel + '，范围 ' + range + '，主图聚焦结果趋势，摘要卡片保留关键指标。';
};

TimetableApp.prototype.getTypeStatsForRange = function (startDate, endDate) {
    var typeStats = {};
    var totalMinutes = 0;
    var current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    var end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        var lessons = this.collectLessonsForDate(current);
        lessons.forEach(function (lesson) {
            var lessonCount = lesson.lessonCount || 1;
            var segmented = this.getLessonSegmentTypeStats(lesson);
            Object.keys(segmented.typeStats).forEach(function (type) {
                typeStats[type] = (typeStats[type] || 0) + segmented.typeStats[type] * lessonCount;
            });
            totalMinutes += segmented.totalMinutes * lessonCount;
        }, this);

        current.setDate(current.getDate() + 1);
    }

    return {
        typeStats: typeStats,
        totalMinutes: totalMinutes
    };
};

TimetableApp.prototype.getNaturalWeekStatsRange = function (startDate, endDate) {
    var start = new Date(startDate);
    var end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    var startDay = start.getDay();
    var startDiffToMonday = startDay === 0 ? 6 : startDay - 1;
    start.setDate(start.getDate() - startDiffToMonday);

    var endDay = end.getDay();
    var endDiffToSunday = endDay === 0 ? 0 : 7 - endDay;
    end.setDate(end.getDate() + endDiffToSunday);

    return {
        start: start,
        end: end
    };
};

TimetableApp.prototype.getSalarySettings = function () {
    var defaults = { basePay: 0, starLevel: 0, basicHours: 8 };
    try {
        var saved = JSON.parse(localStorage.getItem('timetableSalarySettings') || '{}');
        return {
            basePay: Number.isFinite(Number(saved.basePay)) ? Math.max(0, Number(saved.basePay)) : defaults.basePay,
            starLevel: Number.isFinite(Number(saved.starLevel)) ? Math.max(0, Math.min(5, Math.round(Number(saved.starLevel)))) : defaults.starLevel,
            basicHours: 8
        };
    } catch (error) {
        return defaults;
    }
};

TimetableApp.prototype.getSalaryStarBonus = function (level) {
    return [0, 5, 15, 20, 25, 40][Math.max(0, Math.min(5, Number(level) || 0))];
};

TimetableApp.prototype.openSalarySettings = function () {
    var settings = this.getSalarySettings();
    document.getElementById('salaryBasePay').value = settings.basePay;
    document.getElementById('salaryStarLevel').value = settings.starLevel;
    var updatePreview = function () {
        var bonus = this.getSalaryStarBonus(document.getElementById('salaryStarLevel').value);
        document.getElementById('salaryRatePreview').textContent = '当前阶梯课时费：' + [40, 50, 65, 75, 80].map(function (rate) { return rate + bonus; }).join(' / ') + ' 元/小时';
    }.bind(this);
    document.getElementById('salaryStarLevel').onchange = updatePreview;
    updatePreview();
    document.getElementById('salarySettingsModal').style.display = 'block';
};

TimetableApp.prototype.closeSalarySettings = function () {
    document.getElementById('salarySettingsModal').style.display = 'none';
};

TimetableApp.prototype.openSalaryRuleModal = function () {
    document.getElementById('salaryRuleModal').style.display = 'block';
};

TimetableApp.prototype.closeSalaryRuleModal = function () {
    document.getElementById('salaryRuleModal').style.display = 'none';
};

TimetableApp.prototype.saveSalarySettings = function () {
    var numberValue = function (id, fallback) {
        var value = Number(document.getElementById(id).value);
        return Number.isFinite(value) ? value : fallback;
    };
    var settings = {
        basePay: Math.max(0, numberValue('salaryBasePay', 0)),
        starLevel: Math.max(0, Math.min(5, Math.round(numberValue('salaryStarLevel', 0))))
    };
    localStorage.setItem('timetableSalarySettings', JSON.stringify(settings));
    this.closeSalarySettings();
    if (this._statsBaseCardLessons) {
        this.renderStatsCards(this._statsBaseCardLessons, { startDate: this._statsBaseCardStart, endDate: this._statsBaseCardEnd });
    }
    if (this._currentChartCategory === 'salary' && this._lastChartLessons && this._lastChartStart && this._lastChartEnd) {
        this.renderCharts(this._lastChartLessons, this._lastChartStart, this._lastChartEnd);
    }
};

TimetableApp.prototype.calculateSalaryStats = function (lessons) {
    var settings = this.getSalarySettings();
    var peopleFactors = { '1v1(0.8)': 0.8, '1v1': 1, '1v2': 1.2, '1v3': 1.8, '1v4': 1.9 };
    var gradeFactor = function (grade) {
        grade = String(grade || '');
        if (grade.indexOf('高三') >= 0) return 1.5;
        if (grade.indexOf('高二') >= 0) return 1.3;
        if (grade.indexOf('高一') >= 0) return 1.2;
        return 1;
    };
    var weightedHours = 0;
    var typeWeightedHours = {};
    lessons.forEach(function (lesson) {
        var students = (lesson.students || []).filter(function (student) { return student && !student.isAudition; });
        var lessonGradeFactor = students.reduce(function (highest, student) { return Math.max(highest, gradeFactor(student.grade)); }, 1);
        Object.keys(lesson.typeStats || {}).forEach(function (type) {
            var factor = peopleFactors[type];
            if (factor === undefined) {
                var count = Number(String(type).replace('1v', ''));
                factor = count >= 4 ? 1.9 : (count === 3 ? 1.8 : (count === 2 ? 1.2 : 1));
            }
            var typeHours = (Number(lesson.typeStats[type]) || 0) / 60 * factor * lessonGradeFactor;
            weightedHours += typeHours;
            typeWeightedHours[type] = (typeWeightedHours[type] || 0) + typeHours;
        });
    });
    var paidHours = Math.max(0, weightedHours - settings.basicHours);
    var starBonus = this.getSalaryStarBonus(settings.starLevel);
    var rates = [40, 50, 65, 75, 80].map(function (rate) { return rate + starBonus; });
    var remaining = paidHours;
    var coursePay = 0;
    [40, 40, 40, 40, Infinity].forEach(function (size, index) {
        if (remaining <= 0) return;
        var hours = Math.min(remaining, size);
        coursePay += hours * rates[index];
        remaining -= hours;
    });
    var currentTierIndex = paidHours <= 40 ? 0 : (paidHours <= 80 ? 1 : (paidHours <= 120 ? 2 : (paidHours <= 160 ? 3 : 4)));
    return {
        settings: settings,
        weightedHours: weightedHours,
        typeWeightedHours: typeWeightedHours,
        paidHours: paidHours,
        coursePay: coursePay,
        grossPay: settings.basePay + coursePay,
        rates: rates,
        currentRate: rates[currentTierIndex],
        currentMonthWeightedHours: weightedHours,
        currentMonthPaidHours: paidHours
    };
};

TimetableApp.prototype.calculateSalaryStatsForRange = function (startDate, endDate) {
    var settings = this.getSalarySettings();
    var start = new Date(startDate);
    var end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    var cursor = new Date(start);
    var weightedHours = 0;
    var paidHours = 0;
    var coursePay = 0;
    var currentRate = 40 + this.getSalaryStarBonus(settings.starLevel);
    var currentMonthWeightedHours = 0;
    var currentMonthPaidHours = 0;

    while (cursor <= end) {
        var segmentEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        if (segmentEnd > end) segmentEnd = new Date(end);
        var monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        var beforeEnd = new Date(cursor);
        beforeEnd.setDate(beforeEnd.getDate() - 1);
        var beforeStats = beforeEnd >= monthStart
            ? this.calculateSalaryStats(this.aggregateLessons(monthStart, beforeEnd))
            : this.calculateSalaryStats([]);
        var throughStats = this.calculateSalaryStats(this.aggregateLessons(monthStart, segmentEnd));
        var segmentStats = this.calculateSalaryStats(this.aggregateLessons(cursor, segmentEnd));

        weightedHours += segmentStats.weightedHours;
        paidHours += Math.max(0, throughStats.paidHours - beforeStats.paidHours);
        coursePay += Math.max(0, throughStats.coursePay - beforeStats.coursePay);
        currentRate = throughStats.currentRate;
        currentMonthWeightedHours = throughStats.weightedHours;
        currentMonthPaidHours = throughStats.paidHours;
        cursor = new Date(segmentEnd);
        cursor.setDate(cursor.getDate() + 1);
    }

    var starBonus = this.getSalaryStarBonus(settings.starLevel);
    return {
        settings: settings,
        weightedHours: weightedHours,
        paidHours: paidHours,
        coursePay: coursePay,
        grossPay: settings.basePay + coursePay,
        rates: [40, 50, 65, 75, 80].map(function (rate) { return rate + starBonus; }),
        currentRate: currentRate,
        currentMonthWeightedHours: currentMonthWeightedHours,
        currentMonthPaidHours: currentMonthPaidHours
    };
};

TimetableApp.prototype.calculateSalaryChartSeries = function (data, onlyIndex) {
    var self = this;
    var typeOrder = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var indexes = onlyIndex === null || onlyIndex === undefined
        ? data.labels.map(function (_label, index) { return index; })
        : [onlyIndex];

    var settings = this.getSalarySettings();
    var settingsKey = JSON.stringify(settings);
    var firstDate = data.groupStartDates.length ? new Date(data.groupStartDates[0]) : null;
    var lastDate = data.groupEndDates.length ? new Date(data.groupEndDates[data.groupEndDates.length - 1]) : null;
    var cacheStartDate = firstDate ? new Date(firstDate.getFullYear(), firstDate.getMonth(), 1) : null;
    var rangeKey = cacheStartDate && lastDate ? cacheStartDate.toISOString().slice(0, 10) + '|' + lastDate.toISOString().slice(0, 10) : '';

    if (!data._salaryDailyCache || data._salaryDailyCache.settingsKey !== settingsKey || data._salaryDailyCache.rangeKey !== rangeKey) {
        var daily = {};
        var starBonus = this.getSalaryStarBonus(settings.starLevel);
        var rates = [40, 50, 65, 75, 80].map(function (rate) { return rate + starBonus; });
        var payForHours = function (weightedHours) {
            var remaining = Math.max(0, weightedHours - settings.basicHours);
            var total = 0;
            [40, 40, 40, 40, Infinity].forEach(function (size, tier) {
                if (remaining <= 0) return;
                var hours = Math.min(remaining, size);
                total += hours * rates[tier];
                remaining -= hours;
            });
            return total;
        };
        var tierPayForRange = function (startHours, endHours) {
            var bounds = [0, settings.basicHours, settings.basicHours + 40, settings.basicHours + 80, settings.basicHours + 120, settings.basicHours + 160, Infinity];
            var tierRates = [0].concat(rates);
            return tierRates.map(function (rate, tier) {
                var overlap = Math.max(0, Math.min(endHours, bounds[tier + 1]) - Math.max(startHours, bounds[tier]));
                return overlap * rate;
            });
        };
        var tierHoursForRange = function (startHours, endHours) {
            var bounds = [0, settings.basicHours, settings.basicHours + 40, settings.basicHours + 80, settings.basicHours + 120, settings.basicHours + 160, Infinity];
            return bounds.slice(0, 6).map(function (lower, tier) {
                return Math.max(0, Math.min(endHours, bounds[tier + 1]) - Math.max(startHours, lower));
            });
        };
        var formatDate = function (date) {
            return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        };
        var cursor = cacheStartDate ? new Date(cacheStartDate) : null;
        var activeMonth = '';
        var monthWeightedHours = 0;
        while (cursor && cursor <= lastDate) {
            var monthKey = cursor.getFullYear() + '-' + cursor.getMonth();
            if (monthKey !== activeMonth) {
                activeMonth = monthKey;
                monthWeightedHours = 0;
            }
            var dayKey = formatDate(cursor);
            if (!self._statsDailySalaryCache) self._statsDailySalaryCache = new Map();
            var cachedDayStats = self._statsDailySalaryCache.get(dayKey);
            var dayStats;
            if (cachedDayStats && cachedDayStats.revision === (self._statsDataRevision || 0)) {
                dayStats = cachedDayStats.stats;
            } else {
                // Salary factors are stored on aggregated lessons as typeStats.
                // The one-day aggregation itself is cached, so this preserves
                // the fast path without dropping the class-type contributions.
                dayStats = self.calculateSalaryStats(self.aggregateLessons(cursor, cursor));
                self._statsDailySalaryCache.set(dayKey, { revision: self._statsDataRevision || 0, stats: dayStats });
            }
            var weightedBefore = monthWeightedHours;
            var payBefore = payForHours(monthWeightedHours);
            monthWeightedHours += dayStats.weightedHours;
            var dayPay = Math.max(0, payForHours(monthWeightedHours) - payBefore);
            var dayTierPay = tierPayForRange(weightedBefore, monthWeightedHours);
            var dayTierHours = tierHoursForRange(weightedBefore, monthWeightedHours);
            var contributionTotal = Object.keys(dayStats.typeWeightedHours).reduce(function (sum, type) {
                return sum + dayStats.typeWeightedHours[type];
            }, 0);
            var dayTypePay = {};
            typeOrder.forEach(function (type) {
                dayTypePay[type] = contributionTotal > 0 ? dayPay * (dayStats.typeWeightedHours[type] || 0) / contributionTotal : 0;
            });
            daily[formatDate(cursor)] = { pay: dayPay, typePay: dayTypePay, tierPay: dayTierPay, tierHours: dayTierHours };
            cursor.setDate(cursor.getDate() + 1);
        }
        data._salaryDailyCache = { settingsKey: settingsKey, rangeKey: rangeKey, daily: daily };
    }

    var payData = [];
    var typePayByGroup = [];
    var tierPayByGroup = [];
    var tierHoursByGroup = [];
    var formatGroupDate = function (date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    };
    indexes.forEach(function (index) {
        var cursor = new Date(data.groupStartDates[index]);
        var end = new Date(data.groupEndDates[index]);
        var groupPay = 0;
        var groupTypePay = {};
        var groupTierPay = [0, 0, 0, 0, 0, 0];
        var groupTierHours = [0, 0, 0, 0, 0, 0];
        while (cursor <= end) {
            var entry = data._salaryDailyCache.daily[formatGroupDate(cursor)];
            if (entry) {
                groupPay += entry.pay;
                typeOrder.forEach(function (type) { groupTypePay[type] = (groupTypePay[type] || 0) + (entry.typePay[type] || 0); });
                (entry.tierPay || []).forEach(function (value, tier) { groupTierPay[tier] += value || 0; });
                (entry.tierHours || []).forEach(function (value, tier) { groupTierHours[tier] += value || 0; });
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        payData.push(groupPay);
        typePayByGroup.push(groupTypePay);
        tierPayByGroup.push(groupTierPay);
        tierHoursByGroup.push(groupTierHours);
    });

    var typePay = {};
    typePayByGroup.forEach(function (group) {
        Object.keys(group).forEach(function (type) { typePay[type] = (typePay[type] || 0) + group[type]; });
    });
    return {
        labels: indexes.map(function (index) { return data.labels[index]; }),
        payData: payData,
        tierPayByGroup: tierPayByGroup,
        tierHoursByGroup: tierHoursByGroup,
        typePayByGroup: typePayByGroup,
        typePay: typePay
    };
};

TimetableApp.prototype.renderStatsCards = function (lessons, options) {
    var config = typeof options === 'boolean' ? { showClassDays: options } : (options || {});
    var showClassDays = config.showClassDays !== false;
    var useDashForEmpty = true;
    var container = document.getElementById(config.targetId || 'statsCards');
    if (!container) return { empty: true };
    var isStudentSummary = !config.legacy && container.id === 'statsCards' && this._currentChartCategory === 'student';

    container.classList.toggle('stats-grid-compact', !!config.compact);
    container.classList.toggle('student-summary-grid', isStudentSummary);

    var validLessons = lessons.filter(function (lesson) {
        return (lesson.studentCount + (lesson.leaveCount || 0) + (lesson.absentCount || 0)) > 0;
    });

    if (!config.legacy && container.id === 'statsCards' && this._currentChartCategory === 'salary') {
        var bindSalaryCardActions = function () {
            container.querySelector('[data-salary-action="rules"]')?.addEventListener('click', this.openSalaryRuleModal.bind(this));
            container.querySelector('[data-salary-action="settings"]')?.addEventListener('click', this.openSalarySettings.bind(this));
        }.bind(this);
        var salary = config.startDate && config.endDate
            ? this.calculateSalaryStatsForRange(config.startDate, config.endDate)
            : this.calculateSalaryStats(validLessons);
        var money = function (value) { return '¥' + Number(value || 0).toFixed(2); };
        container.classList.remove('lesson-unit-summary-grid', 'student-summary-grid');
        if (validLessons.length === 0) {
            container.innerHTML = [
                '<button type="button" class="stats-card stats-card-hours salary-rule-card" data-salary-action="rules"><div class="stats-card-copy"><div class="st-label">折算总课时</div><div class="st-num">-</div><div class="st-foot">点击查看计算规则</div></div></button>',
                '<div class="stats-card stats-card-lessons"><div class="stats-card-copy"><div class="st-label">本月阶梯进度</div><div class="st-num">-</div></div></div>',
                '<div class="stats-card stats-card-people"><div class="stats-card-copy"><div class="st-label">课时费</div><div class="st-num">-</div></div></div>',
                '<button type="button" class="stats-card stats-card-average salary-settings-card" data-salary-action="settings"><div class="stats-card-copy"><div class="st-label">预计含税工资</div><div class="st-num">-</div><div class="st-foot">点击设置底薪和星级</div></div></button>'
            ].join('');
            bindSalaryCardActions();
            this.animateStatsCards(container, true);
            return { empty: true, totalHours: '0.00', lessonCount: 0 };
        }
        var paidProgress = salary.currentMonthPaidHours || 0;
        var basicRemaining = Math.max(0, salary.settings.basicHours - (salary.currentMonthWeightedHours || 0));
        var progressValue;
        var progressFoot;
        if (basicRemaining > 0) {
            progressValue = basicRemaining.toFixed(2) + 'h';
            progressFoot = '基本课时剩余';
        } else if (paidProgress <= 160) {
            var nextThreshold = paidProgress <= 40 ? 40 : (paidProgress <= 80 ? 80 : (paidProgress <= 120 ? 120 : 160));
            progressValue = paidProgress.toFixed(2) + ' / ' + nextThreshold + 'h';
            progressFoot = '距下一档还差 ' + Math.max(0, nextThreshold - paidProgress).toFixed(2) + 'h';
        } else {
            progressValue = paidProgress.toFixed(2) + 'h';
            progressFoot = '已进入最高档';
        }
        container.innerHTML = [
            '<button type="button" class="stats-card stats-card-hours salary-rule-card" data-salary-action="rules"><div class="stats-card-copy"><div class="st-label">折算总课时</div><div class="st-num">' + salary.weightedHours.toFixed(2) + 'h</div><div class="st-foot">按年级与班型系数折算 · 点击查看规则</div></div></button>',
            '<div class="stats-card stats-card-lessons"><div class="stats-card-copy"><div class="st-label">本月阶梯进度</div><div class="st-num">' + progressValue + '</div><div class="st-foot">' + progressFoot + '</div></div></div>',
            '<div class="stats-card stats-card-people"><div class="stats-card-copy"><div class="st-label">课时费</div><div class="st-num">' + money(salary.coursePay) + '</div><div class="st-foot">当前阶段：' + salary.currentRate + '元/小时 · ' + salary.settings.starLevel + '星</div></div></div>',
            '<button type="button" class="stats-card stats-card-average salary-settings-card" data-salary-action="settings"><div class="stats-card-copy"><div class="st-label">预计含税工资</div><div class="st-num">' + money(salary.grossPay) + '</div><div class="st-foot">点击设置底薪和星级</div></div></button>'
        ].join('');
        bindSalaryCardActions();
        this.animateStatsCards(container, validLessons.length === 0);
        return { empty: validLessons.length === 0, totalHours: salary.weightedHours.toFixed(2), lessonCount: validLessons.length };
    }

    if (!config.legacy && container.id === 'statsCards' && this._durationUnitMode) {
        var totalUnitMinutes = validLessons.reduce(function (sum, lesson) {
            return sum + this.getLessonStudentMinutesForUnitStats(lesson) * (lesson.lessonCount || 1);
        }.bind(this), 0);
        var totalUnits = totalUnitMinutes / 40;
        container.classList.add('lesson-unit-summary-grid');
        container.innerHTML = '<div class="stats-card stats-card-hours"><div class="stats-card-copy">'
            + '<div class="st-label">总耗课（40分钟/Pd.）</div>'
            + '<div class="st-num">' + (totalUnitMinutes ? totalUnits.toFixed(2) : '-') + '</div>'
            + '</div></div>';
        this.animateStatsCards(container, !totalUnitMinutes);
        return {
            empty: !totalUnitMinutes,
            lessonCount: validLessons.length,
            totalPresentStudents: 0,
            totalScheduledStudents: 0,
            totalHours: totalUnits.toFixed(2),
            totalAuditionCount: 0,
            classDays: 0,
            topType: '',
            typeEntries: []
        };
    }
    container.classList.remove('lesson-unit-summary-grid');

    if (validLessons.length === 0) {
        if (config.legacy) {
            var emptyCards = [];
            emptyCards.push('<div class="stats-card"><div class="st-num">-</div><div class="st-label">到课 / 排课人次</div></div>');
            emptyCards.push('<div class="stats-card"><div class="st-num">-</div><div class="st-label">累计课时</div></div>');
            if (showClassDays) {
                emptyCards.push('<div class="stats-card"><div class="st-num">-</div><div class="st-label">上课天数</div></div>');
            }
            emptyCards.push('<div class="stats-card"><div class="st-num">-</div><div class="st-label">试听人次</div></div>');
            ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'].forEach(function (type) {
                emptyCards.push('<div class="stats-card stats-card-type"><div class="st-num">-</div><div class="st-label">' + type + ' 课时</div></div>');
            });
            container.innerHTML = emptyCards.join('');
            return {
                empty: true,
                lessonCount: 0,
                totalPresentStudents: 0,
                totalScheduledStudents: 0,
                totalHours: '0.00',
                totalAuditionCount: 0,
                classDays: 0,
                topType: '',
                typeEntries: []
            };
        }
        container.innerHTML = isStudentSummary
            ? ['总人数', '出勤', '缺勤', '结课', '试听'].map(function (label) {
                return '<div class="stats-card"><div class="stats-card-copy"><div class="st-label">' + label + '</div><div class="st-num">-</div></div></div>';
            }).join('')
            : [
                '<div class="stats-card stats-card-hours"><div class="stats-card-copy"><div class="st-label">总课时（小时）</div><div class="st-num">-</div></div></div>',
                '<div class="stats-card stats-card-lessons"><div class="stats-card-copy"><div class="st-label">总课程（节）</div><div class="st-num">-</div></div></div>',
                '<div class="stats-card stats-card-people"><div class="stats-card-copy"><div class="st-label">实际／计划课时完成率</div><div class="st-num">-</div></div></div>',
                '<div class="stats-card stats-card-average"><div class="stats-card-copy"><div class="st-label">日平均时长（小时/天）</div><div class="st-num">-</div></div></div>'
            ].join('');
        this.animateStatsCards(container, true);
        return {
            empty: true,
            lessonCount: 0,
            totalPresentStudents: 0,
            totalScheduledStudents: 0,
            totalHours: '0.00',
            totalAuditionCount: 0,
            classDays: 0,
            topType: '',
            typeEntries: []
        };
    }

    var totalPresentStudents = 0;
    var totalPresentNonAudition = 0;
    var totalScheduledStudents = 0;
    var totalMinutes = 0;
    var totalPlannedMinutes = 0;
    var totalAuditionCount = 0;
    var totalMissingStudents = 0;
    var totalCompletedStudents = 0;
    var allDates = new Set();
    var typeStats = {};

    validLessons.forEach(function (lesson) {
        var presentNonAuditionCount = lesson.presentNonAuditionCount || 0;
        var auditionCount = lesson.auditionStudentCount || 0;
        var presentCount = lesson.studentCount || 0;
        var totalCount = presentCount + (lesson.leaveCount || 0) + (lesson.absentCount || 0);

        totalAuditionCount += auditionCount;
        totalPresentStudents += presentCount;
        totalPresentNonAudition += presentNonAuditionCount;
        totalScheduledStudents += totalCount;
        totalMissingStudents += (lesson.leaveCount || 0) + (lesson.absentCount || 0);
        totalCompletedStudents += lesson.completedStudentCount || 0;

        var hasNonAuditionStudent = (lesson.students || []).some(function (student) {
            return student && !student.isAudition;
        });
        if (hasNonAuditionStudent && lesson.time) {
            var plannedParts = lesson.time.split('-');
            if (plannedParts.length === 2) {
                totalPlannedMinutes += Math.max(0, this.timeToMinutes(plannedParts[1]) - this.timeToMinutes(plannedParts[0]))
                    * (lesson.lessonCount || 1);
            }
        }

        if (lesson.typeStats && Object.keys(lesson.typeStats).length > 0) {
            Object.keys(lesson.typeStats).forEach(function (type) {
                var minutes = lesson.typeStats[type] || 0;
                if (minutes <= 0) return;
                totalMinutes += minutes;
                typeStats[type] = (typeStats[type] || 0) + minutes;
            });
        } else if (presentNonAuditionCount > 0) {
            var totalDuration = this.getLessonDurationMinutesForStats(lesson) * (lesson.lessonCount || 1);
            var type = this.getLessonTypeKeyForStats(lesson);
            totalMinutes += totalDuration;
            if (type) {
                typeStats[type] = (typeStats[type] || 0) + totalDuration;
            }
        }

        if (lesson.dates && lesson.dates.length > 0) {
            lesson.dates.forEach(function (dateKey) { allDates.add(dateKey); });
        }
    }, this);

    var totalHours = (totalMinutes / 60).toFixed(2);
    var completionRate = totalPlannedMinutes > 0 ? totalMinutes / totalPlannedMinutes * 100 : 0;
    var classDays = allDates.size;
    var topTypeEntry = Object.keys(typeStats).map(function (type) {
        return { type: type, minutes: typeStats[type] };
    }).sort(function (a, b) {
        return b.minutes - a.minutes;
    })[0] || null;
    var topType = topTypeEntry ? topTypeEntry.type : '';
    var typeDisplayOrder = {
        '1v1(0.8)': 0,
        '1v1': 1,
        '1v2': 2,
        '1v3': 3,
        '1v4': 4
    };
    var typeEntries = Object.keys(typeStats).map(function (type) {
        return { type: type, minutes: typeStats[type] };
    }).sort(function (a, b) {
        return (typeDisplayOrder[a.type] || 99) - (typeDisplayOrder[b.type] || 99);
    });

    if (config.legacy) {
        var legacyCards = [];
        legacyCards.push('<div class="stats-card"><div class="st-num">' + totalPresentStudents + '/' + totalScheduledStudents + '</div><div class="st-label">到课 / 排课人次</div></div>');
        legacyCards.push('<div class="stats-card"><div class="st-num">' + (totalMinutes > 0 ? totalHours + 'h' : '-') + '</div><div class="st-label">累计课时</div></div>');
        if (showClassDays) {
            legacyCards.push('<div class="stats-card"><div class="st-num">' + (classDays > 0 ? classDays : '-') + '</div><div class="st-label">上课天数</div></div>');
        }
        legacyCards.push('<div class="stats-card"><div class="st-num">' + (totalAuditionCount > 0 ? totalAuditionCount : '-') + '</div><div class="st-label">试听人次</div></div>');
        var legacyTypeMap = {};
        typeEntries.forEach(function (entry) { legacyTypeMap[entry.type] = entry.minutes; });
        ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'].forEach(function (type) {
            var typeMinutes = legacyTypeMap[type] || 0;
            legacyCards.push('<div class="stats-card stats-card-type"><div class="st-num">' + (typeMinutes > 0 ? (typeMinutes / 60).toFixed(2) + 'h' : '-') + '</div><div class="st-label">' + type + ' 课时</div></div>');
        });
        container.innerHTML = legacyCards.join('');
        return {
            empty: false,
            lessonCount: validLessons.length,
            totalPresentStudents: totalPresentStudents,
            totalScheduledStudents: totalScheduledStudents,
            totalHours: totalHours,
            totalAuditionCount: totalAuditionCount,
            classDays: classDays,
            topType: topType,
            typeEntries: typeEntries
        };
    }

    if (isStudentSummary) {
        const hasStudentComparisonRange = !!(config.startDate && config.endDate);
        let studentComparisonLabel = '较上1周期';
        let previousStudentLessons = [];
        if (hasStudentComparisonRange) {
            const studentGranularity = this._chartGranularity || 'day';
            let previousStudentStart;
            let previousStudentEnd;
            if (studentGranularity === 'year') {
                previousStudentStart = new Date(config.startDate.getFullYear() - 1, 0, 1);
                previousStudentEnd = new Date(config.startDate.getFullYear() - 1, 11, 31);
                studentComparisonLabel = '较上1年';
            } else if (studentGranularity === 'month') {
                previousStudentStart = new Date(config.startDate.getFullYear(), config.startDate.getMonth() - 1, 1);
                previousStudentEnd = new Date(config.startDate.getFullYear(), config.startDate.getMonth(), 0);
                studentComparisonLabel = '较上1月';
            } else if (studentGranularity === 'week') {
                previousStudentStart = new Date(config.startDate);
                previousStudentStart.setDate(previousStudentStart.getDate() - 7);
                previousStudentEnd = new Date(config.endDate);
                previousStudentEnd.setDate(previousStudentEnd.getDate() - 7);
                studentComparisonLabel = '较上1周';
            } else {
                previousStudentStart = new Date(config.startDate);
                previousStudentStart.setDate(previousStudentStart.getDate() - 1);
                previousStudentEnd = new Date(previousStudentStart);
                studentComparisonLabel = '较上1日';
            }
            previousStudentLessons = this.aggregateLessons(previousStudentStart, previousStudentEnd);
        }

        const getStudentSummaryMetrics = function (sourceLessons) {
            return sourceLessons.reduce(function (metrics, lesson) {
                const present = lesson.presentNonAuditionCount || 0;
                const audition = lesson.auditionStudentCount || 0;
                const missing = (lesson.leaveCount || 0) + (lesson.absentCount || 0);
                metrics.total += (lesson.studentCount || 0) + missing;
                metrics.present += present;
                metrics.missing += missing;
                metrics.audition += audition;
                metrics.completed += lesson.completedStudentCount || 0;
                return metrics;
            }, { total: 0, present: 0, missing: 0, completed: 0, audition: 0 });
        };
        const previousStudentMetrics = getStudentSummaryMetrics(previousStudentLessons);
        const studentComparisonHtml = function (current, previous) {
            if (!hasStudentComparisonRange) return '<span class="stats-card-trend trend-flat">—</span><span>当前统计周期</span>';
            if (previous <= 0 && current <= 0) return '<span class="stats-card-trend trend-flat">-</span><span>' + studentComparisonLabel + '</span>';
            const percent = previous > 0 ? (current - previous) / previous * 100 : 100;
            const trendClass = percent > 0 ? 'trend-up' : (percent < 0 ? 'trend-down' : 'trend-flat');
            const arrow = percent > 0 ? '↑' : (percent < 0 ? '↓' : '—');
            return '<span class="stats-card-trend ' + trendClass + '">' + arrow + ' ' + Math.abs(percent).toFixed(1) + '%</span><span>' + studentComparisonLabel + '</span>';
        };
        var studentCards = [
            ['总人数', totalScheduledStudents, previousStudentMetrics.total],
            ['出勤', totalPresentNonAudition, previousStudentMetrics.present],
            ['缺勤', totalMissingStudents, previousStudentMetrics.missing],
            ['结课', totalCompletedStudents, previousStudentMetrics.completed],
            ['试听', totalAuditionCount, previousStudentMetrics.audition]
        ];
        container.innerHTML = studentCards.map(function (entry) {
            return '<div class="stats-card"><div class="stats-card-copy"><div class="st-label">' + entry[0] + '</div><div class="st-num">' + entry[1] + '</div><div class="st-foot">' + studentComparisonHtml(entry[1], entry[2]) + '</div></div></div>';
        }).join('');
        this.animateStatsCards(container, false);
        return {
            empty: false,
            lessonCount: validLessons.length,
            totalPresentStudents: totalPresentStudents,
            totalScheduledStudents: totalScheduledStudents,
            totalHours: totalHours,
            totalAuditionCount: totalAuditionCount,
            classDays: classDays,
            topType: topType,
            typeEntries: typeEntries
        };
    }

    var previousMetrics = { hours: 0, lessons: 0, plannedMinutes: 0, completion: 0, average: 0 };
    var hasComparisonRange = !!(config.startDate && config.endDate);
    var comparisonLabel = '较上1周期';
    if (hasComparisonRange) {
        var granularity = this._chartGranularity || 'day';
        var previousStart;
        var previousEnd;
        if (granularity === 'year') {
            previousStart = new Date(config.startDate.getFullYear() - 1, 0, 1);
            previousEnd = new Date(config.startDate.getFullYear() - 1, 11, 31);
            comparisonLabel = '较上1年';
        } else if (granularity === 'month') {
            previousStart = new Date(config.startDate.getFullYear(), config.startDate.getMonth() - 1, 1);
            previousEnd = new Date(config.startDate.getFullYear(), config.startDate.getMonth(), 0);
            comparisonLabel = '较上1月';
        } else if (granularity === 'week') {
            previousStart = new Date(config.startDate);
            previousStart.setDate(previousStart.getDate() - 7);
            previousEnd = new Date(config.endDate);
            previousEnd.setDate(previousEnd.getDate() - 7);
            comparisonLabel = '较上1周';
        } else {
            previousStart = new Date(config.startDate);
            previousStart.setDate(previousStart.getDate() - 1);
            previousEnd = new Date(previousStart);
            comparisonLabel = '较上1日';
        }
        var previousLessons = this.aggregateLessons(previousStart, previousEnd);
        var previousDates = new Set();
        var self = this;
        previousLessons.forEach(function (lesson) {
            var scheduled = (lesson.studentCount || 0) + (lesson.leaveCount || 0) + (lesson.absentCount || 0);
            if (scheduled <= 0) return;
            previousMetrics.lessons += 1;
            var hasPreviousNonAuditionStudent = (lesson.students || []).some(function (student) {
                return student && !student.isAudition;
            });
            if (hasPreviousNonAuditionStudent && lesson.time) {
                var previousPlannedParts = lesson.time.split('-');
                if (previousPlannedParts.length === 2) {
                    previousMetrics.plannedMinutes += Math.max(0, self.timeToMinutes(previousPlannedParts[1]) - self.timeToMinutes(previousPlannedParts[0]))
                        * (lesson.lessonCount || 1);
                }
            }
            if (lesson.typeStats && Object.keys(lesson.typeStats).length) {
                Object.keys(lesson.typeStats).forEach(function (type) {
                    previousMetrics.hours += (lesson.typeStats[type] || 0) / 60;
                });
            } else if ((lesson.presentNonAuditionCount || 0) > 0) {
                previousMetrics.hours += self.getLessonDurationMinutesForStats(lesson) * (lesson.lessonCount || 1) / 60;
            }
            (lesson.dates || []).forEach(function (dateKey) { previousDates.add(dateKey); });
        });
        previousMetrics.completion = previousMetrics.plannedMinutes > 0
            ? previousMetrics.hours * 60 / previousMetrics.plannedMinutes * 100
            : 0;
        previousMetrics.average = previousDates.size ? previousMetrics.hours / previousDates.size : 0;
    }

    var comparisonHtml = function (current, previous) {
        if (!hasComparisonRange) return '<span class="stats-card-trend trend-flat">—</span><span>当前统计周期</span>';
        if (previous <= 0 && current <= 0) return '<span class="stats-card-trend trend-flat">— 0.0%</span><span>' + comparisonLabel + '</span>';
        var percent = previous > 0 ? (current - previous) / previous * 100 : 100;
        var trendClass = percent > 0 ? 'trend-up' : (percent < 0 ? 'trend-down' : 'trend-flat');
        var arrow = percent > 0 ? '↑' : (percent < 0 ? '↓' : '—');
        return '<span class="stats-card-trend ' + trendClass + '">' + arrow + ' ' + Math.abs(percent).toFixed(1) + '%</span><span>' + comparisonLabel + '</span>';
    };

    var cards = [];
    cards.push('<div class="stats-card stats-card-hours"><div class="stats-card-icon">◷</div><div class="stats-card-copy"><div class="st-label">总课时（小时）</div><div class="st-num">' + (totalMinutes > 0 ? totalHours : '0.00') + '</div><div class="st-foot">' + comparisonHtml(totalMinutes / 60, previousMetrics.hours) + '</div></div></div>');
    cards.push('<div class="stats-card stats-card-lessons"><div class="stats-card-icon">✓</div><div class="stats-card-copy"><div class="st-label">总课程（节）</div><div class="st-num">' + validLessons.length + '</div><div class="st-foot">' + comparisonHtml(validLessons.length, previousMetrics.lessons) + '</div></div></div>');
    cards.push('<div class="stats-card stats-card-people"><div class="stats-card-icon">◴</div><div class="stats-card-copy"><div class="st-label">实际／计划课时完成率</div><div class="st-num">' + completionRate.toFixed(1) + '%</div><div class="st-foot">' + comparisonHtml(completionRate, previousMetrics.completion) + '</div></div></div>');
    var dailyAverageHours = classDays > 0 ? (totalMinutes / 60 / classDays).toFixed(2) : '0.00';
    cards.push('<div class="stats-card stats-card-average"><div class="stats-card-icon">▥</div><div class="stats-card-copy"><div class="st-label">日平均时长（小时/天）</div><div class="st-num">' + dailyAverageHours + '</div><div class="st-foot">' + comparisonHtml(Number(dailyAverageHours), previousMetrics.average) + '</div></div></div>');
    container.innerHTML = cards.join('');
    this.animateStatsCards(container, false);

    return {
        empty: false,
        lessonCount: validLessons.length,
        totalPresentStudents: totalPresentStudents,
        totalScheduledStudents: totalScheduledStudents,
        totalHours: totalHours,
        totalAuditionCount: totalAuditionCount,
        classDays: classDays,
        topType: topType,
        typeEntries: typeEntries
    };
};

TimetableApp.prototype.renderDayStats = function () {
    var startInput = document.getElementById('statsStartDate');
    var endInput = document.getElementById('statsEndDate');
    if (!startInput.value || !endInput.value) return;

    var startDate = new Date(startInput.value + 'T00:00:00');
    var endDate = new Date(endInput.value + 'T00:00:00');
    if (startDate > endDate) return;

    this.updateStatsHeader('日统计', this.getStatsViewSubtitle('日统计', startDate, endDate));
    this._chartGranularity = 'day';
    var lessons = this.aggregateLessons(startDate, endDate);
    var cardDate = new Date(this._statsDate || startDate);
    cardDate.setHours(0, 0, 0, 0);
    var cardLessons = this.aggregateLessons(cardDate, cardDate);
    var summary = this.renderStatsCards(cardLessons, { startDate: cardDate, endDate: cardDate });
    this._statsBaseCardLessons = cardLessons;
    this._statsBaseCardStart = cardDate;
    this._statsBaseCardEnd = cardDate;
    this.updateStatsOverview(summary, cardDate, cardDate);
    this.renderStatsByGrade(lessons);
    this._lastChartLessons = lessons;
    this._lastChartStart = startDate;
    this._lastChartEnd = endDate;
    this.renderCharts(lessons, startDate, endDate);
};

TimetableApp.prototype.renderWeekStats = function () {
    var startInput = document.getElementById('statsStartDate');
    var endInput = document.getElementById('statsEndDate');
    if (!startInput.value || !endInput.value) return;

    var startDate = new Date(startInput.value + 'T00:00:00');
    var endDate = new Date(endInput.value + 'T00:00:00');
    if (startDate > endDate) return;
    var statsRange = this._statsWeekMode === 'naturalWeeks'
        ? this.getNaturalWeekStatsRange(startDate, endDate)
        : { start: startDate, end: endDate };

    this.updateStatsHeader('周统计', this.getStatsViewSubtitle('周统计', startDate, endDate));
    this._chartGranularity = 'week';
    var lessons = this.aggregateLessons(statsRange.start, statsRange.end);
    var cardAnchor = new Date(this._statsDate || startDate);
    cardAnchor.setHours(0, 0, 0, 0);
    if (cardAnchor < startDate) cardAnchor = new Date(startDate);
    if (cardAnchor > endDate) cardAnchor = new Date(endDate);
    var cardWeek = this.getWeekRange(cardAnchor);
    var cardStart = new Date(cardWeek.start);
    var cardEnd = new Date(cardWeek.end);
    if (this._statsWeekMode !== 'naturalWeeks') {
        if (cardStart < startDate) cardStart = new Date(startDate);
        if (cardEnd > endDate) cardEnd = new Date(endDate);
    }
    var cardLessons = this.aggregateLessons(cardStart, cardEnd);
    var summary = this.renderStatsCards(cardLessons, { startDate: cardStart, endDate: cardEnd });
    this._statsBaseCardLessons = cardLessons;
    this._statsBaseCardStart = cardStart;
    this._statsBaseCardEnd = cardEnd;
    this.updateStatsOverview(summary, cardStart, cardEnd);
    this.renderStatsByGrade(lessons);
    this._lastChartLessons = lessons;
    this._lastChartStart = statsRange.start;
    this._lastChartEnd = statsRange.end;
    this.renderCharts(lessons, statsRange.start, statsRange.end);
};

TimetableApp.prototype.renderMonthStats = function () {
    var startInput = document.getElementById('statsStartDate');
    var endInput = document.getElementById('statsEndDate');
    if (!startInput.value || !endInput.value) return;

    var startDate = new Date(startInput.value + 'T00:00:00');
    var endDate = new Date(endInput.value + 'T00:00:00');
    if (startDate > endDate) return;

    this.updateStatsHeader('月统计', this.getStatsViewSubtitle('月统计', startDate, endDate));
    this._chartGranularity = 'month';
    var lessons = this.aggregateLessons(startDate, endDate);
    var cardAnchor = new Date(this._statsDate || startDate);
    var cardMonthStart = new Date(cardAnchor.getFullYear(), cardAnchor.getMonth(), 1);
    var cardMonthEnd = new Date(cardAnchor.getFullYear(), cardAnchor.getMonth() + 1, 0);
    var cardLessons = this.aggregateLessons(cardMonthStart, cardMonthEnd);
    var summary = this.renderStatsCards(cardLessons, { startDate: cardMonthStart, endDate: cardMonthEnd });
    this._statsBaseCardLessons = cardLessons;
    this._statsBaseCardStart = cardMonthStart;
    this._statsBaseCardEnd = cardMonthEnd;
    this.updateStatsOverview(summary, cardMonthStart, cardMonthEnd);
    this.renderStatsByGrade(lessons);
    this._lastChartLessons = lessons;
    this._lastChartStart = startDate;
    this._lastChartEnd = endDate;
    this.renderCharts(lessons, startDate, endDate);
};

TimetableApp.prototype.renderYearStats = function () {
    var startInput = document.getElementById('statsStartDate');
    var endInput = document.getElementById('statsEndDate');
    if (!startInput.value || !endInput.value) return;

    var startDate = new Date(startInput.value + 'T00:00:00');
    var endDate = new Date(endInput.value + 'T00:00:00');
    if (startDate > endDate) return;

    this.updateStatsHeader('年统计', '当前查看年统计，主图突出全年结构变化，附图补充趋势和占比。');
    this._chartGranularity = 'year';
    var lessons = this.aggregateLessons(startDate, endDate);
    var cardAnchor = new Date(this._statsDate || startDate);
    var cardYearStart = new Date(cardAnchor.getFullYear(), 0, 1);
    var cardYearEnd = new Date(cardAnchor.getFullYear(), 11, 31);
    var cardLessons = this.aggregateLessons(cardYearStart, cardYearEnd);
    var summary = this.renderStatsCards(cardLessons, { startDate: cardYearStart, endDate: cardYearEnd });
    this._statsBaseCardLessons = cardLessons;
    this._statsBaseCardStart = cardYearStart;
    this._statsBaseCardEnd = cardYearEnd;
    this.updateStatsOverview(summary, cardYearStart, cardYearEnd);
    this.renderStatsByGrade(lessons);
    this._lastChartLessons = lessons;
    this._lastChartStart = startDate;
    this._lastChartEnd = endDate;
    this.renderCharts(lessons, startDate, endDate);
};

TimetableApp.prototype.setChartPanelText = function (titleId, subtitleId, title, subtitle) {
    var titleEl = document.getElementById(titleId);
    var subtitleEl = document.getElementById(subtitleId);
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
};

TimetableApp.prototype.getChartPanelCopy = function (category, granularity, focusLabel) {
    var prefix = focusLabel || '当前范围';
    var granularityLabel = this.getStatsGranularityLabel(granularity);
    if (category === 'duration' || category === 'salary') {
        if (category === 'salary') {
            return {
                barTitle: '课时费来源总览',
                barSubtitle: granularityLabel + '查看不同班型对折算课时的贡献。',
                lineTitle: focusLabel ? prefix + '折算课时变化' : '折算课时趋势',
                lineSubtitle: '课时费按照折算课时、星级和阶梯课时费计算。',
                pieTitle: focusLabel ? prefix + '班型贡献' : '课时费班型构成',
                pieSubtitle: '查看各班型产生的课时构成。'
            };
        }
        return {
            barTitle: '课时结构总览',
            barSubtitle: granularityLabel + '对比不同班型贡献的课时结构。',
            lineTitle: focusLabel ? prefix + '课时变化' : '课时变化趋势',
            lineSubtitle: granularityLabel + '查看不同班型课时的增减。',
            pieTitle: focusLabel ? prefix + '班型占比' : '班型课时占比',
            pieSubtitle: '快速查看 1v1 到 1v4 的课时分布。',
        };
    }
    return {
        barTitle: '出勤结构总览',
        barSubtitle: granularityLabel + '对比出勤、试听、请假与缺勤。',
        lineTitle: focusLabel ? prefix + '到课趋势' : '学生到课趋势',
        lineSubtitle: granularityLabel + '查看学生总数与到课变化。',
        pieTitle: focusLabel ? prefix + '状态占比' : '课程状态占比',
        pieSubtitle: '快速查看出勤、试听、请假与缺勤的结构比例。'
    };
};

TimetableApp.prototype.applyMainChartFilters = function (category, data) {
    // 模式二只看每天/周/月/年的实际总课时，不再让班型筛选重算总分钟。
    if (this._durationUnitMode && category === 'duration') return data;

    var barChart = this._chartInstances && this._chartInstances.bar;
    if (!barChart || !data) return data;

    if (category === 'student') {
        var visiblePresent = barChart.isDatasetVisible(0);
        var visibleAudition = barChart.isDatasetVisible(1);
        var visibleLeave = barChart.isDatasetVisible(2);
        var visibleAbsent = barChart.isDatasetVisible(3);
        var zeroes = data.labels.map(function () { return 0; });
        var presentNonAuditionData = visiblePresent ? data.presentNonAuditionData.slice() : zeroes.slice();
        var auditionData = visibleAudition ? data.auditionData.slice() : zeroes.slice();
        var leaveData = visibleLeave ? data.leaveData.slice() : zeroes.slice();
        var absentData = visibleAbsent ? data.absentData.slice() : zeroes.slice();
        var presentData = presentNonAuditionData.map(function (value, idx) {
            return value + auditionData[idx];
        });
        var totalStudentsData = presentData.map(function (value, idx) {
            return value + leaveData[idx] + absentData[idx];
        });

        return Object.assign({}, data, {
            presentNonAuditionData: presentNonAuditionData,
            auditionData: auditionData,
            leaveData: leaveData,
            absentData: absentData,
            presentData: presentData,
            totalStudentsData: totalStudentsData
        });
    }

    var visibleTypes = {};
    if (barChart.data && barChart.data.datasets) {
        barChart.data.datasets.forEach(function (dataset, idx) {
            if (dataset.label !== '暂无数据' && barChart.isDatasetVisible(idx)) {
                visibleTypes[dataset.label] = true;
            }
        });
    }

    var filteredTypeMinutesByGroup = data.typeMinutesByGroup.map(function (group) {
        var filteredGroup = {};
        Object.keys(group).forEach(function (type) {
            if (visibleTypes[type]) filteredGroup[type] = group[type];
        });
        return filteredGroup;
    });

    var filteredTypeMinutes = {};
    filteredTypeMinutesByGroup.forEach(function (group) {
        Object.keys(group).forEach(function (type) {
            filteredTypeMinutes[type] = (filteredTypeMinutes[type] || 0) + group[type];
        });
    });

    var filteredTotalMinutesData = filteredTypeMinutesByGroup.map(function (group) {
        return Object.keys(group).reduce(function (sum, type) {
            return sum + group[type];
        }, 0);
    });

    return Object.assign({}, data, {
        typeMinutesByGroup: filteredTypeMinutesByGroup,
        typeMinutes: filteredTypeMinutes,
        totalMinutesData: filteredTotalMinutesData
    });
};

TimetableApp.prototype.renderLinkedCharts = function (category, data, index, options) {
    if (!this._chartInstances) this._chartInstances = {};
    var config = options || {};
    var shouldUpdateLine = !!config.updateLine;

    var overallData = this.applyMainChartFilters(category, this.getChartSliceData(data, null));
    // By default the third row uses the exact active day/week/month/year. While
    // hovering chart one or two, it temporarily follows that point's time slice.
    var hasFocusedSlice = index !== null && index !== undefined;
    var detailSeriesData = hasFocusedSlice ? data : (this._linkedChartSeriesData || data);
    var detailData = this.applyMainChartFilters(
        category,
        this.getChartSliceData(detailSeriesData, hasFocusedSlice ? index : null)
    );
    var focusLabel = hasFocusedSlice ? detailData.selectedLabel || null : null;
    var piePanelCopy = this.getChartPanelCopy(category, data.granularity, focusLabel);
    this.setChartPanelText('pieChartTitle', 'pieChartSubtitle', piePanelCopy.pieTitle, piePanelCopy.pieSubtitle);

    if (shouldUpdateLine && this._chartInstances.line) this._chartInstances.line.destroy();
    if (this._chartInstances.pie) this._chartInstances.pie.destroy();
    if (this._chartInstances.comparison) this._chartInstances.comparison.destroy();

    var lineCanvas = document.getElementById('statsLineChart');
    var pieCanvas = document.getElementById('statsPieChart');
    var comparisonCanvas = document.getElementById('statsComparisonChart');
    var pieLayout = document.getElementById('statsPieLayout');
    if (pieLayout) pieLayout.classList.add('duration-breakdown-active');
    if ((shouldUpdateLine && !lineCanvas) || !pieCanvas) return;

    if (category === 'salary') {
        var salaryOverall = this.calculateSalaryChartSeries(data, null);
        var salaryDetail = this.calculateSalaryChartSeries(detailSeriesData, hasFocusedSlice ? index : null);
        if (shouldUpdateLine) {
            this._chartInstances.line = this.renderSalaryTrendChart(lineCanvas.getContext('2d'), salaryOverall, 'line', this._chartLineHoverHandler);
        }
        this._chartInstances.pie = this.renderSalaryTypePieChart(pieCanvas.getContext('2d'), salaryDetail);
    } else if (category === 'student') {
        if (shouldUpdateLine) {
            this._chartNoteTarget = 'lineChartLegendNote';
            this._chartInstances.line = this.renderStudentLineChart(
                lineCanvas.getContext('2d'),
                overallData,
                this._chartLineHoverHandler
            );
        }
        this._chartNoteTarget = 'pieChartLegendNote';
        this._chartInstances.pie = this.renderStudentPieChart(pieCanvas.getContext('2d'), detailData);
    } else {
        if (shouldUpdateLine) {
            this._chartNoteTarget = 'lineChartLegendNote';
            this._chartInstances.line = this.renderDurationLineChart(
                lineCanvas.getContext('2d'),
                overallData,
                this._chartLineHoverHandler
            );
        }
        this._chartNoteTarget = 'pieChartLegendNote';
        this._chartInstances.pie = this.renderDurationPieChart(pieCanvas.getContext('2d'), detailData);
    }
    if (comparisonCanvas) {
        this._chartNoteTarget = 'comparisonChartLegendNote';
        this._chartInstances.comparison = category === 'salary'
            ? this.renderSalaryTypeComparisonChart(comparisonCanvas.getContext('2d'), salaryDetail)
            : this.renderTypeComparisonChart(comparisonCanvas.getContext('2d'), detailData, category);
    }
    this._chartNoteTarget = null;
};

TimetableApp.prototype.renderSalaryTrendChart = function (ctx, salaryData, chartType, onHover) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var gridColor = isDark ? '#2c2c2a' : '#e1e0d9';
    var themeStyles = getComputedStyle(document.body);
    var primaryRgb = themeStyles.getPropertyValue('--primary-rgb').trim() || '22, 119, 255';
    var primary = themeStyles.getPropertyValue('--primary-color').trim() || 'rgb(' + primaryRgb + ')';
    var isLine = chartType === 'line';
    var linePointSizes = this.getLinePointSizes(salaryData.labels.length);
    var primaryParts = primaryRgb.split(',').map(function (value) { return Number(value.trim()) || 0; });
    var chartBackground = isDark ? [26, 26, 25] : [252, 252, 251];
    var primaryTint = function (strength) {
        return 'rgb(' + primaryParts.map(function (channel, index) {
            return Math.round(chartBackground[index] + (channel - chartBackground[index]) * strength);
        }).join(',') + ')';
    };
    var tierColors = [isDark ? '#64748b' : '#cbd5e1', primaryTint(.28), primaryTint(.44), primaryTint(.6), primaryTint(.78), primaryTint(1)];
    var salarySettings = this.getSalarySettings();
    var salaryRates = [40, 50, 65, 75, 80].map(function (rate) {
        return rate + this.getSalaryStarBonus(salarySettings.starLevel);
    }, this);
    var salaryBarGradient = function (context) {
        var chart = context.chart;
        var value = Number(context.raw);
        var yScale = chart.scales && chart.scales.y;
        if (!chart.chartArea || !yScale || !Number.isFinite(value) || value <= 0) {
            return 'rgba(' + primaryRgb + ', .16)';
        }
        var valueY = yScale.getPixelForValue(value);
        var baseY = yScale.getPixelForValue(0);
        var top = Math.min(valueY, baseY);
        var bottom = Math.max(valueY, baseY);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || top === bottom) {
            return 'rgba(' + primaryRgb + ', .16)';
        }
        var gradient = chart.ctx.createLinearGradient(0, bottom, 0, top);
        gradient.addColorStop(0, 'rgba(' + primaryRgb + ', .22)');
        gradient.addColorStop(1, 'rgb(' + primaryRgb + ')');
        return gradient;
    };
    var salaryBarValuePlugin = {
        id: 'salaryBarValueLabels',
        afterDatasetsDraw: function (chart) {
            if (isLine) return;
            if (salaryData.labels.length > 31) return;
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;
            var drawCtx = chart.ctx;
            drawCtx.save();
            drawCtx.fillStyle = isDark ? '#e2e8f0' : '#334155';
            drawCtx.font = '700 10px sans-serif';
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'bottom';
            meta.data.forEach(function (bar, index) {
                var value = Number(salaryData.payData[index]) || 0;
                if (value <= 0) return;
                var label = value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
                drawCtx.fillText(label, bar.x, Math.max(chart.chartArea.top + 10, bar.y - 6));
            });
            drawCtx.restore();
        }
    };
    var salaryTierGradientPlugin = {
        id: 'salaryTierGradients',
        beforeDatasetsDraw: function (chart) {
            if (isLine) return;
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;
            meta.data.forEach(function (bar, index) {
                var value = Number(salaryData.payData[index]) || 0;
                var tierHours = salaryData.tierHoursByGroup[index] || [];
                var totalHours = tierHours.reduce(function (sum, hours) { return sum + (hours || 0); }, 0);
                if (totalHours <= 0 || !bar || !Number.isFinite(bar.y) || !Number.isFinite(bar.base)) return;
                var bottom = Math.max(bar.y, bar.base);
                var top = value > 0
                    ? Math.min(bar.y, bar.base)
                    : bottom - Math.max(7, Math.min(18, totalHours / Math.max(1, salarySettings.basicHours) * 18));
                var height = Math.max(1, bottom - top);
                var gradient = chart.ctx.createLinearGradient(0, bottom, 0, top);
                var position = 0;
                var previousColor = null;
                tierHours.forEach(function (hours, tier) {
                    if (!hours) return;
                    var start = position;
                    var end = Math.min(1, position + hours / totalHours);
                    var currentColor = tierColors[tier];
                    gradient.addColorStop(start, previousColor || (tier === 0 ? currentColor : primaryTint([.12, .16, .24, .34, .46, .6][tier])));
                    gradient.addColorStop(start + (end - start) * .45, currentColor);
                    gradient.addColorStop(end, currentColor);
                    previousColor = currentColor;
                    position = end;
                });
                if (position < 1 && previousColor) gradient.addColorStop(1, previousColor);

                var left = bar.x - bar.width / 2;
                chart.ctx.save();
                chart.ctx.beginPath();
                if (typeof chart.ctx.roundRect === 'function') chart.ctx.roundRect(left, top, bar.width, height, [5, 5, 0, 0]);
                else chart.ctx.rect(left, top, bar.width, height);
                chart.ctx.fillStyle = gradient;
                chart.ctx.fill();
                chart.ctx.restore();
                if (value <= 0) bar.y = top;
                bar.options = Object.assign({}, bar.options, {
                    backgroundColor: 'rgba(0,0,0,0)', borderWidth: 0, borderRadius: 0, $shared: false
                });
            });
        }
    };
    var salaryChart = new Chart(ctx, {
        type: chartType,
        data: { labels: salaryData.labels, datasets: [{
            label: '课时费', data: salaryData.payData,
            backgroundColor: isLine ? 'transparent' : primary,
            borderColor: primary, borderWidth: isLine ? 2 : 0,
            borderRadius: isLine ? 0 : 5, tension: .3, fill: false,
            pointRadius: isLine ? Math.min(linePointSizes.radius, 2) : 0,
            pointHoverRadius: isLine ? linePointSizes.hoverRadius : 0,
            pointBackgroundColor: primary
        }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            onHover: function (_event, elements, chart) {
                chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
                if (onHover) onHover(elements.length ? elements[0].index : null);
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (item) {
                var index = item.dataIndex;
                var lines = ['课时费合计：¥' + item.parsed.y.toFixed(2)];
                var tierHours = salaryData.tierHoursByGroup[index] || [];
                var tierPay = salaryData.tierPayByGroup[index] || [];
                if ((tierHours[0] || 0) > 0) {
                    lines.push('基本课时：' + Number(tierHours[0]).toFixed(2) + 'h（不计费）');
                }
                salaryRates.forEach(function (rate, tierIndex) {
                    var amount = Number(tierPay[tierIndex + 1]) || 0;
                    if (amount > 0) lines.push(rate + '元档：¥' + amount.toFixed(2));
                });
                return lines;
            } } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                y: { beginAtZero: true, grace: isLine ? 0 : '15%', grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, callback: function (value) { return '¥' + value; } } }
            }
        },
        plugins: [salaryTierGradientPlugin, salaryBarValuePlugin]
    });
    if (!isLine) {
        var legend = document.getElementById('barChartTitleLegend');
        if (legend) {
            var tierLabels = ['0–' + salarySettings.basicHours + 'h 基本课时（不计费）'].concat(salaryRates.map(function (rate) { return rate + '元/小时'; }));
            legend.innerHTML = tierLabels.map(function (label, index) {
                return '<span class="chart-title-legend-item"><i style="background:' + tierColors[index] + '"></i><span>' + label + '</span></span>';
            }).join('');
        }
    }
    return salaryChart;
};

TimetableApp.prototype.renderSalaryTypePieChart = function (ctx, salaryData) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var centerTextColor = isDark ? '#f8fafc' : '#0f172a';
    var order = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var colors = ['#1677ff', '#20b486', '#ff9418', '#7651c9', '#16b4c6'];
    var labels = order.filter(function (type) { return (salaryData.typePay[type] || 0) > 0; });
    var values = labels.map(function (type) { return salaryData.typePay[type]; });
    var hasData = values.length > 0;
    if (!hasData) { labels = ['暂无数据']; values = [1]; colors = ['#e1e0d9']; }
    var getVisibleTotal = function (chart) {
        if (!hasData) return 0;
        return values.reduce(function (sum, value, index) {
            return chart.getDataVisibility(index) ? sum + value : sum;
        }, 0);
    };
    var doughnutLabelPlugin = {
        id: 'salaryTypePieLabelPlugin',
        afterDatasetsDraw: function (chart) {
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;
            var drawCtx = chart.ctx;
            var visibleTotal = getVisibleTotal(chart);
            drawCtx.save();
            if (hasData) {
                var centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                var centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                drawCtx.textAlign = 'center';
                drawCtx.textBaseline = 'middle';
                drawCtx.fillStyle = textColor;
                drawCtx.font = '600 11px sans-serif';
                drawCtx.fillText('总课时费', centerX, centerY - 12);
                drawCtx.fillStyle = centerTextColor;
                drawCtx.font = '700 20px sans-serif';
                drawCtx.fillText('¥' + visibleTotal.toFixed(2), centerX, centerY + 10);
            }
            meta.data.forEach(function (arc, index) {
                if (!hasData || !chart.getDataVisibility(index)) return;
                var pct = visibleTotal > 0 ? values[index] / visibleTotal * 100 : 0;
                if (pct < 8) return;
                var angle = (arc.startAngle + arc.endAngle) / 2;
                var radius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) * 0.58;
                drawCtx.fillStyle = '#ffffff';
                drawCtx.font = '700 12px sans-serif';
                drawCtx.shadowColor = 'rgba(15, 23, 42, 0.24)';
                drawCtx.shadowBlur = 6;
                drawCtx.fillText(Math.round(pct) + '%', arc.x + Math.cos(angle) * radius, arc.y + Math.sin(angle) * radius);
                drawCtx.shadowBlur = 0;
            });
            drawCtx.restore();
        }
    };
    var chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{
            data: values,
            backgroundColor: labels.map(function (type) { return colors[order.indexOf(type)] || colors[0]; }),
            borderColor: isDark ? '#1a1a19' : '#fcfcfb',
            borderWidth: 2,
            hoverBorderWidth: 2
        }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '56%', plugins: {
            legend: this.getChartLegendOptions(textColor, { display: false }),
            tooltip: { callbacks: { label: function (item) {
                if (!hasData) return '暂无数据';
                var visibleTotal = getVisibleTotal(item.chart);
                var pct = visibleTotal > 0 ? item.parsed / visibleTotal * 100 : 0;
                return item.label + ': ¥' + item.parsed.toFixed(2) + ' (' + pct.toFixed(1) + '%)';
            } } }
        } },
        plugins: [doughnutLabelPlugin]
    });
    var breakdown = document.getElementById('durationPieBreakdown');
    var renderBreakdown = function () {
        if (!breakdown) return;
        var visibleTotal = getVisibleTotal(chart);
        var rows = order.map(function (type, typeIndex) {
            var value = salaryData.typePay[type] || 0;
            var chartIndex = labels.indexOf(type);
            var isVisible = chartIndex >= 0 && chart.getDataVisibility(chartIndex);
            var percent = value > 0 && isVisible && visibleTotal > 0 ? (value / visibleTotal * 100).toFixed(1) + '%' : '-';
            var stateClass = value <= 0 ? ' is-empty' : (isVisible ? '' : ' is-hidden');
            return '<button type="button" class="duration-breakdown-row' + stateClass + '" data-index="' + chartIndex + '"' + (chartIndex < 0 ? ' disabled' : '') + '>' +
                '<span class="duration-breakdown-type"><i style="background:' + colors[typeIndex] + '"></i>' + type + '</span>' +
                '<strong>' + (value > 0 ? '¥' + value.toFixed(2) : '-') + '</strong><span>' + percent + '</span></button>';
        }).join('');
        breakdown.innerHTML = '<div class="duration-breakdown-head"><span>班型</span><span>课时费（元）</span><span>占比</span></div>' + rows;
        breakdown.querySelectorAll('.duration-breakdown-row').forEach(function (row) {
            row.onclick = function () {
                var itemIndex = Number(row.dataset.index);
                if (itemIndex < 0) return;
                chart.toggleDataVisibility(itemIndex);
                chart.update();
                renderBreakdown();
            };
        });
    };
    renderBreakdown();
    this.setChartLegendNote(hasData ? '' : '暂无课时费数据');
    return chart;
};

TimetableApp.prototype.renderSalaryTypeComparisonChart = function (ctx, salaryData) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var labels = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var colors = ['#1677ff', '#20b486', '#ff9418', '#7651c9', '#16b4c6'];
    var values = labels.map(function (type) { return salaryData.typePay[type] || 0; });
    var rankedTypes = labels.map(function (label, index) {
        return { label: label, value: values[index], color: colors[index] };
    }).sort(function (a, b) { return b.value - a.value; });
    labels = rankedTypes.map(function (item) { return item.label; });
    values = rankedTypes.map(function (item) { return item.value; });
    colors = rankedTypes.map(function (item) { return item.color; });
    var total = values.reduce(function (sum, value) { return sum + value; }, 0);
    var hasData = total > 0;
    var valueLabelPlugin = {
        id: 'salaryComparisonValueLabels',
        afterDatasetsDraw: function (chart) {
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;
            var drawCtx = chart.ctx;
            drawCtx.save();
            drawCtx.fillStyle = isDark ? '#e2e8f0' : '#334155';
            drawCtx.font = '700 11px sans-serif';
            drawCtx.textAlign = 'left';
            drawCtx.textBaseline = 'middle';
            meta.data.forEach(function (bar, index) {
                drawCtx.fillText('¥' + (values[index] || 0).toFixed(2), Math.min(bar.x + 8, chart.chartArea.right + 8), bar.y);
            });
            drawCtx.restore();
        }
    };
    var title = document.getElementById('comparisonChartTitle');
    if (title) title.textContent = '各班型课时费对比（元）';
    var chart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{
            label: '课时费',
            data: values,
            backgroundColor: colors,
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 13
        }] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 70 } },
            scales: {
                x: { beginAtZero: true, grid: { color: isDark ? 'rgba(148,163,184,.12)' : 'rgba(148,163,184,.16)' }, ticks: { color: isDark ? '#94a3b8' : '#64748b', callback: function (value) { return '¥' + value; } } },
                y: { grid: { display: false }, ticks: { color: isDark ? '#e2e8f0' : '#334155', font: { weight: 600 } } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (item) {
                var value = Number(item.raw || 0);
                var percent = total ? (value / total * 100).toFixed(1) : '0.0';
                return '¥' + value.toFixed(2) + ' · ' + percent + '%';
            } } } }
        },
        plugins: [valueLabelPlugin]
    });
    this.setChartLegendNote(hasData ? '' : '暂无课时费数据');
    return chart;
};

TimetableApp.prototype.renderCharts = function (lessons, startDate, endDate) {
    var chartSection = document.getElementById('chartsSection');
    if (!chartSection) return;

    this._lastChartLessons = lessons;
    this._lastChartStart = startDate;
    this._lastChartEnd = endDate;
    if (!this._currentChartCategory) this._currentChartCategory = 'duration';

    var statsCards = document.getElementById('statsCards');
    var detailSection = document.getElementById('statsDetailSection');
    chartSection.classList.toggle('lesson-unit-mode', !!this._durationUnitMode);
    if (statsCards) statsCards.style.display = this._durationUnitMode ? 'none' : '';
    if (detailSection) detailSection.style.display = this._durationUnitMode ? 'none' : '';

    if (typeof Chart === 'undefined') {
        chartSection.style.display = 'none';
        this.destroyCharts();
        console.warn('Chart.js is unavailable; falling back to text statistics.');
        return;
    }

    chartSection.style.display = '';
    var seriesData = this.collectChartSeriesData(startDate, endDate);
    this._linkedChartSeriesData = (this._statsBaseCardStart && this._statsBaseCardEnd)
        ? this.collectChartSeriesData(this._statsBaseCardStart, this._statsBaseCardEnd, this._chartGranularity)
        : seriesData;
    var updated = document.getElementById('statsDataUpdated');
    if (updated) updated.textContent = '数据更新于 ' + new Date().toLocaleString('zh-CN', { hour12: false });
    var cat = this._currentChartCategory;
    var titleLegend = document.getElementById('barChartTitleLegend');
    if ((cat === 'student' || cat === 'salary') && titleLegend) titleLegend.innerHTML = '';
    var lineTitleLegend = document.getElementById('lineChartTitleLegend');
    if ((cat === 'student' || cat === 'salary') && lineTitleLegend) lineTitleLegend.innerHTML = '';
    var copy = this._durationUnitMode ? {
        barTitle: '总耗课',
        barSubtitle: '按' + this.getStatsGranularityLabel(seriesData.granularity) + '汇总，40分钟计为1Pd.。',
        lineTitle: '总耗课趋势',
        lineSubtitle: '查看所选日、周、月或年范围内的总耗课变化。',
        pieTitle: '', pieSubtitle: ''
    } : this.getChartPanelCopy(cat, seriesData.granularity, null);
    this.setChartPanelText('barChartTitle', 'barChartSubtitle', copy.barTitle, copy.barSubtitle);
    this.setChartPanelText('lineChartTitle', 'lineChartSubtitle', copy.lineTitle, copy.lineSubtitle);
    this.setChartPanelText('pieChartTitle', 'pieChartSubtitle', copy.pieTitle, copy.pieSubtitle);

    this.destroyCharts();

    var canvas = document.getElementById('statsBarChart');
    var lineCanvas = document.getElementById('statsLineChart');
    if (!canvas || !lineCanvas) return;
    var ctx = canvas.getContext('2d');
    var self = this;
    var handleChartHover = function (index) {
        self._pendingChartSliceIndex = index;
        if (self._chartHoverFrame) return;
        self._chartHoverFrame = requestAnimationFrame(function () {
            self._chartHoverFrame = null;
            var nextIndex = self._pendingChartSliceIndex;
            if (self._activeChartSliceIndex === nextIndex) return;
            self._activeChartSliceIndex = nextIndex;
            self.updateStatsCardsForChartSlice(seriesData, nextIndex);
            self.renderLinkedCharts(cat, seriesData, nextIndex, { updateLine: false });
        });
    };
    this._chartLineHoverHandler = handleChartHover;
    canvas.onmouseleave = function () {
        handleChartHover(null);
    };
    lineCanvas.onmouseleave = function () {
        handleChartHover(null);
    };

    this._chartInstances = {};
    this._chartNoteTarget = 'barChartLegendNote';
    if (cat === 'salary') {
        this._chartInstances.bar = this.renderSalaryTrendChart(ctx, this.calculateSalaryChartSeries(seriesData, null), 'bar', handleChartHover);
    } else if (cat === 'student') {
        this._chartInstances.bar = this.renderStudentBarChart(ctx, seriesData, handleChartHover);
    } else {
        this._chartInstances.bar = this.renderDurationBarChart(ctx, seriesData, handleChartHover);
    }
    this._chartNoteTarget = null;
    this.renderLinkedCharts(cat, seriesData, null, { updateLine: true });

};

TimetableApp.prototype.updateStatsCardsForChartSlice = function (seriesData, index) {
    if (index === null || index === undefined) {
        if (this._statsBaseCardLessons && this._statsBaseCardStart && this._statsBaseCardEnd) {
            this.renderStatsCards(this._statsBaseCardLessons, {
                startDate: this._statsBaseCardStart,
                endDate: this._statsBaseCardEnd
            });
        }
        return;
    }

    var sliceStart = seriesData.groupStartDates && seriesData.groupStartDates[index];
    var sliceEnd = seriesData.groupEndDates && seriesData.groupEndDates[index];
    if (!sliceStart || !sliceEnd) return;
    sliceStart = new Date(sliceStart);
    sliceEnd = new Date(sliceEnd);
    var sliceLessons = this.aggregateLessons(sliceStart, sliceEnd);
    this.renderStatsCards(sliceLessons, { startDate: sliceStart, endDate: sliceEnd });
};

TimetableApp.prototype.renderTypeComparisonChart = function (ctx, data, category) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var studentMode = category === 'student';
    var labels = studentMode ? ['到课', '试听', '请假', '缺勤'] : ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var colors = studentMode ? ['#1677ff', '#20b486', '#ff9418', '#7651c9'] : ['#1677ff', '#20b486', '#ff9418', '#7651c9', '#16b4c6'];
    var values = studentMode ? [
        data.presentNonAuditionData.reduce(function (a, b) { return a + b; }, 0),
        data.auditionData.reduce(function (a, b) { return a + b; }, 0),
        data.leaveData.reduce(function (a, b) { return a + b; }, 0),
        data.absentData.reduce(function (a, b) { return a + b; }, 0)
    ] : labels.map(function (type) { return (data.typeMinutes[type] || 0) / 60; });
    if (!studentMode) {
        var rankedTypes = labels.map(function (label, index) {
            return { label: label, value: values[index], color: colors[index] };
        }).sort(function (a, b) {
            return b.value - a.value;
        });
        labels = rankedTypes.map(function (item) { return item.label; });
        values = rankedTypes.map(function (item) { return item.value; });
        colors = rankedTypes.map(function (item) { return item.color; });
    }
    var total = values.reduce(function (sum, value) { return sum + value; }, 0);
    var hasData = total > 0;
    var valueLabelPlugin = {
        id: 'comparisonValueLabels',
        afterDatasetsDraw: function (chart) {
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;
            var drawCtx = chart.ctx;
            drawCtx.save();
            drawCtx.fillStyle = isDark ? '#e2e8f0' : '#334155';
            drawCtx.font = '700 11px sans-serif';
            drawCtx.textAlign = 'left';
            drawCtx.textBaseline = 'middle';
            meta.data.forEach(function (bar, index) {
                var value = values[index] || 0;
                var label = studentMode ? value + '人次' : value.toFixed(2) + 'h';
                drawCtx.fillText(label, Math.min(bar.x + 8, chart.chartArea.right + 8), bar.y);
            });
            drawCtx.restore();
        }
    };

    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: studentMode ? '人次' : '课时（小时）',
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 13
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 58 } },
            scales: {
                x: { beginAtZero: true, grid: { color: isDark ? 'rgba(148,163,184,.12)' : 'rgba(148,163,184,.16)' }, ticks: { color: isDark ? '#94a3b8' : '#64748b' } },
                y: { grid: { display: false }, ticks: { color: isDark ? '#e2e8f0' : '#334155', font: { weight: 600 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function (item) {
                    var value = item.raw || 0;
                    var percent = total ? (value / total * 100).toFixed(1) : '0.0';
                    return (studentMode ? value + '人次' : value.toFixed(2) + 'h') + ' · ' + percent + '%';
                } } }
            }
        },
        plugins: [valueLabelPlugin]
    });
    var title = document.getElementById('comparisonChartTitle');
    if (title) title.textContent = studentMode ? '出勤状态对比（人次）' : '各班型课时对比（小时）';
    this.setChartLegendNote(hasData ? '' : '暂无统计数据');
    return chart;
};

TimetableApp.prototype.renderDurationPieChart = function (ctx, data) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var centerTextColor = isDark ? '#f8fafc' : '#0f172a';

    var typeOrder = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var catColors = ['#1677ff', '#20b486', '#ff9418', '#7651c9', '#16b4c6'];
    var labels = [];
    var values = [];
    var colors = [];

    typeOrder.forEach(function (type, i) {
        if (data.typeMinutes[type] && data.typeMinutes[type] > 0) {
            labels.push(type);
            values.push(data.typeMinutes[type]);
            colors.push(catColors[i]);
        }
    });

    if (labels.length === 0) {
        labels = ['暂无数据'];
        values = [1];
        colors = ['#e1e0d9'];
    }

    var chartHasData = labels.length > 0 && labels[0] !== '暂无数据';
    var totalMin = chartHasData ? values.reduce(function (a, b) { return a + b; }, 0) : 0;
    var getVisibleTotalMin = function (chart) {
        if (!chartHasData) return 0;
        return values.reduce(function (sum, value, index) {
            return chart.getDataVisibility(index) ? sum + value : sum;
        }, 0);
    };

    var doughnutLabelPlugin = {
        id: 'durationPieLabelPluginClean',
        afterDatasetsDraw: function (chart) {
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;

            var drawCtx = chart.ctx;
            var visibleTotalMin = getVisibleTotalMin(chart);
            var visibleTotalHours = (visibleTotalMin / 60).toFixed(2);
            drawCtx.save();

            if (chartHasData) {
                var centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                var centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                drawCtx.textAlign = 'center';
                drawCtx.textBaseline = 'middle';
                drawCtx.fillStyle = textColor;
                drawCtx.font = '600 11px sans-serif';
                drawCtx.fillText('总课时', centerX, centerY - 12);
                drawCtx.fillStyle = centerTextColor;
                drawCtx.font = '700 22px sans-serif';
                drawCtx.fillText(visibleTotalHours + 'h', centerX, centerY + 10);
            }

            meta.data.forEach(function (arc, index) {
                if (!chartHasData) return;
                if (!chart.getDataVisibility(index)) return;
                var value = values[index] || 0;
                var pct = visibleTotalMin > 0 ? (value / visibleTotalMin * 100) : 0;
                if (pct < 8) return;

                var angle = (arc.startAngle + arc.endAngle) / 2;
                var radius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) * 0.58;
                var x = arc.x + Math.cos(angle) * radius;
                var y = arc.y + Math.sin(angle) * radius;

                drawCtx.fillStyle = '#ffffff';
                drawCtx.font = '700 12px sans-serif';
                drawCtx.shadowColor = 'rgba(15, 23, 42, 0.24)';
                drawCtx.shadowBlur = 6;
                drawCtx.fillText(Math.round(pct) + '%', x, y);
                drawCtx.shadowBlur = 0;
            });

            drawCtx.restore();
        }
    };

    var chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: isDark ? '#1a1a19' : '#fcfcfb',
                borderWidth: 2,
                hoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '56%',
            plugins: {
                legend: this.getChartLegendOptions(textColor, { display: false }),
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            if (labels[0] === '暂无数据') return '暂无数据';
                            var hours = (context.parsed / 60).toFixed(2);
                            var visibleTotalMin = getVisibleTotalMin(context.chart);
                            var pct = visibleTotalMin > 0 ? (context.parsed / visibleTotalMin * 100).toFixed(1) : '0';
                            return context.label + ': ' + hours + 'h (' + pct + '%)';
                        }
                    }
                }
            }
        },
        plugins: [doughnutLabelPlugin]
    });

    var breakdown = document.getElementById('durationPieBreakdown');
    var renderBreakdown = function () {
        if (!breakdown) return;
        var visibleTotal = getVisibleTotalMin(chart);
        var rows = typeOrder.map(function (type, typeIndex) {
            var minutes = data.typeMinutes[type] || 0;
            var chartIndex = labels.indexOf(type);
            var isVisible = chartIndex >= 0 && chart.getDataVisibility(chartIndex);
            var hours = minutes > 0 ? (minutes / 60).toFixed(2) : '-';
            var percent = minutes > 0 && isVisible && visibleTotal > 0
                ? (minutes / visibleTotal * 100).toFixed(1) + '%'
                : '-';
            var stateClass = minutes <= 0 ? ' is-empty' : (isVisible ? '' : ' is-hidden');
            return '<button type="button" class="duration-breakdown-row' + stateClass + '" data-index="' + chartIndex + '"' + (chartIndex < 0 ? ' disabled' : '') + '>' +
                '<span class="duration-breakdown-type"><i style="background:' + catColors[typeIndex] + '"></i>' + type + '</span>' +
                '<strong>' + hours + '</strong><span>' + percent + '</span></button>';
        }).join('');
        breakdown.innerHTML = '<div class="duration-breakdown-head"><span>班型</span><span>课时（小时）</span><span>占比</span></div>' + rows;
        breakdown.querySelectorAll('.duration-breakdown-row').forEach(function (row) {
            row.onclick = function () {
                var itemIndex = Number(row.dataset.index);
                if (itemIndex < 0) return;
                chart.toggleDataVisibility(itemIndex);
                chart.update();
                renderBreakdown();
            };
        });
    };
    renderBreakdown();

    this.setChartLegendNote(chartHasData ? '' : '暂无上课时长数据');
    return chart;
};
