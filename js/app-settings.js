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
        }
    }

TimetableApp.prototype.closeSettingsModal = function() {
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
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        this.settings.showSaturday = true;
        this.settings.showSunday = true;
        // Initialize theme settings with defaults if not present
        this.settings.menuColor = this.settings.menuColor || '#ffffff';
        this.settings.scheduleColor = this.settings.scheduleColor || '#ffffff';
        this.settings.backgroundColor = this.settings.backgroundColor || '#f0f7ff';
        // Initialize primary color with defaults if not present
        this.settings.primaryColor = this.settings.primaryColor || '#60a5fa';
        this.settings.primaryHover = this.settings.primaryHover || '#93c5fd';
        this.settings.primaryPressed = this.settings.primaryPressed || '#3b82f6';
        this.settings.primaryBg = this.settings.primaryBg || '#e0f2fe';
        this.settings.shadowColor = this.settings.shadowColor || 'rgba(96, 165, 250, 0.15)';
    }

TimetableApp.prototype.applySettings = function() {
        // Make sure theme colors are initialized before applying
        this.settings.menuColor = this.settings.menuColor || '#ffffff';
        this.settings.scheduleColor = this.settings.scheduleColor || '#ffffff';
        this.settings.backgroundColor = this.settings.backgroundColor || '#f0f7ff';
        this.settings.primaryColor = this.settings.primaryColor || '#60a5fa';
        this.settings.primaryHover = this.settings.primaryHover || '#93c5fd';
        this.settings.primaryPressed = this.settings.primaryPressed || '#3b82f6';
        this.settings.primaryBg = this.settings.primaryBg || '#e0f2fe';
        this.settings.shadowColor = this.settings.shadowColor || 'rgba(96, 165, 250, 0.15)';

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
    };
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
