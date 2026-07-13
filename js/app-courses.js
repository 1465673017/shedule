// app-courses.js - Course management

// Auto-split from script.js

TimetableApp.prototype.ensureTemporarySwapButton = function() {

        const header = document.querySelector('#addLessonModal .modal-header');

        const closeBtn = header ? header.querySelector('.modal-close') : null;

        if (!header || !closeBtn) return null;

        let btn = document.getElementById('temporarySwapBtn');

        if (!btn) {

            btn = document.createElement('button');

            btn.type = 'button';

            btn.id = 'temporarySwapBtn';

            btn.className = 'btn secondary btn-sm temporary-swap-btn';

            btn.textContent = '临时换课';

            btn.addEventListener('click', () => this.startTemporaryCourseEdit());

            header.insertBefore(btn, closeBtn);

        }

        return btn;

    }

TimetableApp.prototype.updateTemporarySwapButton = function(show, active = false) {

        const btn = this.ensureTemporarySwapButton();

        if (!btn) return;

        btn.style.display = show ? 'inline-flex' : 'none';

        btn.classList.toggle('active', !!active);

        btn.textContent = active ? '临时换课中' : '临时换课';

    }

TimetableApp.prototype.getNextWeekStartStr = function(weekStartStr) {

        const parts = String(weekStartStr || '').split('-').map(Number);

        const nextDate = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);

        nextDate.setDate(nextDate.getDate() + 7);

        return this.formatLocalDate(nextDate);

    }

TimetableApp.prototype.canTemporarySwapCellCourse = function(key, weekStartStr, version) {

        if (!key || !weekStartStr || !version || !version.subject) return false;

        const nextWeekStr = this.getNextWeekStartStr(weekStartStr);

        const nextVersion = this.getCellVersion(key, nextWeekStr);

        if (!nextVersion || !nextVersion.subject) return false;

        if (nextVersion.courseInstanceId && version.courseInstanceId && nextVersion.courseInstanceId === version.courseInstanceId) {

            return true;

        }

        if (nextVersion.courseTemplateId && version.courseTemplateId && nextVersion.courseTemplateId === version.courseTemplateId) {

            return true;

        }

        return false;

    }

TimetableApp.prototype.startTemporaryCourseEdit = function() {

        if (!this.selectedCell) return;

        const day = this.selectedCell.dataset.day;

        const period = this.selectedCell.dataset.period;
        const key = this.buildCellKey(day, period);

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        const version = this.getCellVersion(key, weekStartStr);

        if (!this.canTemporarySwapCellCourse(key, weekStartStr, version)) return;

        this.isTemporaryCourseEdit = true;

        this._temporaryCourseSourceVersion = version ? {
            ...version,
            student: Array.isArray(version.student) ? version.student.slice() : []
        } : null;

        this.renderSubjectPicker('');

        this.renderLessonStudentPicker([], [key]);

        this.updateTemporarySwapButton(true, true);

    }

TimetableApp.prototype.openAddLessonModal = function(cell) {

        this.selectedCell = cell;

        this.editingCourse = null;

        this.isAddingManualCourse = false;

        this.isTemporaryCourseEdit = false;

        this._temporaryCourseSourceVersion = null;

        const modal = document.getElementById('addLessonModal');

        const title = document.getElementById('addLessonTitle');

        const day = cell.dataset.day;

        const period = cell.dataset.period;
        const key = this.buildCellKey(day, period);

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        const version = this.getCellVersion(key, weekStartStr);

        title.textContent = version ? '编辑课程' : '添加课程';

        const selectedSubjectId = version && version.subject ? version.subject : '';

        this.renderSubjectPicker(selectedSubjectId);

        const existingStudentIds = version && version.student && Array.isArray(version.student)

            ? version.student

            : [];

        this.renderLessonStudentPicker(existingStudentIds, [key]);

        this.updateTemporarySwapButton(this.canTemporarySwapCellCourse(key, weekStartStr, version), false);

        modal.style.display = 'block';

    }

TimetableApp.prototype.openCourseEditModal = function(course) {

        this.selectedCell = null;

        this.editingCourse = course;

        this.isTemporaryCourseEdit = false;

        this._temporaryCourseSourceVersion = null;

        const modal = document.getElementById('addLessonModal');

        const title = document.getElementById('addLessonTitle');

        title.textContent = '编辑课程';

        this.renderSubjectPicker(course.subjectId);

        if (course.isManual) {

            this._courseEditMatchedKeys = [];

            this.renderLessonStudentPicker(course.studentIds, []);

        } else {

            const matchedKeys = [];

            this.renderLessonStudentPicker(course.studentIds, matchedKeys);

        }

        this.updateTemporarySwapButton(false, false);

        modal.style.display = 'block';

    }

TimetableApp.prototype.openManualCourseModal = function() {

        this.selectedCell = null;

        this.editingCourse = null;

        this.isAddingManualCourse = true;

        this.isTemporaryCourseEdit = false;

        this._temporaryCourseSourceVersion = null;

        const modal = document.getElementById('addLessonModal');

        const title = document.getElementById('addLessonTitle');

        title.textContent = '添加课程';

        this.renderSubjectPicker('');

        this.renderLessonStudentPicker([]);

        this.updateTemporarySwapButton(false, false);

        modal.style.display = 'block';

    }

TimetableApp.prototype.renderSubjectPicker = function(selectedId = '') {

        const picker = document.getElementById('lessonSubjectPicker');

        picker.innerHTML = '';

        if (this.subjects.length === 0) {

            picker.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">暂无科目，请先添加科目</div>';

            return;

        }

        this.subjects.forEach(subject => {

            const chip = document.createElement('div');

            chip.className = 'subject-chip';

            if (subject.id === selectedId) {

                chip.classList.add('selected');

            }

            chip.style.backgroundColor = subject.color;

            chip.dataset.subjectId = subject.id;

            const subjectIcons = {
                '语文': '▤', '数学': '▦', '英语': 'A', '物理': '∪', '化学': '△',
                '生物': '♧', '历史': '⌂', '道德': '▥', '道德与法制': '▥',
                '跨学科': '◎', '未分类': '▦', '地理': '◎', '政治': '▥'
            };
            const icon = subjectIcons[subject.name] || subject.name.slice(0, 1);
            chip.innerHTML = `<span class="sc-name">${subject.name}</span>`;

            chip.addEventListener('click', () => {

                document.querySelectorAll('.subject-chip').forEach(c => c.classList.remove('selected'));

                chip.classList.add('selected');

            });

            picker.appendChild(chip);

        });

    }

TimetableApp.prototype.closeAddLessonModal = function() {

        document.getElementById('addLessonModal').style.display = 'none';

        this.selectedCell = null;

        this.editingCourse = null;

        this.isAddingManualCourse = false;

        this.isTemporaryCourseEdit = false;

        this._temporaryCourseSourceVersion = null;

        this._courseEditMatchedKeys = null;

        this.updateTemporarySwapButton(false, false);

    }

TimetableApp.prototype.renderLessonStudentPicker = function(selectedIds = [], excludeKeys = []) {

        this._pickerExcludeKeys = excludeKeys;

        const picker = document.getElementById('lessonStudentPicker');

        const countTag = document.getElementById('lessonStudentCount');

        picker.innerHTML = '';
        const searchInput = document.getElementById('lessonStudentSearch');
        if (searchInput) searchInput.value = '';

        if (this.students.length === 0) {

            picker.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">暂无学生，请先添加学生</div>';

            countTag.textContent = '';

            return;

        }

        // 课程池模式下（手动添加或编辑课程表中的课程），试听学生不可选。

        const isCoursePoolMode = this.isAddingManualCourse || !!this.editingCourse;

        const hasSelected1v1 = selectedIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && s.is1v1;

        });

        const hasSelectedNon1v1 = selectedIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && !s.is1v1;

        });

        this.students.forEach(student => {

            const isSelected = selectedIds.includes(student.id);

            if (student.completed && !isSelected) {

                return;

            }

            if (student.isAudition && !isSelected) {

                if (this.hasAuditionStudentEverScheduled(student.id, excludeKeys)) {

                    return;

                }

            }

            if (isCoursePoolMode && student.isAudition && !selectedIds.includes(student.id)) {

                return;

            }

            const chip = document.createElement('div');

            chip.className = 'student-chip';

            if (isSelected) {

                chip.classList.add('selected');

            }

            if (hasSelected1v1 && !student.is1v1 && !isSelected) {

                chip.classList.add('disabled');

            }

            if (hasSelectedNon1v1 && student.is1v1 && !isSelected) {

                chip.classList.add('disabled');

            }

            // 课程池模式下，所有试听学生不可选（试听学生只能通过拖拽和课表单元格直接添加）。

        if (isCoursePoolMode && student.isAudition && !isSelected) {

                chip.classList.add('disabled');

            }

            let isAssignedElsewhere = false;

            if (student.isAudition && !isSelected && !isCoursePoolMode) {

                const assignedKeys = this.getAuditionStudentAssignedKeys(student.id, excludeKeys);

                if (assignedKeys.length > 0) {

                    chip.classList.add('disabled');

                    isAssignedElsewhere = true;

                }

            }

            chip.dataset.studentId = student.id;
            chip.dataset.searchText = `${student.name} ${student.grade || ''}`.toLowerCase();

            const oneV1Badge = student.is1v1 ? '<span class="one-v1-badge">1v1</span>' : '';

            const auditionBadge = student.isAudition ? '<span class="audition-badge">试</span>' : '';

            const assignedBadge = isAssignedElsewhere ? '<span class="assigned-badge">已排课</span>' : '';

            chip.innerHTML = `

                <span class="sc-name">${student.name}</span>

                <span class="sc-grade">${student.grade || ''}</span>

                ${oneV1Badge}

                ${auditionBadge}

                ${assignedBadge}

            `;

            chip.addEventListener('click', () => {

                if (chip.classList.contains('disabled')) {

                    return;

                }

                if (chip.classList.contains('selected')) {

                    chip.classList.remove('selected');

                    this.refreshStudentPickerDisabledState();

                } else {

                    const selectedCount = document.querySelectorAll('#lessonStudentPicker .student-chip.selected').length;

                    if (selectedCount >= this.MAX_STUDENTS_PER_COURSE) {

                        alert(`每节课最多只能选择 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);

                        return;

                    }

                    const isClicking1v1 = student.is1v1;

                    const selectedChips = document.querySelectorAll('#lessonStudentPicker .student-chip.selected');

                    const hasSelected1v1Current = Array.from(selectedChips).some(c => {

                        const sid = c.dataset.studentId;

                        const s = this.students.find(st => st.id === sid);

                        return s && s.is1v1;

                    });

                    if (isClicking1v1 && selectedCount > 0) {

                        alert('1v1学生只能单独上课，无法与其他学生同时选择');

                        return;

                    }

                    if (!isClicking1v1 && hasSelected1v1Current) {

                        alert('Cannot add other students to a 1v1 course');

                        return;

                    }

                    chip.classList.add('selected');

                    this.refreshStudentPickerDisabledState();

                }

                this.updateLessonStudentCount();

            });

            picker.appendChild(chip);

        });

        this.updateLessonStudentCount();

    }

TimetableApp.prototype.updateLessonStudentCount = function() {

        const countTag = document.getElementById('lessonStudentCount');

        const selected = document.querySelectorAll('#lessonStudentPicker .student-chip.selected');

        countTag.textContent = `已选择 ${selected.length} 人`;

    }

TimetableApp.prototype.filterLessonStudents = function(keyword = '') {

        const normalized = keyword.trim().toLowerCase();

        document.querySelectorAll('#lessonStudentPicker .student-chip').forEach(chip => {

            chip.style.display = !normalized || (chip.dataset.searchText || '').includes(normalized) ? '' : 'none';

        });

    }

TimetableApp.prototype.refreshStudentPickerDisabledState = function() {

        const excludeKeys = this._pickerExcludeKeys || [];

        const selectedChips = document.querySelectorAll('#lessonStudentPicker .student-chip.selected');

        const selectedIds = Array.from(selectedChips).map(c => c.dataset.studentId);

        // 课程池模式下（手动添加或编辑课程表中的课程），试听学生不可选。

        const isCoursePoolMode = this.isAddingManualCourse || !!this.editingCourse;

        const hasSelected1v1 = selectedIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && s.is1v1;

        });

        const hasSelectedNon1v1 = selectedIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && !s.is1v1;

        });

        const allChips = document.querySelectorAll('#lessonStudentPicker .student-chip');

        allChips.forEach(chip => {

            const sid = chip.dataset.studentId;

            const student = this.students.find(st => st.id === sid);

            const isSelected = chip.classList.contains('selected');

            if (isSelected) {

                chip.classList.remove('disabled');

                chip.querySelector('.assigned-badge')?.remove();

                return;

            }

            let shouldDisable = false;

            if (hasSelected1v1 && student && !student.is1v1) {

                shouldDisable = true;

            } else if (hasSelectedNon1v1 && student && student.is1v1) {

                shouldDisable = true;

            }

            // 课程池模式下，所有试听学生不可选（试听学生只能通过拖拽和课表单元格直接添加）。

            if (isCoursePoolMode && student && student.isAudition) {

                shouldDisable = true;

            }

            let isAssignedElsewhere = false;

            if (student && student.isAudition && !isCoursePoolMode) {

                if (this.hasAuditionStudentEverScheduled(student.id, excludeKeys)) {

                    shouldDisable = true;

                    isAssignedElsewhere = true;

                }

            }

            if (shouldDisable) {

                chip.classList.add('disabled');

            } else {

                chip.classList.remove('disabled');

            }

            const existingBadge = chip.querySelector('.assigned-badge');

            if (isAssignedElsewhere && !existingBadge) {

                const badge = document.createElement('span');

                badge.className = 'assigned-badge';

                badge.textContent = 'Assigned';

                chip.appendChild(badge);

            } else if (!isAssignedElsewhere && existingBadge) {

                existingBadge.remove();

            }

        });

    }

TimetableApp.prototype.saveLessonToCell = function(e) {

        e.preventDefault();

        // 如果是课程表编辑模式

        if (this.editingCourse) {

            this.saveCourseEdit();

            return;

        }

        // 如果是手动添加课程模式

        if (this.isAddingManualCourse) {

            this.saveManualCourse();

            return;

        }

        if (this.isTemporaryCourseEdit) {

            this.saveTemporaryCourseEdit();

            return;

        }

        if (!this.selectedCell) return;

        const selectedSubjectChip = document.querySelector('#lessonSubjectPicker .subject-chip.selected');

        if (!selectedSubjectChip) {

            alert('请选择科目');

            return;

        }

        const subjectId = selectedSubjectChip.dataset.subjectId;

        const subject = this.subjects.find(s => s.id == subjectId);

        if (!subject) return;

        const selectedStudentIds = Array.from(document.querySelectorAll('#lessonStudentPicker .student-chip.selected'))

            .map(chip => chip.dataset.studentId);

        if (selectedStudentIds.length > this.MAX_STUDENTS_PER_COURSE) {

            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);

            return;

        }

        const has1v1Student = selectedStudentIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && s.is1v1;

        });

        if (has1v1Student && selectedStudentIds.length > 1) {

            alert('1v1学生只能单独上课');

            return;

        }

        const day = this.selectedCell.dataset.day;

        const period = this.selectedCell.dataset.period;
        const key = this.buildCellKey(day, period);

        for (const studentId of selectedStudentIds) {

            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [key]);

            if (auditionAssigned.length > 0) {

                const student = this.students.find(s => s.id === studentId);

                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);

                return;

            }

        }

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        this.setCellVersion(key, weekStartStr, subjectId,

            selectedStudentIds.length > 0 ? selectedStudentIds.map(id => id.toString()) : []);

        // 试听学生自动设为临时模式（只出现在当前周）

        this.ensureAuditionStudentsTemporary(key, selectedStudentIds);

        this.syncRealtime();

        this.closeAddLessonModal();

    }

    // 保存手动添加的课程到 manualCourses 数组

TimetableApp.prototype.saveTemporaryCourseEdit = function() {

        if (!this.selectedCell) return;

        const selectedSubjectChip = document.querySelector('#lessonSubjectPicker .subject-chip.selected');

        if (!selectedSubjectChip) {

            alert('请选择科目');

            return;

        }

        const subjectId = selectedSubjectChip.dataset.subjectId;

        const subject = this.subjects.find(s => s.id == subjectId);

        if (!subject) return;

        const selectedStudentIds = Array.from(document.querySelectorAll('#lessonStudentPicker .student-chip.selected'))

            .map(chip => chip.dataset.studentId);

        if (selectedStudentIds.length > this.MAX_STUDENTS_PER_COURSE) {

            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);

            return;

        }

        const has1v1Student = selectedStudentIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && s.is1v1;

        });

        if (has1v1Student && selectedStudentIds.length > 1) {

            alert('1v1学生只能单独上课');

            return;

        }

        const day = this.selectedCell.dataset.day;

        const period = this.selectedCell.dataset.period;
        const key = this.buildCellKey(day, period);

        for (const studentId of selectedStudentIds) {

            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [key]);

            if (auditionAssigned.length > 0) {

                const student = this.students.find(s => s.id === studentId);

                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);

                return;

            }

        }

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        const nextWeekStr = this.getNextWeekStartStr(weekStartStr);

        const sourceVersion = this._temporaryCourseSourceVersion || this.getCellVersion(key, weekStartStr);

        const nextVersion = this.getCellVersion(key, nextWeekStr);

        this.setCellVersion(key, weekStartStr, subjectId,

            selectedStudentIds.length > 0 ? selectedStudentIds.map(id => id.toString()) : []);

        this.ensureAuditionStudentsTemporary(key, selectedStudentIds);

        for (const studentId of selectedStudentIds) {

            this.setStudentRecurrence(key, studentId, 'temporary');

        }

        const restoreVersion = nextVersion || sourceVersion;

        if (restoreVersion && (restoreVersion.subject || (restoreVersion.student || []).length > 0)) {

            this.setCellVersion(key, nextWeekStr, restoreVersion.subject, restoreVersion.student || []);

            const restoredVersion = this.getCellVersion(key, nextWeekStr);

            if (restoredVersion && window.ScheduleErpService && typeof window.ScheduleErpService.inheritStudentBranchState === 'function') {

                window.ScheduleErpService.inheritStudentBranchState(
                    this,
                    restoreVersion,
                    restoredVersion,
                    restoreVersion.student || [],
                    nextWeekStr
                );

            }

        }

        this.syncRealtime();

        this.closeAddLessonModal();

    }

TimetableApp.prototype.saveManualCourse = function() {

        const selectedSubjectChip = document.querySelector('#lessonSubjectPicker .subject-chip.selected');

        if (!selectedSubjectChip) {

            alert('请选择科目');

            return;

        }

        const subjectId = selectedSubjectChip.dataset.subjectId;

        const subject = this.subjects.find(s => s.id == subjectId);

        if (!subject) return;

        const selectedStudentIds = Array.from(document.querySelectorAll('#lessonStudentPicker .student-chip.selected'))

            .map(chip => chip.dataset.studentId);

        if (selectedStudentIds.length > this.MAX_STUDENTS_PER_COURSE) {

            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);

            return;

        }

        const has1v1Student = selectedStudentIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && s.is1v1;

        });

        if (has1v1Student && selectedStudentIds.length > 1) {

            alert('1v1学生只能单独上课');

            return;

        }

        // 手动课程模式下，过滤掉试听学生

        const auditionStudents = selectedStudentIds.filter(id => {

            const s = this.students.find(st => st.id === id);

            return s && s.isAudition;

        });

        if (auditionStudents.length > 0) {

            const auditionNames = auditionStudents.map(id => {

                const s = this.students.find(st => st.id === id);

                return s ? s.name : '未知';

            }).join(', ');

            alert(`试听学生「${auditionNames}」不能添加到课程池中，请通过课表直接添加试听学生`);

            return;

        }

        // 检查是否与已有课程重复

        const sortedNew = [...selectedStudentIds].sort().join(',');

        for (const existing of this.manualCourses) {

            const sortedExisting = [...existing.studentIds].sort().join(',');

            if (existing.subjectId === subjectId && sortedExisting === sortedNew) {

                alert('该课程已存在，无需重复添加');

                return;

            }

        }

        // 检查是否与已排课程重复

        const courses = this.computeCoursePool();

        for (const c of courses) {

            const sortedExisting = [...c.studentIds].sort().join(',');

            if (c.subjectId === subjectId && sortedExisting === sortedNew) {

                alert('该课程已存在于课表中，无需重复添加');

                return;

            }

        }

        this.manualCourses.push({

            subjectId,

            studentIds: selectedStudentIds.length > 0 ? selectedStudentIds.map(id => id.toString()) : []

        });

        window.ScheduleErpService.upsertCourseTemplate(this, subjectId, selectedStudentIds, 'manual');

        this.syncRealtime({ timetable: false });

        this.closeAddLessonModal();

    }

TimetableApp.prototype.saveCourseEdit = function() {

        if (!this.editingCourse) return;

        const selectedSubjectChip = document.querySelector('#lessonSubjectPicker .subject-chip.selected');

        if (!selectedSubjectChip) { alert('请选择科目'); return; }

        const newSubjectId = selectedSubjectChip.dataset.subjectId;

        const newStudentIds = Array.from(document.querySelectorAll('#lessonStudentPicker .student-chip.selected')).map(chip => chip.dataset.studentId);

        if (newStudentIds.length > this.MAX_STUDENTS_PER_COURSE) { alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`); return; }

        const has1v1Student = newStudentIds.some(id => {

            const s = this.students.find(st => st.id === id);

            return s && s.is1v1;

        });

        if (has1v1Student && newStudentIds.length > 1) { alert('1v1学生只能单独上课'); return; }

        const oldCourse = this.editingCourse;

        const oldSubjectId = oldCourse.subjectId;

        const oldStudentIds = (oldCourse.studentIds || []).slice().sort();

        const oldSortedKey = oldStudentIds.join(',');

        if (oldCourse.isManual) {

            const auditionStudents = newStudentIds.filter(id => {

                const s = this.students.find(st => st.id === id);

                return s && s.isAudition;

            });

            if (auditionStudents.length > 0) { alert('试听学生不能加入课程池'); return; }

            for (const mc of this.manualCourses) {

                const mcSortedKey = [...(mc.studentIds || [])].sort().join(',');

                if (mc.subjectId === oldSubjectId && mcSortedKey === oldSortedKey) {

                    mc.subjectId = newSubjectId;

                    mc.studentIds = newStudentIds.map(id => id.toString());

                    break;

                }

            }

            window.ScheduleErpService.upsertCourseTemplate(this, newSubjectId, newStudentIds, 'manual');

            this.syncRealtime({ timetable: false });

            this.closeAddLessonModal();

            return;

        }

        const matchedVersions = [];

        const instances = this.erpData && Array.isArray(this.erpData.courseInstances) ? this.erpData.courseInstances : [];

        instances.forEach(instance => {

            if (instance.subjectId !== oldSubjectId) return;

            const instanceStudentIds = Array.isArray(instance.studentIds) ? instance.studentIds.slice().sort().join(',') : '';

            if (instanceStudentIds === oldSortedKey) {

                matchedVersions.push({ key: instance.cellKey, weekStart: instance.weekStart });

            }

        });

        window.ScheduleErpService.archiveCourseTemplate(this, oldSubjectId, oldStudentIds);

        for (const studentId of newStudentIds) {

            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, matchedVersions.map(m => m.key));

            if (auditionAssigned.length > 0) {

                const student = this.students.find(s => s.id === studentId);

                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);

                return;

            }

        }

        for (const { key, weekStart } of matchedVersions) {

            this.setCellVersion(key, weekStart, newSubjectId, newStudentIds.map(id => id.toString()));

            this.ensureAuditionStudentsTemporary(key, newStudentIds);

        }

        this.syncRealtime();

        this.closeAddLessonModal();

    }

TimetableApp.prototype.computeCoursePool = function() {

        const courseMap = new Map();

        const erpInstances = this.erpData && Array.isArray(this.erpData.courseInstances) ? this.erpData.courseInstances : [];

        erpInstances.forEach(instance => {

            if (!instance.subjectId) return;

            const subjectId = instance.subjectId;

            const allStudentIds = Array.isArray(instance.studentIds) ? instance.studentIds.slice() : [];

            const nonAuditionIds = allStudentIds.filter(id => {

                const s = this.students.find(st => st.id === id);

                return s && !s.isAudition;

            });

            const sortedKey = [...nonAuditionIds].sort().join(',');

            const courseKey = `${subjectId}::${sortedKey}`;

            const displayStudentIds = allStudentIds.filter(id => {

                const s = this.students.find(st => st.id === id);

                return s && !s.isAudition;

            });

            if (courseMap.has(courseKey)) {

                courseMap.get(courseKey).count++;

                return;

            }

            const subject = this.subjects.find(s => s.id == subjectId);

            const students = allStudentIds.map(id => this.students.find(s => s.id == id)).filter(Boolean);

            const displayStudents = displayStudentIds.map(id => this.students.find(s => s.id == id)).filter(Boolean);

            const count = this.erpData && Array.isArray(this.erpData.courseInstances)

                ? this.erpData.courseInstances.filter(ci => ci.courseTemplateId === instance.courseTemplateId && !ci.isDeleted).length

                : 1;

            courseMap.set(courseKey, {

                courseTemplateId: instance.courseTemplateId || null,

                subjectId,

                subjectName: subject ? subject.name : '未知科目',

                subjectColor: subject ? subject.color : '#888',

                studentIds: allStudentIds,

                displayStudentIds,

                students,

                displayStudents,

                count,

                courseKey,

                isManual: false

            });

        });

        (this.manualCourses || []).forEach(mc => {

            const studentIds = (mc.studentIds || []).map(id => id.toString());

            const courseKey = `${mc.subjectId}::${[...studentIds].sort().join(',')}`;

            if (courseMap.has(courseKey)) return;

            const subject = this.subjects.find(s => s.id == mc.subjectId);

            const students = studentIds.map(id => this.students.find(s => s.id == id)).filter(Boolean);

            courseMap.set(courseKey, {

                subjectId: mc.subjectId,

                subjectName: subject ? subject.name : '未知科目',

                subjectColor: subject ? subject.color : '#888',

                studentIds,

                displayStudentIds: studentIds,

                students,

                displayStudents: students,

                count: 0,

                courseKey,

                isManual: true

            });

        });

        return Array.from(courseMap.values());

    }

TimetableApp.prototype.renderCoursePool = function(pool) {

        const courses = this.computeCoursePool();

        if (courses.length === 0) {

            pool.innerHTML = '<div class="course-card-empty">课程池暂无课程<br><small>从课表删除的课程会自动显示在这里</small></div>';

            return;

        }

        courses.forEach(course => {

            const card = document.createElement('div');

            card.className = 'course-card';

            if (course.isManual) {

                card.classList.add('course-card-manual');

                card.style.borderLeft = '3px solid #ff9800';

            }

            card.draggable = true;

            card.dataset.itemType = 'course';

            card.dataset.itemId = course.courseKey;

            const displayStudentIds = course.displayStudentIds || course.studentIds;

            const displayStudents = course.displayStudents || course.students;

            card.dataset.courseSubjectId = course.subjectId;

            card.dataset.courseStudentIds = displayStudentIds.join(',');

            const studentsHtml = displayStudents.length > 0

                ? `<div class="course-card-students">${displayStudents.map(s => `<span class="course-student-tag">${s.name}</span>`).join('')}</div>`

                : '';

            const countHtml = course.isManual

                ? '<span class="course-card-count" style="background:rgba(255,152,0,0.2);color:#ff9800;">未排课</span>'

                : `<span class="course-card-count">已排${course.count}次</span>`;

            card.innerHTML = `

                <div class="course-card-header">

                    <span class="course-card-subject" style="background:${course.subjectColor};color:${this.getContrastColor(course.subjectColor)};">

                        ${course.subjectName}

                    </span>

                    ${countHtml}

                </div>

                ${studentsHtml}

                <div class="subject-actions" style="margin-top:4px;justify-content:flex-end;">

                    <button class="btn-icon edit-btn" title="编辑课程" data-action="edit"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5C17.3284 2.67157 18.6716 2.67157 19.5 3.5L20.5 4.5C21.3284 5.32843 21.3284 6.67157 20.5 7.5L8 20H4V16L16.5 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>

                    <button class="btn-icon delete-btn" title="从课程池删除" data-action="delete"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 11V17M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 7V4H15V7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>

                </div>

            `;

            card.querySelector('.edit-btn').addEventListener('click', (e) => {

                e.stopPropagation();

                e.preventDefault();

                this.openCourseEditModal(course);

            });

            card.querySelector('.delete-btn').addEventListener('click', (e) => {

                e.stopPropagation();

                e.preventDefault();

                this.deleteCourseFromPool(course);

            });

            card.addEventListener('click', (e) => {

                if (e.target.closest('button')) return;

                this.openCourseEditModal(course);

            });

            pool.appendChild(card);

        });

    }

TimetableApp.prototype.deleteCourseFromPool = function(course) {

        if (course.isManual) {

            if (!confirm('Delete this course?')) return;

            const oldSubjectId = course.subjectId;

            const oldStudentIds = (course.studentIds || []).slice().sort();

            const oldSortedKey = oldStudentIds.join(',');

            this.manualCourses = this.manualCourses.filter(mc => {

                const mcSortedKey = [...(mc.studentIds || [])].sort().join(',');

                return !(mc.subjectId === oldSubjectId && mcSortedKey === oldSortedKey);

            });

            window.ScheduleErpService.archiveCourseTemplate(this, oldSubjectId, oldStudentIds);

            this.syncRealtime({ timetable: false });

            return;

        }

        const count = course.count || 1;

        if (!confirm('Delete ' + count + ' scheduled course(s)?')) return;

        const oldSubjectId = course.subjectId;

        const oldStudentIds = (course.studentIds || []).slice().sort();

        window.ScheduleErpService.archiveCourseTemplate(this, oldSubjectId, oldStudentIds);

        window.ScheduleErpService.deleteCourseInstancesBySignature(this, oldSubjectId, oldStudentIds);

        this.syncRealtime();

    }

TimetableApp.prototype.getContrastColor = function(hex) {

        if (!hex || hex.length < 7) return '#333';

        const r = parseInt(hex.substring(1, 3), 16);

        const g = parseInt(hex.substring(3, 5), 16);

        const b = parseInt(hex.substring(5, 7), 16);

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        return brightness > 150 ? '#1f2225' : '#ffffff';

    }
