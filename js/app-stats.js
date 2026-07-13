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
    document.getElementById('textStatsModal').style.display = 'block';
    this.switchTextStatsTab(this._textStatsTab, { preserveDate: true });
}

TimetableApp.prototype.closeTextStatsModal = function () {
    document.getElementById('textStatsModal').style.display = 'none';
}

TimetableApp.prototype.switchTextStatsTab = function (tab, options) {
    const opts = options || {};
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

TimetableApp.prototype.collectLessonsForDate = function (date) {
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

    const subject = cellData.subject ? this.subjects.find(s => s.id == cellData.subject) : null;
    const periodInfo = this.getPeriod(period);

    let studentCount = 0, leaveCount = 0, absentCount = 0;
    let presentNonAuditionCount = 0, auditionStudentCount = 0;
    const students = studentIds.map(id => {
        const student = this.students.find(s => s.id === id);
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

    return {
        subject: subject ? subject.name : '未分类',
        color: subject ? subject.color : '#888',
        time: periodInfo ? periodInfo.time : '',
        studentCount,
        leaveCount,
        absentCount,
        presentNonAuditionCount,
        auditionStudentCount,
        period,
        key,
        courseInstanceId: cellData.courseInstanceId || null,
        studentIds,
        students
    };
}

TimetableApp.prototype.getLessonActualMinutesForStats = function (lesson) {
    if (this.erpData && Array.isArray(this.erpData.courseInstances)) {
        const instance = this.erpData.courseInstances.find(ci => ci.id === lesson.courseInstanceId);
        if (instance && instance.actualMinutesByDate) {
            const dates = lesson.dates || [];
            for (const dateKey of dates) {
                if (instance.actualMinutesByDate[dateKey] !== undefined) {
                    return instance.actualMinutesByDate[dateKey];
                }
            }
            const firstKey = Object.keys(instance.actualMinutesByDate)[0];
            if (firstKey) return instance.actualMinutesByDate[firstKey];
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
        const record = this.erpData.attendanceRecords.find(item =>
            item.studentId === String(studentId) &&
            (item.courseInstanceId === lesson.courseInstanceId || item.cellKey === lesson.key) &&
            (dates.length === 0 || dates.includes(item.dateKey))
        );
        if (record) return record.status;
    }
    return null;
}

TimetableApp.prototype.aggregateLessons = function (startDate, endDate) {
    const aggregated = {};

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

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
                    studentCount: 0,
                    leaveCount: 0,
                    absentCount: 0,
                    presentNonAuditionCount: 0,
                    auditionStudentCount: 0,
                    perSessionStudents: lesson.studentCount + lesson.leaveCount + lesson.absentCount,
                    statsTypeKey: typeKey,
                    period: lesson.period,
                    key: lesson.key,
                    courseInstanceId: lesson.courseInstanceId || null,
                    studentIds: [...lesson.studentIds],
                    students: [...(lesson.students || [])],
                    typeStats: {},
                    sessionTypeCounts: {},
                    lessonCount: 0,
                    dates: []
                };
            }
            aggregated[aggKey].studentCount += lesson.studentCount;
            aggregated[aggKey].leaveCount += lesson.leaveCount;
            aggregated[aggKey].absentCount += lesson.absentCount;
            aggregated[aggKey].presentNonAuditionCount += lesson.presentNonAuditionCount || 0;
            aggregated[aggKey].auditionStudentCount += lesson.auditionStudentCount || 0;
            if (lesson.students) {
                lesson.students.forEach(s => {
                    if (!aggregated[aggKey].students.find(existing => existing.id === s.id)) {
                        aggregated[aggKey].students.push(s);
                    }
                });
            }
            if (typeKey) {
                aggregated[aggKey].sessionTypeCounts[typeKey] = (aggregated[aggKey].sessionTypeCounts[typeKey] || 0) + 1;
                aggregated[aggKey].typeStats[typeKey] = (aggregated[aggKey].typeStats[typeKey] || 0) + this.getLessonDurationMinutesForStats(lesson);
            }
            aggregated[aggKey].lessonCount++;
            aggregated[aggKey].dates.push(dateStr);
        });
        current.setDate(current.getDate() + 1);
    }

    return Object.values(aggregated);
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

TimetableApp.prototype.getInlineOneV1Badge = function () {
    return '<span style="display:inline-flex;align-items:center;justify-content:center;margin-left:4px;padding:0 4px;min-width:16px;height:16px;border-radius:8px;background:linear-gradient(135deg,#4caf50 0%,#66bb6a 100%);color:#fff;font-size:10px;font-weight:700;line-height:1;">1v1</span>';
}

TimetableApp.prototype.getStatsStudentLabel = function (lesson) {
    const lessonCount = lesson.lessonCount || 1;
    const presentNonAuditionCount = lesson.presentNonAuditionCount || 0;
    let studentLabel = '';

    if (presentNonAuditionCount > 0) {
        if (presentNonAuditionCount === 1) {
            const presentStudent = lesson.students ? lesson.students.find(s =>
                s && !s.isAudition && (!s.status || (s.status !== 'leave' && s.status !== 'absent'))
            ) : null;
            if (presentStudent && presentStudent.is1v1) {
                studentLabel = '1v1';
            } else {
                studentLabel = '1v1(0.8)';
            }
        } else {
            studentLabel = `1v${presentNonAuditionCount}`;
        }
    }
    if (studentLabel && lessonCount > 1) {
        studentLabel += ` ×${lessonCount}`;
    }

    return studentLabel ? `(${studentLabel})` : '';
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
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${lesson.color};margin-right:8px"></span>
            ${lesson.subject} ${studentLabel}${auditionBadge}${suffix}
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
        const totalActualMin = actualMin !== undefined ? actualMin * lessonCount : null;
        const totalScheduled = parseFloat(scheduledDuration) * 60 * lessonCount;
        const durationDisplay = totalActualMin !== null
            ? this.formatDuration(Math.floor(totalActualMin / 60), totalActualMin % 60)
            : (totalScheduled >= 60 ? `${(totalScheduled / 60).toFixed(1).replace('.0', '')}h` : `${totalScheduled}min`);
        const perDisplay = actualMin !== undefined
            ? this.formatDuration(Math.floor(actualMin / 60), actualMin % 60)
            : `${scheduledDuration}h`;
        const durationTitle = actualMin !== undefined
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
        row.dataset.expanded = 'false';
        row.innerHTML = `
                <div class="gr-name">
                    ${this.getStatsRowNameHtml(lesson, false)}
                </div>
                <div class="gr-hours" title="${durationTitle}${dateTitle ? ' · ' + dateTitle : ''}">
                    ${lesson.time} · ${durationDisplay}
                    ${datesDisplay ? `<span class="gr-dates">${datesDisplay}</span>` : ''}
                </div>
            `;

        // 学生出勤详情面板（初始隐藏）
        const detailPanel = document.createElement('div');
        detailPanel.className = 'grade-detail';
        detailPanel.style.display = 'none';
        container.appendChild(row);
        container.appendChild(detailPanel);

        let expanded = false;
        row.addEventListener('click', () => {
            expanded = !expanded;
            row.dataset.expanded = expanded ? 'true' : 'false';
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
        html += `
                <div class="att-inline-row" style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
                    <span style="display:inline-flex;align-items:center;">${name}${oneV1Badge}${auditionBadge}</span>
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
        selectedLabel: data.labels[index]
    };
};

TimetableApp.prototype.switchChartCategory = function (category) {
    this._currentChartCategory = category;
    document.querySelectorAll('.chart-category-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
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

    var current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    var end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        var groupKey;
        if (granularity === 'day') {
            groupKey = formatLocalDate(current);
        } else if (granularity === 'week') {
            if (weekMode === 'naturalWeeks') {
                var dayOfWeek = current.getDay();
                var diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                var monday = new Date(current);
                monday.setDate(current.getDate() - diffToMonday);
                groupKey = formatLocalDate(monday);
            } else {
                var weekOfMonth = Math.floor((current.getDate() - 1) / 7) + 1;
                groupKey = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0') + '-W' + weekOfMonth;
            }
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

            var presentNonAuditionCount = lesson.presentNonAuditionCount || 0;
            var duration;
            var actualMinutes = self.getLessonActualMinutesForStats(lesson);
            if (actualMinutes !== undefined) {
                duration = actualMinutes;
            } else if (lesson.time) {
                var parts = lesson.time.split('-');
                if (parts.length === 2) {
                    duration = self.timeToMinutes(parts[1]) - self.timeToMinutes(parts[0]);
                } else {
                    duration = 0;
                }
            } else {
                duration = 0;
            }
            if (duration < 0) duration = 0;

            var lessonCount = lesson.lessonCount || 1;
            var totalDuration = duration * lessonCount;

            if (presentNonAuditionCount > 0) {
                groups[groupKey].totalMinutes += totalDuration;
                var typeKey;
                if (presentNonAuditionCount === 1) {
                    var presentStudent = lesson.students ? lesson.students.find(function (s) {
                        return s && !s.isAudition && (!s.status || (s.status !== 'leave' && s.status !== 'absent'));
                    }) : null;
                    if (presentStudent && presentStudent.is1v1) {
                        typeKey = '1v1';
                    } else {
                        typeKey = '1v1(0.8)';
                    }
                } else {
                    typeKey = '1v' + presentNonAuditionCount;
                }
                if (!groups[groupKey].typeMinutes[typeKey]) {
                    groups[groupKey].typeMinutes[typeKey] = 0;
                }
                groups[groupKey].typeMinutes[typeKey] += totalDuration;
            }
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

    var rangeCrossesMonth = startDate.getFullYear() !== endDate.getFullYear() || startDate.getMonth() !== endDate.getMonth();
    var rangeCrossesYear = startDate.getFullYear() !== endDate.getFullYear();
    var weekOrdinalByMonth = {};
    var formatFullDateLabel = function (d) {
        return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    };
    var formatShortDateLabel = function (d) {
        return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    };

    groupOrder.forEach(function (key) {
        var g = groups[key];
        var label;
        if (granularity === 'day') {
            var d = new Date(key + 'T00:00:00');
            label = rangeCrossesMonth ? formatFullDateLabel(d) : formatShortDateLabel(d);
        } else if (granularity === 'week') {
            var weekMonthKey = g.startDate.getFullYear() + '-' + String(g.startDate.getMonth() + 1).padStart(2, '0');
            weekOrdinalByMonth[weekMonthKey] = (weekOrdinalByMonth[weekMonthKey] || 0) + 1;
            label = '第' + weekOrdinalByMonth[weekMonthKey] + '周';
            if (rangeCrossesMonth) {
                label = g.startDate.getFullYear() + '年' + (g.startDate.getMonth() + 1) + '月' + label;
            }
        } else if (granularity === 'month') {
            var parts = key.split('-');
            label = parseInt(parts[1]) + '月';
            if (rangeCrossesYear) {
                label = parts[0] + '年' + label;
            }
        } else {
            label = key + '年';
        }
        if (granularity === 'week') {
            var weekMonthKeyDisplay = g.startDate.getFullYear() + '-' + String(g.startDate.getMonth() + 1).padStart(2, '0');
            var weekIndexDisplay = weekOrdinalByMonth[weekMonthKeyDisplay];
            var weekRangeLabel = (g.startDate.getMonth() + 1) + '/' + g.startDate.getDate() + '-' + (g.endDate.getMonth() + 1) + '/' + g.endDate.getDate();
            label = '第' + weekIndexDisplay + '周 ' + weekRangeLabel;
            if (startDate.getFullYear() !== endDate.getFullYear()) {
                label = g.startDate.getFullYear() + ' ' + label;
            }
        }

        if (granularity === 'week') {
            if (weekMode === 'naturalWeeks') {
                label = (g.startDate.getMonth() + 1) + '/' + g.startDate.getDate() + '-' + (g.endDate.getMonth() + 1) + '/' + g.endDate.getDate();
                if (startDate.getFullYear() !== endDate.getFullYear()) {
                    label = g.startDate.getFullYear() + ' ' + label;
                }
            } else {
                var weekMonthKeyDisplayFinal = g.startDate.getFullYear() + '-' + String(g.startDate.getMonth() + 1).padStart(2, '0');
                var weekIndexDisplayFinal = weekOrdinalByMonth[weekMonthKeyDisplayFinal];
                label = '第' + weekIndexDisplayFinal + '周';
                if (rangeCrossesMonth) {
                    label = (g.startDate.getMonth() + 1) + '月' + label;
                }
            }
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

    return {
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
        granularity: granularity
    };
};

// Final override: keep the percentage-enhanced duration pie chart as the last definition.
// ========== 人数统计 ==========

TimetableApp.prototype.renderStudentBarChart = function (ctx, data, onBarHover) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var gridColor = isDark ? '#2c2c2a' : '#e1e0d9';
    var self = this;

    var totalStudents = data.totalStudentsData.reduce(function (a, b) { return a + b; }, 0);
    var totalPresent = data.presentData.reduce(function (a, b) { return a + b; }, 0);
    var totalAudition = data.auditionData.reduce(function (a, b) { return a + b; }, 0);
    var totalNonAudition = totalPresent - totalAudition;
    var totalLeave = data.leaveData.reduce(function (a, b) { return a + b; }, 0);
    var totalAbsent = data.absentData.reduce(function (a, b) { return a + b; }, 0);

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
                    borderWidth: 0,
                    borderRadius: 4,
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
                    borderWidth: 0,
                    borderRadius: 4,
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
                    borderWidth: 0,
                    borderRadius: 4,
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
                    borderWidth: 0,
                    borderRadius: 4,
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
                legend: this.getChartLegendOptions(textColor),
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

    this.setChartLegendNote(chartHasData ? '' : '暂无人数数据');
    return chart;
};

TimetableApp.prototype.renderStudentLineChart = function (ctx, data) {
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

    var typeOrder = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var catColors = ['#1677ff', '#20b486', '#ff9418', '#7651c9', '#16b4c6'];
    var typeLabels = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];

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
                type: 'bar',
                data: typeData,
                backgroundColor: catColors[i],
                borderColor: catColors[i],
                borderWidth: 0,
                borderRadius: 4,
                borderSkipped: false,
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

    var totalHours = data.totalMinutesData.reduce(function (a, b) { return a + b; }, 0);
    var totalHoursDisplay = (totalHours / 60).toFixed(2);
    var stackedTotalLabelPlugin = {
        id: 'durationStackedTotalLabels',
        afterDatasetsDraw: function (chart) {
            if (!hasData) return;
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
                drawCtx.fillText(visibleTotal.toFixed(1), centerX, Math.max(chart.chartArea.top + 11, topY - 5));
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
        plugins: [stackedTotalLabelPlugin]
    });

    var titleLegend = document.getElementById('barChartTitleLegend');
    if (titleLegend) {
        titleLegend.innerHTML = '';
        chart.data.datasets.forEach(function (dataset, datasetIndex) {
            if (dataset.label === '暂无数据') return;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'chart-title-legend-item';
            button.innerHTML = '<i style="background:' + dataset.backgroundColor + '"></i><span>' + dataset.label + '</span>';
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

TimetableApp.prototype.renderDurationLineChart = function (ctx, data) {
    var isDark = document.body.classList.contains('dark-theme-active');
    var textColor = isDark ? '#c3c2b7' : '#52514e';
    var gridColor = isDark ? '#2c2c2a' : '#e1e0d9';

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

    this._statsDate = date || new Date();
    this._statsShowCharts = true;
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
            var presentNonAuditionCount = lesson.presentNonAuditionCount || 0;
            if (presentNonAuditionCount <= 0) return;

            var duration = 0;
            var actualMinutes = this.getLessonActualMinutesForStats(lesson);
            if (actualMinutes !== undefined) {
                duration = actualMinutes;
            } else if (lesson.time) {
                var parts = lesson.time.split('-');
                if (parts.length === 2) {
                    duration = this.timeToMinutes(parts[1]) - this.timeToMinutes(parts[0]);
                }
            }
            if (duration < 0) duration = 0;

            var lessonCount = lesson.lessonCount || 1;
            var totalDuration = duration * lessonCount;
            var type = null;
            if (presentNonAuditionCount === 1) {
                var presentStudent = lesson.students ? lesson.students.find(function (student) {
                    return student && !student.isAudition && (!student.status || (student.status !== 'leave' && student.status !== 'absent'));
                }) : null;
                type = presentStudent && presentStudent.is1v1 ? '1v1' : '1v1(0.8)';
            } else {
                type = '1v' + presentNonAuditionCount;
            }

            typeStats[type] = (typeStats[type] || 0) + totalDuration;
            totalMinutes += totalDuration;
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

TimetableApp.prototype.renderStatsCards = function (lessons, options) {
    var config = typeof options === 'boolean' ? { showClassDays: options } : (options || {});
    var showClassDays = config.showClassDays !== false;
    var container = document.getElementById(config.targetId || 'statsCards');
    if (!container) return { empty: true };

    container.classList.toggle('stats-grid-compact', !!config.compact);

    var validLessons = lessons.filter(function (lesson) {
        return (lesson.studentCount + (lesson.leaveCount || 0) + (lesson.absentCount || 0)) > 0;
    });

    if (validLessons.length === 0) {
        container.innerHTML = '<div class="text-muted stats-empty-state">' + (config.emptyText || '当前范围内暂无有效课时') + '</div>';
        return { empty: true };
    }

    var totalPresentStudents = 0;
    var totalScheduledStudents = 0;
    var totalMinutes = 0;
    var totalAuditionCount = 0;
    var allDates = new Set();
    var typeStats = {};

    validLessons.forEach(function (lesson) {
        var lessonCount = lesson.lessonCount || 1;
        var duration = 0;
        var actualMinutes = this.getLessonActualMinutesForStats(lesson);
        if (actualMinutes !== undefined) {
            duration = actualMinutes;
        } else if (lesson.time) {
            var parts = lesson.time.split('-');
            if (parts.length === 2) {
                duration = this.timeToMinutes(parts[1]) - this.timeToMinutes(parts[0]);
            }
        }

        var totalDuration = duration * lessonCount;
        var presentNonAuditionCount = lesson.presentNonAuditionCount || 0;
        var auditionCount = lesson.auditionStudentCount || 0;
        var presentCount = lesson.studentCount || 0;
        var totalCount = presentCount + (lesson.leaveCount || 0) + (lesson.absentCount || 0);

        totalAuditionCount += auditionCount;
        totalPresentStudents += presentCount;
        totalScheduledStudents += totalCount;

        if (presentNonAuditionCount > 0) {
            totalMinutes += totalDuration;
            if (presentNonAuditionCount === 1) {
                var presentStudent = lesson.students ? lesson.students.find(function (s) {
                    return s && !s.isAudition && (!s.status || (s.status !== 'leave' && s.status !== 'absent'));
                }) : null;
                if (presentStudent && presentStudent.is1v1) {
                    typeStats['1v1'] = (typeStats['1v1'] || 0) + totalDuration;
                } else {
                    typeStats['1v1(0.8)'] = (typeStats['1v1(0.8)'] || 0) + totalDuration;
                }
            } else {
                var type = '1v' + presentNonAuditionCount;
                typeStats[type] = (typeStats[type] || 0) + totalDuration;
            }
        }

        if (lesson.dates && lesson.dates.length > 0) {
            lesson.dates.forEach(function (dateKey) { allDates.add(dateKey); });
        }
    }, this);

    var totalHours = (totalMinutes / 60).toFixed(2);
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

    var cards = [];

    // 1. 到课 / 排课人次
    cards.push('<div class="stats-card"><div class="st-num">' + totalPresentStudents + '/' + totalScheduledStudents + '</div><div class="st-label">到课 / 排课人次</div></div>');
    // 2. 累计课时
    cards.push('<div class="stats-card"><div class="st-num">' + totalHours + 'h</div><div class="st-label">累计课时</div></div>');
    // 3. 上课天数
    if (showClassDays) {
        cards.push('<div class="stats-card"><div class="st-num">' + classDays + '</div><div class="st-label">上课天数</div></div>');
    }
    // 4. 试听人次
    cards.push('<div class="stats-card"><div class="st-num">' + totalAuditionCount + '</div><div class="st-label">试听人次</div></div>');
    // 5-9. 1v1(0.8) / 1v1 / 1v2 / 1v3 / 1v4（固定顺序，始终显示）
    var fixedTypeOrder = ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'];
    var typeStatsMap = {};
    typeEntries.forEach(function (entry) {
        typeStatsMap[entry.type] = entry.minutes;
    });
    fixedTypeOrder.forEach(function (type) {
        var minutes = typeStatsMap[type] || 0;
        cards.push('<div class="stats-card"><div class="st-num">' + (minutes / 60).toFixed(2) + 'h</div><div class="st-label">' + type + ' 课时</div></div>');
    });

    container.innerHTML = cards.join('');

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

TimetableApp.prototype.renderStatsCards = function (lessons, options) {
    var config = typeof options === 'boolean' ? { showClassDays: options } : (options || {});
    var showClassDays = config.showClassDays !== false;
    var useDashForEmpty = true;
    var container = document.getElementById(config.targetId || 'statsCards');
    if (!container) return { empty: true };

    container.classList.toggle('stats-grid-compact', !!config.compact);

    var validLessons = lessons.filter(function (lesson) {
        return (lesson.studentCount + (lesson.leaveCount || 0) + (lesson.absentCount || 0)) > 0;
    });

    if (validLessons.length === 0) {
        container.innerHTML = '<div class="text-muted stats-empty-state">' + (config.emptyText || '当前范围内暂无有效课时') + '</div>';
        return { empty: true };
    }

    var totalPresentStudents = 0;
    var totalScheduledStudents = 0;
    var totalMinutes = 0;
    var totalAuditionCount = 0;
    var allDates = new Set();
    var typeStats = {};

    validLessons.forEach(function (lesson) {
        var presentNonAuditionCount = lesson.presentNonAuditionCount || 0;
        var auditionCount = lesson.auditionStudentCount || 0;
        var presentCount = lesson.studentCount || 0;
        var totalCount = presentCount + (lesson.leaveCount || 0) + (lesson.absentCount || 0);

        totalAuditionCount += auditionCount;
        totalPresentStudents += presentCount;
        totalScheduledStudents += totalCount;

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
        legacyCards.push('<div class="stats-card"><div class="st-num">' + totalHours + 'h</div><div class="st-label">累计课时</div></div>');
        if (showClassDays) {
            legacyCards.push('<div class="stats-card"><div class="st-num">' + classDays + '</div><div class="st-label">上课天数</div></div>');
        }
        legacyCards.push('<div class="stats-card"><div class="st-num">' + totalAuditionCount + '</div><div class="st-label">试听人次</div></div>');
        var legacyTypeMap = {};
        typeEntries.forEach(function (entry) { legacyTypeMap[entry.type] = entry.minutes; });
        ['1v1(0.8)', '1v1', '1v2', '1v3', '1v4'].forEach(function (type) {
            legacyCards.push('<div class="stats-card"><div class="st-num">' + ((legacyTypeMap[type] || 0) / 60).toFixed(2) + 'h</div><div class="st-label">' + type + ' 课时</div></div>');
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

    var previousMetrics = { hours: 0, lessons: 0, people: 0, average: 0 };
    var hasComparisonRange = !!(config.startDate && config.endDate);
    var comparisonLabel = '较上一周期';
    if (hasComparisonRange) {
        var granularity = this._chartGranularity || 'day';
        var previousStart;
        var previousEnd;
        if (granularity === 'year') {
            previousStart = new Date(config.startDate.getFullYear() - 1, 0, 1);
            previousEnd = new Date(config.startDate.getFullYear() - 1, 11, 31);
            comparisonLabel = '较上年';
        } else if (granularity === 'month') {
            previousStart = new Date(config.startDate.getFullYear(), config.startDate.getMonth() - 1, 1);
            previousEnd = new Date(config.startDate.getFullYear(), config.startDate.getMonth(), 0);
            comparisonLabel = '较上月';
        } else if (granularity === 'week') {
            previousStart = new Date(config.startDate);
            previousStart.setDate(previousStart.getDate() - 7);
            previousEnd = new Date(config.endDate);
            previousEnd.setDate(previousEnd.getDate() - 7);
            comparisonLabel = '较上周';
        } else {
            previousStart = new Date(config.startDate);
            previousStart.setDate(previousStart.getDate() - 1);
            previousEnd = new Date(previousStart);
            comparisonLabel = '较昨天';
        }
        var previousLessons = this.aggregateLessons(previousStart, previousEnd);
        var previousDates = new Set();
        var self = this;
        previousLessons.forEach(function (lesson) {
            var scheduled = (lesson.studentCount || 0) + (lesson.leaveCount || 0) + (lesson.absentCount || 0);
            if (scheduled <= 0) return;
            previousMetrics.lessons += 1;
            previousMetrics.people += scheduled;
            if (lesson.typeStats && Object.keys(lesson.typeStats).length) {
                Object.keys(lesson.typeStats).forEach(function (type) {
                    previousMetrics.hours += (lesson.typeStats[type] || 0) / 60;
                });
            } else if ((lesson.presentNonAuditionCount || 0) > 0) {
                previousMetrics.hours += self.getLessonDurationMinutesForStats(lesson) * (lesson.lessonCount || 1) / 60;
            }
            (lesson.dates || []).forEach(function (dateKey) { previousDates.add(dateKey); });
        });
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
    cards.push('<div class="stats-card stats-card-people"><div class="stats-card-icon">♟</div><div class="stats-card-copy"><div class="st-label">参与人数（人次）</div><div class="st-num">' + totalScheduledStudents + '</div><div class="st-foot">' + comparisonHtml(totalScheduledStudents, previousMetrics.people) + '</div></div></div>');
    var dailyAverageHours = classDays > 0 ? (totalMinutes / 60 / classDays).toFixed(2) : '0.00';
    cards.push('<div class="stats-card stats-card-average"><div class="stats-card-icon">▥</div><div class="stats-card-copy"><div class="st-label">日平均时长（小时/天）</div><div class="st-num">' + dailyAverageHours + '</div><div class="st-foot">' + comparisonHtml(Number(dailyAverageHours), previousMetrics.average) + '</div></div></div>');
    container.innerHTML = cards.join('');

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
    var cardDate = new Date(this._statsDate || this.currentDate || startDate);
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
    var cardAnchor = new Date(this._statsDate || this.currentDate || startDate);
    var cardWeek = this.getWeekRange(cardAnchor);
    var cardLessons = this.aggregateLessons(cardWeek.start, cardWeek.end);
    var summary = this.renderStatsCards(cardLessons, { startDate: cardWeek.start, endDate: cardWeek.end });
    this._statsBaseCardLessons = cardLessons;
    this._statsBaseCardStart = cardWeek.start;
    this._statsBaseCardEnd = cardWeek.end;
    this.updateStatsOverview(summary, cardWeek.start, cardWeek.end);
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
    var cardAnchor = new Date(this._statsDate || this.currentDate || startDate);
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
    var cardAnchor = new Date(this._statsDate || this.currentDate || startDate);
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
    if (category === 'duration') {
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
    var detailData = this.applyMainChartFilters(category, this.getChartSliceData(data, index));
    var focusLabel = detailData.selectedLabel || null;
    var piePanelCopy = this.getChartPanelCopy(category, data.granularity, focusLabel);
    this.setChartPanelText('pieChartTitle', 'pieChartSubtitle', piePanelCopy.pieTitle, piePanelCopy.pieSubtitle);

    if (shouldUpdateLine && this._chartInstances.line) this._chartInstances.line.destroy();
    if (this._chartInstances.pie) this._chartInstances.pie.destroy();
    if (this._chartInstances.comparison) this._chartInstances.comparison.destroy();

    var lineCanvas = document.getElementById('statsLineChart');
    var pieCanvas = document.getElementById('statsPieChart');
    var comparisonCanvas = document.getElementById('statsComparisonChart');
    var pieLayout = document.getElementById('statsPieLayout');
    if (pieLayout) pieLayout.classList.toggle('duration-breakdown-active', category === 'duration');
    if (category !== 'duration') {
        var durationBreakdown = document.getElementById('durationPieBreakdown');
        if (durationBreakdown) durationBreakdown.innerHTML = '';
    }
    if ((shouldUpdateLine && !lineCanvas) || !pieCanvas) return;

    if (category === 'student') {
        if (shouldUpdateLine) {
            this._chartNoteTarget = 'lineChartLegendNote';
            this._chartInstances.line = this.renderStudentLineChart(lineCanvas.getContext('2d'), overallData);
        }
        this._chartNoteTarget = 'pieChartLegendNote';
        this._chartInstances.pie = this.renderStudentPieChart(pieCanvas.getContext('2d'), detailData);
    } else {
        if (shouldUpdateLine) {
            this._chartNoteTarget = 'lineChartLegendNote';
            this._chartInstances.line = this.renderDurationLineChart(lineCanvas.getContext('2d'), overallData);
        }
        this._chartNoteTarget = 'pieChartLegendNote';
        this._chartInstances.pie = this.renderDurationPieChart(pieCanvas.getContext('2d'), detailData);
    }
    if (comparisonCanvas) {
        this._chartNoteTarget = 'comparisonChartLegendNote';
        this._chartInstances.comparison = this.renderTypeComparisonChart(comparisonCanvas.getContext('2d'), detailData, category);
    }
    this._chartNoteTarget = null;
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
    if (statsCards) statsCards.style.display = '';
    if (detailSection) detailSection.style.display = '';

    if (typeof Chart === 'undefined') {
        chartSection.style.display = 'none';
        this.destroyCharts();
        console.warn('Chart.js is unavailable; falling back to text statistics.');
        return;
    }

    chartSection.style.display = '';
    var seriesData = this.collectChartSeriesData(startDate, endDate);
    var updated = document.getElementById('statsDataUpdated');
    if (updated) updated.textContent = '数据更新于 ' + new Date().toLocaleString('zh-CN', { hour12: false });
    var cat = this._currentChartCategory;
    var titleLegend = document.getElementById('barChartTitleLegend');
    if (cat === 'student' && titleLegend) titleLegend.innerHTML = '';
    var lineTitleLegend = document.getElementById('lineChartTitleLegend');
    if (cat === 'student' && lineTitleLegend) lineTitleLegend.innerHTML = '';
    var copy = this.getChartPanelCopy(cat, seriesData.granularity, null);
    this.setChartPanelText('barChartTitle', 'barChartSubtitle', copy.barTitle, copy.barSubtitle);
    this.setChartPanelText('lineChartTitle', 'lineChartSubtitle', copy.lineTitle, copy.lineSubtitle);
    this.setChartPanelText('pieChartTitle', 'pieChartSubtitle', copy.pieTitle, copy.pieSubtitle);

    this.destroyCharts();

    var canvas = document.getElementById('statsBarChart');
    var lineCanvas = document.getElementById('statsLineChart');
    if (!canvas || !lineCanvas) return;
    var ctx = canvas.getContext('2d');
    var self = this;
    var handleBarHover = function (index) {
        if (self._activeChartSliceIndex === index) return;
        self._activeChartSliceIndex = index;
        self.updateStatsCardsForChartSlice(seriesData, index);
        self.renderLinkedCharts(cat, seriesData, index, { updateLine: false });
    };
    canvas.onmouseleave = function () {
        handleBarHover(null);
    };

    this._chartInstances = {};
    this._chartNoteTarget = 'barChartLegendNote';
    if (cat === 'student') {
        this._chartInstances.bar = this.renderStudentBarChart(ctx, seriesData, handleBarHover);
    } else {
        this._chartInstances.bar = this.renderDurationBarChart(ctx, seriesData, handleBarHover);
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
            layout: { padding: { right: 34 } },
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
        }
    });
    var title = document.getElementById('comparisonChartTitle');
    if (title) title.textContent = studentMode ? '出勤状态对比（人次）' : '各班型课时对比（小时）';
    this.setChartLegendNote(studentMode && hasData ? '合计 ' + total + ' 人次，悬停可查看占比。' : (hasData ? '' : '暂无统计数据'));
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
