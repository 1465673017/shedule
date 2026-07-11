// app-timetable.js - Timetable rendering and cell operations
// Auto-split from script.js

TimetableApp.prototype.openTimeModal = function(e) {
        const timeText = e.target;
        const period = timeText.dataset.period;
        const modal = document.getElementById('timeModal');
        const timeInput = document.getElementById('timeRange');
        
        timeInput.value = timeText.textContent;
        timeInput.dataset.period = period;
        modal.style.display = 'block';
    }

TimetableApp.prototype.closeTimeModal = function() {
        document.getElementById('timeModal').style.display = 'none';
    }

TimetableApp.prototype.saveTime = function(e) {
        e.preventDefault();
        
        const timeInput = document.getElementById('timeRange');
        const period = timeInput.dataset.period;
        const newTime = timeInput.value.trim();
        
        if (!newTime) return;
        
        document.querySelector(`[data-period="${period}"]`).textContent = newTime;
        this.saveData();
        this.closeTimeModal();
    }

TimetableApp.prototype.getCell1v1Status = function(key) {
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

TimetableApp.prototype.addItemToCell = function(item, day, section, period) {
        const key = `${day}-${section}-${period}`;
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        // 获取或创建当前周的版本
        let version = this.getCellVersion(key, weekStartStr);
        let currentSubject = version ? version.subject : null;
        let currentStudents = version ? (version.student || []).slice() : [];

        if (item.type === 'subject') {
            currentSubject = item.id;
        } else {
            if (currentStudents.includes(item.id)) return; // 已存在

            if (currentStudents.length >= this.MAX_STUDENTS_PER_COURSE) {
                alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
                return;
            }
            const draggedStudent = this.students.find(s => s.id === item.id);
            const isDragged1v1 = draggedStudent && draggedStudent.is1v1;
            const { has1v1, studentCount } = this.getCell1v1Status(key);

            if (isDragged1v1 && studentCount > 0) {
                alert('1v1学生只能单独上课，无法添加到已有学生的课程中');
                return;
            }
            if (!isDragged1v1 && has1v1) {
                alert('已有1v1学生的课程无法添加其他学生');
                return;
            }

            const auditionAssigned = this.getAuditionStudentAssignedKeys(item.id, [key]);
            if (auditionAssigned.length > 0) {
                const student = this.students.find(s => s.id === item.id);
                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);
                return;
            }

            currentStudents.push(item.id);
        }

        this.setCellVersion(key, weekStartStr, currentSubject, currentStudents);

        // 试听学生自动设为临时模式（只出现在当前周）
        if (item.type === 'student') {
            this.ensureAuditionStudentsTemporary(key, [item.id]);
            // 已结课学生自动设为临时模式（只出现在当前周）
            const draggedStudent = this.students.find(s => s.id === item.id);
            if (draggedStudent && draggedStudent.completed) {
                this.setStudentRecurrence(key, item.id, 'temporary');
            }
        }

        this.syncRealtime();
    }

    // 从课程池拖入整个课程（科目 + 所有学生）
TimetableApp.prototype.addCourseToCell = function(courseItem, day, section, period) {
        const key = `${day}-${section}-${period}`;

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
            alert('1v1学生只能单独上课，无法加入包含多个学生的课程');
            return;
        }

        const { has1v1, studentCount } = this.getCell1v1Status(key);
        
        if (hasCourse1v1 && studentCount > 0) {
            alert('1v1学生只能单独上课，无法添加到已有学生的课程中');
            return;
        }
        if (!hasCourse1v1 && has1v1) {
            alert('已有1v1学生的课程无法添加其他学生');
            return;
        }

        for (const studentId of studentIds) {
            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [key]);
            if (auditionAssigned.length > 0) {
                const student = this.students.find(s => s.id === studentId);
                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);
                return;
            }
        }

        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        this.setCellVersion(key, weekStartStr, courseItem.courseSubjectId, [...studentIds]);

        // 试听学生自动设为临时模式（只出现在当前周）
        this.ensureAuditionStudentsTemporary(key, studentIds);

        // 已结课学生拖入课表时自动设为临时模式
        for (const studentId of studentIds) {
            const s = this.students.find(st => st.id === studentId);
            if (s && s.completed) {
                this.setStudentRecurrence(key, studentId, 'temporary');
            }
        }

        // 如果拖入的是手动课程，从 manualCourses 中移除
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
        const section = cell.dataset.section;
        const period = cell.dataset.period;
        const key = `${day}-${section}-${period}`;
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

        const isEmpty = !newSubject && newStudents.length === 0;
        this.setCellVersion(key, weekStartStr, newSubject, newStudents, { cutoff: isEmpty });

        this.syncRealtime();
    }

TimetableApp.prototype.moveStudent = function(sourceKey, targetKey, studentId) {
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const nextWeekStr = this.formatLocalDate(this.getWeekRange(new Date(new Date(this.getWeekRange(this.currentDate).start).getTime() + 7 * 24 * 60 * 60 * 1000)).start);
        const sourceVersion = this.getCellVersion(sourceKey, weekStartStr);
        if (!sourceVersion || !sourceVersion.student || !sourceVersion.student.includes(studentId)) return;

        const draggedStudent = this.students.find(s => s.id === studentId);
        const isDragged1v1 = draggedStudent && draggedStudent.is1v1;

        const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [sourceKey, targetKey]);
        if (auditionAssigned.length > 0) {
            alert(`试听学生「${draggedStudent ? draggedStudent.name : '未知'}」已排在其他课程中，不可重复排课`);
            return;
        }

        const targetVersion = this.getCellVersion(targetKey, weekStartStr);
        let targetStudents = targetVersion ? (targetVersion.student || []).slice() : [];
        let targetSubject = targetVersion ? targetVersion.subject : null;

        const { has1v1, studentCount } = this.getCell1v1Status(targetKey);

        if (isDragged1v1 && studentCount > 0) {
            alert('1v1学生只能单独上课，无法添加到已有学生的课程中');
            return;
        }
        if (!isDragged1v1 && has1v1) {
            alert('已有1v1学生的课程无法添加其他学生');
            return;
        }

        if (targetStudents.length >= this.MAX_STUDENTS_PER_COURSE) {
            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
            return;
        }

        targetStudents.push(studentId);

        const sourceNextVersion = this.getCellVersion(sourceKey, nextWeekStr);
        const targetNextVersion = this.getCellVersion(targetKey, nextWeekStr);

        // 只改当前这一周：源课位本周移除学生，下一周恢复原本未来状态
        const sourceStudents = (sourceVersion.student || []).filter(id => id !== studentId);

        this.setCellVersion(sourceKey, weekStartStr, sourceVersion.subject, sourceStudents);
        this.setCellVersion(targetKey, weekStartStr, targetSubject, targetStudents);

        const branchedSourceVersion = this.getCellVersion(sourceKey, weekStartStr);
        const branchedTargetVersion = this.getCellVersion(targetKey, weekStartStr);
        const sourceRestoreSubject = sourceNextVersion ? sourceNextVersion.subject : sourceVersion.subject;
        const sourceRestoreStudents = sourceNextVersion ? (sourceNextVersion.student || []) : (sourceVersion.student || []);

        if (sourceRestoreSubject || sourceRestoreStudents.length > 0) {
            this.setCellVersion(sourceKey, nextWeekStr, sourceRestoreSubject, sourceRestoreStudents);
            const restoredSourceVersion = this.getCellVersion(sourceKey, nextWeekStr);
            if (restoredSourceVersion) {
                const sourceStateOrigin = sourceNextVersion || sourceVersion;
                window.ScheduleErpService.inheritStudentBranchState(
                    this,
                    sourceStateOrigin,
                    restoredSourceVersion,
                    sourceRestoreStudents,
                    nextWeekStr
                );
            }
        } else {
            this.setCellVersion(sourceKey, nextWeekStr, null, [], { cutoff: true });
        }

        if (targetNextVersion && (targetNextVersion.subject || (targetNextVersion.student || []).length > 0)) {
            this.setCellVersion(targetKey, nextWeekStr, targetNextVersion.subject, targetNextVersion.student || []);
            const restoredTargetVersion = this.getCellVersion(targetKey, nextWeekStr);
            if (restoredTargetVersion) {
                window.ScheduleErpService.inheritStudentBranchState(
                    this,
                    targetNextVersion,
                    restoredTargetVersion,
                    targetNextVersion.student || [],
                    nextWeekStr
                );
            }
        } else {
            this.setCellVersion(targetKey, nextWeekStr, null, [], { cutoff: true });
        }

        // 试听学生自动设为临时模式（只出现在当前周）
        if (draggedStudent && draggedStudent.isAudition) {
            this.ensureAuditionStudentsTemporary(targetKey, [studentId]);
        }
        // 已结课学生移动后保持临时模式（只出现在当前周）
        if (draggedStudent && draggedStudent.completed) {
            this.setStudentRecurrence(targetKey, studentId, 'temporary');
        }

        this.syncRealtime();
    }

TimetableApp.prototype.moveSubject = function(sourceKey, targetKey) {
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const nextWeekStr = this.formatLocalDate(this.getWeekRange(new Date(new Date(this.getWeekRange(this.currentDate).start).getTime() + 7 * 24 * 60 * 60 * 1000)).start);
        const sourceVersion = this.getCellVersion(sourceKey, weekStartStr);
        if (!sourceVersion || !sourceVersion.subject) return;

        const subjectId = sourceVersion.subject;
        const sourceStudents = sourceVersion.student || [];

        const targetVersion = this.getCellVersion(targetKey, weekStartStr);
        const targetStudents = targetVersion ? (targetVersion.student || []).slice() : [];

        // 检查源和目标的学生组合是否不同，不同则提示用户确认
        if (targetStudents.length > 0 && 
            [...targetStudents].sort().join(',') !== [...sourceStudents].sort().join(',')) {
            if (!confirm('目标格已有不同的学生，合并后学生组合将改变，是否继续？')) {
                return;
            }
        }

        // 合并源和目标的学生（去重），拖拽科目时连同学生一起移动
        const mergedStudents = [...new Set([...sourceStudents, ...targetStudents])];

        // 检查合并后学生数是否超限
        if (mergedStudents.length > this.MAX_STUDENTS_PER_COURSE) {
            alert(`每节课最多只能有 ${this.MAX_STUDENTS_PER_COURSE} 个学生`);
            return;
        }

        // 1v1 约束检查
        const hasSource1v1 = sourceStudents.some(id => {
            const s = this.students.find(st => st.id === id);
            return s && s.is1v1;
        });
        const hasTarget1v1 = targetStudents.some(id => {
            const s = this.students.find(st => st.id === id);
            return s && s.is1v1;
        });
        if (hasSource1v1 && targetStudents.length > 0) {
            alert('1v1学生只能单独上课，无法移到已有学生的课程中');
            return;
        }
        if (hasTarget1v1 && sourceStudents.length > 0) {
            alert('已有1v1学生的课程无法添加其他学生');
            return;
        }

        // 试听学生约束检查（源学生从源课位移到目标课位）
        for (const studentId of sourceStudents) {
            const auditionAssigned = this.getAuditionStudentAssignedKeys(studentId, [sourceKey, targetKey]);
            if (auditionAssigned.length > 0) {
                const student = this.students.find(s => s.id === studentId);
                alert(`试听学生「${student ? student.name : '未知'}」已排在其他课程中，不可重复排课`);
                return;
            }
        }

        const sourceNextVersion = this.getCellVersion(sourceKey, nextWeekStr);
        const targetNextVersion = this.getCellVersion(targetKey, nextWeekStr);

        // 只改当前这一节：源课位本周隐藏，目标课位本周显示，下一周恢复双方原来的未来状态
        this.setCellVersion(sourceKey, weekStartStr, null, [], { cutoff: true });
        this.setCellVersion(targetKey, weekStartStr, subjectId, mergedStudents);
        const movedTargetVersion = this.getCellVersion(targetKey, weekStartStr);

        if (sourceNextVersion && (sourceNextVersion.subject || (sourceNextVersion.student || []).length > 0)) {
            this.setCellVersion(sourceKey, nextWeekStr, sourceNextVersion.subject, sourceNextVersion.student || []);
            const restoredSourceVersion = this.getCellVersion(sourceKey, nextWeekStr);
            if (restoredSourceVersion) {
                window.ScheduleErpService.inheritStudentBranchState(
                    this,
                    sourceNextVersion,
                    restoredSourceVersion,
                    sourceNextVersion.student || [],
                    nextWeekStr
                );
            }
        } else {
            this.setCellVersion(sourceKey, nextWeekStr, null, [], { cutoff: true });
        }

        if (targetNextVersion && (targetNextVersion.subject || (targetNextVersion.student || []).length > 0)) {
            this.setCellVersion(targetKey, nextWeekStr, targetNextVersion.subject, targetNextVersion.student || []);
            const restoredTargetVersion = this.getCellVersion(targetKey, nextWeekStr);
            if (restoredTargetVersion) {
                window.ScheduleErpService.inheritStudentBranchState(
                    this,
                    targetNextVersion,
                    restoredTargetVersion,
                    targetNextVersion.student || [],
                    nextWeekStr
                );
            }
        } else {
            this.setCellVersion(targetKey, nextWeekStr, null, [], { cutoff: true });
        }
        window.ScheduleErpService.transferMovedCourseData(this, sourceVersion, targetKey, movedTargetVersion, weekStartStr);

        this.ensureAuditionStudentsTemporary(targetKey, mergedStudents);

        this.syncRealtime();
    }

TimetableApp.prototype.renderTimetable = function() {
        const tbody = document.getElementById('timetableBody');
        tbody.innerHTML = '';
        
        let totalPeriodNum = 0;
        
        // 渲染上午
        if (this.periods.morning.length > 0) {
            this.periods.morning.forEach((period, index) => {
                totalPeriodNum++;
                const row = this.createPeriodRow('morning', index, period, totalPeriodNum);
                tbody.appendChild(row);
            });
        }
        
        // 渲染下午
        if (this.periods.afternoon.length > 0) {
            this.periods.afternoon.forEach((period, index) => {
                totalPeriodNum++;
                const row = this.createPeriodRow('afternoon', index, period, totalPeriodNum);
                tbody.appendChild(row);
            });
        }

        // 渲染晚上
        if (this.settings.showEvening && this.periods.evening.length > 0) {
            this.periods.evening.forEach((period, index) => {
                totalPeriodNum++;
                const row = this.createPeriodRow('evening', index, period, totalPeriodNum);
                tbody.appendChild(row);
            });
        }

        this.highlightTodayColumn();
}



TimetableApp.prototype.createPeriodRow = function(section, periodIndex, period, periodNum) {
        const row = document.createElement('tr');
        
        // 节次/时间列
        const periodCell = document.createElement('td');
        periodCell.className = 'period-cell';
        periodCell.innerHTML = `
                        <div class="period-name" data-section="${section}" data-period="${periodIndex}" style="cursor: pointer; font-weight: bold; color: var(--text-1); font-size: 14px;">
                            第${periodNum}节
                        </div>
                        <div class="time-display" data-section="${section}" data-period="${periodIndex}" style="cursor: pointer; font-size: 12px; color: var(--text-3); display: block;">
                            ${period.time}
                        </div>
                    `;
        
        // 添加课时名称和时间段点击事件
        periodCell.querySelector('.period-name').addEventListener('click', (e) => {
            this.openTimeModal(e, section, periodIndex);
        });
        periodCell.querySelector('.time-display').addEventListener('click', (e) => {
            this.openTimeModal(e, section, periodIndex);
        });
        
        row.appendChild(periodCell);
        
        // 周一到周日的格子
        const days = [1, 2, 3, 4, 5];
        if (this.settings.showSaturday) days.push(6);
        if (this.settings.showSunday) days.push(7);

        for (let day of days) {
            const cell = document.createElement('td');
            cell.className = 'cell';
            if (day >= 6) {
                cell.classList.add('weekend-col');
            }
            cell.dataset.day = day;
            cell.dataset.section = section;
            cell.dataset.period = periodIndex;
            
            const key = `${day}-${section}-${periodIndex}`;
            const weekStart = this.getWeekRange(this.currentDate).start;
            const weekStartStr = this.formatLocalDate(weekStart);
            const version = this.getCellVersion(key, weekStartStr);

            if (version) {
                // 直接从版本中获取学生和科目（无需额外过滤）
                const students = (version.student || [])
                    .map(id => this.students.find(s => s.id === id)).filter(Boolean);
                const subject = version.subject ? this.subjects.find(s => s.id === version.subject) : null;

                // 仅当有可见科目或有可见学生时才标记为 occupied
                if (subject || students.length > 0) {
                    cell.classList.add('occupied');
                }

                if (subject) {
                    cell.draggable = true;
                    cell.dataset.itemType = 'subject';
                    cell.dataset.itemId = version.subject;
                    cell.style.cursor = 'grab';
                    
                    const subjectBg = document.createElement('div');
                    subjectBg.className = 'subject-bg';
                    subjectBg.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: ${subject.color || '#666666'}; border-radius: 6px; z-index: 1; pointer-events: none;`;
                    cell.appendChild(subjectBg);
                }
                
                if (students.length > 0) {
                    const studentContainer = document.createElement('div');
                    studentContainer.className = 'cell-content';
                    studentContainer.style.cssText = 'position: absolute; top: 8px; left: 6px; width: calc(100% - 12px) !important; height: calc(100% - 14px) !important; display: flex; flex-direction: row; justify-content: space-between; align-items: stretch; gap: 6px; box-sizing: border-box; z-index: 2;';
                    
                    const studentCount = students.length;
                    const isVertical = studentCount >= 3;
                    const fontSize = isVertical ? 14 : 20;
                    
                    students.forEach(student => {
                        const studentCard = document.createElement('div');
                        studentCard.draggable = true;
                        studentCard.dataset.itemId = student.id;
                        studentCard.dataset.itemType = 'student';
                        studentCard.dataset.sourceDay = day;
                        studentCard.dataset.sourceSection = section;
                        studentCard.dataset.sourcePeriod = periodIndex;
                        const dynamicColor = this.getStudentGradeColor(student);
                        const bgColor = dynamicColor ? 'rgba(255,255,255,0.7)' : 'transparent';
                        const textColor = dynamicColor ? '#333' : '#333';
                        const gradeColor = dynamicColor;
                        const cardFlexDir = isVertical ? 'column' : 'row';
                        studentCard.style.cssText = `flex: 1; background-color: ${bgColor}; border-radius: 4px; display: flex; flex-direction: ${cardFlexDir}; justify-content: center; align-items: stretch; position: relative; overflow: hidden; cursor: grab;`;

                        const gradeColorBar = document.createElement('div');
                        gradeColorBar.style.cssText = isVertical 
                            ? `width: 100%; height: 4px; background-color: ${gradeColor}; flex-shrink: 0;`
                            : `width: 4px; height: 100%; background-color: ${gradeColor}; flex-shrink: 0;`;

                        const studentName = document.createElement('div');
                        studentName.textContent = student.name;

                        if (isVertical) {
                            const adjustedFontSize = student.isAudition ? 12 : fontSize;
                            const topPadding = student.isAudition ? 6 : 2;
                            studentName.style.cssText = `font-size: ${adjustedFontSize}px; color: ${textColor}; font-weight: bold; text-align: center; overflow: hidden; display: flex; flex-direction: column; justify-content: center; line-height: 1.2; padding: ${topPadding}px 1px 2px 1px; writing-mode: vertical-rl; text-orientation: mixed; flex: 1;`;
                        } else {
                            studentName.style.cssText = `font-size: ${fontSize}px; color: ${textColor}; font-weight: bold; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; display: flex; align-items: center; justify-content: center; flex: 1;`;
                        }

                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-cell-btn';
                        deleteBtn.title = '删除学生';
                        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" width="10" height="10"><path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 19.5304 6.21071 20.0391 6.58579 20.4142C6.96086 20.7893 7.46957 21 8 21H16C16.5304 21 17.0391 20.7893 17.4142 20.4142C17.7893 20.0391 18 19.5304 18 19L19 7M9 7V4C9 3.73478 9.10536 3.48043 9.29289 3.29289C9.48043 3.10536 9.73478 3 10 3H14C14.2652 3 14.5196 3.10536 14.7071 3.29289C14.8946 3.48043 15 3.73478 15 4V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                        deleteBtn.style.cssText = `position: absolute; top: 1px; right: 1px; width: 14px; height: 14px; background: #dc3545; color: white; border: none; border-radius: 50%; cursor: pointer; display: none; align-items: center; justify-content: center; z-index: 10;`;

                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.removeItemFromCell(cell, 'student', student.id);
                        });

                        studentCard.addEventListener('mouseenter', () => {
                            deleteBtn.style.display = 'flex';
                        });

                        studentCard.addEventListener('mouseleave', () => {
                            deleteBtn.style.display = 'none';
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
                            badge.className = 'one-v1-badge';
                            badge.textContent = '1v1';
                            studentCard.appendChild(badge);
                        }

                        if (student.isAudition) {
                            const badge = document.createElement('span');
                            badge.className = 'audition-badge';
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
                    deleteBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; background: rgba(255, 255, 255, 0.9); color: #dc3545; border: none; border-radius: 50%; cursor: pointer; display: none; align-items: center; justify-content: center; z-index: 10; transition: all 0.2s ease;';
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
                
                if (students.length > 0 && !subject) {
                    const studentContainer = document.createElement('div');
                    studentContainer.className = 'cell-content';
                    studentContainer.style.cssText = 'position: absolute; top: 8px; left: 6px; width: calc(100% - 12px) !important; height: calc(100% - 14px) !important; display: flex; flex-direction: row; justify-content: space-between; align-items: stretch; gap: 6px; box-sizing: border-box; z-index: 2;';
                    
                    const studentCount = students.length;
                    const isVertical = studentCount >= 3;
                    const fontSize = isVertical ? 14 : 20;
                    
                    students.forEach(student => {
                        const studentCard = document.createElement('div');
                        studentCard.draggable = true;
                        studentCard.dataset.itemId = student.id;
                        studentCard.dataset.itemType = 'student';
                        studentCard.dataset.sourceDay = day;
                        studentCard.dataset.sourceSection = section;
                        studentCard.dataset.sourcePeriod = periodIndex;
                        const dynamicColor = this.getStudentGradeColor(student);
                        const bgColor = dynamicColor || 'transparent';
                        const textColor = dynamicColor ? 'white' : '#333';
                        const gradeColor = dynamicColor;
                        const cardFlexDir = isVertical ? 'column' : 'row';
                        studentCard.style.cssText = `flex: 1; background-color: ${bgColor}; border-radius: 4px; display: flex; flex-direction: ${cardFlexDir}; justify-content: center; align-items: stretch; position: relative; overflow: hidden; cursor: grab;`;

                        const gradeColorBar = document.createElement('div');
                        gradeColorBar.style.cssText = isVertical 
                            ? `width: 100%; height: 4px; background-color: ${gradeColor}; flex-shrink: 0;`
                            : `width: 4px; height: 100%; background-color: ${gradeColor}; flex-shrink: 0;`;

                        const studentName = document.createElement('div');
                        studentName.textContent = student.name;

                        if (isVertical) {
                            const adjustedFontSize = student.isAudition ? 12 : fontSize;
                            const topPadding = student.isAudition ? 6 : 2;
                            studentName.style.cssText = `font-size: ${adjustedFontSize}px; color: ${textColor}; font-weight: bold; text-align: center; overflow: hidden; display: flex; flex-direction: column; justify-content: center; line-height: 1.2; padding: ${topPadding}px 1px 2px 1px; writing-mode: vertical-rl; text-orientation: mixed; flex: 1;`;
                        } else {
                            studentName.style.cssText = `font-size: ${fontSize}px; color: ${textColor}; font-weight: bold; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; display: flex; align-items: center; justify-content: center; flex: 1;`;
                        }

                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-cell-btn';
                        deleteBtn.title = '删除学生';
                        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" width="10" height="10"><path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 19.5304 6.21071 20.0391 6.58579 20.4142C6.96086 20.7893 7.46957 21 8 21H16C16.5304 21 17.0391 20.7893 17.4142 20.4142C17.7893 20.0391 18 19.5304 18 19L19 7M9 7V4C9 3.73478 9.10536 3.48043 9.29289 3.29289C9.48043 3.10536 9.73478 3 10 3H14C14.2652 3 14.5196 3.10536 14.7071 3.29289C14.8946 3.48043 15 3.73478 15 4V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                        deleteBtn.style.cssText = `position: absolute; top: 1px; right: 1px; width: 14px; height: 14px; background: rgba(255,255,255,0.9); color: #dc3545; border: none; border-radius: 50%; cursor: pointer; display: none; align-items: center; justify-content: center; z-index: 10;`;

                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.removeItemFromCell(cell, 'student', student.id);
                        });

                        studentCard.addEventListener('mouseenter', () => {
                        deleteBtn.style.display = 'flex';
                    });

                    studentCard.addEventListener('mouseleave', () => {
                        deleteBtn.style.display = 'none';
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
                            badge.className = 'one-v1-badge';
                            badge.textContent = '1v1';
                            studentCard.appendChild(badge);
                        }

                        if (student.isAudition) {
                            const badge = document.createElement('span');
                            badge.className = 'audition-badge';
                            badge.textContent = '试';
                            studentCard.appendChild(badge);
                        }

                        studentContainer.appendChild(studentCard);
                    });
                    
                    cell.appendChild(studentContainer);
                }
            } else {
                // 所有设备默认显示+号
                cell.classList.add('empty-cell');
                cell.style.cssText = 'position: relative; cursor: pointer;';
                
                // 使用CSS伪元素显示+号，确保默认显示
                const plusIndicator = document.createElement('div');
                plusIndicator.className = 'plus-indicator';
                plusIndicator.textContent = '+';
                plusIndicator.style.cssText = 'font-size: 24px; color: #ccc; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;';
                cell.appendChild(plusIndicator);
            }
            
            // 添加双击删除课程/学生事件
            cell.addEventListener('dblclick', () => {
                if (cell.classList.contains('occupied')) {
                    this.removeItemFromCell(cell);
                }
            });
            
            // 添加点击选择
            cell.addEventListener('click', () => {
                this.editingCell = cell;
                document.querySelectorAll('.cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                
                this.openAddLessonModal(cell);
            });
            
            row.appendChild(cell);
        }
        
        return row;
    }

TimetableApp.prototype.openTimeModal = function(e, section, periodIndex) {
        this.editingPeriod = { section, periodIndex };
        const modal = document.getElementById('timeModal');
        const nameInput = document.getElementById('periodName');
        const startHourSelect = document.getElementById('startHour');
        const startMinuteSelect = document.getElementById('startMinute');
        const endHourSelect = document.getElementById('endHour');
        const endMinuteSelect = document.getElementById('endMinute');
        
        const period = this.periods[section][periodIndex];
        nameInput.value = period.name;
        
        // 解析现有时间
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
        
        const { section, periodIndex } = this.editingPeriod;
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
        this.periods[section][periodIndex].time = newTime;
        this.periods[section][periodIndex].name = newName;
        this.syncRealtime({ subjects: false });
        this.closeTimeModal();
    }
