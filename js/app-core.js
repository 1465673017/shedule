// app-core.js - Core class definition and data management
// Auto-split from script.js

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
        shadowColor: 'rgba(96, 165, 250, 0.15)'
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
            theme: 'default'
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
        this.renderSubjects();
        this.renderTimetable();
        this.applyThemeSettings(); // 先应用主题设置
        this.applySettings();
        this.updateThemeSettingsUI(); // Ensure UI matches loaded settings
        this.updateWeekRange();
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
        bind('studentBatchForm', 'submit', (e) => this.saveStudentBatch(e));
        bind('cancelBtn', 'click', () => this.closeSubjectModal());
        bind('cancelStudentBatchBtn', 'click', () => this.closeStudentBatchModal());
        bind('deleteSubjectBtn', 'click', () => this.deleteSubject());
        this.ensureStudentBatchImportButton();
        
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
        bind('tutorialBtn', 'click', () => this.openTutorialModal());
        
        bind('totalPeriodCount', 'change', (e) => {
            this.updateLunchBreakOptions(e.target.value);
            this.updateDinnerBreakOptions(e.target.value);
        });
        
        // 重置和打印
        bind('resetBtn', 'click', () => this.openResetModal());
        bind('exportBtn', 'click', () => this.openExportModal());
        bind('settingsBtn', 'click', () => this.openSettingsModal());
        bind('importCourseDataBtn', 'click', () => this.openCourseDataImportModal());
        bind('courseDataImportForm', 'submit', (e) => this.submitCourseDataImport(e));
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
                this.closeSubjectModal();
                this.closeStudentBatchModal();
                this.closeTimeModal();
                this.closeTutorialModal();
                this.closeAddLessonModal();
                this.closeAttendanceModal();
                this.closeTimeManagementModal();
                this.closeSettingsModal();
                this.closeGradeModal();
                this.closeStatsModal();
                this.closeTextStatsModal();
                this.closeExportModal();
            }
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
            settingsModal: () => this.closeSettingsModal(),
            gradeModal: () => this.closeGradeModal(),
            tutorialModal: () => this.closeTutorialModal(),
            studentBatchModal: () => this.closeStudentBatchModal(),
            courseDataImportModal: () => this.closeCourseDataImportModal(),
            resetModal: () => this.closeResetModal(),
            exportModal: () => this.closeExportModal()
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
        const data = {
            subjects: this.subjects,
            students: this.students,
            manualCourses: this.manualCourses,
            periods: this.periods,
            erpData: this.erpData,
            quickSettingsState: this.quickSettingsState
        };
        try {
            localStorage.setItem('timetableData', JSON.stringify(data));
        } catch (e) {
            alert('保存失败：存储空间不足，请清理旧数据或导出备份。');
            console.error('保存数据失败:', e);
        }
    }

    loadData() {
        const data = localStorage.getItem('timetableData');
        let hasValidSubjects = false;

        if (data) {
            const parsed = JSON.parse(data);
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
        window.ScheduleErpService.buildTimetableProjection(this);
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

        const endTimeStr = periodInfo.time.split('-')[1]; // e.g., "08:40"
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
        return now > classEndTime;
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
        window.ScheduleErpService.setCellVersion(this, key, weekStartStr, subjectId, studentIds, options);
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
        this.ensureStudentBatchImportButton();
        const importStudentsBtn = document.getElementById('importStudentsBtn');
        if (importStudentsBtn) {
            importStudentsBtn.style.display = tab === 'student' ? 'inline-flex' : 'none';
        }

        // 切换到学生池时显示筛选按钮，其他池隐藏
        const filterButtons = document.querySelector('.student-filter-buttons');
        if (filterButtons) {
            filterButtons.style.display = tab === 'student' ? 'flex' : 'none';
        }

        this.renderSubjects();
    }

    ensureStudentBatchImportButton() {
        const addButtons = document.querySelector('.add-buttons');
        const btn = document.getElementById('importStudentsBtn');
        if (!addButtons || !btn) return;
        if (btn.dataset.bound === 'true') return;

        btn.style.display = this.currentPool === 'student' ? 'inline-flex' : 'none';
        btn.addEventListener('click', () => this.openStudentBatchModal());
        btn.dataset.bound = 'true';
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

// Initialize app on DOMContentLoaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TimetableApp();
});
