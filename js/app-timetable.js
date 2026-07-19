// app-timetable.js - Timetable rendering and cell operations
// Auto-split from script.js

TimetableApp.prototype.closeTimeModal = function() {
        document.getElementById('timeModal').style.display = 'none';
    }

TimetableApp.prototype.getCell1v1Status = function(key) {
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

TimetableApp.prototype.addItemToCell = function(item, day, period) {
        const key = this.buildCellKey(day, period);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        let version = this.getCellVersion(key, weekStartStr);
        let currentSubject = version ? version.subject : null;
        let currentStudents = version ? (version.student || []).slice() : [];

        if (item.type === 'subject') {
            currentSubject = item.id;
        } else {
            if (currentStudents.includes(item.id)) return;

            if (currentStudents.length >= this.MAX_STUDENTS_PER_COURSE) {
                alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
                return;
            }
            const draggedStudent = this.students.find(s => s.id === item.id);
            const isDragged1v1 = draggedStudent && draggedStudent.is1v1;
            const { has1v1, studentCount } = this.getCell1v1Status(key);

            if (isDragged1v1 && studentCount > 0) {
                alert('1v1学生只能单独上课，无法加入已有其他学生的课程');
                return;
            }
            if (!isDragged1v1 && has1v1) {
                alert('已有1v1学生的课程无法再添加其他学生');
                return;
            }

            const auditionAssigned = this.getAuditionStudentAssignedKeys(item.id, [key]);
            if (auditionAssigned.length > 0) {
                alert(this.getAuditionStudentConflictMessage(item.id, auditionAssigned));
                return;
                const student = this.students.find(s => s.id === item.id);
                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);
                return;
            }

            currentStudents.push(item.id);

            if (!currentSubject) {
                currentSubject = this.ensureUncategorizedSubject().id;
            }
        }

        if (item.type === 'student') {
            window.ScheduleErpService.setSingleCellOccurrence(this, key, weekStartStr, currentSubject, currentStudents);
        } else {
            this.setCellVersion(key, weekStartStr, currentSubject, currentStudents);
        }

        if (item.type === 'student') {
            this.ensureAuditionStudentsTemporary(key, [item.id]);
            const draggedStudent = this.students.find(s => s.id === item.id);
            if (draggedStudent && draggedStudent.completed && !(this.settings && this.settings.segmentedScheduling)) {
                this.setStudentRecurrence(key, item.id, 'temporary');
            }
        }

        this.syncRealtime();
    }

TimetableApp.prototype.addCourseToCell = function(courseItem, day, period) {
        const key = this.buildCellKey(day, period);

        const studentIds = courseItem.courseStudentIds || [];
        if (studentIds.length > this.MAX_STUDENTS_PER_COURSE) {
            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
            return;
        }

        const hasCourse1v1 = studentIds.some(id => {
            const s = this.students.find(st => st.id === id);
            return s && s.is1v1;
        });
        
        if (hasCourse1v1 && studentIds.length > 1) {
            alert('1v1学生只能单独上课，无法与其他学生同课');
            return;
        }

        const { has1v1, studentCount } = this.getCell1v1Status(key);
        
        if (hasCourse1v1 && studentCount > 0) {
            alert('1v1学生只能单独上课，无法加入已有其他学生的课程');
            return;
        }
        if (!hasCourse1v1 && has1v1) {
            alert('已有1v1学生的课程无法再添加其他学生');
            return;
        }

        for (const studentId of studentIds) {
            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [key]);
            if (auditionAssigned.length > 0) {
                alert(this.getAuditionStudentConflictMessage(studentId, auditionAssigned));
                return;
                const student = this.students.find(s => s.id === studentId);
                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);
                return;
            }
        }

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        this.setCellVersion(key, weekStartStr, courseItem.courseSubjectId, [...studentIds]);

        this.ensureAuditionStudentsTemporary(key, studentIds);

        for (const studentId of studentIds) {
            const s = this.students.find(st => st.id === studentId);
            if (s && s.completed && !(this.settings && this.settings.segmentedScheduling)) {
                this.setStudentRecurrence(key, studentId, 'temporary');
            }
        }

        const sortedIds = [...studentIds].sort().join(',');
        this.manualCourses = this.manualCourses.filter(mc => {
            const mcSorted = [...(mc.studentIds || [])].sort().join(',');
            return !(mc.subjectId === courseItem.courseSubjectId && mcSorted === sortedIds);
        });

        this.syncRealtime();
    }

TimetableApp.prototype.removeItemFromCell = function(cell, type = null, studentId = null) {
        if (!cell.classList.contains('occupied')) return;

        const day = cell.dataset.day;
        const period = cell.dataset.period;
        const key = this.buildCellKey(day, period);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const version = this.getCellVersion(key, weekStartStr);

        if (!version) {
            window.ScheduleErpService.buildTimetableProjection(this);
            this.syncRealtime();
            return;
        }

        let newSubject = version.subject || null;
        let newStudents = (version.student || []).map(id => String(id));

        if (type === 'subject') {
            newSubject = null;
        } else if (type === 'student' && studentId) {
            newStudents = newStudents.filter(id => id !== String(studentId));
        } else if (type === 'student' && !studentId) {
            newStudents = [];
        } else if (type === undefined || type === null) {
            newSubject = null;
            newStudents = [];
        }

        if (!newSubject && newStudents.length > 0) {
            newSubject = this.ensureUncategorizedSubject().id;
        }

        const isEmpty = !newSubject && newStudents.length === 0;
        if (type === 'student') {
            window.ScheduleErpService.setSingleCellOccurrence(this, key, weekStartStr, newSubject, newStudents);
        } else if (isEmpty) {
            window.ScheduleErpService.deleteSingleCellOccurrence(this, key, weekStartStr);
        } else {
            this.setCellVersion(key, weekStartStr, newSubject, newStudents, { cutoff: isEmpty });
        }

        this.syncRealtime();
    }

TimetableApp.prototype.moveStudent = function(sourceKey, targetKey, studentId) {
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const sourceVersion = this.getCellVersion(sourceKey, weekStartStr);
        if (!sourceVersion || !sourceVersion.student || !sourceVersion.student.includes(studentId)) return;

        const draggedStudent = this.students.find(s => s.id === studentId);
        const isDragged1v1 = draggedStudent && draggedStudent.is1v1;

        const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [sourceKey, targetKey]);
        if (auditionAssigned.length > 0) {
            alert(this.getAuditionStudentConflictMessage(studentId, auditionAssigned));
            return;
            alert(`试听学生「${draggedStudent ? draggedStudent.name : '未知'}」已排在其他课程中，不可重复排课`);
            return;
        }

        const targetVersion = this.getCellVersion(targetKey, weekStartStr);
        let targetStudents = targetVersion ? (targetVersion.student || []).slice() : [];
        let targetSubject = targetVersion ? targetVersion.subject : null;

        const { has1v1, studentCount } = this.getCell1v1Status(targetKey);

        if (isDragged1v1 && studentCount > 0) {
            alert('1v1学生只能单独上课，无法加入已有其他学生的课程');
            return;
        }
        if (!isDragged1v1 && has1v1) {
            alert('已有1v1学生的课程无法再添加其他学生');
            return;
        }

        if (targetStudents.length >= this.MAX_STUDENTS_PER_COURSE) {
            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
            return;
        }

        targetStudents.push(studentId);
        if (!targetSubject) {
            targetSubject = this.ensureUncategorizedSubject().id;
        }

        const sourceStudents = (sourceVersion.student || []).filter(id => id !== studentId);

        window.ScheduleErpService.setSingleCellOccurrence(this, sourceKey, weekStartStr, sourceVersion.subject, sourceStudents);
        window.ScheduleErpService.setSingleCellOccurrence(this, targetKey, weekStartStr, targetSubject, targetStudents);

        if (draggedStudent && draggedStudent.isAudition) {
            this.ensureAuditionStudentsTemporary(targetKey, [studentId]);
        }
        if (draggedStudent && draggedStudent.completed && !(this.settings && this.settings.segmentedScheduling)) {
            this.setStudentRecurrence(targetKey, studentId, 'temporary');
        }

        this.syncRealtime();
    }

TimetableApp.prototype.moveSubject = async function(sourceKey, targetKey) {
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const nextWeekStr = this.formatLocalDate(this.getWeekRange(new Date(new Date(this.getWeekRange(this.currentDate).start).getTime() + 7 * 24 * 60 * 60 * 1000)).start);
        const sourceVersion = this.getCellVersion(sourceKey, weekStartStr);
        if (!sourceVersion || !sourceVersion.subject) return;

        const subjectId = sourceVersion.subject;
        const sourceStudents = sourceVersion.student || [];

        const targetVersion = this.getCellVersion(targetKey, weekStartStr);
        const targetStudents = targetVersion ? (targetVersion.student || []).slice() : [];

        if (targetStudents.length > 0 && 
            [...targetStudents].sort().join(',') !== [...sourceStudents].sort().join(',')) {
            if (!await window.showAppConfirm('目标位置有不同的学生，合并会覆盖学生列表，是否继续？')) {
                return;
            }
        }

        const mergedStudents = [...new Set([...sourceStudents, ...targetStudents])];

        if (mergedStudents.length > this.MAX_STUDENTS_PER_COURSE) {
            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
            return;
        }

        const hasSource1v1 = sourceStudents.some(id => {
            const s = this.students.find(st => st.id === id);
            return s && s.is1v1;
        });
        const hasTarget1v1 = targetStudents.some(id => {
            const s = this.students.find(st => st.id === id);
            return s && s.is1v1;
        });
        if (hasSource1v1 && targetStudents.length > 0) {
            alert('1v1学生只能单独上课，无法移动到已有学生的课程');
            return;
        }
        if (hasTarget1v1 && sourceStudents.length > 0) {
            alert('已有1v1学生的课程无法再添加其他学生');
            return;
        }

        for (const studentId of sourceStudents) {
            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [sourceKey, targetKey]);
            if (auditionAssigned.length > 0) {
                alert(this.getAuditionStudentConflictMessage(studentId, auditionAssigned));
                return;
                const student = this.students.find(s => s.id === studentId);
                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);
                return;
            }
        }

        const sourceNextVersion = this.getCellVersion(sourceKey, nextWeekStr);
        const targetNextVersion = this.getCellVersion(targetKey, nextWeekStr);

        this.setCellVersion(sourceKey, weekStartStr, null, [], { cutoff: true });
        this.setCellVersion(targetKey, weekStartStr, subjectId, mergedStudents);
        const movedTargetVersion = this.getCellVersion(targetKey, weekStartStr);

        if (sourceNextVersion && (sourceNextVersion.subject || (sourceNextVersion.student || []).length > 0)) {
            window.ScheduleErpService.restoreCellSnapshot(this, sourceKey, nextWeekStr, sourceNextVersion);
        } else {
            this.setCellVersion(sourceKey, nextWeekStr, null, [], { cutoff: true });
        }

        if (targetNextVersion && (targetNextVersion.subject || (targetNextVersion.student || []).length > 0)) {
            window.ScheduleErpService.restoreCellSnapshot(this, targetKey, nextWeekStr, targetNextVersion);
        } else {
            this.setCellVersion(targetKey, nextWeekStr, null, [], { cutoff: true });
        }
        window.ScheduleErpService.transferMovedCourseData(this, sourceVersion, targetKey, movedTargetVersion, weekStartStr);

        this.ensureAuditionStudentsTemporary(targetKey, mergedStudents);

        this.syncRealtime();
    }

TimetableApp.prototype.copyCourseFromCell = function(cell) {
        if (!cell || !cell.classList.contains('occupied')) return;

        const day = cell.dataset.day;
        const period = cell.dataset.period;
        const key = this.buildCellKey(day, period);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const version = this.getCellVersion(key, weekStartStr);
        if (!version) return;

        const studentIds = Array.isArray(version.student) ? version.student.map(id => String(id)) : [];
        if (!version.subject && studentIds.length === 0) return;

        this.copiedScheduleBlock = null;
        this.copiedCourse = {
            subjectId: version.subject || null,
            studentIds
        };
        this.renderTimetable();
    }

TimetableApp.prototype.cancelCopyPasteState = function() {
        if (!this.copiedCourse && !this.copiedScheduleBlock) return false;
        this.copiedCourse = null;
        this.copiedScheduleBlock = null;
        this.renderTimetable();
        return true;
    }

TimetableApp.prototype.pasteCopiedCourseToCell = function(cell) {
        if (!cell || !this.copiedCourse || cell.classList.contains('occupied')) return false;

        const day = cell.dataset.day;
        const period = cell.dataset.period;
        const key = this.buildCellKey(day, period);
        const studentIds = Array.isArray(this.copiedCourse.studentIds)
            ? this.copiedCourse.studentIds.map(id => String(id))
            : [];

        if (studentIds.length > this.MAX_STUDENTS_PER_COURSE) {
            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
            return false;
        }

        const hasCourse1v1 = studentIds.some(id => {
            const s = this.students.find(st => st.id === id);
            return s && s.is1v1;
        });

        if (hasCourse1v1 && studentIds.length > 1) {
            alert('1v1学生只能单独上课，无法与其他学生同课');
            return false;
        }

        for (const studentId of studentIds) {
            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [key]);
            if (auditionAssigned.length > 0) {
                alert(this.getAuditionStudentConflictMessage(studentId, auditionAssigned));
                return false;
                const student = this.students.find(s => s.id === studentId);
                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);
                return false;
            }
        }

        let subjectId = this.copiedCourse.subjectId || null;
        if (!subjectId && studentIds.length > 0) {
            subjectId = this.ensureUncategorizedSubject().id;
        }

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        this.setCellVersion(key, weekStartStr, subjectId, studentIds);
        this.ensureAuditionStudentsTemporary(key, studentIds);

        for (const studentId of studentIds) {
            const student = this.students.find(st => st.id === studentId);
            if (student && student.completed && !(this.settings && this.settings.segmentedScheduling)) {
                this.setStudentRecurrence(key, studentId, 'temporary');
            }
        }

        this.copiedCourse = null;
        this.syncRealtime();
        return true;
    }

TimetableApp.prototype.getScheduleBlockEntries = function(type, sourceIndex, weekStartStr) {
        const days = [1, 2, 3, 4, 5, 6, 7];
        const periods = this.periods.map((_period, index) => index);
        const entries = [];
        const sourceDays = type === 'day' ? [Number(sourceIndex)] : days;
        const sourcePeriods = type === 'period' ? [Number(sourceIndex)] : periods;
        sourceDays.forEach(day => sourcePeriods.forEach(period => {
            const version = this.getCellVersion(this.buildCellKey(day, period), weekStartStr);
            if (!version) return;
            const studentIds = Array.isArray(version.student) ? version.student.map(String) : [];
            if (!version.subject && studentIds.length === 0) return;
            entries.push({ day, period, subjectId: version.subject || null, studentIds });
        }));
        return entries;
    }

TimetableApp.prototype.copyScheduleBlock = function(type, sourceIndex = null) {
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const entries = this.getScheduleBlockEntries(type, sourceIndex, weekStartStr);
        if (entries.length === 0) {
            alert(type === 'week' ? '本周没有可复制的课程' : '该范围没有可复制的课程');
            return false;
        }
        this.copiedCourse = null;
        this.copiedScheduleBlock = { type, sourceIndex: sourceIndex === null ? null : Number(sourceIndex), sourceWeekStart: weekStartStr, entries };
        this.renderTimetable();
        return true;
    }

TimetableApp.prototype.getScheduleBlockTargets = function(targetType, targetIndex = null) {
        const copied = this.copiedScheduleBlock;
        if (!copied || copied.type !== targetType) return [];
        const days = [1, 2, 3, 4, 5, 6, 7];
        const periods = this.periods.map((_period, index) => index);
        const targetDays = targetType === 'day' ? [Number(targetIndex)] : days;
        const targetPeriods = targetType === 'period' ? [Number(targetIndex)] : periods;
        return targetDays.flatMap(day => targetPeriods.map(period => {
            const sourceDay = targetType === 'day' ? Number(copied.sourceIndex) : day;
            const sourcePeriod = targetType === 'period' ? Number(copied.sourceIndex) : period;
            const source = copied.entries.find(entry => entry.day === sourceDay && entry.period === sourcePeriod);
            return {
                day,
                period,
                subjectId: source ? source.subjectId : null,
                studentIds: source ? [...source.studentIds] : []
            };
        }));
    }

TimetableApp.prototype.pasteScheduleBlock = async function(type, targetIndex = null) {
        const copied = this.copiedScheduleBlock;
        if (!copied || copied.type !== type) return false;
        const targetWeekStart = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const targets = this.getScheduleBlockTargets(type, targetIndex);
        if (targets.length === 0) return false;
        if (targets.some(target => this.isHistoricalCellProtected(this.buildCellKey(target.day, target.period), targetWeekStart))) {
            this.showHistoryProtectionNotice();
            return false;
        }
        const targetKeys = targets.map(target => this.buildCellKey(target.day, target.period));
        for (const target of targets) {
            for (const studentId of target.studentIds) {
                const student = this.students.find(item => String(item.id) === String(studentId));
                if (!student || !student.isAudition) continue;
                const assigned = this.getAuditionStudentAssignedKeys(studentId, targetKeys);
                if (assigned.length > 0) {
                    alert(this.getAuditionStudentConflictMessage(studentId, assigned));
                    return false;
                }
            }
        }

        const conflicts = targets.filter(target => {
            const existing = this.getCellVersion(this.buildCellKey(target.day, target.period), targetWeekStart);
            return !!(existing && (existing.subject || (existing.student || []).length > 0));
        });
        let overwrite = false;
        if (conflicts.length > 0) {
            overwrite = await window.showAppConfirm(
                `目标范围有 ${conflicts.length} 节课程冲突，是否覆盖？\n\n确定：覆盖冲突课程。\n取消：保留原课程，仅粘贴到空课位。`
            );
        }

        let pastedCount = 0;
        targets.forEach(target => {
            const key = this.buildCellKey(target.day, target.period);
            const existing = this.getCellVersion(key, targetWeekStart);
            const occupied = !!(existing && (existing.subject || (existing.student || []).length > 0));
            const hasSourceCourse = !!(target.subjectId || target.studentIds.length > 0);
            if (!overwrite && (!hasSourceCourse || occupied)) return;
            if (overwrite && !hasSourceCourse) {
                if (occupied && this.setCellVersion(key, targetWeekStart, null, [], { cutoff: true }) !== false) pastedCount++;
                return;
            }
            let subjectId = target.subjectId;
            if (!subjectId && target.studentIds.length > 0) subjectId = this.ensureUncategorizedSubject().id;
            if (this.setCellVersion(key, targetWeekStart, subjectId, target.studentIds) === false) return;
            this.ensureAuditionStudentsTemporary(key, target.studentIds);
            target.studentIds.forEach(studentId => {
                const student = this.students.find(item => String(item.id) === String(studentId));
                if (student && student.completed && !(this.settings && this.settings.segmentedScheduling)) {
                    this.setStudentRecurrence(key, studentId, 'temporary');
                }
            });
            pastedCount++;
        });

        this.copiedScheduleBlock = null;
        this.syncRealtime();
        if (pastedCount === 0) alert('没有可粘贴的空课位');
        return pastedCount > 0;
    }

TimetableApp.prototype.createScheduleHeaderAction = function(container, type, index = null) {
        if (!container) return;
        container.style.position = 'relative';
        const copied = this.copiedScheduleBlock;
        const weekStart = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const canPaste = !!copied && copied.type === type && (
            type === 'week' ? copied.sourceWeekStart !== weekStart : Number(copied.sourceIndex) !== Number(index)
        );
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `copy-course-btn schedule-block-action ${canPaste ? 'paste-indicator' : ''}`;
        button.textContent = canPaste ? '粘贴' : '复制';
        button.title = canPaste
            ? (type === 'week' ? '粘贴整周课表' : type === 'day' ? '粘贴整列课程' : '粘贴整行课程')
            : (type === 'week' ? '复制本周课表' : type === 'day' ? '复制这一列课程' : '复制这一行课程');
        button.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();
            if (canPaste) await this.pasteScheduleBlock(type, index);
            else this.copyScheduleBlock(type, index);
        });
        container.querySelectorAll(':scope > .schedule-block-action').forEach(existing => existing.remove());
        container.appendChild(button);
    }

TimetableApp.prototype.renderScheduleBlockActions = function() {
        this.createScheduleHeaderAction(document.querySelector('#timetable thead .period-header'), 'week');
        document.querySelectorAll('#timetable thead [data-day-header]').forEach(header => {
            this.createScheduleHeaderAction(header, 'day', Number(header.dataset.dayHeader));
        });
        document.querySelectorAll('#timetableBody .period-cell').forEach((cell, index) => {
            this.createScheduleHeaderAction(cell, 'period', index);
        });
    }

TimetableApp.prototype.renderTimetable = function() {
        if (window.ScheduleErpService.completeStudentsForEndedStages(this)) {
            this.saveData();
            this.renderSubjects();
        }
        const tbody = document.getElementById('timetableBody');
        tbody.innerHTML = '';
        
        let totalPeriodNum = 0;
        
        this.periods.forEach((period, index) => {
            totalPeriodNum++;
            const row = this.createPeriodRow(index, period, totalPeriodNum);
            tbody.appendChild(row);
        });

        this.highlightTodayColumn();
        this.renderScheduleBlockActions();
        this.syncTimetableLayout();
}

TimetableApp.prototype.getVisibleTimetableDayCount = function() {
        let dayCount = 5;
        if (this.settings.showSaturday) dayCount += 1;
        if (this.settings.showSunday) dayCount += 1;
        return dayCount;
}

TimetableApp.prototype.getTimetableLayoutMetrics = function() {
        const periodColumnWidth = 120;
        const dayColumnWidth = 120;
        const containerPadding = 48;
        const visibleDayCount = this.getVisibleTimetableDayCount();
        const tableMinWidth = periodColumnWidth + (visibleDayCount * dayColumnWidth);

        return {
            visibleDayCount,
            periodColumnWidth,
            dayColumnWidth,
            tableMinWidth,
            containerMinWidth: tableMinWidth + containerPadding
        };
}

TimetableApp.prototype.syncTimetableLayout = function() {
        const container = document.querySelector('.timetable-container');
        const wrapper = document.querySelector('.timetable-wrapper');
        const table = document.getElementById('timetable');
        if (!container || !wrapper || !table) return;

        const metrics = this.getTimetableLayoutMetrics();
        wrapper.style.overflowX = 'auto';
        wrapper.style.width = '100%';
        wrapper.style.minWidth = '0';
        table.style.minWidth = `${metrics.tableMinWidth}px`;
        table.style.width = '100%';
}




TimetableApp.prototype.createPeriodRow = function(periodIndex, period, periodNum) {
        const row = document.createElement('tr');
        
        const periodCell = document.createElement('td');
        periodCell.className = 'period-cell';
        periodCell.innerHTML = `
                        <div class="period-name" data-period="${periodIndex}" style="cursor: pointer; font-weight: bold; color: var(--text-1); font-size: 14px;">
                            第${periodNum}节
                        </div>
                        <div class="time-display" data-period="${periodIndex}" style="cursor: pointer; font-size: 12px; color: var(--text-3); display: block;">
                            ${period.time}
                        </div>
                    `;
        
        periodCell.querySelector('.period-name').addEventListener('click', (e) => {
            this.openTimeModal(e, periodIndex);
        });
        periodCell.querySelector('.time-display').addEventListener('click', (e) => {
            this.openTimeModal(e, periodIndex);
        });
        
        row.appendChild(periodCell);
        
        const days = [1, 2, 3, 4, 5];
        if (this.settings.showSaturday) days.push(6);
        if (this.settings.showSunday) days.push(7);

        for (let day of days) {
            const cell = document.createElement('td');
            cell.className = 'cell';
            cell.style.position = 'relative';
            if (day >= 6) {
                cell.classList.add('weekend-col');
            }
            cell.dataset.day = day;
            cell.dataset.period = periodIndex;
            
            const key = this.buildCellKey(day, periodIndex);
            const weekStart = this.getWeekRange(this.currentDate).start;
            const weekStartStr = this.formatLocalDate(weekStart);
            const version = this.getCellVersion(key, weekStartStr);

            if (version) {
                const students = (version.student || [])
                    .map(id => this.students.find(s => s.id === id)).filter(Boolean);
                const subject = version.subject
                    ? this.subjects.find(s => s.id === version.subject)
                    : (students.length > 0 ? this.ensureUncategorizedSubject() : null);

                if (subject || students.length > 0) {
                    cell.classList.add('occupied');
                }

                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-course-btn';
                copyBtn.title = '复制这节课';
                copyBtn.textContent = '复制';
                copyBtn.style.cssText = 'position: absolute; right: 8px; bottom: 8px; min-width: 40px; height: 22px; padding: 0 8px; border: none; border-radius: 999px; background: rgba(255, 255, 255, 0.96); color: #2563eb; font-size: 12px; font-weight: 600; cursor: pointer; display: none; align-items: center; justify-content: center; z-index: 14; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.16);';
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.copyCourseFromCell(cell);
                });
                cell.appendChild(copyBtn);

                cell.addEventListener('mouseenter', () => {
                    copyBtn.style.display = 'inline-flex';
                });
                cell.addEventListener('mouseleave', () => {
                    copyBtn.style.display = 'none';
                });

                if (subject) {
                    cell.draggable = true;
                    cell.dataset.itemType = 'subject';
                    cell.dataset.itemId = version.subject;
                    cell.style.cursor = 'grab';
                    
                    const subjectBg = document.createElement('div');
                    subjectBg.className = 'subject-bg subject-bg-light';
                    subjectBg.style.setProperty('--subject-color', subject.color || '#666666');
                    const leadStudent = students.length > 0 ? students[0] : null;
                    const gradeAccentColor = leadStudent
                        ? this.getStudentGradeColor(leadStudent)
                        : (subject.color || '#666666');
                    subjectBg.style.setProperty('--grade-accent-color', gradeAccentColor);
                    
                    const opacity = this.hexToRgbaOpacity(subject.color || '#666666', 0.12);
                    subjectBg.style.backgroundColor = opacity;
                    
                    const borderOpacity = this.hexToRgbaOpacity(subject.color || '#666666', 0.25);
                    subjectBg.style.border = `1px solid ${borderOpacity}`;
                    
                    const subjectName = document.createElement('div');
                    subjectName.className = 'subject-name-light';
                    const subjectNameText = document.createElement('span');
                    subjectNameText.className = 'subject-name-text';
                    subjectNameText.textContent = subject.name;
                    subjectName.appendChild(subjectNameText);

                    const gradeNames = [...new Set(
                        students
                            .map(student => student && student.grade)
                            .filter(Boolean)
                    )];

                    if (gradeNames.length > 0) {
                        const gradeTag = document.createElement('span');
                        gradeTag.className = 'subject-grade-tag';
                        gradeTag.textContent = gradeNames[0];
                        subjectName.appendChild(gradeTag);
                    }
                    
                    subjectBg.appendChild(subjectName);
                    cell.appendChild(subjectBg);
                }
                
                if (students.length > 0) {
                    const studentContainer = document.createElement('div');
                    studentContainer.className = 'cell-content';
                    studentContainer.style.cssText = 'position: absolute; top: 8px; left: 6px; width: calc(100% - 12px) !important; height: calc(100% - 14px) !important; display: flex; flex-direction: row; justify-content: space-between; align-items: stretch; gap: 6px; box-sizing: border-box; z-index: 2;';
                    
                    const studentCount = students.length;
                    const isVertical = studentCount >= 3;
                    
                    students.forEach(student => {
                        const studentCard = document.createElement('div');
                        studentCard.className = `student-card-light${isVertical ? ' vertical' : ''}`;
                        studentCard.draggable = true;
                        studentCard.dataset.itemId = student.id;
                        studentCard.dataset.itemType = 'student';
                        studentCard.dataset.sourceDay = day;
                        studentCard.dataset.sourcePeriod = periodIndex;
                        
                        const dynamicColor = this.getStudentGradeColor(student);
                        const gradeColor = dynamicColor || '#666666';

                        const gradeColorBar = document.createElement('div');
                        gradeColorBar.className = `grade-color-bar ${isVertical ? 'vertical' : 'horizontal'}`;
                        gradeColorBar.style.backgroundColor = gradeColor;

                        const studentName = document.createElement('div');
                        studentName.className = `student-name${isVertical ? ' vertical' : ''}`;
                        studentName.textContent = student.name;

                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-cell-btn-light';
                        deleteBtn.title = '删除学生';
                        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" width="10" height="10"><path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 19.5304 6.21071 20.0391 6.58579 20.4142C6.96086 20.7893 7.46957 21 8 21H16C16.5304 21 17.0391 20.7893 17.4142 20.4142C17.7893 20.0391 18 19.5304 18 19L19 7M9 7V4C9 3.73478 9.10536 3.48043 9.29289 3.29289C9.48043 3.10536 9.73478 3 10 3H14C14.2652 3 14.5196 3.10536 14.7071 3.29289C14.8946 3.48043 15 3.73478 15 4V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.removeItemFromCell(cell, 'student', student.id);
                        });

                        studentCard.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.openAttendanceModal(cell);
                        });

                        studentCard.appendChild(gradeColorBar);
                        studentCard.appendChild(studentName);
                        studentCard.appendChild(deleteBtn);

                        if (student.is1v1) {
                            const badge = document.createElement('span');
                            badge.className = 'status-badge one-v1';
                            badge.textContent = '1v1';
                            studentCard.appendChild(badge);
                        }

                        if (student.isAudition) {
                            const badge = document.createElement('span');
                            badge.className = 'status-badge audition';
                            badge.textContent = '试';
                            studentCard.appendChild(badge);
                        }

                        studentContainer.appendChild(studentCard);
                    });
                    
                    cell.appendChild(studentContainer);
                }
                
                if (subject && students.length === 0) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-cell-btn';
                    deleteBtn.title = '删除科目';
                    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 19.5304 6.21071 20.0391 6.58579 20.4142C6.96086 20.7893 7.46957 21 8 21H16C16.5304 21 17.0391 20.7893 17.4142 20.4142C17.7893 20.0391 18 19.5304 18 19L19 7M9 7V4C9 3.73478 9.10536 3.48043 9.29289 3.29289C9.48043 3.10536 9.73478 3 10 3H14C14.2652 3 14.5196 3.10536 14.7071 3.29289C14.8946 3.48043 15 3.73478 15 4V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; background: rgba(255, 255, 255, 0.96); color: #dc3545; border: none; border-radius: 50%; cursor: pointer; display: none; align-items: center; justify-content: center; z-index: 12; transition: all 0.2s ease;';
                    cell.appendChild(deleteBtn);
                    
                    cell.addEventListener('mouseenter', () => {
                        deleteBtn.style.display = 'flex';
                    });
                    cell.addEventListener('mouseleave', () => {
                        deleteBtn.style.display = 'none';
                    });
                    
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.removeItemFromCell(cell, 'subject');
                    });
                }
                
            } else {
                cell.classList.add('empty-cell');
                cell.style.cssText = 'position: relative; cursor: pointer;';
                
                const plusIndicator = document.createElement('div');
                plusIndicator.className = 'plus-indicator';
                plusIndicator.textContent = '+';
                plusIndicator.style.cssText = 'font-size: 24px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;';
                cell.appendChild(plusIndicator);

                if (this.copiedCourse) {
                    const pasteIndicator = document.createElement('div');
                    pasteIndicator.className = 'paste-indicator';
                    pasteIndicator.textContent = '粘贴';
                    pasteIndicator.style.cssText = 'position: absolute; inset: 3px; display: none; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 3;';
                    cell.appendChild(pasteIndicator);

                    cell.addEventListener('mouseenter', () => {
                        plusIndicator.style.display = 'none';
                        pasteIndicator.style.display = 'flex';
                    });
                    cell.addEventListener('mouseleave', () => {
                        pasteIndicator.style.display = 'none';
                        plusIndicator.style.display = 'flex';
                    });
                }
            }
            
            cell.addEventListener('click', () => {
                if (cell.classList.contains('empty-cell') && this.copiedCourse) {
                    if (this.pasteCopiedCourseToCell(cell)) {
                        return;
                    }
                }
                this.editingCell = cell;
                document.querySelectorAll('.cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                
                this.openAddLessonModal(cell);
            });
            
            row.appendChild(cell);
        }
        
        return row;
    }

TimetableApp.prototype.openTimeModal = function(e, periodIndex) {
        this.editingPeriod = { periodIndex };
        const modal = document.getElementById('timeModal');
        const nameInput = document.getElementById('periodName');
        const startHourSelect = document.getElementById('startHour');
        const startMinuteSelect = document.getElementById('startMinute');
        const endHourSelect = document.getElementById('endHour');
        const endMinuteSelect = document.getElementById('endMinute');
        
        const period = this.periods[periodIndex];
        nameInput.value = period.name;
        
        const [startTime, endTime] = period.time.split('-');
        const [startH, startM] = startTime.split(':');
        const [endH, endM] = endTime.split(':');
        
        startHourSelect.value = startH;
        startMinuteSelect.value = startM;
        endHourSelect.value = endH;
        endMinuteSelect.value = endM;
        
        modal.style.display = 'block';
    }

TimetableApp.prototype.savePeriodTime = function(e) {
        e.preventDefault();
        
        if (!this.editingPeriod) return;
        
        const { periodIndex } = this.editingPeriod;
        const nameInput = document.getElementById('periodName');
        const startHourSelect = document.getElementById('startHour');
        const startMinuteSelect = document.getElementById('startMinute');
        const endHourSelect = document.getElementById('endHour');
        const endMinuteSelect = document.getElementById('endMinute');
        
        const newName = nameInput.value.trim();
        const startHour = startHourSelect.value;
        const startMinute = startMinuteSelect.value;
        const endHour = endHourSelect.value;
        const endMinute = endMinuteSelect.value;
        
        if (!newName || !startHour || !startMinute || !endHour || !endMinute) return;
        
        const newTime = `${startHour}:${startMinute}-${endHour}:${endMinute}`;
        this.periods[periodIndex].time = newTime;
        this.periods[periodIndex].name = newName;
        this.syncRealtime({ subjects: false });
        this.closeTimeModal();
    }

TimetableApp.prototype.hexToRgbaOpacity = function(color, opacity) {
        if (!color || typeof color !== 'string') {
            return `rgba(102, 102, 102, ${opacity})`;
        }

        const value = color.trim();

        if (/^#([0-9a-fA-F]{6})$/.test(value)) {
            const r = parseInt(value.slice(1, 3), 16);
            const g = parseInt(value.slice(3, 5), 16);
            const b = parseInt(value.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        if (/^#([0-9a-fA-F]{3})$/.test(value)) {
            const r = parseInt(value[1] + value[1], 16);
            const g = parseInt(value[2] + value[2], 16);
            const b = parseInt(value[3] + value[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        const rgbMatch = value.match(/^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i);
        if (rgbMatch) {
            const r = Math.min(255, parseInt(rgbMatch[1], 10));
            const g = Math.min(255, parseInt(rgbMatch[2], 10));
            const b = Math.min(255, parseInt(rgbMatch[3], 10));
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        return `rgba(102, 102, 102, ${opacity})`;
    }
