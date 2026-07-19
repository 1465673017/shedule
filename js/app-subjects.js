// app-subjects.js - Subject and student pool management
// Auto-split from script.js

TimetableApp.prototype.openSubjectModal = function (subject = null) {
    this.editingEntityType = 'subject';
    this.editingSubject = subject;
    const modal = document.getElementById('subjectModal');
    const modalPanel = modal.querySelector('.entity-editor-modal');
    modalPanel?.classList.add('subject-mode');
    modalPanel?.classList.remove('student-mode');
    const title = document.getElementById('modalTitle');
    const subtitle = document.getElementById('entityModalSubtitle');
    const nameLabel = document.getElementById('nameLabel');
    const teacherLabel = document.getElementById('teacherLabel');
    const nameInput = document.getElementById('subjectName');
    const teacherInput = document.getElementById('teacherName');
    const gradeSelector = document.getElementById('gradeSelector');
    const deleteBtn = document.getElementById('deleteSubjectBtn');
    const oneV1Toggle = document.getElementById('oneV1Toggle');

    title.textContent = subject ? '编辑科目' : '添加科目';
    if (subtitle) subtitle.textContent = '设置科目名称、老师和课程卡片的显示颜色';
    nameLabel.textContent = '科目名称';
    teacherLabel.innerHTML = '老师姓名 <span class="optional-label">（可选）</span>';
    nameInput.placeholder = '请输入科目名称（如：语文）';
    teacherInput.placeholder = '请填写老师姓名（可选）';

    // 隐藏1v1开关
    oneV1Toggle.style.display = 'none';

    teacherInput.style.display = 'block';
    gradeSelector.style.display = 'none';
    document.getElementById('colorFormGroup').style.display = 'block';

    if (subject) {
        nameInput.value = subject.name;
        teacherInput.value = subject.teacher;
        this.selectColorByValue(subject.color);
        deleteBtn.style.display = 'block';
    } else {
        nameInput.value = '';
        teacherInput.value = '';
        this.selectColorByValue('#FF6B6B');
        deleteBtn.style.display = 'none';
    }

    const nameCount = document.getElementById('subjectNameCount');
    if (nameCount) nameCount.textContent = `${nameInput.value.length} / 20`;

    modal.style.display = 'block';
}

TimetableApp.prototype.closeSubjectModal = function () {
    document.getElementById('subjectModal').style.display = 'none';
    this.editingSubject = null;
    this.editingEntityType = null;
    document.getElementById('oneV1Btn').classList.remove('active');
    document.getElementById('auditionBtn').classList.remove('active');
}

TimetableApp.prototype.toggleOneV1 = function () {
    const oneV1Btn = document.getElementById('oneV1Btn');
    const auditionBtn = document.getElementById('auditionBtn');
    oneV1Btn.classList.toggle('active');
    if (oneV1Btn.classList.contains('active')) {
        auditionBtn.classList.remove('active');
    }
}

TimetableApp.prototype.toggleAudition = function () {
    const auditionBtn = document.getElementById('auditionBtn');
    const oneV1Btn = document.getElementById('oneV1Btn');
    auditionBtn.classList.toggle('active');
    if (auditionBtn.classList.contains('active')) {
        oneV1Btn.classList.remove('active');
    }
}

TimetableApp.prototype.saveSubject = function (e) {
    e.preventDefault();

    const name = document.getElementById('subjectName').value.trim();
    const extra = document.getElementById('teacherName').value.trim();
    const color = document.getElementById('customColor').value;

    if (!name) return;

    const entityType = this.editingEntityType || (this.currentPool === 'student' ? 'student' : 'subject');

    if (entityType === 'subject') {
        if (this.editingSubject) {
            this.editingSubject.name = name;
            this.editingSubject.teacher = extra;
            this.editingSubject.color = color;
        } else {
            const subject = {
                id: Date.now().toString(),
                name,
                teacher: extra,
                color
            };
            this.subjects.push(subject);
        }
    } else if (entityType === 'student') {
        const selectedGradeChip = document.querySelector('.grade-chip.selected');
        const grade = selectedGradeChip ? selectedGradeChip.dataset.gradeName : '';
        const gradeId = selectedGradeChip ? selectedGradeChip.dataset.gradeId : '';
        const gradeInfo = this.grades.find(g => g.id === gradeId);
        const gradeColor = gradeInfo ? gradeInfo.color : '#666666';
        const is1v1 = document.getElementById('oneV1Btn').classList.contains('active');
        const isAudition = document.getElementById('auditionBtn').classList.contains('active') && !is1v1;
        if (this.editingSubject) {
            this.editingSubject.name = name;
            this.editingSubject.grade = grade;
            this.editingSubject.color = gradeColor;
            this.editingSubject.is1v1 = is1v1;
            this.editingSubject.isAudition = isAudition;
        } else {
            const student = {
                id: Date.now().toString(),
                name,
                grade: grade,
                color: gradeColor,
                is1v1: is1v1,
                isAudition: isAudition
            };
            this.students.push(student);
        }
    }

    this.syncRealtime();
    this.closeSubjectModal();
}

TimetableApp.prototype.deleteSubject = function () {
    if (this.editingSubject) {
        if (this.editingEntityType === 'subject') {
            this.deleteSubjectFromPool(this.editingSubject.id);
        } else {
            this.deleteStudentFromPool(this.editingSubject.id);
        }
        this.closeSubjectModal();
    }
}

TimetableApp.prototype.deleteSubjectFromPool = function (subjectId) {
    const subject = this.subjects.find(s => s.id === subjectId);
    if (subject) {
        this.subjects = this.subjects.filter(s => s.id !== subjectId);
        window.ScheduleErpService.removeSubjectFromSchedule(this, subjectId);
        this.syncRealtime();
    }
}

TimetableApp.prototype.openStudentModal = function (student = null) {
    this.editingEntityType = 'student';
    this.editingSubject = student;
    const modal = document.getElementById('subjectModal');
    const modalPanel = modal.querySelector('.entity-editor-modal');
    modalPanel?.classList.add('student-mode');
    modalPanel?.classList.remove('subject-mode');
    const title = document.getElementById('modalTitle');
    const subtitle = document.getElementById('entityModalSubtitle');
    const nameLabel = document.getElementById('nameLabel');
    const teacherLabel = document.getElementById('teacherLabel');
    const nameInput = document.getElementById('subjectName');
    const teacherInput = document.getElementById('teacherName');
    const gradeSelector = document.getElementById('gradeSelector');
    const deleteBtn = document.getElementById('deleteSubjectBtn');
    const oneV1Toggle = document.getElementById('oneV1Toggle');
    const oneV1Btn = document.getElementById('oneV1Btn');
    const auditionBtn = document.getElementById('auditionBtn');

    title.textContent = student ? '编辑学生' : '添加学生';
    if (subtitle) subtitle.textContent = '填写学生信息，并按需要设置学生类型';
    nameLabel.textContent = '学生姓名';
    teacherLabel.textContent = '学生年级';
    nameInput.placeholder = '请输入学生姓名';

    oneV1Toggle.style.display = 'flex';
    oneV1Btn.classList.remove('active');
    auditionBtn.classList.remove('active');
    if (student && student.is1v1) {
        oneV1Btn.classList.add('active');
    } else if (student && student.isAudition) {
        auditionBtn.classList.add('active');
    }

    teacherInput.style.display = 'none';
    gradeSelector.style.display = 'grid';

    gradeSelector.innerHTML = '';
    this.grades.forEach(grade => {
        const gradeChip = document.createElement('div');
        gradeChip.className = 'grade-chip';
        gradeChip.dataset.gradeId = grade.id;
        gradeChip.dataset.gradeName = grade.name;
        gradeChip.style.backgroundColor = grade.color;
        gradeChip.textContent = grade.name;

        if (student && student.grade === grade.name) {
            gradeChip.classList.add('selected');
        }

        gradeChip.addEventListener('click', () => {
            document.querySelectorAll('.grade-chip').forEach(c => c.classList.remove('selected'));
            gradeChip.classList.add('selected');
        });

        gradeSelector.appendChild(gradeChip);
    });

    if (student) {
        nameInput.value = student.name;
        deleteBtn.style.display = 'block';
    } else {
        nameInput.value = '';
        deleteBtn.style.display = 'none';
    }

    const nameCount = document.getElementById('subjectNameCount');
    if (nameCount) nameCount.textContent = `${nameInput.value.length} / 20`;

    document.getElementById('colorFormGroup').style.display = 'none';
    modal.style.display = 'block';
}

TimetableApp.prototype.saveStudent = function (e) {
    e.preventDefault();

    const name = document.getElementById('subjectName').value.trim();
    const selectedGradeChip = document.querySelector('.grade-chip.selected');
    const grade = selectedGradeChip ? selectedGradeChip.dataset.gradeName : '';
    const gradeId = selectedGradeChip ? selectedGradeChip.dataset.gradeId : '';
    const gradeInfo = this.grades.find(g => g.id === gradeId);
    const color = gradeInfo ? gradeInfo.color : '';

    if (!name) return;

    if (this.editingSubject) {
        this.editingSubject.name = name;
        this.editingSubject.grade = grade;
        this.editingSubject.color = color;
    } else {
        const student = {
            id: Date.now().toString(),
            name,
            grade,
            color
        };
        this.students.push(student);
    }

    this.syncRealtime();
    this.closeSubjectModal();
}

TimetableApp.prototype.openStudentBatchModal = function () {
    const modal = document.getElementById('studentBatchModal');
    const namesInput = document.getElementById('studentBatchNames');
    if (!modal || !namesInput) return;

    namesInput.value = '';
    const message = document.getElementById('studentBatchImportMessage');
    if (message) message.textContent = '';
    this._courseImportFromCurrentStage = false;
    modal.style.display = 'block';
    namesInput.focus();
}

TimetableApp.prototype.closeStudentBatchModal = function () {
    const modal = document.getElementById('studentBatchModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

TimetableApp.prototype.clearStudentBatchInput = function () {
    const input = document.getElementById('studentBatchNames');
    const message = document.getElementById('studentBatchImportMessage');
    if (input) input.value = '';
    if (message) message.textContent = '';
    this._courseImportFromCurrentStage = false;
}

TimetableApp.prototype.isStudentBatchJson = function () {
    const input = document.getElementById('studentBatchNames');
    const rawText = input ? input.value.trim() : '';
    const normalized = window.CourseDataImportService
        && typeof window.CourseDataImportService.normalizeMarkedInput === 'function'
        ? window.CourseDataImportService.normalizeMarkedInput(rawText)
        : { text: rawText };
    const text = normalized.text;
    if (normalized.hasStageMarker) return true;
    if (!text) return false;
    try {
        const value = JSON.parse(text);
        return value !== null && typeof value === 'object';
    } catch (_) {
        return false;
    }
}

TimetableApp.prototype.parseStudentBatchEntries = function (text) {
    let source = String(text || '').trim();
    let groupGradeNumber = null;
    // 前后编号是“整组年级”语法，只在确实包含多个姓名时启用。
    // 否则像 1000001 这样的纯数字姓名会被误删末尾的 1。
    const hasMultipleNames = /[、,，\n]/.test(source);
    const groupMatch = hasMultipleNames ? source.match(/^(1[0-2]|[1-9])([\s\S]*?)\1$/) : null;
    if (groupMatch) {
        groupGradeNumber = Number(groupMatch[1]);
        source = groupMatch[2].trim();
    }

    return source.split(/[、,，\n]+/).map(item => item.trim()).filter(Boolean).map(item => {
        let name = item;
        let gradeNumber = groupGradeNumber;
        if (!gradeNumber) {
            // 10–12 只在后面紧跟非数字姓名时按两位年级识别；数字姓名
            // 如 1000001 应识别为“一年级 + 000001”。
            const prefix = item.match(/^(1[0-2])\s*(\D.*)$/)
                || item.match(/^([1-9])\s*(.+)$/);
            const suffix = item.match(/^(.*\D)\s*(1[0-2])$/)
                || item.match(/^(.+?)\s*([1-9])$/);
            if (prefix) {
                gradeNumber = Number(prefix[1]);
                name = prefix[2].trim();
            } else if (suffix) {
                gradeNumber = Number(suffix[2]);
                name = suffix[1].trim();
            }
        }
        return { name, gradeNumber: gradeNumber || 1 };
    }).filter(entry => entry.name);
}

TimetableApp.prototype.getBatchGradeByNumber = function (gradeNumber) {
    return this.grades.find(grade => grade.id === `g${gradeNumber}`)
        || this.grades[gradeNumber - 1]
        || null;
}

TimetableApp.prototype.saveStudentBatch = async function (e) {
    e.preventDefault();

    const namesInput = document.getElementById('studentBatchNames');
    if (!namesInput) return;

    if (this.isStudentBatchJson()) {
        await this.importCourseDataText(namesInput.value, document.getElementById('studentBatchImportMessage'));
        return;
    }

    const entries = this.parseStudentBatchEntries(namesInput.value);
    if (entries.length === 0) {
        alert('请输入至少一个学生姓名（可用顿号、逗号或换行分隔）。');
        return;
    }

    const invalidEntry = entries.find(entry => !this.getBatchGradeByNumber(entry.gradeNumber));
    if (invalidEntry) {
        alert(`未找到编号 ${invalidEntry.gradeNumber} 对应的年级，请先检查基础设置中的年级。`);
        return;
    }

    const existingKeys = new Set(
        this.students.map(student => `${(student.name || '').trim()}__${student.grade || ''}`)
    );

    entries.forEach((entry, index) => {
        const gradeInfo = this.getBatchGradeByNumber(entry.gradeNumber);
        const name = entry.name;
        const studentKey = `${name}__${gradeInfo.name}`;
        if (existingKeys.has(studentKey)) return;

        this.students.push({
            id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            grade: gradeInfo.name,
            color: gradeInfo.color
        });
        existingKeys.add(studentKey);
    });

    this.syncRealtime();
    this.closeStudentBatchModal();
}

TimetableApp.prototype.deleteStudentFromPool = function (studentId) {
    this.students = this.students.filter(s => s.id !== studentId);

    window.ScheduleErpService.removeStudentEverywhere(this, studentId);
    this.syncRealtime();
}

TimetableApp.prototype.selectColor = function (e) {
    const color = e.target.dataset.color;
    document.getElementById('customColor').value = color;
    document.getElementById('customColorText').value = color;

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    e.target.classList.add('selected');
}

TimetableApp.prototype.selectColorByValue = function (color) {
    document.getElementById('customColor').value = color;
    document.getElementById('customColorText').value = color;

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === color);
    });
}

TimetableApp.prototype.renderSubjects = function () {
    const pool = document.getElementById('subjectPool');
    pool.innerHTML = '';

    let items = this.currentPool === 'subject' ? this.subjects : this.students;

    const scheduledStudentIds = new Set();
    if (this.currentPool === 'student') {
        this.students.forEach(student => {
            if (this.hasStudentEverScheduled(student.id)) {
                scheduledStudentIds.add(String(student.id));
            }
        });
    }

    if (this.currentPool === 'student' && this.currentStudentFilter !== 'all') {
        items = items.filter(student => {
            if (this.currentStudentFilter === 'ongoing') {
                return !student.isAudition
                    && !student.completed
                    && typeof this.isStudentOngoing === 'function'
                    && this.isStudentOngoing(student.id);
            } else if (this.currentStudentFilter === 'completed') {
                return !!student.completed && !student.isAudition;
            } else if (this.currentStudentFilter === 'audition') {
                return !!student.isAudition;
            }
            return true;
        });
    }

    // 学生池按状态分组，再按姓名拼音/首字母排序。
    if (this.currentPool === 'student') {
        const nameCollator = typeof Intl !== 'undefined' && Intl.Collator
            ? new Intl.Collator('zh-CN-u-co-pinyin', { sensitivity: 'base', numeric: true })
            : null;
        const getPriority = student => {
            const scheduled = scheduledStudentIds.has(String(student.id));
            if (student.isAudition) return scheduled ? 4 : 0;
            if (student.completed) return 3;
            return scheduled ? 2 : 1;
        };
        items = [...items].sort((a, b) => {
            const priorityDiff = getPriority(a) - getPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            const aName = String(a.name || '').trim();
            const bName = String(b.name || '').trim();
            return nameCollator ? nameCollator.compare(aName, bName) : aName.localeCompare(bName);
        });
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.draggable = true;
        card.dataset.itemType = this.currentPool;
        card.dataset.itemId = item.id;

        if (this.currentPool === 'subject') {
            card.dataset.subjectId = item.id;
            card.classList.add('subject-type');
            card.style.setProperty('--card-color', item.color);
        } else {
            card.dataset.studentId = item.id;
            const dynamicColor = this.getStudentGradeColor(item);
            card.classList.add('student-type');
            card.style.setProperty('--card-color', dynamicColor || '#666666');
        }

        const extraInfo = this.currentPool === 'subject' ? item.teacher : item.grade;
        const extraClass = this.currentPool === 'subject' ? 'teacher-name' : 'grade-label';
        const extraHtml = extraInfo ? `<div class="${extraClass}">${this.escapeHtml(extraInfo)}</div>` : '';
        const oneV1Badge = (this.currentPool === 'student' && item.is1v1) ? '<span class="status-badge one-v1">1v1</span>' : '';
        const auditionBadge = (this.currentPool === 'student' && item.isAudition) ? '<span class="status-badge audition">试</span>' : '';
        const completedBadge = (this.currentPool === 'student' && item.completed) ? '<span class="status-badge completed">结</span>' : '';
        const assignedBadge = (this.currentPool === 'student' && item.isAudition && scheduledStudentIds.has(String(item.id)))
            ? '<span class="assigned-badge">已排课</span>'
            : '';

        card.innerHTML = `
                <div class="status-badges">
                    ${completedBadge}
                    ${auditionBadge}
                    ${oneV1Badge}
                </div>
                ${assignedBadge}
                <div class="subject-info">
                    <div class="subject-name">${this.escapeHtml(item.name)}</div>
                    ${extraHtml}
                </div>
                <div class="subject-actions">
                    <button class="btn-icon edit-btn" title="编辑" data-action="edit">✏️</button>
                    <button class="btn-icon delete-btn" title="删除" data-action="delete">🗑️</button>
                </div>
            `;

        // 编辑按钮事件
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentPool === 'subject') {
                this.openSubjectModal(item);
            } else {
                this.openStudentModal(item);
            }
        });

        // 删除按钮事件
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentPool === 'subject') {
                this.deleteSubjectFromPool(item.id);
            } else {
                this.deleteStudentFromPool(item.id);
            }
        });

        // 点击卡片主体也打开编辑
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            if (this.currentPool === 'subject') {
                this.openSubjectModal(item);
            } else {
                this.openStudentModal(item);
            }
        });

        pool.appendChild(card);
    });
}
