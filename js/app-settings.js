// app-settings.js - Settings, themes, grades
// Auto-split from script.js

TimetableApp.prototype.openTutorialModal = function() {
        document.getElementById('tutorialModal').style.display = 'flex';
    }

TimetableApp.prototype.closeTutorialModal = function() {
        document.getElementById('tutorialModal').style.display = 'none';
    }

TimetableApp.prototype.openSettingsModal = function(defaultTab = 'theme') {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'block';
        this.renderGrades();

        // Initialize UI with current theme settings
        this.updateThemeSettingsUI();

        this.switchSettingsTab(defaultTab);
    }

TimetableApp.prototype.switchSettingsTab = function(tabName) {
        document.querySelectorAll('.settings-tab').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelectorAll('.settings-tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        document.querySelector(`.settings-tab[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}SettingsTab`).classList.add('active');

        if (tabName === 'time') {
            this.renderPeriods();
            this.initQuickSettings();
            this.updateShowPeriodTimeToggle();
            this.updateTimeAdvancedSaveVisibility();
        } else if (tabName === 'stage') {
            this.renderStageSettings();
        }
    }

TimetableApp.prototype.closeSettingsModal = function() {
        if (this._activeSharedDateRangeScope && this._activeSharedDateRangeScope.startsWith('stage-')) {
            this.closeSharedDateRangePicker(this._activeSharedDateRangeScope);
        }
        document.getElementById('settingsModal').style.display = 'none';
    }

TimetableApp.prototype.renderGrades = function() {
        const gradesList = document.getElementById('gradesList');
        gradesList.innerHTML = '';
        
        this.grades.forEach((grade, index) => {
            const card = document.createElement('div');
            card.className = 'grade-card';
            card.draggable = true;
            card.dataset.gradeId = grade.id;
            card.dataset.index = index;
            
            card.innerHTML = `
                <div class="grade-color" style="background: ${grade.color};"></div>
                <div class="grade-name">${grade.name}</div>
                <div class="grade-actions">
                    <button class="btn-icon edit-btn" title="编辑" onclick="app.editGrade('${grade.id}')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5C17.3284 2.67157 18.6716 2.67157 19.5 3.5L20.5 4.5C21.3284 5.32843 21.3284 6.67157 20.5 7.5L8 20H4V16L16.5 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>
                    <button class="btn-icon delete-btn" title="删除" onclick="app.deleteGrade('${grade.id}')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 11V17M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 7V4H15V7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>
                </div>
            `;
            
            gradesList.appendChild(card);
        });
        
        // 添加拖拽事件监听器
        this.setupGradeDragListeners();
    }
    
TimetableApp.prototype.setupGradeDragListeners = function() {
        const gradesList = document.getElementById('gradesList');
        let draggedGradeId = null;
        
        gradesList.querySelectorAll('.grade-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedGradeId = e.target.dataset.gradeId;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            card.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                draggedGradeId = null;
            });
            
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const draggingCard = gradesList.querySelector('.dragging');
                if (draggingCard && draggingCard !== card) {
                    card.classList.add('drag-over');
                }
            });
            
            card.addEventListener('dragleave', (e) => {
                card.classList.remove('drag-over');
            });
            
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.remove('drag-over');
                
                const targetId = e.currentTarget.dataset.gradeId;
                if (draggedGradeId && targetId && draggedGradeId !== targetId) {
                    this.reorderGrades(draggedGradeId, targetId);
                }
            });
        });
    }
    
TimetableApp.prototype.reorderGrades = function(draggedId, targetId) {
        const draggedIndex = this.grades.findIndex(g => g.id === draggedId);
        const targetIndex = this.grades.findIndex(g => g.id === targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [draggedGrade] = this.grades.splice(draggedIndex, 1);
            this.grades.splice(targetIndex, 0, draggedGrade);
            
            this.saveGrades();
            this.syncGradeColorsToStudents();
            this.saveData();
            this.renderGrades();
            this.renderSubjects();
            this.renderTimetable();
        }
    }

TimetableApp.prototype.randomizeGradeColors = function() {
        const colors = [
            '#FFE4E1', '#E3F2FD', '#FCE4EC', '#FFF3E0', '#E8EAF6',
            '#FEF9E7', '#FFECB3', '#F5F5F5', '#F3E5F5', '#FFE0B2',
            '#FFCDBA', '#D1C4E9', '#B3E5FC', '#F8BBD9', '#FFCDD2'
        ];
        
        const shuffled = [...colors];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        this.grades.forEach((grade, index) => {
            grade.color = shuffled[index % shuffled.length];
        });
        
        this.saveGrades();
        this.syncGradeColorsToStudents();
        this.saveData();
        this.renderGrades();
        this.renderSubjects();
        this.renderTimetable();
    }

TimetableApp.prototype.addGrade = function() {
        this.editingGrade = null;
        document.getElementById('gradeModalTitle').textContent = '添加年级';
        document.getElementById('gradeName').value = '';
        document.getElementById('gradeCustomColor').value = '#FF6B6B';
        document.getElementById('gradeCustomColorText').value = '';
        document.getElementById('deleteGradeBtn').style.display = 'none';
        document.getElementById('gradeModal').style.display = 'block';
    }

TimetableApp.prototype.editGrade = function(id) {
        const grade = this.grades.find(g => g.id === id);
        if (!grade) return;
        
        this.editingGrade = grade;
        document.getElementById('gradeModalTitle').textContent = '编辑年级';
        document.getElementById('gradeName').value = grade.name;
        document.getElementById('gradeCustomColor').value = grade.color;
        document.getElementById('gradeCustomColorText').value = grade.color;
        document.getElementById('deleteGradeBtn').style.display = 'inline-block';
        document.getElementById('gradeModal').style.display = 'block';
    }

TimetableApp.prototype.selectGradeColor = function(e) {
        const color = e.target.dataset.color;
        document.getElementById('gradeCustomColor').value = color;
        document.getElementById('gradeCustomColorText').value = color;
    }

TimetableApp.prototype.saveGrade = function(e) {
        e.preventDefault();
        
        const name = document.getElementById('gradeName').value.trim();
        const color = document.getElementById('gradeCustomColor').value;
        
        if (!name) {
            alert('请输入年级名称');
            return;
        }
        
        if (this.editingGrade) {
            const oldName = this.editingGrade.name;
            this.editingGrade.name = name;
            this.editingGrade.color = color;
            
            this.students.forEach(student => {
                if (student.grade === oldName) {
                    student.grade = name;
                }
            });
        } else {
            const newId = 'g' + Date.now();
            this.grades.push({ id: newId, name, color });
        }
        
        this.saveGrades();
        this.syncGradeColorsToStudents();
        this.saveData();
        this.renderGrades();
        this.renderSubjects();
        this.renderTimetable();
        this.closeGradeModal();
    }

TimetableApp.prototype.deleteGrade = function(id) {
        if (!id && !this.editingGrade) return;
        
        const gradeId = id || this.editingGrade.id;
        
        if (this.grades.length <= 1) {
            alert('至少保留一个年级');
            return;
        }
        
        if (!confirm('确定要删除这个年级吗？')) return;
        
        const deletedGrade = this.grades.find(g => g.id === gradeId);
        const deletedGradeName = deletedGrade ? deletedGrade.name : '';
        
        this.grades = this.grades.filter(g => g.id !== gradeId);
        
        if (deletedGradeName && this.grades.length > 0) {
            const fallbackGrade = this.grades[0];
            this.students.forEach(student => {
                if (student.grade === deletedGradeName) {
                    student.grade = fallbackGrade.name;
                }
            });
        }
        
        this.saveGrades();
        this.syncGradeColorsToStudents();
        this.saveData();
        this.renderGrades();
        this.renderSubjects();
        this.renderTimetable();
        
        if (!id) {
            this.closeGradeModal();
        }
    }

TimetableApp.prototype.closeGradeModal = function() {
        document.getElementById('gradeModal').style.display = 'none';
        this.editingGrade = null;
    }

TimetableApp.prototype.loadGrades = function() {
        const savedGrades = localStorage.getItem('timetableGrades');
        if (savedGrades) {
            try {
                this.grades = JSON.parse(savedGrades);
            } catch (e) {
                console.error('加载年级数据失败:', e);
            }
        }
    }

TimetableApp.prototype.saveGrades = function() {
        localStorage.setItem('timetableGrades', JSON.stringify(this.grades));
    }

TimetableApp.prototype.syncGradeColorsToStudents = function() {
        this.students.forEach(student => {
            const gradeInfo = this.grades.find(g => g.name === student.grade);
            if (gradeInfo) {
                student.color = gradeInfo.color;
            }
        });
    }

TimetableApp.prototype.getStudentGradeColor = function(student) {
        const gradeInfo = this.grades.find(g => g.name === student.grade);
        return gradeInfo ? gradeInfo.color : (student.color || '#666666');
    }

    // 设置相关方法
TimetableApp.prototype.loadSettings = function() {
        const savedSettings = localStorage.getItem('timetableSettings');
        let parsedSettings = null;
        if (savedSettings) {
            parsedSettings = JSON.parse(savedSettings);
            this.settings = { ...this.settings, ...parsedSettings };
        }
        this.settings.showSaturday = true;
        this.settings.showSunday = true;
        if (!Array.isArray(this.settings.stages)) this.settings.stages = [];
        if (typeof this.settings.segmentedStatistics !== 'boolean') this.settings.segmentedStatistics = false;
        if (typeof this.settings.segmentedScheduling !== 'boolean') {
            this.settings.segmentedScheduling = Boolean(this.settings.segmentedStatistics);
        }
        if (!Array.isArray(this.settings.stageMonthRanges)) this.settings.stageMonthRanges = [];
        // 旧版阶段数据没有当前配置版本，首次加载时直接采用新版默认值，
        // 避免必须先修改输入框才出现 4 段默认配置。
        if (parsedSettings && parsedSettings.stageRangeSettingsVersion !== 1) {
            this.settings.stages = [];
            this.settings.stageMonthRanges = [];
        }
        this.ensureThemeSettings();
    }

TimetableApp.prototype.getDefaultStageStartDate = function() {
    const today = new Date();
    const year = today.getMonth() < 8 ? today.getFullYear() - 1 : today.getFullYear();
    return `${year}-09-01`;
}

TimetableApp.prototype.getDefaultStageMonthRanges = function(count) {
    if (count === 4) return [[9, 12], [1, 2], [3, 6], [7, 8]];
    const result = [];
    for (let index = 0; index < count; index++) {
        const startOffset = Math.floor(12 * index / count);
        const endOffset = Math.floor(12 * (index + 1) / count) - 1;
        result.push([((8 + startOffset) % 12) + 1, ((8 + endOffset) % 12) + 1]);
    }
    return result;
}

TimetableApp.prototype.createStage = function(index, source = {}) {
    const names = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九', '第十', '第十一', '第十二'];
    return {
        id: source.id || `stage-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        name: source.name || `${names[index] || `第${index + 1}`}阶段`,
        startDate: source.startDate || '',
        endDate: source.endDate || ''
    };
}

TimetableApp.prototype.escapeHtml = function(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

TimetableApp.prototype.renderStageSettings = function() {
    if (this._activeSharedDateRangeScope && this._activeSharedDateRangeScope.startsWith('stage-')) {
        this.closeSharedDateRangePicker(this._activeSharedDateRangeScope);
    }
    const list = document.getElementById('stagesList');
    const toggle = document.getElementById('segmentedSchedulingToggle');
    const countInput = document.getElementById('stageCountInput');
    const firstStartInput = document.getElementById('firstStageStartDate');
    const monthRanges = document.getElementById('stageMonthRanges');
    const addZone = document.getElementById('stageAddZone');
    if (!list || !toggle || !countInput || !firstStartInput || !monthRanges) return;
    if (!this.settings.stages.length) {
        this.settings.stageMonthRanges = [[9, 12], [1, 2], [3, 6], [7, 8]];
        this.settings.stages = Array.from({ length: 4 }, (_, index) => this.createStage(index));
        firstStartInput.value = this.getDefaultStageStartDate();
        this.recalculateStageRanges(false);
    }
    if (this.settings.stageMonthRanges.length !== this.settings.stages.length) {
        this.settings.stageMonthRanges = this.settings.stages.map(stage => {
            const start = this.parseDateInputValue(stage.startDate);
            const end = this.parseDateInputValue(stage.endDate);
            return start && end ? [start.getMonth() + 1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() + 1] : [1, 1];
        });
    }
    countInput.value = this.settings.stages.length;
    firstStartInput.value = this.settings.stages[0]?.startDate || '';
    toggle.classList.toggle('active', Boolean(this.settings.segmentedScheduling));
    toggle.textContent = this.settings.segmentedScheduling ? '分段排课已开启' : '开启分段排课';
    const names = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九', '第十', '第十一', '第十二'];
    monthRanges.innerHTML = this.settings.stageMonthRanges.map((range, index) => `
        <div class="form-group stage-month-field" data-stage-index="${index}">
            <label>${names[index] || `第${index + 1}`}段月份范围</label>
            <div class="stage-month-range-inputs">
                <input type="number" id="stageStartMonth-${index}" aria-label="${names[index] || `第${index + 1}`}段起始月" class="setting-input" min="1" max="12" value="${range[0]}" oninput="app.updateStageQuickValidation()" onchange="app.recalculateStageRanges()">
                <span>至</span>
                <input type="number" id="stageEndMonth-${index}" aria-label="${names[index] || `第${index + 1}`}段结束月" class="setting-input" min="1" max="120" value="${range[1]}" oninput="app.updateStageQuickValidation()" onchange="app.recalculateStageRanges()">
                <span>月</span>
            </div>
        </div>`).join('');
    this.updateStageQuickValidation();
    list.innerHTML = '';
    this.settings.stages.forEach((stage, index) => {
        const row = document.createElement('div');
        row.className = 'stage-setting-row';
        const names = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九', '第十', '第十一', '第十二'];
        if (!stage.name || /^第\d+阶段$/.test(stage.name)) stage.name = `${names[index] || `第${index + 1}`}阶段`;
        const scope = `stage-${stage.id}`;
        const start = this.parseDateInputValue(stage.startDate);
        const end = this.parseDateInputValue(stage.endDate);
        const rangeText = start && end ? this.formatSharedDateRangeLabel(start, end) : '请选择日期范围';
        row.innerHTML = `<input type="text" class="setting-input stage-name-input" maxlength="20" aria-label="阶段名称" value="${this.escapeHtml(stage.name)}" oninput="app.updateStage('${stage.id}', 'name', this.value)">
            <div class="shared-date-range-picker stage-date-range" id="stageRange-${stage.id}">
                <input type="hidden" id="stageStart-${stage.id}" value="${stage.startDate || ''}">
                <input type="hidden" id="stageEnd-${stage.id}" value="${stage.endDate || ''}">
                <button type="button" class="stats-date-range-picker" onclick="app.toggleStageDateRangePicker('${stage.id}', this)">
                    <span class="stats-date-range-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 3V6M17 3V6M4 9H20M6 5H18C19.1 5 20 5.9 20 7V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V7C4 5.9 4.9 5 6 5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                    <span class="stats-date-range-value" id="stageRangeText-${stage.id}">${rangeText}</span>
                    <span class="stats-date-range-caret">&#9662;</span>
                </button>
                <div class="stats-date-popover stage-date-popover" id="stagePopover-${stage.id}" style="display:none;">
                    <div class="stats-calendar-header"><button type="button" class="stats-calendar-nav" onclick="app.changeSharedCalendarMonth('${scope}', -1)">&#8249;</button><div class="stats-calendar-title" id="stageCalendarTitle-${stage.id}"></div><button type="button" class="stats-calendar-nav" onclick="app.changeSharedCalendarMonth('${scope}', 1)">&#8250;</button></div>
                    <div class="stats-calendar-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
                    <div class="stats-calendar-grid" id="stageCalendarGrid-${stage.id}"></div>
                </div>
            </div>
            <div class="stage-order-actions">
                <button type="button" class="stage-order-button" aria-label="上移${this.escapeHtml(stage.name)}" title="上移" ${index === 0 ? 'disabled' : ''} onclick="app.moveStage('${stage.id}', -1)">↑</button>
                <button type="button" class="stage-order-button" aria-label="下移${this.escapeHtml(stage.name)}" title="下移" ${index === this.settings.stages.length - 1 ? 'disabled' : ''} onclick="app.moveStage('${stage.id}', 1)">↓</button>
            </div>`;
        list.appendChild(row);
    });
    if (addZone) {
        const reachedLimit = this.settings.stages.length >= 12;
        addZone.disabled = reachedLimit;
        addZone.querySelector('span').textContent = reachedLimit ? '最多添加 12 个阶段' : '+ 添加阶段';
    }
}

TimetableApp.prototype.addStage = function() {
    if (!Array.isArray(this.settings.stages)) this.settings.stages = [];
    if (this.settings.stages.length >= 12) return;
    const index = this.settings.stages.length;
    this.settings.stages.push(this.createStage(index));
    if (!Array.isArray(this.settings.stageMonthRanges)) this.settings.stageMonthRanges = [];
    this.settings.stageMonthRanges.push([1, 1]);
    const message = document.getElementById('stageSettingsMessage');
    if (message) {
        message.textContent = '已添加新阶段，请填写日期范围后保存。';
        message.className = 'stage-settings-message';
    }
    this.renderStageSettings();
}

TimetableApp.prototype.setStageCount = function(value, shouldRender = true) {
    const count = Math.max(1, Math.min(12, Number.parseInt(value, 10) || 1));
    const firstStartDate = document.getElementById('firstStageStartDate')?.value || this.settings.stages[0]?.startDate || this.getDefaultStageStartDate();
    if (count !== this.settings.stages.length) {
        const previous = this.settings.stages;
        this.settings.stages = Array.from({ length: count }, (_, index) => this.createStage(index, previous[index] || {}));
        this.settings.stageMonthRanges = this.getDefaultStageMonthRanges(count);
    }
    const input = document.getElementById('stageCountInput');
    if (input) input.value = count;
    const startInput = document.getElementById('firstStageStartDate');
    if (startInput) startInput.value = firstStartDate;
    this.recalculateStageRanges(false, true);
    if (shouldRender) this.renderStageSettings();
}

TimetableApp.prototype.recalculateStageRanges = function(shouldRender = true, useStoredRanges = false) {
    const startInput = document.getElementById('firstStageStartDate');
    const count = Math.max(1, Math.min(12, Number.parseInt(document.getElementById('stageCountInput')?.value, 10) || this.settings.stages.length || 4));
    const startDate = this.parseDateInputValue(startInput?.value || this.settings.stages[0]?.startDate || this.getDefaultStageStartDate());
    if (!startDate) return;
    const names = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九', '第十', '第十一', '第十二'];
    const ranges = Array.from({ length: count }, (_, index) => {
        const stored = this.settings.stageMonthRanges[index] || this.getDefaultStageMonthRanges(count)[index];
        const startInput = document.getElementById(`stageStartMonth-${index}`);
        const endInput = document.getElementById(`stageEndMonth-${index}`);
        const startMonth = useStoredRanges ? stored[0] : Number.parseInt(startInput?.value, 10);
        const endMonth = useStoredRanges ? stored[1] : Number.parseInt(endInput?.value, 10);
        return [Math.max(1, Math.min(12, startMonth || stored[0] || 1)), Math.max(1, Math.min(120, endMonth || stored[1] || 1))];
    });
    if (!this.validateStageMonthRanges(ranges).valid) {
        this.updateStageQuickValidation(ranges);
        return false;
    }
    this.settings.stageMonthRanges = ranges;
    let earliestStart = new Date(startDate.getFullYear(), 0, 1);
    this.settings.stages = Array.from({ length: count }, (_, index) => {
        const previous = this.settings.stages[index] || {};
        const [startMonth, rawEndMonth] = ranges[index];
        let startYear = index === 0 ? startDate.getFullYear() : earliestStart.getFullYear();
        let stageStart = new Date(startYear, startMonth - 1, 1);
        while (index > 0 && stageStart < earliestStart) {
            startYear += 1;
            stageStart = new Date(startYear, startMonth - 1, 1);
        }
        const normalizedEndMonth = ((rawEndMonth - 1) % 12) + 1;
        let endYear = startYear + Math.floor((rawEndMonth - 1) / 12);
        let stageEnd = new Date(endYear, normalizedEndMonth, 0);
        while (stageEnd < stageStart) {
            endYear += 1;
            stageEnd = new Date(endYear, normalizedEndMonth, 0);
        }
        earliestStart = new Date(stageEnd.getFullYear(), stageEnd.getMonth() + 1, 1);
        return this.createStage(index, {
            ...previous,
            name: previous.name || `${names[index] || `第${index + 1}`}阶段`,
            startDate: this.formatLocalDate(stageStart),
            endDate: this.formatLocalDate(stageEnd)
        });
    });
    if (shouldRender) this.renderStageSettings();
    return true;
}

TimetableApp.prototype.applyStageQuickSettings = function() {
    if (!this.recalculateStageRanges(false)) return;
    this.saveSettings();
    if (window.ScheduleErpService.completeStudentsForEndedStages(this)) this.saveData();
    this.renderStageSettings();
    this.renderSubjects();
}

TimetableApp.prototype.getStageMonthRangesFromInputs = function() {
    const count = Math.max(1, Math.min(12, Number.parseInt(document.getElementById('stageCountInput')?.value, 10) || 4));
    return Array.from({ length: count }, (_, index) => [
        Number.parseInt(document.getElementById(`stageStartMonth-${index}`)?.value, 10),
        Number.parseInt(document.getElementById(`stageEndMonth-${index}`)?.value, 10)
    ]);
}

TimetableApp.prototype.validateStageMonthRanges = function(ranges) {
    const invalid = new Set();
    if (!ranges.length) return { valid: false, invalid };
    const baseMonth = ranges[0][0];
    const intervals = ranges.map(([startMonth, rawEndMonth], index) => {
        if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12 || !Number.isInteger(rawEndMonth) || rawEndMonth < 1 || rawEndMonth > 120) {
            invalid.add(index);
            return null;
        }
        const start = (startMonth - baseMonth + 12) % 12;
        let duration = rawEndMonth - startMonth;
        while (duration < 0) duration += 12;
        return { index, start, end: start + duration };
    }).filter(Boolean);
    for (let left = 0; left < intervals.length; left++) {
        for (let right = left + 1; right < intervals.length; right++) {
            if (intervals[left].start <= intervals[right].end && intervals[right].start <= intervals[left].end) {
                invalid.add(intervals[left].index);
                invalid.add(intervals[right].index);
            }
        }
    }
    return { valid: invalid.size === 0, invalid };
}

TimetableApp.prototype.updateStageQuickValidation = function(ranges = null) {
    const currentRanges = ranges || this.getStageMonthRangesFromInputs();
    const result = this.validateStageMonthRanges(currentRanges);
    document.querySelectorAll('.stage-month-field').forEach((field, index) => field.classList.toggle('invalid', result.invalid.has(index)));
    const message = document.getElementById('stageQuickMessage');
    const button = document.getElementById('stageQuickApplyBtn');
    if (message) message.textContent = result.valid ? '' : '月份范围存在重叠，请调整标红的分段后再应用。';
    if (button) button.disabled = !result.valid;
    return result.valid;
}

TimetableApp.prototype.toggleStageAdvancedSettings = function() {
    const toggle = document.querySelector('.stage-advanced-toggle');
    const advanced = document.getElementById('stageAdvancedSettings');
    const actions = document.getElementById('stageAdvancedSaveActions');
    const expanded = !toggle.classList.contains('expanded');
    toggle.classList.toggle('expanded', expanded);
    advanced.classList.toggle('expanded', expanded);
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (actions) actions.style.display = expanded ? 'flex' : 'none';
}

TimetableApp.prototype.updateFirstStageStartDate = function(value) {
    const firstStage = this.settings.stages[0];
    if (!firstStage) return;
    firstStage.startDate = value;
    this.renderStageSettings();
}

TimetableApp.prototype.updateStageDateRange = function(id, startDate, endDate) {
    const stage = this.settings.stages.find(item => item.id === id);
    if (!stage) return;
    stage.startDate = startDate;
    stage.endDate = endDate;
    if (stage === this.settings.stages[0]) {
        const firstStartInput = document.getElementById('firstStageStartDate');
        if (firstStartInput) firstStartInput.value = startDate;
    }
}

TimetableApp.prototype.toggleStageDateRangePicker = function(id, button) {
    const scope = `stage-${id}`;
    this.toggleSharedDateRangePicker(scope);
    const popover = document.getElementById(`stagePopover-${id}`);
    if (!popover || popover.style.display === 'none') return;
    const rect = button.getBoundingClientRect();
    const width = 252;
    document.body.appendChild(popover);
    popover.style.position = 'fixed';
    popover.style.right = 'auto';
    popover.style.bottom = 'auto';
    popover.style.width = `${width}px`;
    popover.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    const height = popover.offsetHeight || 292;
    const fitsBelow = window.innerHeight - rect.bottom >= height + 12;
    const preferredTop = fitsBelow ? rect.bottom + 6 : rect.top - height - 6;
    popover.style.top = `${Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12))}px`;
}

TimetableApp.prototype.moveStage = function(id, direction) {
    const index = this.settings.stages.findIndex(stage => stage.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.settings.stages.length) return;
    [this.settings.stages[index], this.settings.stages[target]] = [this.settings.stages[target], this.settings.stages[index]];
    this.renderStageSettings();
}

TimetableApp.prototype.updateStage = function(id, field, value) {
    const stage = this.settings.stages.find(item => item.id === id);
    if (stage && ['name', 'startDate', 'endDate'].includes(field)) {
        stage[field] = value;
        if (field === 'startDate' && stage === this.settings.stages[0]) {
            const firstStartInput = document.getElementById('firstStageStartDate');
            if (firstStartInput) firstStartInput.value = value;
        }
    }
}

TimetableApp.prototype.toggleSegmentedScheduling = function() {
    this.settings.segmentedScheduling = !this.settings.segmentedScheduling;
    this.saveSettings();
    if (window.ScheduleErpService.completeStudentsForEndedStages(this)) this.saveData();
    this.renderStageSettings();
    this.renderSubjects();
}

TimetableApp.prototype.saveStageSettings = function() {
    const message = document.getElementById('stageSettingsMessage');
    const stages = this.settings.stages.map(stage => ({ ...stage, name: (stage.name || '').trim() }));
    if (stages.some(stage => !stage.name || !stage.startDate || !stage.endDate || stage.startDate > stage.endDate)) {
        message.textContent = '请填写阶段名称和完整日期，并确保开始日期不晚于结束日期。';
        message.className = 'stage-settings-message error';
        return;
    }
    const sorted = [...stages].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (sorted.some((stage, index) => index > 0 && stage.startDate <= sorted[index - 1].endDate)) {
        message.textContent = '阶段日期不能互相重叠，请调整后再保存。';
        message.className = 'stage-settings-message error';
        return;
    }
    this.settings.stages = stages;
    this.saveSettings();
    if (window.ScheduleErpService.completeStudentsForEndedStages(this)) this.saveData();
    this.renderStageSettings();
    this.renderSubjects();
    message.textContent = '阶段设置已保存。';
    message.className = 'stage-settings-message success';
}

TimetableApp.prototype.applySettings = function() {
        this.ensureThemeSettings();
        this.applyThemeSettings(); // Apply theme settings

    // 应用周六、周日显示设置
    const saturdayCol = document.getElementById('saturdayCol');
    const sundayCol = document.getElementById('sundayCol');
    
    if (saturdayCol) {
        saturdayCol.style.display = this.settings.showSaturday ? 'table-cell' : 'none';
    }
    if (sundayCol) {
        sundayCol.style.display = this.settings.showSunday ? 'table-cell' : 'none';
    }

    // 更新课程表中的周末列 - 重新渲染后应用设置
    setTimeout(() => {
        const weekendCols = document.querySelectorAll('.weekend-col');
        weekendCols.forEach(col => {
            if (col.dataset.day === '6') {
                col.style.display = this.settings.showSaturday ? 'table-cell' : 'none';
            } else if (col.dataset.day === '7') {
                col.style.display = this.settings.showSunday ? 'table-cell' : 'none';
            }
        });
    }, 0);

    // 应用时间显示设置
    setTimeout(() => {
        const timeDisplays = document.querySelectorAll('.time-display');
        timeDisplays.forEach(display => {
            display.style.display = this.settings.showPeriodTime ? 'block' : 'none';
        });
    }, 0);

    this.renderTimetable();
}

TimetableApp.prototype.applyThemeSettings = function() {
    const root = document.documentElement;

    // Apply theme background colors
    root.style.setProperty('--menu-bg-color', this.settings.menuColor);
    root.style.setProperty('--schedule-bg-color', this.settings.scheduleColor);
    root.style.setProperty('--app-bg-color', this.settings.backgroundColor);

    // Apply primary/accent colors
    root.style.setProperty('--primary-color', this.settings.primaryColor);
    root.style.setProperty('--primary-hover', this.settings.primaryHover);
    root.style.setProperty('--primary-pressed', this.settings.primaryPressed);
    root.style.setProperty('--primary-bg', this.settings.primaryBg);
    root.style.setProperty('--shadow-color', this.settings.shadowColor);

    // Compute and set RGB components for rgba() usage in CSS
    const primaryRgb = this.hexToRgb(this.settings.primaryColor);
    const hoverRgb = this.hexToRgb(this.settings.primaryHover);
    root.style.setProperty('--primary-rgb', primaryRgb);
    root.style.setProperty('--primary-hover-rgb', hoverRgb);

    // Toggle dark theme class based on selected theme
    document.body.classList.toggle('mint-theme-active', this.settings.theme === 'mint');

    if (this.settings.theme === 'dark') {
        document.body.classList.add('dark-theme-active');
        document.body.classList.remove('light-sidebar');
    } else {
        document.body.classList.remove('dark-theme-active');
        document.body.classList.add('light-sidebar');
    }
}

// Helper: convert hex color to "r, g, b" string for CSS rgba()
TimetableApp.prototype.hexToRgb = function(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

// Helper: determine if a hex color is light (returns true for light colors)
TimetableApp.prototype.isLightColor = function(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    // Relative luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 0.55;
}

TimetableApp.prototype.updateThemeSettingsUI = function() {
    // Clear active state from predefined themes
    document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
    
    // Mark current theme as active
    const activeBtn = document.querySelector(`.theme-option[data-theme="${this.settings.theme}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

TimetableApp.prototype.getThemeDefinitions = function() {
    return {
        'default': {
            menu: '#ffffff', schedule: '#ffffff', bg: '#f0f7ff',
            primary: '#60a5fa', primaryHover: '#93c5fd', primaryPressed: '#3b82f6',
            primaryBg: '#e0f2fe', shadowColor: 'rgba(96, 165, 250, 0.15)'
        },
        'dark': {
            menu: '#1e293b', schedule: '#1a1a2e', bg: '#0f172a',
            primary: '#818cf8', primaryHover: '#6366f1', primaryPressed: '#4f46e5',
            primaryBg: 'rgba(99, 102, 241, 0.2)', shadowColor: 'rgba(99, 102, 241, 0.3)'
        },
        'mint': {
            menu: '#f8fbf8', schedule: '#ffffff', bg: '#eef6f1',
            primary: '#367a59', primaryHover: '#5f9f79', primaryPressed: '#285f45',
            primaryBg: '#dcefe3', shadowColor: 'rgba(47, 111, 82, 0.18)'
        },
    };
}

TimetableApp.prototype.ensureThemeSettings = function() {
    const themes = this.getThemeDefinitions();
    const fallback = themes[this.settings.theme] || themes.default;
    const defaults = {
        menuColor: fallback.menu,
        scheduleColor: fallback.schedule,
        backgroundColor: fallback.bg,
        primaryColor: fallback.primary,
        primaryHover: fallback.primaryHover,
        primaryPressed: fallback.primaryPressed,
        primaryBg: fallback.primaryBg,
        shadowColor: fallback.shadowColor
    };

    Object.entries(defaults).forEach(([key, value]) => {
        if (!this.settings[key]) this.settings[key] = value;
    });
}

TimetableApp.prototype.applyPredefinedTheme = function(themeName) {
    this.settings.theme = themeName;
    
    const themes = this.getThemeDefinitions();
    const theme = themes[themeName];
    if (theme) {
        this.settings.menuColor = theme.menu;
        this.settings.scheduleColor = theme.schedule;
        this.settings.backgroundColor = theme.bg;
        this.settings.primaryColor = theme.primary;
        this.settings.primaryHover = theme.primaryHover;
        this.settings.primaryPressed = theme.primaryPressed;
        this.settings.primaryBg = theme.primaryBg;
        this.settings.shadowColor = theme.shadowColor;

        this.updateThemeSettingsUI();
        this.applyThemeSettings();
        this.saveSettings();
    }
}
