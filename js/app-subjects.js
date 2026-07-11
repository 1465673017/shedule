// app-subjects.js - Subject and student pool management
// Auto-split from script.js

TimetableApp.prototype.openSubjectModal = function(subject = null) {
        this.editingSubject = subject;
        const modal = document.getElementById('subjectModal');
        const title = document.getElementById('modalTitle');
        const nameLabel = document.getElementById('nameLabel');
        const teacherLabel = document.getElementById('teacherLabel');
        const nameInput = document.getElementById('subjectName');
        const teacherInput = document.getElementById('teacherName');
        const gradeSelector = document.getElementById('gradeSelector');
        const deleteBtn = document.getElementById('deleteSubjectBtn');
        const oneV1Toggle = document.getElementById('oneV1Toggle');

        title.textContent = '科目设置';
        nameLabel.textContent = '科目名称';
        teacherLabel.textContent = '老师姓名';
        teacherInput.placeholder = '可选';

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
        
        modal.style.display = 'block';
    }

TimetableApp.prototype.closeSubjectModal = function() {
        document.getElementById('subjectModal').style.display = 'none';
        this.editingSubject = null;
        document.getElementById('oneV1Btn').classList.remove('active');
        document.getElementById('auditionBtn').classList.remove('active');
    }

TimetableApp.prototype.toggleOneV1 = function() {
        const oneV1Btn = document.getElementById('oneV1Btn');
        const auditionBtn = document.getElementById('auditionBtn');
        oneV1Btn.classList.toggle('active');
        if (oneV1Btn.classList.contains('active')) {
            auditionBtn.classList.remove('active');
        }
    }

TimetableApp.prototype.toggleAudition = function() {
        const auditionBtn = document.getElementById('auditionBtn');
        const oneV1Btn = document.getElementById('oneV1Btn');
        auditionBtn.classList.toggle('active');
        if (auditionBtn.classList.contains('active')) {
            oneV1Btn.classList.remove('active');
        }
    }

TimetableApp.prototype.saveSubject = function(e) {
        e.preventDefault();
        
        const name = document.getElementById('subjectName').value.trim();
        const extra = document.getElementById('teacherName').value.trim();
        const color = document.getElementById('customColor').value;
        
        if (!name) return;
        
        if (this.currentPool === 'subject') {
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
        } else if (this.currentPool === 'student') {
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

TimetableApp.prototype.deleteSubject = function() {
        if (this.editingSubject) {
            if (this.currentPool === 'subject') {
                this.deleteSubjectFromPool(this.editingSubject.id);
            } else {
                this.deleteStudentFromPool(this.editingSubject.id);
            }
            this.closeSubjectModal();
        }
    }

TimetableApp.prototype.deleteSubjectFromPool = function(subjectId) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (subject) {
            this.subjects = this.subjects.filter(s => s.id !== subjectId);
            window.ScheduleErpService.removeSubjectFromSchedule(this, subjectId);
            this.syncRealtime();
        }
    }

TimetableApp.prototype.openStudentModal = function(student = null) {
        this.editingSubject = student;
        const modal = document.getElementById('subjectModal');
        const title = document.getElementById('modalTitle');
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
        nameLabel.textContent = '学生姓名';
        teacherLabel.textContent = '学生年级';

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

        document.getElementById('colorFormGroup').style.display = 'none';
        modal.style.display = 'block';
    }

TimetableApp.prototype.saveStudent = function(e) {
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

TimetableApp.prototype.deleteStudentFromPool = function(studentId) {
        this.students = this.students.filter(s => s.id !== studentId);

        window.ScheduleErpService.removeStudentEverywhere(this, studentId);
        this.syncRealtime();
    }

TimetableApp.prototype.selectColor = function(e) {
        const color = e.target.dataset.color;
        document.getElementById('customColor').value = color;
        document.getElementById('customColorText').value = color;
        
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        e.target.classList.add('selected');
    }

TimetableApp.prototype.selectColorByValue = function(color) {
        document.getElementById('customColor').value = color;
        document.getElementById('customColorText').value = color;
        
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === color);
        });
    }

TimetableApp.prototype.renderSubjects = function() {
        const pool = document.getElementById('subjectPool');
        pool.innerHTML = '';

let items = this.currentPool === 'subject' ? this.subjects : this.students;
        
        if (this.currentPool === 'student' && this.currentStudentFilter !== 'all') {
            items = items.filter(student => {
                if (this.currentStudentFilter === 'ongoing') {
                    return !student.isAudition && !student.completed && this.isStudentOngoing(student.id);
                } else if (this.currentStudentFilter === 'completed') {
                    return !!student.completed;
                } else if (this.currentStudentFilter === 'audition') {
                    return student.isAudition && !student.completed && !this.isStudentCompleted(student.id);
                }
                return true;
            });
        }

        // 学生池中已结课的学生排在最后
        if (this.currentPool === 'student') {
            items = [...items].sort((a, b) => {
                if (a.completed && !b.completed) return 1;
                if (!a.completed && b.completed) return -1;
                return 0;
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
                card.style.borderLeft = `4px solid ${item.color}`;
            } else {
                card.dataset.studentId = item.id;
                const dynamicColor = this.getStudentGradeColor(item);
                card.style.borderLeft = `4px solid ${dynamicColor}`;
                card.style.position = 'relative';
            }

            const extraInfo = this.currentPool === 'subject' ? item.teacher : item.grade;
            const extraHtml = extraInfo ? `<div class="teacher-name">${extraInfo}</div>` : '';
            const nameStyle = !extraInfo ? 'style="line-height: 40px;"' : '';
            const oneV1Badge = (this.currentPool === 'student' && item.is1v1) ? '<span class="one-v1-badge">1v1</span>' : '';
            const auditionBadge = (this.currentPool === 'student' && item.isAudition) ? '<span class="audition-badge">试</span>' : '';
            const completedBadge = (this.currentPool === 'student' && item.completed) ? '<span class="completed-badge">结</span>' : '';

            card.innerHTML = `
                ${oneV1Badge}
                ${auditionBadge}
                ${completedBadge}
                <div class="subject-info">
                    <div class="subject-name" ${nameStyle}>${item.name}</div>
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

    // ========== 课程池（从课表自动生成） ==========

