// app-core.js - Core class definition and data management
// Auto-split from script.js

function createDefaultSubjects() {
    return [
        { id: '1', name: '语文', teacher: '', color: '#FFE4E1' },
        { id: '2', name: '数学', teacher: '', color: '#E3F2FD' },
        { id: '3', name: '英语', teacher: '', color: '#FCE4EC' },
        { id: '4', name: '美术', teacher: '', color: '#FFF3E0' },
        { id: '5', name: '健康与体育', teacher: '', color: '#E8EAF6' },
        { id: '6', name: '道德与法治', teacher: '', color: '#FEF9E7' },
        { id: '7', name: '音乐', teacher: '', color: '#FFECB3' },
        { id: '8', name: '劳动', teacher: '', color: '#F5F5F5' },
        { id: '9', name: '班队会', teacher: '', color: '#F3E5F5' },
        { id: '10', name: '值日', teacher: '', color: '#FFE0B2' },
        { id: '11', name: '历史', teacher: '', color: '#FFCDBA' },
        { id: '12', name: '地理', teacher: '', color: '#D1C4E9' },
        { id: '13', name: '政治', teacher: '', color: '#FFEBEE' },
        { id: '14', name: '物理', teacher: '', color: '#EFEBE9' },
        { id: '15', name: '化学', teacher: '', color: '#B3E5FC' },
        { id: '16', name: '生物', teacher: '', color: '#F8BBD9' }
    ];
}

function createDefaultPeriods() {
    return {
        morning: [
            { name: '第1节', time: '08:00-08:40' },
            { name: '第2节', time: '08:50-09:30' },
            { name: '第3节', time: '10:00-10:40' },
            { name: '第4节', time: '10:50-11:30' }
        ],
        afternoon: [
            { name: '第5节', time: '14:00-14:40' },
            { name: '第6节', time: '14:50-15:30' },
            { name: '第7节', time: '15:40-16:20' }
        ],
        evening: [
            { name: '第8节', time: '19:00-19:40' },
            { name: '第9节', time: '19:50-20:30' }
        ]
    };
}

function createDefaultSettings() {
    return {
        showEvening: true,
        showSaturday: true,
        showSunday: true,
        showPeriodTime: true,
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
        this.subjects = [
            { id: '1', name: '语文', teacher: '', color: '#FFE4E1' },
            { id: '2', name: '数学', teacher: '', color: '#E3F2FD' },
            { id: '3', name: '英语', teacher: '', color: '#FCE4EC' },
            { id: '4', name: '美术', teacher: '', color: '#FFF3E0' },
            { id: '5', name: '健康与体育', teacher: '', color: '#E8EAF6' },
            { id: '6', name: '道德与法制', teacher: '', color: '#FEF9E7' },
            { id: '7', name: '音乐', teacher: '', color: '#FFECB3' },
            { id: '8', name: '劳动', teacher: '', color: '#F5F5F5' },
            { id: '9', name: '班队会', teacher: '', color: '#F3E5F5' },
            { id: '10', name: '值日', teacher: '', color: '#FFE0B2' },
            { id: '11', name: '历史', teacher: '', color: '#FFCDBA' },
            { id: '12', name: '地理', teacher: '', color: '#D1C4E9' },
            { id: '13', name: '政治', teacher: '', color: '#FFEBEE' },
            { id: '14', name: '物理', teacher: '', color: '#EFEBE9' },
            { id: '15', name: '化学', teacher: '', color: '#B3E5FC' },
            { id: '16', name: '生物', teacher: '', color: '#F8BBD9' }
        ];
        this.students = [];
        this.manualCourses = [];   // 手动添加的课程（未排入课表的）
        this.currentPool = 'subject';
        this.timetable = {};
        this.periods = {
            morning: [
                { name: '第1节', time: '08:00-08:40' },
                { name: '第2节', time: '08:50-09:30' },
                { name: '第3节', time: '10:00-10:40' },
                { name: '第4节', time: '10:50-11:30' }
            ],
            afternoon: [
                { name: '第1节', time: '14:00-14:40' },
                { name: '第2节', time: '14:50-15:30' },
                { name: '第3节', time: '15:40-16:20' }
            ],
            evening: [
                { name: '第1节', time: '19:00-19:40' },
                { name: '第2节', time: '19:50-20:30' }
            ]
        };
        this.settings = {
            showEvening: true,
            showSaturday: true,
            showSunday: true,
            showPeriodTime: true,
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
        this.quickSettingsState = null;
        this.editingSubject = null;
        this.editingCell = null;
        this.editingPeriod = null;
        this.draggedItem = null;
        
        this.currentDate = new Date();
        this.currentStudentFilter = 'all';
        
        this.init();
    }

    init() {
        this.loadData();
        this.loadSettings();
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
        bind('tutorialBtn', 'click', () => this.openTutorialModal());
        
        // 时间管理
        bind('timeManagementBtn', 'click', () => this.openTimeManagementModal());
        bind('totalPeriodCount', 'change', (e) => {
            this.updateLunchBreakOptions(e.target.value);
            this.updateDinnerBreakOptions(e.target.value);
        });
        
        // 重置和打印
        bind('resetBtn', 'click', () => this.openResetModal());
        bind('saveImageBtn', 'click', () => this.saveAsImage());
        bind('exportWordBtn', 'click', () => this.exportToWord());
        bind('exportExcelBtn', 'click', () => this.exportToExcel());
        bind('settingsBtn', 'click', () => this.openSettingsModal());
        
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
        bind('datePicker', 'change', (e) => this.handleDateChange(e));
        

        
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
        
        // 拖拽相关
        this.setupDragAndDrop();
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.editingCell) {
                this.removeItemFromCell(this.editingCell);
            }
            if (e.key === 'Escape') {
                this.closeSubjectModal();
                this.closeTimeModal();
                this.closeTutorialModal();
                this.closeAddLessonModal();
                this.closeAttendanceModal();
                this.closeTimeManagementModal();
                this.closeSettingsModal();
                this.closeGradeModal();
                this.closeStatsModal();
                this.closeTextStatsModal();
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
            resetModal: () => this.closeResetModal()
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


    getCell1v1Status(key) {
        // 获取当前周该课位的版本，检查其学生列表
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const version = this.getCellVersion(key, weekStartStr);
        if (!version || !version.student || !Array.isArray(version.student) || version.student.length === 0) {
            return { has1v1: false, studentCount: 0 };
        }
        const studentCount = version.student.length;
        const has1v1 = version.student.some(studentId => {
            const student = this.students.find(s => s.id === studentId);
            return student && student.is1v1;
        });
        return { has1v1, studentCount };
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

    // 确保试听学生以临时模式存在于课表中（只出现在当前周，不参与循环）
    ensureAuditionStudentsTemporary(key, studentIds) {
        for (const studentId of studentIds) {
            const student = this.students.find(s => s.id === studentId);
            if (student && student.isAudition) {
                this.setStudentRecurrence(key, studentId, 'temporary');
            }
        }
    }

    getContrastColor(hex) {
        if (!hex || hex.length < 7) return '#333';
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        // 计算亮度
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 150 ? '#1f2225' : '#ffffff';
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
            this.periods = parsed.periods || this.periods;
            this.quickSettingsState = parsed.quickSettingsState || null;

            if (parsed.subjects && Array.isArray(parsed.subjects) && parsed.subjects.length > 0) {
                this.subjects = parsed.subjects;
                hasValidSubjects = true;
            }
        }

        if (!hasValidSubjects) {
            this.subjects = [
                { id: '1', name: 'Chinese', teacher: '', color: '#FFE4E1' },
                { id: '2', name: 'Math', teacher: '', color: '#E3F2FD' },
                { id: '3', name: 'English', teacher: '', color: '#FCE4EC' },
                { id: '4', name: 'Art', teacher: '', color: '#FFF3E0' },
                { id: '5', name: 'PE', teacher: '', color: '#E8EAF6' },
                { id: '6', name: 'Morality', teacher: '', color: '#FEF9E7' },
                { id: '7', name: 'Music', teacher: '', color: '#FFECB3' },
                { id: '8', name: 'Labor', teacher: '', color: '#F5F5F5' },
                { id: '9', name: 'Class Meeting', teacher: '', color: '#F3E5F5' },
                { id: '10', name: 'Duty', teacher: '', color: '#FFE0B2' },
                { id: '11', name: 'History', teacher: '', color: '#FFCDBA' },
                { id: '12', name: 'Geography', teacher: '', color: '#D1C4E9' },
                { id: '13', name: 'Politics', teacher: '', color: '#FFEBEE' },
                { id: '14', name: 'Physics', teacher: '', color: '#EFEBE9' },
                { id: '15', name: 'Chemistry', teacher: '', color: '#B3E5FC' },
                { id: '16', name: 'Biology', teacher: '', color: '#F8BBD9' }
            ];
        }

        if (!this.periods.evening) {
            this.periods.evening = [
                { name: 'Period 8', time: '19:00-19:40' },
                { name: 'Period 9', time: '19:50-20:30' }
            ];
        }

        window.ScheduleErpService.ensureErpData(this);
        window.ScheduleErpService.buildTimetableProjection(this);
    }
    syncRealtime(options = {}) {
        window.ScheduleErpService.ensureErpData(this);
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

    loadTimetableTitle() {
        const savedTitle = localStorage.getItem('timetableTitle');
        const titleInput = document.getElementById('timetableTitle');
        if (savedTitle && titleInput) {
            titleInput.value = savedTitle;
        }
    }

    saveTimetableTitle(title) {
        localStorage.setItem('timetableTitle', title);
    }

    saveTableTitle(title) {
        localStorage.setItem('tableTitle', title);
    }

    openResetModal() {
        const modal = document.getElementById('resetModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeResetModal() {
        const modal = document.getElementById('resetModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    resetScheduleOnly() {
        if (!confirm('确定要重置课表吗？这会清空当前排课、循环和考勤数据，但保留科目、学生、手动课程、年级、课时和设置。')) {
            return;
        }

        this.timetable = {};
        this.erpData = window.createEmptyErpData ? window.createEmptyErpData() : null;
        this.currentPool = 'subject';
        this.currentStudentFilter = 'all';
        this.draggedItem = null;
        this.editingCell = null;
        this.selectedCell = null;
        this._attModalStudents = null;
        this._attModalKey = null;
        this._attModalCellKey = null;
        this._attModalCourseInstanceId = null;
        this._attModalRecurrence = null;
        this._courseEditMatchedKeys = null;

        window.ScheduleErpService.ensureErpData(this);
        window.ScheduleErpService.buildTimetableProjection(this);

        this.closeResetModal();
        this.closeAttendanceModal();
        this.closeAddLessonModal();
        this.syncRealtime({ weekRange: true });
    }

    resetTimetable() {
        if (!confirm('确定要重置课表吗？这会清空当前课表、学生、手动课程、考勤和循环数据。')) {
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
        this.quickSettingsState = null;
        this.currentPool = 'subject';
        this.currentStudentFilter = 'all';
        this.currentDate = new Date();
        this.draggedItem = null;
        this.editingCell = null;
        this.editingSubject = null;
        this.editingGrade = null;
        this.editingPeriod = null;
        this.selectedCell = null;
        this._attModalStudents = null;
        this._attModalKey = null;
        this._attModalCellKey = null;
        this._attModalCourseInstanceId = null;
        this._attModalRecurrence = null;
        this._courseEditMatchedKeys = null;

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

    loadTableTitle() {
        const savedTitle = localStorage.getItem('tableTitle');
        const titleInput = document.getElementById('tableTitle');
        if (savedTitle && titleInput) {
            titleInput.value = savedTitle;
        }
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
        const parts = key.split('-');
        if (parts.length !== 3) return true; // 无法解析，默认认为已结束
        const dayNum = parseInt(parts[0]);
        const section = parts[1];
        const period = parseInt(parts[2]);

        const periodInfo = this.periods[section] && this.periods[section][period]
            ? this.periods[section][period] : null;
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

// Initialize app on DOMContentLoaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TimetableApp();
});
