// app-core.js - Core class definition and data management
// Auto-split from script.js

const TIMETABLE_BACKUP_INTERVAL_MS = 10 * 60 * 1000;

function createDefaultSubjects() {
    return [
        { id: '1', name: '语文', teacher: '', color: '#FFE4E1' },
        { id: '2', name: '数学', teacher: '', color: '#E3F2FD' },
        { id: '3', name: '英语', teacher: '', color: '#FCE4EC' },
        { id: '4', name: '物理', teacher: '', color: '#EFEBE9' },
        { id: '5', name: '化学', teacher: '', color: '#B3E5FC' },
        { id: '6', name: '生物', teacher: '', color: '#F8BBD9' },
        { id: '7', name: '历史', teacher: '', color: '#FFCDBA' },
        { id: '8', name: '道法', teacher: '', color: '#FEF9E7' },
        { id: '9', name: '跨学科', teacher: '', color: '#D1C4E9' },
        { id: '10', name: '未分类', teacher: '', color: '#E5E7EB' }
    ];
}

function createDefaultPeriods() {
    return [
        { name: '第1节', time: '08:00-10:00' },
        { name: '第2节', time: '10:10-12:10' },
        { name: '第3节', time: '13:00-15:00' },
        { name: '第4节', time: '15:10-17:10' },
        { name: '第5节', time: '17:30-19:30' },
        { name: '第6节', time: '19:40-21:40' }
    ];
}

function createDefaultQuickSettings() {
    return { totalPeriods: 6, firstStart: '08:00', periodDuration: 120, breakDuration: 10,
        lunchPosition: 2, lunchDuration: 50, dinnerPosition: 4, dinnerDuration: 20 };
}

function createDefaultSettings() {
    return {
        showEvening: true,
        showSaturday: true,
        showSunday: true,
        showPeriodTime: true,
        segmentedStatistics: false,
        segmentedScheduling: false,
        stageRangeSettingsVersion: 1,
        stageMonthRanges: [],
        stages: [],
        theme: 'default',
        menuColor: '#ffffff',
        scheduleColor: '#ffffff',
        backgroundColor: '#f0f7ff',
        primaryColor: '#60a5fa',
        primaryHover: '#93c5fd',
        primaryPressed: '#3b82f6',
        primaryBg: '#e0f2fe',
        shadowColor: 'rgba(96, 165, 250, 0.15)',
        historyDataProtection: false,
        pageZoom: 100,
        teacherSubjectId: ''
    };
}

function createDefaultGrades() {
    return [
        { id: 'g1', name: '一年级', color: '#FFE4E1' },
        { id: 'g2', name: '二年级', color: '#E3F2FD' },
        { id: 'g3', name: '三年级', color: '#FCE4EC' },
        { id: 'g4', name: '四年级', color: '#FFF3E0' },
        { id: 'g5', name: '五年级', color: '#E8EAF6' },
        { id: 'g6', name: '六年级', color: '#FEF9E7' },
        { id: 'g7', name: '七年级', color: '#FFECB3' },
        { id: 'g8', name: '八年级', color: '#F3E5F5' },
        { id: 'g9', name: '九年级', color: '#FFE0B2' },
        { id: 'g10', name: '高一', color: '#B3E5FC' },
        { id: 'g11', name: '高二', color: '#F8BBD9' },
        { id: 'g12', name: '高三', color: '#D1C4E9' }
    ];
}

class TimetableApp {
    constructor() {
        this.MAX_STUDENTS_PER_COURSE = 4;
        this.subjects = createDefaultSubjects();
        this.students = [];
        this.manualCourses = [];   // 手动添加的课程（未排入课表的）
        this.currentPool = 'subject';
        this.timetable = {};
        this.periods = createDefaultPeriods();
        this.settings = {
            showEvening: true,
            showSaturday: true,
            showSunday: true,
            showPeriodTime: true,
            segmentedStatistics: false,
            segmentedScheduling: false,
            stageRangeSettingsVersion: 1,
            stageMonthRanges: [],
            stages: [],
            theme: 'default',
            historyDataProtection: false,
            pageZoom: 100,
            teacherSubjectId: ''
        };
        this.grades = [
            { id: 'g1', name: '一年级', color: '#FFE4E1' },
            { id: 'g2', name: '二年级', color: '#E3F2FD' },
            { id: 'g3', name: '三年级', color: '#FCE4EC' },
            { id: 'g4', name: '四年级', color: '#FFF3E0' },
            { id: 'g5', name: '五年级', color: '#E8EAF6' },
            { id: 'g6', name: '六年级', color: '#FEF9E7' },
            { id: 'g7', name: '七年级', color: '#FFECB3' },
            { id: 'g8', name: '八年级', color: '#F3E5F5' },
            { id: 'g9', name: '九年级', color: '#FFE0B2' },
            { id: 'g10', name: '高一', color: '#B3E5FC' },
            { id: 'g11', name: '高二', color: '#F8BBD9' },
            { id: 'g12', name: '高三', color: '#D1C4E9' }
        ];
        this.editingGrade = null;
        this.quickSettingsState = createDefaultQuickSettings();
        this.editingSubject = null;
        this.editingEntityType = null;
        this.editingCell = null;
        this.editingPeriod = null;
        this.isTemporaryCourseEdit = false;
        this._temporaryCourseSourceVersion = null;
        this.copiedCourse = null;
        this.copiedScheduleBlock = null;
        this.draggedItem = null;
        
        this.currentDate = new Date();
        this.currentStudentFilter = 'ongoing';
        
        this.init();
    }

    init() {
        this.loadData();
        this.loadSettings();
        if (window.ScheduleErpService.completeStudentsForEndedStages(this)) {
            this.saveData();
        }
        this.loadGrades();
        this.bindEvents();
        if (window.electronAPI && typeof window.electronAPI.onCourseSyncEvent === 'function') {
            this._courseSyncQueue = Promise.resolve();
            window.electronAPI.onCourseSyncEvent(event => {
                this._courseSyncQueue = this._courseSyncQueue.then(() => this.handleCourseSyncEvent(event));
            });
            if (typeof window.electronAPI.courseRestoreLogin === 'function' && localStorage.getItem('courseAutoLogin') === 'true') {
                window.electronAPI.courseRestoreLogin();
            }
        }
        this.renderSubjects();
        this.renderTimetable();
        this.applyThemeSettings(); // 先应用主题设置
        this.applySettings();
        this.updateThemeSettingsUI(); // Ensure UI matches loaded settings
        this.updateWeekRange();
        this._courseAutoSyncTimer = setInterval(() => this.checkCourseAutoSync(), 30000);
    }

    bindEvents() {
        const bind = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        };
        
        // 科目相关
        bind('addSubjectBtn', 'click', () => this.openSubjectModal());
        bind('addStudentBtn', 'click', () => this.openStudentModal());
        bind('addCourseBtn', 'click', () => this.openManualCourseModal());
        bind('subjectForm', 'submit', (e) => this.saveSubject(e));
        bind('courseLoginBtn', 'click', () => this.openCourseLogin());
        bind('courseLoginForm', 'submit', (e) => this.submitCourseLogin(e));
        bind('courseSyncRangeButton', 'click', () => this.chooseCourseSyncRange());
        bind('courseSyncCalendarPrev', 'click', () => this.changeCourseSyncCalendarMonth(-1));
        bind('courseSyncCalendarNext', 'click', () => this.changeCourseSyncCalendarMonth(1));
        bind('courseSyncStartBtn', 'click', () => this.startCourseSync());
        bind('courseSyncTodayBtn', 'click', () => this.syncTodayCourses());
        bind('courseSyncStopBtn', 'click', () => this.stopCourseSync());
        bind('courseAutoSyncToggle', 'click', () => this.toggleCourseAutoSync());
        bind('courseLogoutBtn', 'click', () => this.logoutCourseAccount());
        bind('courseAutoLoginOption', 'change', (e) => {
            if (e.target.checked) document.getElementById('courseSavePasswordOption').checked = true;
        });
        bind('courseSavePasswordOption', 'change', (e) => {
            if (!e.target.checked) document.getElementById('courseAutoLoginOption').checked = false;
        });
        bind('cancelBtn', 'click', () => this.closeSubjectModal());
        bind('deleteSubjectBtn', 'click', () => this.deleteSubject());
        
        // 添加课程弹窗相关
        bind('addLessonForm', 'submit', (e) => this.saveLessonToCell(e));
        bind('cancelLessonBtn', 'click', () => this.closeAddLessonModal());
        
        // 池切换相关
        document.querySelectorAll('.pool-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchPool(e.target.dataset.tab));
        });
        
        // 学生筛选相关
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterStudents(e.target.dataset.filter));
        });
        
        // 时间相关
        bind('timeForm', 'submit', (e) => this.savePeriodTime(e));
        bind('cancelTimeBtn', 'click', () => this.closeTimeModal());
        
        // 初始化时间选择器
        this.initTimeSelectors();
        
        // 教程事件
        bind('tutorialBtn', 'click', () => this.openQuickStartModal());
        
        bind('totalPeriodCount', 'change', (e) => {
            this.updateLunchBreakOptions(e.target.value);
            this.updateDinnerBreakOptions(e.target.value);
        });
        
        // 重置和打印
        bind('resetBtn', 'click', () => this.openResetModal());
        bind('exportBtn', 'click', () => this.openExportModal());
        bind('settingsBtn', 'click', () => this.openSettingsModal());
        window.addEventListener('resize', () => this.syncTimetableLayout());
        
        // 设置弹窗相关
        bind('gradeForm', 'submit', (e) => this.saveGrade(e));
        bind('cancelGradeBtn', 'click', () => this.closeGradeModal());
        bind('deleteGradeBtn', 'click', () => this.deleteGrade());
        
        // 年级颜色选择
        document.querySelectorAll('#gradeModal .color-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectGradeColor(e));
        });
        document.getElementById('gradeCustomColor').addEventListener('change', (e) => {
            document.getElementById('gradeCustomColorText').value = e.target.value;
        });
        document.getElementById('gradeCustomColorText').addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                document.getElementById('gradeCustomColor').value = e.target.value;
            }
        });
        
        // 预设主题选择
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all options
                document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
                
                // Add active class to clicked option
                const targetBtn = e.target.closest('.theme-option');
                targetBtn.classList.add('active');

                const theme = targetBtn.dataset.theme;
                this.applyPredefinedTheme(theme);
            });
        });
        
        // 设置弹窗Tab切换
        document.querySelectorAll('.settings-tab').forEach(tabButton => {
            tabButton.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchSettingsTab(tabName);
            });
        });

        // 日期导航相关
        bind('prevWeekBtn', 'click', () => this.changeWeek(-1));
        bind('nextWeekBtn', 'click', () => this.changeWeek(1));
        bind('todayBtn', 'click', () => {
            this.currentDate = new Date();
            this.updateWeekRange();
            this.renderTimetable();
        });
        bind('courseCheckBtn', 'click', () => this.openCourseCheckModal());
        bind('courseCheckRunBtn', 'click', () => this.runCourseCheck());
        bind('courseCheckRangeButton', 'click', () => this.toggleCourseCheckDatePicker());
        bind('courseCheckCalendarPrev', 'click', () => this.changeCourseCheckCalendarMonth(-1));
        bind('courseCheckCalendarNext', 'click', () => this.changeCourseCheckCalendarMonth(1));
        bind('courseCheckSyncBtn', 'click', () => this.syncCourseCheckRange());
        document.querySelectorAll('.course-check-mode').forEach(button => {
            button.addEventListener('click', () => this.setCourseCheckMode(button.dataset.mode));
        });
        bind('datePicker', 'change', (e) => this.handleDateChange(e));
        const calendarIcon = document.querySelector('.calendar-icon');
        if (calendarIcon) {
            calendarIcon.addEventListener('click', (e) => {
                e.preventDefault();
                const picker = document.getElementById('datePicker');
                if (picker && typeof picker.showPicker === 'function') picker.showPicker();
                else if (picker) picker.focus();
            });
        }
        bind('lessonStudentSearch', 'input', (e) => this.filterLessonStudents(e.target.value));
        

        
        // 颜色选择
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectColor(e));
        });
        document.getElementById('customColor').addEventListener('change', (e) => {
            document.getElementById('customColorText').value = e.target.value;
        });
        document.getElementById('customColorText').addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                document.getElementById('customColor').value = e.target.value;
            }
        });
        bind('subjectName', 'input', (e) => {
            const count = document.getElementById('subjectNameCount');
            if (count) count.textContent = `${e.target.value.length} / 20`;
        });
        
        // 拖拽相关
        this.setupDragAndDrop();
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.editingCell) {
                this.removeItemFromCell(this.editingCell);
            }
            if (e.key === 'Escape') {
                this.cancelCopyPasteState();
                this.closeSubjectModal();
                this.closeStudentBatchModal();
                this.closeTimeModal();
                this.closeQuickStartModal();
                this.closeAddLessonModal();
                this.closeAttendanceModal();
                this.closeTimeManagementModal();
                this.closeSettingsModal();
                this.closeGradeModal();
                this.closeStatsModal();
                this.closeTextStatsModal();
                this.closeSalarySettings();
                this.closeSalaryRuleModal();
                this.closeExportModal();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.copiedCourse && !this.copiedScheduleBlock) return;
            if (e.target.closest('.copy-course-btn, .schedule-block-action, .cell, .timetable th, .period-cell, .date-navigator')) return;
            this.cancelCopyPasteState();
        });
        
        // 点击弹窗外部关闭弹窗
        const modalCloseHandlers = {
            subjectModal: () => this.closeSubjectModal(),
            timeModal: () => this.closeTimeModal(),
            timeManagementModal: () => this.closeTimeManagementModal(),
            addLessonModal: () => this.closeAddLessonModal(),
            attendanceModal: () => this.closeAttendanceModal(),
            statsModal: () => this.closeStatsModal(),
            textStatsModal: () => this.closeTextStatsModal(),
            salarySettingsModal: () => this.closeSalarySettings(),
            salaryRuleModal: () => this.closeSalaryRuleModal(),
            settingsModal: () => this.closeSettingsModal(),
            gradeModal: () => this.closeGradeModal(),
            quickStartModal: () => this.closeQuickStartModal(),
            resetModal: () => this.closeResetModal(),
            exportModal: () => this.closeExportModal(),
            courseLoginModal: () => this.closeCourseLoginModal()
            ,courseCheckModal: () => this.closeCourseCheckModal()
        };
        
        Object.keys(modalCloseHandlers).forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modalCloseHandlers[modalId]();
                    }
                });
            }
        });
    }

    openCourseCheckModal() {
        const loggedInPanel = document.getElementById('courseLoggedInPanel');
        if (!this._courseLoggedIn && loggedInPanel && loggedInPanel.style.display === 'block') {
            this._courseLoggedIn = true;
        }
        if (!this._courseLoggedIn) {
            this._openCourseCheckAfterLogin = true;
            this.openCourseLogin();
            const message = document.getElementById('courseLoginMessage');
            if (message) message.textContent = '正在恢复登录，完成后将自动打开课表检查。';
            return;
        }
        this._openCourseCheckAfterLogin = false;
        const today = this.formatLocalDate(new Date());
        const week = this.getWeekRange(new Date());
        const weekStart = this.formatLocalDate(week.start);
        const weekEnd = this.formatLocalDate(week.end);
        document.getElementById('courseCheckDay').value = today;
        document.getElementById('courseCheckStartDate').value = weekStart;
        document.getElementById('courseCheckEndDate').value = weekEnd;
        document.getElementById('courseCheckRangeText').textContent = `${weekStart} → ${weekEnd}`;
        if (!this._courseCheckRunning) {
            document.getElementById('courseCheckStatus').textContent =
                document.querySelector('#courseCheckResults .course-check-record')
                    ? '当前显示最新一次检查结果，可重新检查以更新。'
                    : '请选择检查方式和日期。';
        }
        this.setCourseCheckMode('range');
        document.getElementById('courseCheckModal').style.display = 'block';
    }

    closeCourseCheckModal() {
        this.closeCourseCheckDatePicker();
        document.getElementById('courseCheckModal').style.display = 'none';
    }

    setCourseCheckMode(mode) {
        this._courseCheckMode = mode === 'range' ? 'range' : 'day';
        document.querySelectorAll('.course-check-mode').forEach(button => {
            button.classList.toggle('active', button.dataset.mode === this._courseCheckMode);
        });
        document.getElementById('courseCheckDayFields').style.display = this._courseCheckMode === 'day' ? 'flex' : 'none';
        document.getElementById('courseCheckRangeFields').style.display = this._courseCheckMode === 'range' ? 'flex' : 'none';
        if (this._courseCheckMode !== 'range') this.closeCourseCheckDatePicker();
    }

    toggleCourseCheckDatePicker() {
        const popover = document.getElementById('courseCheckDatePopover');
        if (!popover) return;
        if (popover.style.display === 'none' || !popover.style.display) {
            const start = this.parseDateInputValue(document.getElementById('courseCheckStartDate').value) || new Date();
            this._courseCheckCalendarMonth = new Date(start.getFullYear(), start.getMonth(), 1);
            this._pendingCourseCheckStartDate = null;
            popover.style.display = 'block';
            this.renderCourseCheckDatePicker();
            setTimeout(() => this.bindCourseCheckDatePickerOutsideClick(), 0);
        } else {
            this.closeCourseCheckDatePicker();
        }
    }

    closeCourseCheckDatePicker() {
        const popover = document.getElementById('courseCheckDatePopover');
        if (popover) popover.style.display = 'none';
        this._pendingCourseCheckStartDate = null;
        if (this._courseCheckDatePickerOutsideHandler) {
            document.removeEventListener('mousedown', this._courseCheckDatePickerOutsideHandler);
            this._courseCheckDatePickerOutsideHandler = null;
        }
    }

    bindCourseCheckDatePickerOutsideClick() {
        if (this._courseCheckDatePickerOutsideHandler) {
            document.removeEventListener('mousedown', this._courseCheckDatePickerOutsideHandler);
        }
        this._courseCheckDatePickerOutsideHandler = event => {
            const picker = document.getElementById('courseCheckRangeFields');
            const popover = document.getElementById('courseCheckDatePopover');
            if (!popover || popover.style.display === 'none' || (picker && picker.contains(event.target))) return;
            this.closeCourseCheckDatePicker();
        };
        document.addEventListener('mousedown', this._courseCheckDatePickerOutsideHandler);
    }

    changeCourseCheckCalendarMonth(delta) {
        const base = this._courseCheckCalendarMonth || new Date();
        this._courseCheckCalendarMonth = new Date(base.getFullYear(), base.getMonth() + delta, 1);
        this.renderCourseCheckDatePicker();
    }

    renderCourseCheckDatePicker() {
        const title = document.getElementById('courseCheckCalendarTitle');
        const grid = document.getElementById('courseCheckCalendarGrid');
        if (!title || !grid) return;
        const month = this._courseCheckCalendarMonth || new Date();
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - monthStart.getDay());
        const storedStart = this.parseDateInputValue(document.getElementById('courseCheckStartDate').value);
        const storedEnd = this.parseDateInputValue(document.getElementById('courseCheckEndDate').value);
        const rangeStart = this._pendingCourseCheckStartDate || storedStart;
        const rangeEnd = this._pendingCourseCheckStartDate || storedEnd;
        title.textContent = `${month.getFullYear()}年${month.getMonth() + 1}月`;
        grid.innerHTML = '';
        for (let index = 0; index < 42; index++) {
            const day = new Date(gridStart);
            day.setDate(gridStart.getDate() + index);
            day.setHours(0, 0, 0, 0);
            const dayKey = this.formatLocalDate(day);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'stats-calendar-day';
            button.textContent = String(day.getDate());
            if (day.getMonth() !== month.getMonth()) button.classList.add('other-month');
            if (rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd) button.classList.add('in-range');
            if ((rangeStart && day.getTime() === rangeStart.getTime()) || (rangeEnd && day.getTime() === rangeEnd.getTime())) {
                button.classList.add('range-edge');
            }
            button.addEventListener('click', () => this.selectCourseCheckCalendarDate(dayKey));
            grid.appendChild(button);
        }
    }

    selectCourseCheckCalendarDate(dateValue) {
        const picked = this.parseDateInputValue(dateValue);
        if (!picked) return;
        if (!this._pendingCourseCheckStartDate) {
            this._pendingCourseCheckStartDate = picked;
            document.getElementById('courseCheckRangeText').textContent =
                `${this.formatLocalDate(picked)} → 请选择结束日期`;
            this.renderCourseCheckDatePicker();
            return;
        }
        const start = this._pendingCourseCheckStartDate <= picked ? this._pendingCourseCheckStartDate : picked;
        const end = this._pendingCourseCheckStartDate <= picked ? picked : this._pendingCourseCheckStartDate;
        const startKey = this.formatLocalDate(start);
        const endKey = this.formatLocalDate(end);
        document.getElementById('courseCheckStartDate').value = startKey;
        document.getElementById('courseCheckEndDate').value = endKey;
        document.getElementById('courseCheckRangeText').textContent = `${startKey} → ${endKey}`;
        this.closeCourseCheckDatePicker();
    }

    async runCourseCheck() {
        if (this._courseSyncRunning) {
            document.getElementById('courseCheckStatus').textContent = '当前有同步任务正在运行，请稍后再检查。';
            return;
        }
        let startDate;
        let endDate;
        if (this._courseCheckMode === 'range') {
            startDate = document.getElementById('courseCheckStartDate').value;
            endDate = document.getElementById('courseCheckEndDate').value;
        } else {
            startDate = document.getElementById('courseCheckDay').value;
            endDate = startDate;
        }
        if (!startDate || !endDate) {
            document.getElementById('courseCheckStatus').textContent = '请先选择完整日期。';
            return;
        }
        if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
        this._courseCheckRange = { startDate, endDate };
        this._courseCheckRunning = true;
        this._courseSyncRunning = true;
        // A sync may only consume the snapshot produced by this check.
        this._courseCheckLastResult = null;
        this._courseCheckNetworkCourses = null;
        this._courseCheckSelections = new Map();
        this._courseCheckRunId = `course-check-${Date.now()}`;
        document.getElementById('courseCheckRunBtn').disabled = true;
        document.getElementById('courseCheckSyncBtn').disabled = true;
        document.getElementById('courseCheckResults').innerHTML = `
            <section id="${this._courseCheckRunId}" class="course-check-record is-running">
                <div class="course-check-record-title">
                    <strong>${this.escapeHtml(startDate === endDate ? startDate : `${startDate} → ${endDate}`)}</strong>
                    <span>检查中</span>
                </div>
                <div class="course-check-record-content"><div class="course-check-empty">正在读取课程列表…</div></div>
            </section>
        `;
        document.getElementById('courseCheckStatus').textContent = '正在读取网络课表并进行只读比较…';
        const result = await window.electronAPI.startCourseSync({ startDate, endDate, checkOnly: true });
        if (!result || !result.started) {
            this._courseCheckRunning = false;
            this._courseSyncRunning = false;
            document.getElementById('courseCheckRunBtn').disabled = false;
            const failedRecord = document.getElementById(this._courseCheckRunId);
            if (failedRecord) failedRecord.remove();
            document.getElementById('courseCheckStatus').textContent = result && result.message ? result.message : '无法开始检查。';
        }
    }

    buildCourseCheckItems(startDate, endDate) {
        const items = new Map();
        let cursor = this.parseDateInputValue(startDate);
        const end = this.parseDateInputValue(endDate);
        while (cursor && end && cursor <= end) {
            const dateKey = this.formatLocalDate(cursor);
            const day = cursor.getDay() || 7;
            const weekStart = this.formatLocalDate(this.getWeekRange(cursor).start);
            this.periods.forEach((period, periodIndex) => {
                const cellKey = this.buildCellKey(day, periodIndex);
                const version = this.getCellVersion(cellKey, weekStart);
                if (!version || !version.subject) return;
                const subject = this.subjects.find(item => String(item.id) === String(version.subject));
                const instance = version.courseInstanceId && this.erpData
                    ? (this.erpData.courseInstances || []).find(item => item.id === version.courseInstanceId)
                    : null;
                const students = (version.student || []).map(id => {
                    const student = this.students.find(item => String(item.id) === String(id));
                    if (!student) return null;
                    const record = (this.erpData && this.erpData.attendanceRecords || []).find(item =>
                        String(item.studentId) === String(id)
                        && item.dateKey === dateKey
                        && (item.courseInstanceId === version.courseInstanceId || item.cellKey === cellKey)
                    );
                    const savedMinutes = instance && instance.studentActualMinutesByDate
                        && instance.studentActualMinutesByDate[dateKey]
                        ? instance.studentActualMinutesByDate[dateKey][String(id)]
                        : undefined;
                    const courseMinutes = instance && instance.actualMinutesByDate
                        ? instance.actualMinutesByDate[dateKey]
                        : undefined;
                    return {
                        name: student.name,
                        status: record ? record.status : (this.isClassFinished(cellKey, cursor) ? 'present' : null),
                        statusDetail: record && (record.detail || record.reason || record.remark) || '',
                        actualMinutes: savedMinutes !== undefined ? Number(savedMinutes) : (courseMinutes !== undefined ? Number(courseMinutes) : undefined)
                    };
                }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                const time = instance && instance.actualStartTime && instance.actualEndTime
                    ? `${instance.actualStartTime}-${instance.actualEndTime}`
                    : String(period.time || '');
                items.set(`${dateKey}|${periodIndex}`, {
                    date: dateKey,
                    periodIndex,
                    periodName: period.name || `第${periodIndex + 1}节`,
                    subject: subject ? subject.name : '未分类',
                    time,
                    students
                });
            });
            cursor = this.addDays(cursor, 1);
        }
        return items;
    }

    buildNetworkCourseCheckItems(courses) {
        const items = new Map();
        const service = window.CourseDataImportService;
        (courses || []).forEach(course => {
            try {
                const date = this.parseDateInputValue(String(course.courseDate || '').slice(0, 10));
                if (!date) return;
                const dateKey = this.formatLocalDate(date);
                const day = date.getDay() || 7;
                const slot = service.periodSlots(this, course).slots[0];
                const students = (course.students || []).map(student => ({
                    name: String(student.name || '').trim(),
                    status: service.attendanceStatus(course, student),
                    statusDetail: String(student.attendanceStatus || student.attendentStatus || student.leaveReason || student.remark || '').trim(),
                    actualMinutes: service.sourceActualMinutes(student)
                })).filter(student => student.name).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                items.set(`${dateKey}|${slot.index}`, {
                    date: dateKey,
                    periodIndex: slot.index,
                    periodName: slot.period.name || `第${slot.index + 1}节`,
                    subject: String(course.subject && course.subject.name || '未分类').trim(),
                    time: `${String(course.courseTime || '').slice(0, 5)}-${String(course.courseEndTime || '').slice(0, 5)}`,
                    attendanceLoaded: course.__attendanceLoaded === true,
                    students
                });
            } catch (_) {
                // Invalid remote rows are ignored by the same rules as normal import.
            }
        });
        return items;
    }

    getNetworkCourseCheckKey(course) {
        try {
            const date = this.parseDateInputValue(String(course.courseDate || '').slice(0, 10));
            if (!date) return null;
            const slot = window.CourseDataImportService.periodSlots(this, course).slots[0];
            return `${this.formatLocalDate(date)}|${slot.index}`;
        } catch (_) {
            return null;
        }
    }

    getCourseCheckDifferences(courses, includeAttendance = false) {
        const range = this._courseCheckRange;
        const local = this.buildCourseCheckItems(range.startDate, range.endDate);
        const remote = this.buildNetworkCourseCheckItems(courses);
        const keys = [...new Set([...local.keys(), ...remote.keys()])].sort();
        return keys.map(key => {
            const left = local.get(key) || null;
            const right = remote.get(key) || null;
            const localNames = left ? left.students.map(student => student.name) : [];
            const remoteNames = right ? right.students.map(student => student.name) : [];
            let same = left && right
                && left.subject === right.subject
                && left.time === right.time
                && JSON.stringify(localNames) === JSON.stringify(remoteNames);
            if (same && includeAttendance && right.attendanceLoaded) {
                const normalize = students => students.map(student => ({
                    name: student.name,
                    status: student.status || null,
                    actualMinutes: student.actualMinutes === undefined ? null : Math.max(0, Number(student.actualMinutes) || 0)
                }));
                same = JSON.stringify(normalize(left.students)) === JSON.stringify(normalize(right.students));
            }
            return same ? null : { key, local: left, remote: right };
        }).filter(Boolean);
    }

    renderCourseCheckResults(courses, includeAttendance = false) {
        const differences = this.getCourseCheckDifferences(courses, includeAttendance);
        const selections = this._courseCheckSelections || new Map();
        const record = this._courseCheckRunId && document.getElementById(this._courseCheckRunId);
        const container = record
            ? record.querySelector('.course-check-record-content')
            : document.getElementById('courseCheckResults');
        const status = document.getElementById('courseCheckStatus');
        const syncButton = document.getElementById('courseCheckSyncBtn');
        if (!differences.length) {
            status.textContent = '检查完成：当前课表与网络数据一致。';
            container.innerHTML = '<div class="course-check-empty">没有发现不一致的课程。</div>';
            syncButton.disabled = true;
            return;
        }
        status.textContent = `检查完成：发现 ${differences.length} 处课程数据不一致。`;
        const statusLabel = status => ({ present: '出勤', leave: '请假', absent: '缺勤' }[status] || '未记录');
        const studentLabel = student => {
            if (!includeAttendance) return student.name;
            const duration = student.actualMinutes === undefined
                ? '未记录时长'
                : this.formatDuration(Math.floor(Number(student.actualMinutes) / 60), Number(student.actualMinutes) % 60);
            const detail = student.statusDetail && student.status !== 'present'
                ? `：${student.statusDetail}`
                : '';
            return `${student.name}（${statusLabel(student.status)}${detail} · ${duration}）`;
        };
        const detail = item => item
            ? `<strong>${this.escapeHtml(item.subject)}</strong><span>${this.escapeHtml(item.date)} · ${this.escapeHtml(item.periodName)}</span><span>${this.escapeHtml(item.time)}</span><small>${item.attendanceLoaded === false && this._courseCheckRunning ? '出勤记录排队检查中' : (item.students.length ? this.escapeHtml(item.students.map(studentLabel).join('、')) : '无学生')}</small>`
            : '<span class="course-check-missing">无课程</span>';
        container.innerHTML = `
            <div class="course-check-columns"><strong>本地课表数据</strong><strong>网络数据</strong></div>
            ${differences.map(item => `
                <div class="course-check-diff-row" data-key="${this.escapeHtml(item.key)}">
                    <div class="course-check-choice${selections.get(item.key) === 'local' ? ' is-selected' : ''}" data-choice="local" role="button" tabindex="0" aria-pressed="${selections.get(item.key) === 'local'}">
                        ${detail(item.local)}
                    </div>
                    <div class="course-check-choice${selections.get(item.key) === 'network' ? ' is-selected' : ''}" data-choice="network" role="button" tabindex="0" aria-pressed="${selections.get(item.key) === 'network'}">
                        ${detail(item.remote)}
                    </div>
                </div>
            `).join('')}
        `;
        container.querySelectorAll('.course-check-choice').forEach(choice => {
            const select = () => {
                const row = choice.closest('.course-check-diff-row');
                if (!row) return;
                this._courseCheckSelections.set(row.dataset.key, choice.dataset.choice);
                this.renderCourseCheckResults(courses, includeAttendance);
            };
            choice.addEventListener('click', select);
            choice.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select();
                }
            });
        });
        // The network snapshot is complete only after all attendance rows arrive.
        syncButton.disabled = !!this._courseCheckRunning
            || differences.some(item => !selections.has(item.key));
        if (!this._courseCheckRunning) {
            const selectedCount = differences.filter(item => selections.has(item.key)).length;
            status.textContent = selectedCount === differences.length
                ? `已选择全部 ${differences.length} 处差异，可以同步。`
                : `发现 ${differences.length} 处差异，请逐行选择保留本地或使用网络数据（${selectedCount}/${differences.length}）。`;
        }
    }

    async syncCourseCheckRange() {
        const cached = this._courseCheckLastResult;
        if (!cached || !cached.range || !Array.isArray(cached.courses)) {
            document.getElementById('courseCheckStatus').textContent = '没有可同步的已完成检查数据，请先完成检查。';
            return;
        }
        const button = document.getElementById('courseCheckSyncBtn');
        button.disabled = true;
        const status = document.getElementById('courseCheckStatus');
        const differences = this.getCourseCheckDifferences(cached.courses, true);
        const selections = this._courseCheckSelections || new Map();
        if (differences.some(item => !selections.has(item.key))) {
            status.textContent = '请先为每一处差异选择“本地数据”或“网络数据”。';
            button.disabled = false;
            return;
        }
        status.textContent = '正在按选择结果同步最新课程快照…';
        try {
            const result = window.CourseDataImportService.applyCourseCheckSelections(
                this,
                cached.courses,
                selections
            );
            this.renderCourseCheckResults(cached.courses, true);
            status.textContent = `同步完成：保留本地 ${result.localCount} 处，使用网络数据 ${result.networkCount} 处。`;
            button.disabled = true;
        } catch (error) {
            const detail = String(error && error.message ? error.message : '未知错误');
            status.textContent = `同步失败，原课表已恢复：${detail}`;
            button.disabled = false;
        }
    }

    async openCourseLogin() {
        const modal = document.getElementById('courseLoginModal');
        const range = this.getWeekRange(this.currentDate);
        document.getElementById('courseSyncStartDate').value = this.formatLocalDate(range.start);
        document.getElementById('courseSyncEndDate').value = this.formatLocalDate(range.end);
        document.getElementById('courseLoginMessage').textContent = '';
        this.updateCourseSyncRangeText();
        this.renderCourseAutoSyncSettings();
        document.getElementById('courseAutoLoginOption').checked = localStorage.getItem('courseAutoLogin') === 'true';
        document.getElementById('courseSavePasswordOption').checked = localStorage.getItem('courseSavePassword') === 'true';
        document.getElementById('courseCredentialsPanel').style.display = this._courseLoggedIn ? 'none' : 'block';
        document.getElementById('courseLoggedInPanel').style.display = this._courseLoggedIn ? 'block' : 'none';
        modal.style.display = 'block';
        if (!this._courseLoggedIn) document.getElementById('courseLoginAccount').focus();
    }

    closeCourseLoginModal() {
        this.closeCourseSyncDatePicker();
        document.getElementById('courseLoginModal').style.display = 'none';
    }

    async submitCourseLogin(event) {
        event.preventDefault();
        const message = document.getElementById('courseLoginMessage');
        const submit = document.getElementById('courseLoginSubmitBtn');
        const payload = {
            account: document.getElementById('courseLoginAccount').value.trim(),
            password: document.getElementById('courseLoginPassword').value,
            autoLogin: document.getElementById('courseAutoLoginOption').checked,
            savePassword: document.getElementById('courseSavePasswordOption').checked
        };
        if (!payload.account || !payload.password) {
            message.textContent = '请输入账号和密码。';
            return;
        }
        submit.disabled = true;
        submit.textContent = '正在登录…';
        message.textContent = '正在连接课程系统…';
        localStorage.setItem('courseAutoLogin', payload.autoLogin ? 'true' : 'false');
        localStorage.setItem('courseSavePassword', payload.savePassword ? 'true' : 'false');
        const result = await window.electronAPI.courseLogin(payload);
        document.getElementById('courseLoginPassword').value = '';
        if (!result || !result.started) {
            submit.disabled = false;
            submit.textContent = '登录';
            message.textContent = result && result.message ? result.message : '无法启动课程同步。';
        }
    }

    chooseCourseSyncRange() {
        const popover = document.getElementById('courseSyncDatePopover');
        if (!popover) return;
        if (popover.style.display === 'none' || !popover.style.display) {
            const current = this.parseDateInputValue(document.getElementById('courseSyncStartDate').value) || new Date();
            this._courseSyncCalendarMonth = new Date(current.getFullYear(), current.getMonth(), 1);
            this._pendingCourseSyncStartDate = null;
            popover.style.display = 'block';
            this.renderCourseSyncDatePicker();
            setTimeout(() => this.bindCourseSyncDatePickerOutsideClick(), 0);
        } else {
            this.closeCourseSyncDatePicker();
        }
    }

    closeCourseSyncDatePicker() {
        const popover = document.getElementById('courseSyncDatePopover');
        if (popover) popover.style.display = 'none';
        this._pendingCourseSyncStartDate = null;
        if (this._courseSyncDatePickerOutsideHandler) {
            document.removeEventListener('mousedown', this._courseSyncDatePickerOutsideHandler);
            this._courseSyncDatePickerOutsideHandler = null;
        }
    }

    bindCourseSyncDatePickerOutsideClick() {
        if (this._courseSyncDatePickerOutsideHandler) {
            document.removeEventListener('mousedown', this._courseSyncDatePickerOutsideHandler);
        }
        this._courseSyncDatePickerOutsideHandler = event => {
            const picker = document.getElementById('courseSyncRangePicker');
            const popover = document.getElementById('courseSyncDatePopover');
            if (!popover || popover.style.display === 'none' || (picker && picker.contains(event.target))) return;
            this.closeCourseSyncDatePicker();
        };
        document.addEventListener('mousedown', this._courseSyncDatePickerOutsideHandler);
    }

    changeCourseSyncCalendarMonth(delta) {
        const base = this._courseSyncCalendarMonth || new Date();
        this._courseSyncCalendarMonth = new Date(base.getFullYear(), base.getMonth() + delta, 1);
        this.renderCourseSyncDatePicker();
    }

    renderCourseSyncDatePicker() {
        const title = document.getElementById('courseSyncCalendarTitle');
        const grid = document.getElementById('courseSyncCalendarGrid');
        if (!title || !grid) return;
        const month = this._courseSyncCalendarMonth || new Date();
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - monthStart.getDay());
        const storedStart = this.parseDateInputValue(document.getElementById('courseSyncStartDate').value);
        const storedEnd = this.parseDateInputValue(document.getElementById('courseSyncEndDate').value);
        const rangeStart = this._pendingCourseSyncStartDate || storedStart;
        const rangeEnd = this._pendingCourseSyncStartDate || storedEnd;
        title.textContent = `${month.getFullYear()}年${month.getMonth() + 1}月`;
        grid.innerHTML = '';
        for (let index = 0; index < 42; index++) {
            const day = new Date(gridStart);
            day.setDate(gridStart.getDate() + index);
            day.setHours(0, 0, 0, 0);
            const dayKey = this.formatLocalDate(day);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'stats-calendar-day';
            button.textContent = String(day.getDate());
            if (day.getMonth() !== month.getMonth()) button.classList.add('other-month');
            if (rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd) button.classList.add('in-range');
            if ((rangeStart && day.getTime() === rangeStart.getTime()) || (rangeEnd && day.getTime() === rangeEnd.getTime())) {
                button.classList.add('range-edge');
            }
            button.addEventListener('click', () => this.selectCourseSyncCalendarDate(dayKey));
            grid.appendChild(button);
        }
    }

    selectCourseSyncCalendarDate(dateValue) {
        const picked = this.parseDateInputValue(dateValue);
        if (!picked) return;
        if (!this._pendingCourseSyncStartDate) {
            this._pendingCourseSyncStartDate = picked;
            document.getElementById('courseSyncRangeText').textContent =
                `${this.formatLocalDate(picked)} → 请选择结束日期`;
            this.renderCourseSyncDatePicker();
            return;
        }
        const start = this._pendingCourseSyncStartDate <= picked ? this._pendingCourseSyncStartDate : picked;
        const end = this._pendingCourseSyncStartDate <= picked ? picked : this._pendingCourseSyncStartDate;
        document.getElementById('courseSyncStartDate').value = this.formatLocalDate(start);
        document.getElementById('courseSyncEndDate').value = this.formatLocalDate(end);
        this.updateCourseSyncRangeText();
        this.closeCourseSyncDatePicker();
    }

    updateCourseSyncRangeText() {
        const start = document.getElementById('courseSyncStartDate').value;
        const end = document.getElementById('courseSyncEndDate').value;
        document.getElementById('courseSyncRangeText').textContent = start && end ? `${start}  →  ${end}` : '请选择同步起点和终点';
    }

    hasManualSyncData(startDate, endDate) {
        const erp = window.ScheduleErpService.ensureErpData(this);
        const inRange = value => String(value || '') >= startDate && String(value || '') <= endDate;
        if ((erp.attendanceRecords || []).some(record =>
            inRange(record.dateKey) && record.source === 'manual'
        )) return true;
        return (erp.courseInstances || []).some(instance => {
            if (!instance || instance.source === 'course-import' || !instance.weekStart || !instance.cellKey) return false;
            const day = Number(String(instance.cellKey).split('-')[0]);
            if (!Number.isFinite(day) || day < 1 || day > 7) return false;
            const weekStart = this.parseDateInputValue(instance.weekStart);
            if (!weekStart) return false;
            return inRange(this.formatLocalDate(this.addDays(weekStart, day - 1)));
        });
    }

    async startCourseSync(range = null) {
        const startDate = range ? range.startDate : document.getElementById('courseSyncStartDate').value;
        const endDate = range ? range.endDate : document.getElementById('courseSyncEndDate').value;
        const message = document.getElementById('courseLoginMessage');
        const automatic = !!(range && range.automatic);
        let overwriteManual = false;
        if (startDate && endDate && !automatic && this.hasManualSyncData(startDate, endDate)) {
            overwriteManual = await window.showAppConfirm(
                '所选同步范围内存在手动修改的课程、出勤数据或人员名单。是否完全使用线上数据覆盖？\n\n确定：清空该范围后重新导入，线上没有的手动课程也会删除。\n取消：保留手动修改，并继续合并同步。'
            );
        }
        this._courseSyncPreserveManual = automatic || !overwriteManual;
        this._courseSyncAttendanceOnly = !!(range && range.attendanceOnly);
        this._courseSyncReplaceRange = overwriteManual && !this._courseSyncAttendanceOnly
            ? { startDate, endDate }
            : null;
        if (!startDate || !endDate) { message.textContent = '请先选择同步日期范围。'; return; }
        const result = await window.electronAPI.startCourseSync({
            startDate,
            endDate,
            attendanceOnly: this._courseSyncAttendanceOnly
        });
        if (!result || !result.started) { message.textContent = result && result.message ? result.message : '无法开始同步。'; return; }
        this._courseSyncRunning = true;
        document.getElementById('courseSyncStartBtn').disabled = true;
        document.getElementById('courseSyncTodayBtn').disabled = true;
        document.getElementById('courseSyncStopBtn').disabled = false;
        message.textContent = '正在读取基础课程信息…';
    }

    async stopCourseSync() {
        await window.electronAPI.stopCourseSync();
        document.getElementById('courseLoginMessage').textContent = '正在停止同步…';
    }

    toggleCourseAutoSync() {
        const button = document.getElementById('courseAutoSyncToggle');
        button.classList.toggle('active');
        this.saveCourseAutoSyncSettings();
    }

    saveCourseAutoSyncSettings() {
        const enabled = document.getElementById('courseAutoSyncToggle').classList.contains('active');
        localStorage.setItem('courseAutoSyncSettings', JSON.stringify({ enabled, intervalHours: 2 }));
        this.renderCourseAutoSyncSettings();
    }

    renderCourseAutoSyncSettings() {
        let settings = { enabled: false, intervalHours: 2 };
        try { settings = { ...settings, ...JSON.parse(localStorage.getItem('courseAutoSyncSettings') || '{}') }; } catch (_) {}
        const toggle = document.getElementById('courseAutoSyncToggle');
        toggle.classList.toggle('active', !!settings.enabled);
        toggle.setAttribute('aria-pressed', settings.enabled ? 'true' : 'false');
    }

    syncTodayCourses(automatic = false) {
        const today = this.formatLocalDate(new Date());
        return this.startCourseSync({
            startDate: today,
            endDate: today,
            automatic,
            attendanceOnly: true
        });
    }

    getCourseAutoSyncRange(now, lastRunAt) {
        const today = this.formatLocalDate(now);
        const lastRun = lastRunAt > 0 ? new Date(lastRunAt) : null;
        const alreadyRanToday = lastRun && this.formatLocalDate(lastRun) === today;
        return {
            startDate: alreadyRanToday ? today : this.formatLocalDate(this.addDays(now, -2)),
            endDate: today,
            automatic: true,
            attendanceOnly: true
        };
    }

    async handleCourseSyncEvent(event) {
        const message = document.getElementById('courseLoginMessage');
        const submit = document.getElementById('courseLoginSubmitBtn');
        if (!event || !event.type) return;
        if (event.type === 'restore-missing') return;
        if (event.type === 'check-basic') {
            this._courseCheckNetworkCourses = new Map();
            (event.courses || []).forEach(course => {
                const key = this.getNetworkCourseCheckKey(course);
                if (key) this._courseCheckNetworkCourses.set(key, course);
            });
            this.renderCourseCheckResults([...this._courseCheckNetworkCourses.values()], false);
            const total = this._courseCheckNetworkCourses.size;
            document.getElementById('courseCheckStatus').textContent =
                `课程列表初检完成，正在检查考勤（0/${total}）…`;
            return;
        }
        if (event.type === 'check-progress') {
            document.getElementById('courseCheckStatus').textContent =
                `课程列表初检完成，正在检查第 ${event.current}/${event.total} 节课程的考勤详情…`;
            return;
        }
        if (event.type === 'check-attendance') {
            if (!this._courseCheckNetworkCourses) this._courseCheckNetworkCourses = new Map();
            event.course.__attendanceLoaded = true;
            const key = this.getNetworkCourseCheckKey(event.course || {});
            if (key) this._courseCheckNetworkCourses.set(key, event.course);
            this.renderCourseCheckResults(
                [...this._courseCheckNetworkCourses.values()],
                true
            );
            document.getElementById('courseCheckStatus').textContent =
                `已检查 ${event.current}/${event.total} 节课程：学生出勤、请假/缺勤及实际上课时长`;
            return;
        }
        if (event.type === 'check-done') {
            this._courseCheckRunning = false;
            this._courseSyncRunning = false;
            document.getElementById('courseCheckRunBtn').disabled = false;
            const completedCourses = [...(this._courseCheckNetworkCourses || new Map()).values()];
            this.renderCourseCheckResults(
                completedCourses,
                true
            );
            this._courseCheckLastResult = {
                range: this._courseCheckRange ? { ...this._courseCheckRange } : null,
                courses: completedCourses,
                completedAt: new Date().toISOString()
            };
            const completedRecord = this._courseCheckRunId && document.getElementById(this._courseCheckRunId);
            if (completedRecord) {
                completedRecord.classList.remove('is-running');
                const state = completedRecord.querySelector('.course-check-record-title span');
                if (state) state.textContent = `完成 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
            }
            this._courseCheckNetworkCourses = null;
            this._courseCheckRunId = null;
            return;
        }
        if (event.type === 'check-result') {
            this._courseCheckRunning = false;
            this._courseSyncRunning = false;
            document.getElementById('courseCheckRunBtn').disabled = false;
            this.renderCourseCheckResults(event.courses || [], true);
            return;
        }
        if (event.type === 'login') {
            this._courseLoggedIn = true;
            document.getElementById('courseCredentialsPanel').style.display = 'none';
            document.getElementById('courseLoggedInPanel').style.display = 'block';
            document.getElementById('courseExclusiveTitle').textContent = `尊贵的定制版用户「${event.teacherName || ''}」你好`;
            submit.disabled = false;
            submit.textContent = '登录';
            message.textContent = '';
            this.checkCourseAutoSync();
            if (this._openCourseCheckAfterLogin) {
                this._openCourseCheckAfterLogin = false;
                this.closeCourseLoginModal();
                setTimeout(() => this.openCourseCheckModal(), 0);
            }
            return;
        }
        if (event.type === 'basic') {
            const result = { textContent: '' };
            if (this._courseSyncReplaceRange) {
                const replaceRange = this._courseSyncReplaceRange;
                this._courseSyncReplaceRange = null;
                window.CourseDataImportService.clearCoursesInRange(
                    this,
                    this.parseDateInputValue(replaceRange.startDate),
                    this.parseDateInputValue(replaceRange.endDate)
                );
                this.saveData();
            }
            if (!Array.isArray(event.courses) || event.courses.length === 0) {
                message.textContent = '登录成功，但所选日期范围内没有课程。';
                return;
            }
            await this.importCourseDataText(event.courses, result, true, {
                updateExisting: true,
                preserveManual: this._courseSyncPreserveManual !== false,
                singleOccurrence: true
            });
            message.textContent = `${result.textContent}，正在逐节检查考勤…`;
            return;
        }
        if (event.type === 'progress') {
            message.textContent = `正在检查第 ${event.current}/${event.total} 节课的考勤…`;
            return;
        }
        if (event.type === 'attendance') {
            const result = { textContent: '' };
            await this.importCourseDataText([event.course], result, true, {
                updateExisting: true,
                preserveManual: this._courseSyncPreserveManual !== false,
                onlyExisting: this._courseSyncAttendanceOnly,
                singleOccurrence: true
            });
            message.textContent = `已更新第 ${event.current}/${event.total} 节课的考勤和实际时长`;
            return;
        }
        submit.disabled = false;
        submit.textContent = '登录';
        if (event.type === 'done') {
            message.textContent = `同步完成，共检查 ${event.total} 节课。`;
            this._courseSyncRunning = false;
            document.getElementById('courseSyncStartBtn').disabled = false;
            document.getElementById('courseSyncTodayBtn').disabled = false;
            document.getElementById('courseSyncStopBtn').disabled = true;
        } else if (event.type === 'stopped') {
            message.textContent = `同步已停止，已检查 ${event.current || 0}/${event.total || 0} 节课。`;
            this._courseSyncRunning = false;
            document.getElementById('courseSyncStartBtn').disabled = false;
            document.getElementById('courseSyncTodayBtn').disabled = false;
            document.getElementById('courseSyncStopBtn').disabled = true;
        } else if (event.type === 'stopping') {
            message.textContent = '正在停止同步…';
        } else if (event.type === 'error') {
            if (this._courseCheckRunning) {
                this._courseCheckRunning = false;
                this._courseSyncRunning = false;
                document.getElementById('courseCheckRunBtn').disabled = false;
                const failedRecord = this._courseCheckRunId && document.getElementById(this._courseCheckRunId);
                if (failedRecord) {
                    failedRecord.classList.remove('is-running');
                    const state = failedRecord.querySelector('.course-check-record-title span');
                    if (state) state.textContent = '检查失败';
                }
                this._courseCheckRunId = null;
                document.getElementById('courseCheckStatus').textContent = `检查失败：${event.message || '未知错误'}`;
                return;
            }
            message.textContent = `同步失败：${event.message || '未知错误'}`;
            document.getElementById('courseSyncStartBtn').disabled = false;
            document.getElementById('courseSyncTodayBtn').disabled = false;
            document.getElementById('courseSyncStopBtn').disabled = true;
        }
    }

    checkCourseAutoSync() {
        if (!this._courseLoggedIn || this._courseSyncRunning) return;
        let settings;
        try { settings = JSON.parse(localStorage.getItem('courseAutoSyncSettings') || '{}'); } catch (_) { return; }
        if (!settings.enabled) return;
        const now = new Date();
        const lastRun = Number(localStorage.getItem('courseAutoSyncLastRunAt')) || 0;
        const intervalMs = 2 * 60 * 60 * 1000;
        if (now.getTime() - lastRun < intervalMs) return;
        localStorage.setItem('courseAutoSyncLastRunAt', String(now.getTime()));
        this.startCourseSync(this.getCourseAutoSyncRange(now, lastRun));
    }

    async logoutCourseAccount() {
        if (this._courseSyncRunning) await this.stopCourseSync();
        await window.electronAPI.courseLogout();
        localStorage.setItem('courseAutoLogin', 'false');
        localStorage.setItem('courseSavePassword', 'false');
        this._courseLoggedIn = false;
        this._openCourseCheckAfterLogin = false;
        this._courseSyncRunning = false;
        document.getElementById('courseLoggedInPanel').style.display = 'none';
        document.getElementById('courseCredentialsPanel').style.display = 'block';
        document.getElementById('courseLoginPassword').value = '';
        document.getElementById('courseAutoLoginOption').checked = false;
        document.getElementById('courseSavePasswordOption').checked = false;
        document.getElementById('courseLoginMessage').textContent = '已退出登录。';
        document.getElementById('courseLoginSubmitBtn').disabled = false;
        document.getElementById('courseLoginSubmitBtn').textContent = '登录';
        document.getElementById('courseLoginAccount').focus();
    }


    getAuditionStudentAssignedKeys(studentId, excludeKeys = []) {
        const student = this.students.find(s => String(s.id) === String(studentId));
        if (!student || !student.isAudition) {
            return [];
        }
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const assignedKeys = [];
        const keys = this.erpData && Array.isArray(this.erpData.courseInstances)
            ? [...new Set(this.erpData.courseInstances
                .filter(instance => instance.cellKey && !instance.isDeleted)
                .map(instance => instance.cellKey))]
            : Object.keys(this.timetable || {});
        for (const key of keys) {
            if (excludeKeys.includes(key)) continue;
            const effectiveVersion = this.getCellVersion(key, weekStartStr);
            if (effectiveVersion && effectiveVersion.student && effectiveVersion.student.includes(String(studentId))) {
                assignedKeys.push(key);
            }
        }
        return assignedKeys;
    }

    getAuditionStudentConflictMessage(studentId, assignedKeys = null) {
        const student = this.students.find(s => String(s.id) === String(studentId));
        const studentName = student ? student.name : '未知';
        const keys = Array.isArray(assignedKeys)
            ? assignedKeys
            : this.getAuditionStudentAssignedKeys(studentId);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        const schedules = [...new Set(keys)].map(key => {
            const parsed = this.parseCellKey(key);
            const occurrenceDate = this.getCellOccurrenceDate(weekStartStr, key);
            if (!parsed || !occurrenceDate) return null;
            const period = this.getPeriod(parsed.periodIndex);
            const dateText = `${occurrenceDate.getFullYear()}年${occurrenceDate.getMonth() + 1}月${occurrenceDate.getDate()}日`;
            const weekdayText = weekdayNames[parsed.day - 1] || '';
            const periodName = period && period.name ? period.name : `第${parsed.periodIndex + 1}节`;
            const timeText = period && period.time ? `（${period.time}）` : '';
            return {
                day: parsed.day,
                periodIndex: parsed.periodIndex,
                text: `${dateText}（${weekdayText}）${periodName}${timeText}`
            };
        }).filter(Boolean).sort((a, b) => a.day - b.day || a.periodIndex - b.periodIndex);

        if (schedules.length === 0) {
            return `试听学生「${studentName}」已排在其他课程中，不可重复排课`;
        }

        const details = schedules.map(schedule => `• ${schedule.text}`).join('\n');
        return `试听学生「${studentName}」已经排课：\n${details}\n试听学生不可重复排课。`;
    }

    hasAuditionStudentEverScheduled(studentId, excludeKeys = []) {
        const student = this.students.find(s => String(s.id) === String(studentId));
        if (!student || !student.isAudition) {
            return false;
        }

        if (this.erpData && Array.isArray(this.erpData.courseInstances)) {
            return this.erpData.courseInstances.some(instance => {
                if (!instance || !instance.cellKey || excludeKeys.includes(instance.cellKey)) {
                    return false;
                }
                const weekStart = instance.weekStart || this.formatLocalDate(this.getWeekRange(this.currentDate).start);
                const version = this.getCellVersion(instance.cellKey, weekStart);
                if (version && Array.isArray(version.student) && version.student.includes(String(studentId))) {
                    return true;
                }
                return Array.isArray(instance.studentIds) && instance.studentIds.includes(String(studentId));
            });
        }

        return Object.keys(this.timetable || {}).some(key => {
            if (excludeKeys.includes(key)) return false;
            const cell = this.timetable[key];
            const versions = cell && cell.versions ? Object.values(cell.versions) : [];
            return versions.some(version =>
                version && Array.isArray(version.student) && version.student.includes(String(studentId))
            );
        });
    }

    hasStudentEverScheduled(studentId, excludeKeys = []) {
        const normalizedId = String(studentId);
        const erp = this.erpData || {};
        const instances = Array.isArray(erp.courseInstances) ? erp.courseInstances : [];
        const relations = Array.isArray(erp.studentCourseRelations) ? erp.studentCourseRelations : [];

        if (relations.some(relation => String(relation.studentId) === normalizedId)) {
            return true;
        }

        if (instances.some(instance => {
            if (!instance || !instance.cellKey || excludeKeys.includes(instance.cellKey)) return false;
            if (Array.isArray(instance.studentIds) && instance.studentIds.map(String).includes(normalizedId)) return true;
            const weekStart = instance.weekStart || this.formatLocalDate(this.getWeekRange(this.currentDate).start);
            const version = this.getCellVersion(instance.cellKey, weekStart);
            return !!(version && Array.isArray(version.student) && version.student.map(String).includes(normalizedId));
        })) {
            return true;
        }

        return Object.keys(this.timetable || {}).some(key => {
            if (excludeKeys.includes(key)) return false;
            const cell = this.timetable[key];
            const versions = cell && cell.versions ? Object.values(cell.versions) : [cell];
            return versions.some(version =>
                version && Array.isArray(version.student) && version.student.map(String).includes(normalizedId)
            );
        });
    }

    // 确保试听学生以临时模式存在于课表中（只出现在当前周，不参与循环）
    ensureAuditionStudentsTemporary(key, studentIds) {
        for (const studentId of studentIds) {
            const student = this.students.find(s => s.id === studentId);
            if (student && student.isAudition) {
                this.setStudentRecurrence(key, studentId, 'temporary');
            }
        }
    }

    ensureUncategorizedSubject() {
        const teacherSubjectId = this.settings && this.settings.teacherSubjectId;
        if (teacherSubjectId) {
            const teacherSubject = this.subjects.find(s => String(s.id) === String(teacherSubjectId));
            if (teacherSubject) return teacherSubject;
        }
        let subject = this.subjects.find(s => s && s.name === '未分类');
        if (subject) return subject;

        subject = {
            id: Date.now().toString(),
            name: '未分类',
            teacher: '',
            color: '#E5E7EB'
        };
        this.subjects.push(subject);
        return subject;
    }

    saveData() {
        if (typeof this.invalidateStatsCache === 'function') this.invalidateStatsCache();
        const data = {
            subjects: this.subjects,
            students: this.students,
            manualCourses: this.manualCourses,
            periods: this.periods,
            erpData: this.erpData,
            quickSettingsState: this.quickSettingsState
        };
        let serialized = '';
        let backupWritten = false;
        try {
            serialized = JSON.stringify(data);
            const previous = localStorage.getItem('timetableData');
            const backupAt = Number(localStorage.getItem('timetableDataBackupAt')) || 0;
            const shouldRefreshBackup = previous
                && (!localStorage.getItem('timetableDataBackup') || Date.now() - backupAt >= TIMETABLE_BACKUP_INTERVAL_MS);
            if (shouldRefreshBackup) {
                try {
                    // The primary snapshot was validated by loadData (or produced by
                    // the last successful save), so copying it does not need another
                    // expensive JSON.parse on the UI thread.
                    localStorage.setItem('timetableDataBackup', previous);
                    backupWritten = true;
                    localStorage.setItem('timetableDataBackupAt', String(Date.now()));
                } catch (_) {
                    // A backup quota failure must not prevent the smaller primary
                    // update from being attempted.
                }
            }
            localStorage.setItem('timetableData', serialized);
            return true;
        } catch (e) {
            if (backupWritten) {
                try {
                    localStorage.removeItem('timetableDataBackup');
                    localStorage.removeItem('timetableDataBackupAt');
                    localStorage.setItem('timetableData', serialized);
                    return true;
                } catch (_) {
                    // Continue to the visible failure below.
                }
            }
            alert('保存失败：存储空间不足。本次修改已撤回并恢复到最后成功保存的状态，请先导出备份或清理旧数据。');
            console.error('保存数据失败:', e);
            this.restoreRuntimeDataSnapshot(localStorage.getItem('timetableData'));
            return false;
        }
    }

    restoreRuntimeDataSnapshot(serialized) {
        if (!serialized) return false;
        try {
            const parsed = JSON.parse(serialized);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
            this.subjects = Array.isArray(parsed.subjects) && parsed.subjects.length ? parsed.subjects : createDefaultSubjects();
            this.students = Array.isArray(parsed.students) ? parsed.students : [];
            this.manualCourses = Array.isArray(parsed.manualCourses) ? parsed.manualCourses : [];
            this.erpData = parsed.erpData || (window.createEmptyErpData ? window.createEmptyErpData() : null);
            this.periods = this.normalizePeriods(parsed.periods || createDefaultPeriods());
            this.quickSettingsState = parsed.quickSettingsState || createDefaultQuickSettings();
            window.ScheduleErpService.ensureErpData(this);
            window.ScheduleErpService.buildTimetableProjection(this);
            if (typeof this.invalidateStatsCache === 'function') this.invalidateStatsCache();
            return true;
        } catch (error) {
            console.error('恢复最后成功保存的数据失败:', error);
            return false;
        }
    }

    loadData() {
        const primaryData = localStorage.getItem('timetableData');
        const backupData = localStorage.getItem('timetableDataBackup');
        let hasValidSubjects = false;
        let parsed = null;

        if (primaryData) {
            try {
                parsed = JSON.parse(primaryData);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = null;
            } catch (error) {
                console.error('主课表数据损坏，尝试恢复备份:', error);
            }
        }
        if (!parsed && backupData) {
            try {
                parsed = JSON.parse(backupData);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = null;
                if (parsed) localStorage.setItem('timetableData', backupData);
            } catch (error) {
                console.error('课表备份数据也无法读取:', error);
                parsed = null;
            }
        }

        if (parsed) {
            this.students = Array.isArray(parsed.students) ? parsed.students : [];
            this.manualCourses = Array.isArray(parsed.manualCourses) ? parsed.manualCourses : [];
            this.erpData = parsed.erpData || null;
            this._legacyPeriodsForMigration = parsed.periods && !Array.isArray(parsed.periods) ? parsed.periods : null;
            this.periods = parsed.periods || this.periods;
            this.quickSettingsState = parsed.quickSettingsState || createDefaultQuickSettings();

            if (parsed.subjects && Array.isArray(parsed.subjects) && parsed.subjects.length > 0) {
                this.subjects = parsed.subjects;
                hasValidSubjects = true;
            }
        }

        if (!hasValidSubjects) {
            this.subjects = createDefaultSubjects();
        }

        this.periods = this.normalizePeriods(this.periods);
        this.migrateLegacyScheduleKeys();

        window.ScheduleErpService.ensureErpData(this);
        const removedSubjectOnlyCourses = window.ScheduleErpService.removeSubjectOnlyCourses(this);
        window.ScheduleErpService.buildTimetableProjection(this);
        if (removedSubjectOnlyCourses) this.saveData();
    }
    syncRealtime(options = {}) {
        window.ScheduleErpService.ensureErpData(this);
        window.ScheduleErpService.completeStudentsForEndedStages(this);
        window.ScheduleErpService.buildTimetableProjection(this);
        this.saveData();
        if (options.timetable !== false) {
            this.renderTimetable();
        }
        if (options.subjects !== false) {
            this.renderSubjects();
        }
        if (options.weekRange) {
            this.updateWeekRange();
        }
        const statsModal = document.getElementById('statsModal');
        if (statsModal && statsModal.style.display === 'block' && typeof this.onStatsDateChange === 'function') {
            this.onStatsDateChange();
        }
        const textStatsModal = document.getElementById('textStatsModal');
        if (textStatsModal && textStatsModal.style.display === 'block' && typeof this.renderTextStatsModal === 'function') {
            this.renderTextStatsModal();
        }
    }

    refreshOpenStatsViews() {
        const statsModal = document.getElementById('statsModal');
        if (statsModal && statsModal.style.display === 'block' && typeof this.onStatsDateChange === 'function') {
            this.onStatsDateChange();
        }
        const textStatsModal = document.getElementById('textStatsModal');
        if (textStatsModal && textStatsModal.style.display === 'block' && typeof this.renderTextStatsModal === 'function') {
            this.renderTextStatsModal();
        }
    }

    openResetModal() {
        const modal = document.getElementById('resetModal');
        if (modal) {
            const startInput = document.getElementById('customResetStartDate');
            const endInput = document.getElementById('customResetEndDate');
            const referenceDate = this.currentDate || new Date();
            const weekRange = this.getWeekRange(referenceDate);
            if (startInput) startInput.value = this.formatLocalDate(weekRange.start);
            if (endInput) endInput.value = this.formatLocalDate(weekRange.end);
            this.syncSharedDateRangeLabel('reset');
            modal.style.display = 'block';
        }
    }

    closeResetModal() {
        this.closeSharedDateRangePicker('reset');
        const modal = document.getElementById('resetModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    parseDateInputValue(value) {
        if (!value) return null;
        const [year, month, day] = String(value).split('-').map(Number);
        if (!year || !month || !day) return null;
        const date = new Date(year, month - 1, day);
        if (Number.isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        return date;
    }

    getSharedDateRangeConfig(scope) {
        const configs = {
            reset: {
                rootId: 'resetDateRangePicker', startId: 'customResetStartDate', endId: 'customResetEndDate',
                textId: 'resetDateRangeText', popoverId: 'resetDatePopover',
                titleId: 'resetCalendarTitle', gridId: 'resetCalendarGrid'
            },
            lessonSheet: {
                rootId: 'lessonSheetDateRangePicker', startId: 'lessonSheetStartDate', endId: 'lessonSheetEndDate',
                textId: 'lessonSheetDateRangeText', popoverId: 'lessonSheetDatePopover',
                titleId: 'lessonSheetCalendarTitle', gridId: 'lessonSheetCalendarGrid'
            }
        };
        if (configs[scope]) return configs[scope];
        if (scope.startsWith('stage-')) {
            const id = scope.slice(6);
            return {
                rootId: `stageRange-${id}`, startId: `stageStart-${id}`, endId: `stageEnd-${id}`,
                textId: `stageRangeText-${id}`, popoverId: `stagePopover-${id}`,
                titleId: `stageCalendarTitle-${id}`, gridId: `stageCalendarGrid-${id}`
            };
        }
        return null;
    }

    formatSharedDateRangeLabel(startDate, endDate) {
        const format = date => `${date.getFullYear()}年${date.getMonth() + 1}月${String(date.getDate()).padStart(2, '0')}日`;
        return `${format(startDate)}-${format(endDate)}`;
    }

    syncSharedDateRangeLabel(scope) {
        const config = this.getSharedDateRangeConfig(scope);
        if (!config) return;
        const startInput = document.getElementById(config.startId);
        const endInput = document.getElementById(config.endId);
        const label = document.getElementById(config.textId);
        if (!label) return;
        const start = this.parseDateInputValue(startInput ? startInput.value : '');
        const end = this.parseDateInputValue(endInput ? endInput.value : '');
        label.textContent = start && end ? this.formatSharedDateRangeLabel(start, end) : '请选择日期范围';
    }

    toggleSharedDateRangePicker(scope) {
        const config = this.getSharedDateRangeConfig(scope);
        if (!config) return;
        const popover = document.getElementById(config.popoverId);
        if (!popover) return;
        if (popover.style.display !== 'none' && popover.style.display) {
            this.closeSharedDateRangePicker(scope);
            return;
        }

        if (this._activeSharedDateRangeScope && this._activeSharedDateRangeScope !== scope) {
            this.closeSharedDateRangePicker(this._activeSharedDateRangeScope);
        }
        const startInput = document.getElementById(config.startId);
        const start = this.parseDateInputValue(startInput ? startInput.value : '') || new Date();
        this._sharedDateRangeState = this._sharedDateRangeState || {};
        this._sharedDateRangeState[scope] = {
            month: new Date(start.getFullYear(), start.getMonth(), 1),
            pendingStart: null
        };
        this._activeSharedDateRangeScope = scope;
        popover.style.display = 'block';
        this.renderSharedDateRangePicker(scope);
        setTimeout(() => this.bindSharedDateRangeOutsideClick(scope), 0);
    }

    closeSharedDateRangePicker(scope) {
        const config = this.getSharedDateRangeConfig(scope);
        if (config) {
            const popover = document.getElementById(config.popoverId);
            const root = document.getElementById(config.rootId);
            if (popover) {
                popover.style.display = 'none';
                if (root && popover.parentElement !== root) root.appendChild(popover);
            }
        }
        if (this._sharedDateRangeState && this._sharedDateRangeState[scope]) {
            this._sharedDateRangeState[scope].pendingStart = null;
        }
        if (this._sharedDateRangeOutsideHandler) {
            document.removeEventListener('mousedown', this._sharedDateRangeOutsideHandler);
            this._sharedDateRangeOutsideHandler = null;
        }
        if (this._activeSharedDateRangeScope === scope) this._activeSharedDateRangeScope = null;
    }

    bindSharedDateRangeOutsideClick(scope) {
        if (this._sharedDateRangeOutsideHandler) {
            document.removeEventListener('mousedown', this._sharedDateRangeOutsideHandler);
        }
        this._sharedDateRangeOutsideHandler = event => {
            const config = this.getSharedDateRangeConfig(scope);
            const root = config ? document.getElementById(config.rootId) : null;
            const popover = config ? document.getElementById(config.popoverId) : null;
            if (root && root.contains(event.target)) return;
            if (popover && popover.contains(event.target)) return;
            this.closeSharedDateRangePicker(scope);
        };
        document.addEventListener('mousedown', this._sharedDateRangeOutsideHandler);
    }

    changeSharedCalendarMonth(scope, delta) {
        const state = this._sharedDateRangeState && this._sharedDateRangeState[scope];
        if (!state) return;
        state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
        this.renderSharedDateRangePicker(scope);
    }

    renderSharedDateRangePicker(scope) {
        const config = this.getSharedDateRangeConfig(scope);
        const state = this._sharedDateRangeState && this._sharedDateRangeState[scope];
        if (!config || !state) return;
        const title = document.getElementById(config.titleId);
        const grid = document.getElementById(config.gridId);
        if (!title || !grid) return;

        const month = state.month;
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - monthStart.getDay());
        const startInput = document.getElementById(config.startId);
        const endInput = document.getElementById(config.endId);
        const startDate = state.pendingStart || this.parseDateInputValue(startInput ? startInput.value : '');
        const endDate = state.pendingStart || this.parseDateInputValue(endInput ? endInput.value : '');

        title.textContent = `${month.getFullYear()}年${month.getMonth() + 1}月`;
        grid.innerHTML = '';
        for (let index = 0; index < 42; index++) {
            const day = new Date(gridStart);
            day.setDate(gridStart.getDate() + index);
            day.setHours(0, 0, 0, 0);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'stats-calendar-day';
            button.textContent = String(day.getDate());
            if (day.getMonth() !== month.getMonth()) button.classList.add('other-month');
            if (startDate && endDate && day >= startDate && day <= endDate) button.classList.add('in-range');
            if ((startDate && day.getTime() === startDate.getTime()) || (endDate && day.getTime() === endDate.getTime())) {
                button.classList.add('range-edge');
            }
            const dateValue = this.formatLocalDate(day);
            button.addEventListener('click', () => this.selectSharedDateRangeDate(scope, dateValue));
            grid.appendChild(button);
        }
    }

    selectSharedDateRangeDate(scope, dateValue) {
        const config = this.getSharedDateRangeConfig(scope);
        const state = this._sharedDateRangeState && this._sharedDateRangeState[scope];
        const picked = this.parseDateInputValue(dateValue);
        if (!config || !state || !picked) return;
        if (!state.pendingStart) {
            state.pendingStart = picked;
            const label = document.getElementById(config.textId);
            if (label) label.textContent = `${picked.getFullYear()}年${picked.getMonth() + 1}月${String(picked.getDate()).padStart(2, '0')}日-请选择结束日期`;
            this.renderSharedDateRangePicker(scope);
            return;
        }

        const rangeStart = state.pendingStart <= picked ? state.pendingStart : picked;
        const rangeEnd = state.pendingStart <= picked ? picked : state.pendingStart;
        document.getElementById(config.startId).value = this.formatLocalDate(rangeStart);
        document.getElementById(config.endId).value = this.formatLocalDate(rangeEnd);
        this.syncSharedDateRangeLabel(scope);
        if (scope.startsWith('stage-') && typeof this.updateStageDateRange === 'function') {
            this.updateStageDateRange(scope.slice(6), this.formatLocalDate(rangeStart), this.formatLocalDate(rangeEnd));
        }
        this.closeSharedDateRangePicker(scope);
    }

    addDays(date, days) {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        next.setHours(0, 0, 0, 0);
        return next;
    }

    getWeekStartStrForDate(date) {
        return this.formatLocalDate(this.getWeekRange(date).start);
    }

    getCellDayOfWeek(cellKey) {
        const day = parseInt(String(cellKey || '').split('-')[0], 10);
        return Number.isInteger(day) && day >= 1 && day <= 7 ? day : null;
    }

    getCellOccurrenceDate(weekStartStr, cellKey) {
        const day = this.getCellDayOfWeek(cellKey);
        const weekStart = this.parseDateInputValue(weekStartStr);
        if (!day || !weekStart) return null;
        return this.addDays(weekStart, day - 1);
    }

    getFirstOccurrenceOnOrAfter(cellKey, startDate) {
        const day = this.getCellDayOfWeek(cellKey);
        if (!day || !startDate) return null;
        const targetJsDay = day === 7 ? 0 : day;
        const result = new Date(startDate);
        result.setHours(0, 0, 0, 0);
        const diff = (targetJsDay - result.getDay() + 7) % 7;
        result.setDate(result.getDate() + diff);
        return result;
    }

    getLastOccurrenceOnOrBefore(cellKey, endDate) {
        const day = this.getCellDayOfWeek(cellKey);
        if (!day || !endDate) return null;
        const targetJsDay = day === 7 ? 0 : day;
        const result = new Date(endDate);
        result.setHours(0, 0, 0, 0);
        const diff = (result.getDay() - targetJsDay + 7) % 7;
        result.setDate(result.getDate() - diff);
        return result;
    }

    getSortedCellWeekStarts(cellKey) {
        const erp = this.erpData && Array.isArray(this.erpData.courseInstances)
            ? this.erpData.courseInstances
            : [];
        return [...new Set(
            erp
                .filter(instance => instance && instance.cellKey === cellKey && instance.weekStart)
                .map(instance => instance.weekStart)
        )].sort((a, b) => a.localeCompare(b));
    }

    cloneVersionSnapshot(version) {
        if (!version) return null;
        return {
            ...version,
            student: Array.isArray(version.student) ? [...version.student] : [],
            actualMinutesByDate: version.actualMinutesByDate ? { ...version.actualMinutesByDate } : undefined
        };
    }

    findFirstWeekWithContent(cellKey, fromWeekStart, toWeekStart = null) {
        const candidates = [fromWeekStart, ...this.getSortedCellWeekStarts(cellKey)]
            .filter(Boolean)
            .filter(weekStart => weekStart >= fromWeekStart && (!toWeekStart || weekStart <= toWeekStart))
            .filter((weekStart, index, arr) => arr.indexOf(weekStart) === index)
            .sort((a, b) => a.localeCompare(b));

        for (const weekStart of candidates) {
            const version = this.getCellVersion(cellKey, weekStart);
            if (version && (version.subject || (version.student && version.student.length > 0))) {
                return weekStart;
            }
        }
        return null;
    }

    findLastWeekWithContent(cellKey, fromWeekStart, toWeekStart) {
        const candidates = [toWeekStart, ...this.getSortedCellWeekStarts(cellKey)]
            .filter(Boolean)
            .filter(weekStart => weekStart >= fromWeekStart && weekStart <= toWeekStart)
            .filter((weekStart, index, arr) => arr.indexOf(weekStart) === index)
            .sort((a, b) => b.localeCompare(a));

        for (const weekStart of candidates) {
            const version = this.getCellVersion(cellKey, weekStart);
            if (version && (version.subject || (version.student && version.student.length > 0))) {
                return weekStart;
            }
        }
        return null;
    }

    isDateWithinCustomResetRange(dateKey, startDate, endDate) {
        const date = this.parseDateInputValue(dateKey);
        if (!date) return false;
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
    }

    async resetScheduleByCustomRange() {
        const startInput = document.getElementById('customResetStartDate');
        const endInput = document.getElementById('customResetEndDate');
        const startDate = this.parseDateInputValue(startInput ? startInput.value : '');
        const endDate = this.parseDateInputValue(endInput ? endInput.value : '');

        if (!startDate && !endDate) {
            alert('请至少选择一个日期');
            return;
        }

        if (startDate && endDate && startDate > endDate) {
            alert('开始日期不能晚于结束日期');
            return;
        }

        let message = '确定要按所选日期范围清除课程吗？这会清空对应日期的排课、考勤和实际上课时长，其余课程保留。';
        if (startDate && !endDate) {
            message = '确定要清除此日期及以后所有课程吗？这会清空对应日期的排课、考勤和实际上课时长，其余课程保留。';
        } else if (!startDate && endDate) {
            message = '确定要清除此日期及以前所有课程吗？这会清空对应日期的排课、考勤和实际上课时长，其余课程保留。';
        }

        if (!await window.showAppConfirm(message)) {
            return;
        }

        const erp = window.ScheduleErpService.ensureErpData(this);
        const cellKeys = [...new Set(
            (erp.courseInstances || [])
                .map(instance => instance.cellKey)
                .filter(Boolean)
        )];

        let changed = false;

        cellKeys.forEach(cellKey => {
            const weekStarts = this.getSortedCellWeekStarts(cellKey);
            if (weekStarts.length === 0) return;

            const earliestWeekStart = weekStarts[0];
            const earliestOccurrenceDate = this.getCellOccurrenceDate(earliestWeekStart, cellKey);
            if (!earliestOccurrenceDate) return;

            const lowerDate = startDate || earliestOccurrenceDate;
            const upperDate = endDate || null;
            const firstCandidateDate = this.getFirstOccurrenceOnOrAfter(cellKey, lowerDate);
            const lastCandidateDate = upperDate ? this.getLastOccurrenceOnOrBefore(cellKey, upperDate) : null;

            if (!firstCandidateDate) return;
            if (lastCandidateDate && firstCandidateDate > lastCandidateDate) return;
            if (!startDate && endDate && earliestOccurrenceDate > endDate) return;

            const searchFromWeekStart = startDate
                ? this.getWeekStartStrForDate(firstCandidateDate)
                : earliestWeekStart;
            const searchToWeekStart = lastCandidateDate
                ? this.getWeekStartStrForDate(lastCandidateDate)
                : null;

            const firstAffectedWeekStart = this.findFirstWeekWithContent(cellKey, searchFromWeekStart, searchToWeekStart);
            if (!firstAffectedWeekStart) return;

            const lastAffectedWeekStart = searchToWeekStart
                ? this.findLastWeekWithContent(cellKey, firstAffectedWeekStart, searchToWeekStart)
                : null;

            if (searchToWeekStart && !lastAffectedWeekStart) return;

            const restoreWeekStart = lastAffectedWeekStart
                ? this.getWeekStartStrForDate(this.addDays(this.parseDateInputValue(lastAffectedWeekStart), 7))
                : null;
            const restoreSnapshot = restoreWeekStart
                ? this.cloneVersionSnapshot(this.getCellVersion(cellKey, restoreWeekStart))
                : null;

            this.setCellVersion(cellKey, firstAffectedWeekStart, null, [], { cutoff: true });
            changed = true;

            if (restoreWeekStart && restoreSnapshot && (restoreSnapshot.subject || restoreSnapshot.student.length > 0)) {
                const restoredVersion = window.ScheduleErpService.restoreCellSnapshot(
                    this,
                    cellKey,
                    restoreWeekStart,
                    restoreSnapshot
                );
                if (restoredVersion) {
                    const restoredInstance = window.ScheduleErpService.getCourseInstanceForVersion(this, restoredVersion);
                    if (restoredInstance && restoreSnapshot.actualMinutesByDate) {
                        restoredInstance.actualMinutesByDate = Object.fromEntries(
                            Object.entries(restoreSnapshot.actualMinutesByDate).filter(([dateKey]) =>
                                !this.isDateWithinCustomResetRange(dateKey, startDate, endDate)
                            )
                        );
                    }
                }
            }
        });

        if (!changed) {
            alert('所选日期范围内没有可清除的课程');
            return;
        }

        erp.attendanceRecords = (erp.attendanceRecords || []).filter(record =>
            !this.isDateWithinCustomResetRange(record.dateKey, startDate, endDate)
        );

        (erp.courseInstances || []).forEach(instance => {
            if (!instance.actualMinutesByDate) return;
            instance.actualMinutesByDate = Object.fromEntries(
                Object.entries(instance.actualMinutesByDate).filter(([dateKey]) =>
                    !this.isDateWithinCustomResetRange(dateKey, startDate, endDate)
                )
            );
            instance.updatedAt = new Date().toISOString();
        });

        window.ScheduleErpService.buildTimetableProjection(this);
        this.closeResetModal();
        this.closeAttendanceModal();
        this.closeAddLessonModal();
        this.syncRealtime({ weekRange: true });
    }

    async resetScheduleOnly() {
        if (!await window.showAppConfirm('确定要重置课表吗？这会清空当前排课、循环和考勤数据，但保留科目、学生、手动课程、年级、课时和设置。')) {
            return;
        }

        const automaticallyCompletedStudentIds = new Set(
            ((this.erpData && this.erpData.stageCompletionRecords) || [])
                .flatMap(record => Array.isArray(record.studentIds) ? record.studentIds : [])
                .map(String)
        );
        this.students.forEach(student => {
            if (!automaticallyCompletedStudentIds.has(String(student.id))) return;
            student.completed = false;
            student.accountStatus = 'normal';
        });

        this.timetable = {};
        this.erpData = window.createEmptyErpData ? window.createEmptyErpData() : null;
        this.currentPool = 'subject';
        this.currentStudentFilter = 'ongoing';
        this.draggedItem = null;
        this.editingCell = null;
        this.selectedCell = null;
        this.editingEntityType = null;
        this._attModalStudents = null;
        this._attModalKey = null;
        this._attModalCellKey = null;
        this._attModalCourseInstanceId = null;
        this._attModalRecurrence = null;
        this._courseEditMatchedKeys = null;
        this.isTemporaryCourseEdit = false;
        this._temporaryCourseSourceVersion = null;

        window.ScheduleErpService.ensureErpData(this);
        window.ScheduleErpService.buildTimetableProjection(this);

        this.closeResetModal();
        this.closeAttendanceModal();
        this.closeAddLessonModal();
        this.syncRealtime({ weekRange: true });
    }

    async resetTimetable() {
        if (!await window.showAppConfirm('确定要重置课表吗？这会清空当前课表、学生、手动课程、考勤和循环数据。')) {
            return;
        }

        this.subjects = createDefaultSubjects();
        this.students = [];
        this.manualCourses = [];
        this.timetable = {};
        this.periods = createDefaultPeriods();
        this.settings = createDefaultSettings();
        this.grades = createDefaultGrades();
        this.erpData = window.createEmptyErpData ? window.createEmptyErpData() : null;
        this.quickSettingsState = createDefaultQuickSettings();
        this.currentPool = 'subject';
        this.currentStudentFilter = 'ongoing';
        this.currentDate = new Date();
        this.draggedItem = null;
        this.editingCell = null;
        this.editingSubject = null;
        this.editingEntityType = null;
        this.editingGrade = null;
        this.editingPeriod = null;
        this.selectedCell = null;
        this._attModalStudents = null;
        this._attModalKey = null;
        this._attModalCellKey = null;
        this._attModalCourseInstanceId = null;
        this._attModalRecurrence = null;
        this._courseEditMatchedKeys = null;
        this.isTemporaryCourseEdit = false;
        this._temporaryCourseSourceVersion = null;

        localStorage.removeItem('timetableData');
        localStorage.removeItem('timetableDataBackup');
        localStorage.removeItem('timetableDataBackupAt');
        localStorage.removeItem('timetableGrades');
        localStorage.removeItem('timetableSettings');
        localStorage.removeItem('timetableTitle');
        localStorage.removeItem('tableTitle');
        const timetableTitleInput = document.getElementById('timetableTitle');
        if (timetableTitleInput) {
            timetableTitleInput.value = '';
        }
        const tableTitleInput = document.getElementById('tableTitle');
        if (tableTitleInput) {
            tableTitleInput.value = '';
        }

        window.ScheduleErpService.ensureErpData(this);
        window.ScheduleErpService.buildTimetableProjection(this);

        this.saveGrades();
        this.saveSettings();
        this.syncRealtime({ weekRange: true });

        if (typeof this.renderGrades === 'function') {
            this.renderGrades();
        }
        this.applySettings();
        this.updateThemeSettingsUI();
        this.closeResetModal();
        this.closeAttendanceModal();
        this.closeAddLessonModal();
        this.closeSubjectModal();
        this.closeTimeModal();
        this.closeTimeManagementModal();
        this.closeSettingsModal();
        this.closeGradeModal();
    }

    updateWeekRange() {
        const range = this.getWeekRange(this.currentDate);
        const startDate = range.start;
        const endDate = range.end;
        
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${year}年${month}月${day}日`;
        };
        
        document.getElementById('currentWeekRange').textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;
        document.getElementById('currentWeekRange').style.cursor = 'pointer';
        document.getElementById('currentWeekRange').title = '点击查看课时统计';
        document.getElementById('currentWeekRange').onclick = () => this.openStatsModal(this.currentDate);

        const firstDay = new Date(startDate.getFullYear(), 0, 1);
        const weekNumber = Math.ceil((((startDate - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
        const weekNumberLabel = document.getElementById('weekNumber');
        if (weekNumberLabel) weekNumberLabel.textContent = `第 ${weekNumber} 周`;
        
        const datePicker = document.getElementById('datePicker');
        const currentDateStr = this.currentDate.toISOString().split('T')[0];
        datePicker.value = currentDateStr;
        
        this.updateDateRow();
    }
    
    updateDateRow() {
        const range = this.getWeekRange(this.currentDate);
        const startDate = range.start;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        document.querySelectorAll('.today-header').forEach(el => el.classList.remove('today-header'));
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            date.setHours(0, 0, 0, 0);
            
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dateCell = document.getElementById(`dateCell${i + 1}`);
            const headerCell = document.querySelector(`[data-day-header="${i + 1}"]`);
            
            if (dateCell) {
                dateCell.textContent = `${month}/${day}`;
                
                if (date.getTime() === today.getTime()) {
                    if (headerCell) {
                        headerCell.classList.add('today-header');
                    }
                }
            }
            
            if (headerCell) {
                headerCell.style.cursor = 'pointer';
                headerCell.onclick = () => {
                    this.showDayStats(date);
                };
            }
        }
        
        this.highlightTodayColumn();
    }
    
    highlightTodayColumn() {
        const range = this.getWeekRange(this.currentDate);
        const startDate = range.start;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        document.querySelectorAll('.today-col').forEach(el => el.classList.remove('today-col'));
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            date.setHours(0, 0, 0, 0);
            
            if (date.getTime() === today.getTime()) {
                const dayNum = i + 1;
                const cells = document.querySelectorAll(`[data-day="${dayNum}"]`);
                cells.forEach(cell => cell.classList.add('today-col'));
                break;
            }
        }
    }
    
    // ========== 综合课时统计（日/周/月/年/自定义） ==========

    timeToMinutes(timeStr) {
        const parts = timeStr.split(':');
        if (parts.length !== 2) return 0;
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    
    getLessonDuration(timeStr) {
        if (!timeStr) return '0';
        const parts = timeStr.split('-');
        if (parts.length !== 2) return '0';
        const start = this.timeToMinutes(parts[0]);
        const end = this.timeToMinutes(parts[1]);
        return ((end - start) / 60).toFixed(1).replace('.0', '');
    }

    // 判断一节课是否已经结束（当前时间已超过该节课的结束时间）
    // date: 参考日期（用于确定该节课所在的日期）
    isClassFinished(key, date) {
        const parsedKey = this.parseCellKey(key);
        if (!parsedKey) return true; // 无法解析，默认认为已结束
        const periodInfo = this.getPeriod(parsedKey.periodIndex);
        if (!periodInfo || !periodInfo.time) return true; // 无课时信息，默认认为已结束

        const classReferenceDate = new Date(date);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(classReferenceDate).start);
        const version = this.getCellVersion(key, weekStartStr);
        const instance = version && version.courseInstanceId && this.erpData
            ? (this.erpData.courseInstances || []).find(item => item.id === version.courseInstanceId)
            : null;
        const actualEndTime = instance
            && instance.isNonStandardTime
            && /^\d{1,2}:\d{2}$/.test(String(instance.actualEndTime || ''))
            ? instance.actualEndTime
            : null;
        const endTimeStr = actualEndTime || periodInfo.time.split('-')[1]; // e.g., "08:40"
        const [endH, endM] = endTimeStr.split(':').map(Number);

        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 构造该节课的日期（基于传入的参考日期）
        const classDate = new Date(date);
        classDate.setHours(0, 0, 0, 0);

        // 过去的日期 → 已结束
        if (classDate < today) return true;
        // 未来的日期 → 未结束
        if (classDate > today) return false;

        // 同一天，比较具体时间
        const classEndTime = new Date(date);
        classEndTime.setHours(endH, endM, 0, 0);
        return now >= classEndTime;
    }

    getWeekRange(date) {
        const currentDay = date.getDay();
        const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
        
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        return { start: startOfWeek, end: endOfWeek };
    }

    // ========== 版本化课表辅助方法 ==========

    // 统一的日期格式化：Date → "YYYY-MM-DD"
    formatLocalDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    normalizePeriods(periods) {
        if (Array.isArray(periods)) {
            return periods.map((period, index) => ({
                name: period && period.name ? period.name : `第${index + 1}节`,
                time: period && period.time ? period.time : '08:00-08:40'
            }));
        }

        const normalized = [];
        const legacy = periods && typeof periods === 'object' ? periods : {};
        ['morning', 'afternoon', 'evening'].forEach(section => {
            const list = Array.isArray(legacy[section]) ? legacy[section] : [];
            list.forEach(period => normalized.push({
                name: period && period.name ? period.name : `第${normalized.length + 1}节`,
                time: period && period.time ? period.time : '08:00-08:40'
            }));
        });

        return normalized.length > 0 ? normalized : createDefaultPeriods();
    }

    getLegacySectionOffset(periods, section) {
        const legacy = periods && typeof periods === 'object' ? periods : {};
        const morningCount = Array.isArray(legacy.morning) ? legacy.morning.length : 0;
        const afternoonCount = Array.isArray(legacy.afternoon) ? legacy.afternoon.length : 0;
        if (section === 'morning') return 0;
        if (section === 'afternoon') return morningCount;
        if (section === 'evening') return morningCount + afternoonCount;
        return 0;
    }

    migrateLegacyCellKey(cellKey, legacyPeriods = null) {
        const parts = String(cellKey || '').split('-');
        if (parts.length === 2) return cellKey;
        if (parts.length !== 3) return cellKey;
        const day = parseInt(parts[0], 10);
        const section = parts[1];
        const period = parseInt(parts[2], 10);
        if (!day || Number.isNaN(period)) return cellKey;
        const periodIndex = this.getLegacySectionOffset(legacyPeriods || this.periods, section) + period;
        return `${day}-${periodIndex}`;
    }

    buildCellKey(day, sectionOrPeriod, maybePeriod) {
        const dayNum = Number(day);
        let periodIndex;
        if (maybePeriod === undefined) {
            periodIndex = Number(sectionOrPeriod);
        } else {
            periodIndex = this.getLegacySectionOffset(this._legacyPeriodsForMigration || null, sectionOrPeriod) + Number(maybePeriod);
        }
        return `${dayNum}-${periodIndex}`;
    }

    parseCellKey(cellKey) {
        const parts = String(cellKey || '').split('-');
        if (parts.length === 2) {
            const day = parseInt(parts[0], 10);
            const periodIndex = parseInt(parts[1], 10);
            if (Number.isNaN(day) || Number.isNaN(periodIndex)) return null;
            return { day, periodIndex };
        }
        if (parts.length === 3) {
            const migrated = this.migrateLegacyCellKey(cellKey, this._legacyPeriodsForMigration || null);
            return this.parseCellKey(migrated);
        }
        return null;
    }

    getPeriod(periodOrSection, maybeIndex) {
        const periodIndex = maybeIndex === undefined
            ? Number(periodOrSection)
            : this.parseCellKey(this.buildCellKey(1, periodOrSection, maybeIndex)).periodIndex;
        return this.periods[periodIndex] || null;
    }

    getOrderedPeriods() {
        return this.periods.map((period, index) => ({
            period,
            index,
            periodNum: index + 1
        }));
    }

    getPeriodNumber(sectionOrIndex, periodIndex) {
        if (periodIndex === undefined) return Number(sectionOrIndex) + 1;
        const parsed = this.parseCellKey(this.buildCellKey(1, sectionOrIndex, periodIndex));
        return parsed ? parsed.periodIndex + 1 : Number(periodIndex) + 1;
    }

    migrateLegacyScheduleKeys() {
        const legacyPeriods = this._legacyPeriodsForMigration;
        if (!legacyPeriods) return;

        if (this.erpData) {
            const migrateKeyField = item => {
                if (item && item.cellKey) {
                    item.cellKey = this.migrateLegacyCellKey(item.cellKey, legacyPeriods);
                }
            };
            (this.erpData.courseInstances || []).forEach(migrateKeyField);
            (this.erpData.attendanceRecords || []).forEach(migrateKeyField);
            (this.erpData.exceptionRules || []).forEach(migrateKeyField);
        }

        this._legacyPeriodsForMigration = null;
    }

    // 获取某课位在当前周应使用的版本（最新 weekStart <= 当前周的版本）
    getCellVersion(key, weekStartStr) {
        return window.ScheduleErpService.getCellVersion(this, key, weekStartStr);
    }

    setCellVersion(key, weekStartStr, subjectId, studentIds, options = {}) {
        if (this.isHistoricalCellProtected(key, weekStartStr)) {
            this.showHistoryProtectionNotice();
            return false;
        }
        window.ScheduleErpService.setCellVersion(this, key, weekStartStr, subjectId, studentIds, options);
        return true;
    }

    isHistoricalDateProtected(dateValue) {
        if (!this.settings || !this.settings.historyDataProtection) return false;
        const date = dateValue instanceof Date ? new Date(dateValue) : new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(date.getTime())) return false;
        date.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    }

    isHistoricalCellProtected(key, weekStartStr) {
        const day = Number.parseInt(String(key || '').split('-')[0], 10);
        const date = new Date(`${weekStartStr}T00:00:00`);
        if (!Number.isNaN(day) && !Number.isNaN(date.getTime())) date.setDate(date.getDate() + day - 1);
        return this.isHistoricalDateProtected(date);
    }

    showHistoryProtectionNotice() {
        const now = Date.now();
        if (this._lastHistoryProtectionNotice && now - this._lastHistoryProtectionNotice < 800) return;
        this._lastHistoryProtectionNotice = now;
        alert('历史数据保护已开启，今天以前的数据无法修改。');
    }

    changeWeek(direction) {
        const newDate = new Date(this.currentDate);
        newDate.setDate(this.currentDate.getDate() + direction * 7);
        this.currentDate = newDate;
        this.updateWeekRange();
        this.renderTimetable();
    }

    handleDateChange(e) {
        const [y, m, d] = e.target.value.split('-').map(Number);
        const selectedDate = new Date(y, m - 1, d);
        if (!isNaN(selectedDate.getTime())) {
            this.currentDate = selectedDate;
            this.updateWeekRange();
            this.renderTimetable();
        }
    }

    switchPool(tab) {
        this.currentPool = tab;

        document.querySelectorAll('.pool-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // 切换课程池时调整按钮可见性 - 始终显示所有按钮
        const addButtons = document.querySelector('.add-buttons');
        if (addButtons) {
            addButtons.style.display = 'flex';
        }

        // 切换到学生池时显示筛选按钮，其他池隐藏
        const filterButtons = document.querySelector('.student-filter-buttons');
        if (filterButtons) {
            filterButtons.style.display = tab === 'student' ? 'flex' : 'none';
        }

        this.renderSubjects();
    }

    filterStudents(filter) {
        this.currentStudentFilter = filter;

        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        this.renderSubjects();
    }

    initTimeSelectors() {
        const startHourSelect = document.getElementById('startHour');
        const endHourSelect = document.getElementById('endHour');
        const startMinuteSelect = document.getElementById('startMinute');
        const endMinuteSelect = document.getElementById('endMinute');
        
        startHourSelect.innerHTML = '';
        endHourSelect.innerHTML = '';
        startMinuteSelect.innerHTML = '';
        endMinuteSelect.innerHTML = '';
        
        for (let i = 6; i <= 22; i++) {
            const hour = i.toString().padStart(2, '0');
            startHourSelect.appendChild(new Option(hour, hour));
            endHourSelect.appendChild(new Option(hour, hour));
        }
        
        for (let i = 0; i < 60; i += 5) {
            const minute = i.toString().padStart(2, '0');
            startMinuteSelect.appendChild(new Option(minute, minute));
            endMinuteSelect.appendChild(new Option(minute, minute));
        }
    }

}

function bindStaticDeclarativeHandlers() {
    const eventNames = ['click', 'input', 'change', 'submit', 'mousedown', 'keydown'];
    const parseArgument = (token, element) => {
        const value = token.trim();
        if (value === 'this.value') return element.value;
        if (value === 'this.checked') return element.checked;
        if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
        const stringMatch = value.match(/^'([^']*)'$/);
        if (stringMatch) return stringMatch[1];
        throw new Error(`Unsupported declarative handler argument: ${value}`);
    };
    const invoke = (code, element, event) => {
        if (code === 'if(event.target===this)app.closeQuickStartModal()') {
            if (event.target === element) app.closeQuickStartModal();
            return;
        }
        const windowMatch = code.match(/^window\.electronAPI\.windowControl\('([^']+)'\)$/);
        if (windowMatch) {
            window.electronAPI.windowControl(windowMatch[1]);
            return;
        }
        const appMatch = code.match(/^app\.([a-zA-Z_$][\w$]*)\((.*)\)$/);
        if (!appMatch || typeof app[appMatch[1]] !== 'function') throw new Error(`Unsupported declarative handler: ${code}`);
        const rawArgs = appMatch[2].trim();
        const args = rawArgs ? rawArgs.split(',').map(token => parseArgument(token, element)) : [];
        app[appMatch[1]](...args);
    };
    const selector = eventNames.map(eventName => `[data-on${eventName}]`).join(',');
    document.querySelectorAll(selector).forEach(element => {
        eventNames.forEach(eventName => {
            if (!element.hasAttribute(`data-on${eventName}`)) return;
            const code = element.dataset[`on${eventName}`];
            element.removeAttribute(`data-on${eventName}`);
            element.addEventListener(eventName, event => invoke(code, element, event));
        });
    });
}

// Initialize app on DOMContentLoaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    if (navigator.userAgent.includes('Electron')) document.documentElement.classList.add('electron-app');
    if (window.electronAPI && window.electronAPI.platform === 'darwin') document.documentElement.classList.add('macos');
    app = new TimetableApp();
    bindStaticDeclarativeHandlers();
});
