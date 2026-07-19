// app-dragdrop.js - Drag and drop

// Auto-split from script.js

TimetableApp.prototype.setupDragAndDrop = function() {

        // 科目、学生池拖拽

        document.getElementById('subjectPool').addEventListener('dragstart', (e) => {

            const card = e.target.closest('.subject-card');

            if (card) {

                this.draggedItem = {

                    id: card.dataset.itemId,

                    type: card.dataset.itemType

                };

                card.classList.add('dragging');

            }

        });

        document.getElementById('subjectPool').addEventListener('dragend', (e) => {

            const card = e.target.closest('.subject-card');

            if (card) {

                card.classList.remove('dragging');

                this.draggedItem = null;

            }

        });

        // 课表内部拖拽

        const timetable = document.getElementById('timetable');
        const leftSidebar = document.querySelector('.left-sidebar');
        const clearRecycleDragState = () => {
            leftSidebar.classList.remove('drag-over-recycle');
            document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
            this.draggedItem = null;
        };

        // 浏览器取消拖拽、拖出窗口或源元素刷新时，确保删除提示不会残留。
        document.addEventListener('dragend', clearRecycleDragState);
        document.addEventListener('drop', () => setTimeout(clearRecycleDragState, 0));
        window.addEventListener('blur', clearRecycleDragState);

        timetable.addEventListener('dragstart', (e) => {

            const studentCard = e.target.closest('[data-item-type="student"]');

            const subjectCell = e.target.closest('.cell[data-item-type="subject"]');

            if (studentCard) {

                e.stopPropagation();

                e.dataTransfer.setData('text/plain', '');

                this.draggedItem = {

                    id: studentCard.dataset.itemId,

                    type: 'student',

                    sourceDay: studentCard.dataset.sourceDay,

                    sourcePeriod: studentCard.dataset.sourcePeriod

                };

                studentCard.classList.add('dragging');
                leftSidebar.classList.add('drag-over-recycle');

                e.dataTransfer.effectAllowed = 'move';

            } else if (subjectCell) {

                e.dataTransfer.setData('text/plain', '');

                const key = this.buildCellKey(subjectCell.dataset.day, subjectCell.dataset.period);

                const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

                const version = this.getCellVersion(key, weekStartStr);

                this.draggedItem = {

                    id: subjectCell.dataset.itemId,

                    type: 'subject',

                    sourceDay: subjectCell.dataset.day,

                    sourcePeriod: subjectCell.dataset.period,

                    sourceStudents: version ? (version.student || []) : []

                };

                subjectCell.classList.add('dragging');
                leftSidebar.classList.add('drag-over-recycle');

                e.dataTransfer.effectAllowed = 'move';

            }

        });

        timetable.addEventListener('dragend', (e) => {

            const studentCard = e.target.closest('[data-item-type="student"]');

            const subjectCell = e.target.closest('.cell[data-item-type="subject"]');

            if (studentCard) {

                studentCard.classList.remove('dragging');

            }

            if (subjectCell) {

                subjectCell.classList.remove('dragging');

            }

            clearRecycleDragState();

        });

        // 使用事件委托处理表格拖拽

        const validateDrop = (draggedItem, targetKey, excludeKeys = [], showMessage = false) => {

            const rejectDrop = (message) => {

                if (showMessage && message) alert(message);

                return false;

            };

            if (!draggedItem) return false;

            const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

            const existingVersion = this.getCellVersion(targetKey, weekStartStr);

            if (draggedItem.type === 'subject') {

                if (existingVersion && existingVersion.subject) {

                    return rejectDrop('该课时已有课程，请先编辑、移动或删除原课程');

                }

                return true;

            } else {

                const existingStudents = existingVersion ? (existingVersion.student || []) : [];

                const studentExists = existingStudents.includes(draggedItem.id);

                const isFull = existingStudents.length >= this.MAX_STUDENTS_PER_COURSE;

                if (studentExists) return rejectDrop('该学生已经在这节课程中');

                if (isFull) return rejectDrop(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);

                const draggedStudent = this.students.find(s => s.id === draggedItem.id);

                const isDragged1v1 = draggedStudent && draggedStudent.is1v1;

                const { has1v1, studentCount } = this.getCell1v1Status(targetKey);

                if (isDragged1v1 && studentCount > 0) return rejectDrop('1v1课程最多容纳一人');

                if (!isDragged1v1 && has1v1) return rejectDrop('1v1课程最多容纳一人');

                const auditionAssigned = this.getAuditionStudentAssignedKeys(draggedItem.id, excludeKeys);

                if (auditionAssigned.length > 0) {

                    return rejectDrop(this.getAuditionStudentConflictMessage(draggedItem.id, auditionAssigned));

                }

                return true;

            }

        };

        timetable.addEventListener('dragover', (e) => {

            e.preventDefault();

            const cell = e.target.closest('.cell');

            if (cell) {

                const day = cell.dataset.day;

                const period = cell.dataset.period;
                const key = this.buildCellKey(day, period);

                const isInternalDrag = this.draggedItem && this.draggedItem.sourceDay !== undefined;

                if (isInternalDrag && this.draggedItem.type === 'subject') {

                    const isSameCell = this.draggedItem.sourceDay === day && this.draggedItem.sourcePeriod === period;

                    if (isSameCell) {

                        return;

                    }

                }

                if (!cell.classList.contains('occupied')) {

                    cell.classList.add('drag-over');

                } else if (this.draggedItem) {

                    const excludeKeys = isInternalDrag ? [this.buildCellKey(this.draggedItem.sourceDay, this.draggedItem.sourcePeriod)] : [];

                    if (validateDrop(this.draggedItem, key, excludeKeys)) {

                        cell.classList.add('drag-over');

                    }

                }

            }

        });

        timetable.addEventListener('dragleave', (e) => {

            const cell = e.target.closest('.cell');

            if (cell) {

                cell.classList.remove('drag-over');

            }

        });

        timetable.addEventListener('drop', (e) => {

            e.preventDefault();

            const cell = e.target.closest('.cell');

            if (cell) {

                cell.classList.remove('drag-over');

                if (this.draggedItem) {

                    const day = cell.dataset.day;

                    const period = cell.dataset.period;
                    const key = this.buildCellKey(day, period);

                    const isInternalDrag = this.draggedItem.sourceDay !== undefined;

                    const excludeKeys = isInternalDrag ? [this.buildCellKey(this.draggedItem.sourceDay, this.draggedItem.sourcePeriod)] : [];

                    if (this.draggedItem.type === 'subject') {

                        if (isInternalDrag) {

                            const isSameCell = this.draggedItem.sourceDay === day && this.draggedItem.sourcePeriod === period;

                            if (!isSameCell) {

                                const sourceKey = this.buildCellKey(this.draggedItem.sourceDay, this.draggedItem.sourcePeriod);

                                this.moveSubject(sourceKey, key);

                            }

                        } else if (validateDrop(this.draggedItem, key, excludeKeys, true)) {

                            this.addItemToCell(this.draggedItem, day, period);

                        }

                    } else {

                        if (isInternalDrag) {

                            const isSameCell = this.draggedItem.sourceDay === day && this.draggedItem.sourcePeriod === period;

                            if (!isSameCell) {

                                const sourceKey = this.buildCellKey(this.draggedItem.sourceDay, this.draggedItem.sourcePeriod);

                                this.moveStudent(sourceKey, key, this.draggedItem.id);

                            }

                        } else if (validateDrop(this.draggedItem, key, excludeKeys, true)) {

                            this.addItemToCell(this.draggedItem, day, period);

                        }

                    }

                }

            }

        });

        // 左侧菜单栏：从课表拖放课程/学生到此处回收（删除但不入池）

        leftSidebar.addEventListener('dragover', (e) => {

            // 只接受从课表内部拖出的项目（sourceDay 表示来自课表）

            if (this.draggedItem && this.draggedItem.sourceDay !== undefined) {

                e.preventDefault();

                e.dataTransfer.dropEffect = 'move';

                leftSidebar.classList.add('drag-over-recycle');

            }

        });

        leftSidebar.addEventListener('dragleave', (e) => {

            // 只在真正离开 sidebar 时移除高亮

            if (!leftSidebar.contains(e.relatedTarget)) {

                leftSidebar.classList.remove('drag-over-recycle');

            }

        });

        leftSidebar.addEventListener('drop', (e) => {

            leftSidebar.classList.remove('drag-over-recycle');

            if (this.draggedItem && this.draggedItem.sourceDay !== undefined) {

                e.preventDefault();

                e.stopPropagation();

                const sourceKey = this.buildCellKey(this.draggedItem.sourceDay, this.draggedItem.sourcePeriod);

                const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

                const sourceVersion = this.getCellVersion(sourceKey, weekStartStr);

                if (this.draggedItem.type === 'subject') {

                    // 回收科目背景时，整节课连同学生一起删除

                    if (sourceVersion && sourceVersion.subject) {
                        window.ScheduleErpService.deleteSingleCellOccurrence(this, sourceKey, weekStartStr);

                    }

                } else if (this.draggedItem.type === 'student') {

                    // 回收单个学生

                    if (sourceVersion && sourceVersion.student) {

                        const newStudents = sourceVersion.student.filter(id => id !== this.draggedItem.id);

                        window.ScheduleErpService.setSingleCellOccurrence(
                            this,
                            sourceKey,
                            weekStartStr,
                            sourceVersion.subject,
                            newStudents
                        );

                    }

                }

                this.draggedItem = null;

                this.syncRealtime();

            }

            setTimeout(clearRecycleDragState, 0);

        });

    }

