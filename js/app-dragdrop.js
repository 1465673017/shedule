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

                    sourceSection: studentCard.dataset.sourceSection,

                    sourcePeriod: studentCard.dataset.sourcePeriod

                };

                studentCard.classList.add('dragging');

                e.dataTransfer.effectAllowed = 'move';

            } else if (subjectCell) {

                e.dataTransfer.setData('text/plain', '');

                const key = `${subjectCell.dataset.day}-${subjectCell.dataset.section}-${subjectCell.dataset.period}`;

                const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

                const version = this.getCellVersion(key, weekStartStr);

                this.draggedItem = {

                    id: subjectCell.dataset.itemId,

                    type: 'subject',

                    sourceDay: subjectCell.dataset.day,

                    sourceSection: subjectCell.dataset.section,

                    sourcePeriod: subjectCell.dataset.period,

                    sourceStudents: version ? (version.student || []) : []

                };

                subjectCell.classList.add('dragging');

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

            this.draggedItem = null;

        });

        // 使用事件委托处理表格拖拽

        const validateDrop = (draggedItem, targetKey, excludeKeys = []) => {

            if (!draggedItem) return false;

            const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

            const existingVersion = this.getCellVersion(targetKey, weekStartStr);

            if (draggedItem.type === 'subject') {

                return !existingVersion || !existingVersion.subject;

            } else {

                if (!existingVersion) return true;

                const existingStudents = existingVersion.student || [];

                const studentExists = existingStudents.includes(draggedItem.id);

                const isFull = existingStudents.length >= this.MAX_STUDENTS_PER_COURSE;

                if (studentExists || isFull) return false;

                const draggedStudent = this.students.find(s => s.id === draggedItem.id);

                const isDragged1v1 = draggedStudent && draggedStudent.is1v1;

                const { has1v1, studentCount } = this.getCell1v1Status(targetKey);

                if (isDragged1v1 && studentCount > 0) return false;

                if (!isDragged1v1 && has1v1) return false;

                const auditionAssigned = this.getAuditionStudentAssignedKeys(draggedItem.id, excludeKeys);

                return auditionAssigned.length === 0;

            }

        };

        timetable.addEventListener('dragover', (e) => {

            e.preventDefault();

            const cell = e.target.closest('.cell');

            if (cell) {

                const day = cell.dataset.day;

                const section = cell.dataset.section;

                const period = cell.dataset.period;

                const key = `${day}-${section}-${period}`;

                const isInternalDrag = this.draggedItem && this.draggedItem.sourceDay !== undefined;

                if (isInternalDrag && this.draggedItem.type === 'subject') {

                    const isSameCell = this.draggedItem.sourceDay === day && 

                        this.draggedItem.sourceSection === section && 

                        this.draggedItem.sourcePeriod === period;

                    if (isSameCell) {

                        return;

                    }

                }

                if (!cell.classList.contains('occupied')) {

                    cell.classList.add('drag-over');

                } else if (this.draggedItem) {

                    const excludeKeys = isInternalDrag ? [`${this.draggedItem.sourceDay}-${this.draggedItem.sourceSection}-${this.draggedItem.sourcePeriod}`] : [];

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

                    const section = cell.dataset.section;

                    const period = cell.dataset.period;

                    const key = `${day}-${section}-${period}`;

                    const isInternalDrag = this.draggedItem.sourceDay !== undefined;

                    const excludeKeys = isInternalDrag ? [`${this.draggedItem.sourceDay}-${this.draggedItem.sourceSection}-${this.draggedItem.sourcePeriod}`] : [];

                    if (this.draggedItem.type === 'subject') {

                        if (isInternalDrag) {

                            const isSameCell = this.draggedItem.sourceDay === day && 

                                this.draggedItem.sourceSection === section && 

                                this.draggedItem.sourcePeriod === period;

                            if (!isSameCell) {

                                const sourceKey = `${this.draggedItem.sourceDay}-${this.draggedItem.sourceSection}-${this.draggedItem.sourcePeriod}`;

                                this.moveSubject(sourceKey, key);

                            }

                        } else if (validateDrop(this.draggedItem, key, excludeKeys)) {

                            this.addItemToCell(this.draggedItem, day, section, period);

                        }

                    } else {

                        if (isInternalDrag) {

                            const isSameCell = this.draggedItem.sourceDay === day &&

                                this.draggedItem.sourceSection === section &&

                                this.draggedItem.sourcePeriod === period;

                            if (!isSameCell) {

                                const sourceKey = `${this.draggedItem.sourceDay}-${this.draggedItem.sourceSection}-${this.draggedItem.sourcePeriod}`;

                                this.moveStudent(sourceKey, key, this.draggedItem.id);

                            }

                        } else if (validateDrop(this.draggedItem, key, excludeKeys)) {

                            this.addItemToCell(this.draggedItem, day, section, period);

                        }

                    }

                }

            }

        });

        // 双击删除课程/学生

        timetable.addEventListener('dblclick', (e) => {

            const cell = e.target.closest('.cell');

            if (cell && cell.classList.contains('occupied')) {

                this.removeItemFromCell(cell);

            }

        });

        // 左侧菜单栏：从课表拖放课程/学生到此处回收（删除但不入池）

        const leftSidebar = document.querySelector('.left-sidebar');

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

                const sourceKey = `${this.draggedItem.sourceDay}-${this.draggedItem.sourceSection}-${this.draggedItem.sourcePeriod}`;

                const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

                const sourceVersion = this.getCellVersion(sourceKey, weekStartStr);

                if (this.draggedItem.type === 'subject') {

                    // 回收科目背景时，整节课连同学生一起删除

                    if (sourceVersion && sourceVersion.subject) {
                        this.setCellVersion(sourceKey, weekStartStr, null, [], { cutoff: true });

                    }

                } else if (this.draggedItem.type === 'student') {

                    // 回收单个学生

                    if (sourceVersion && sourceVersion.student) {

                        const newStudents = sourceVersion.student.filter(id => id !== this.draggedItem.id);

                        this.setCellVersion(sourceKey, weekStartStr, sourceVersion.subject, newStudents);

                    }

                }

                this.draggedItem = null;

                this.syncRealtime();

            }

        });

    }

