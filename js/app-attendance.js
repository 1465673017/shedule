// app-attendance.js - Attendance and recurrence
// Auto-split from script.js

TimetableApp.prototype.openAttendanceModal = function(cell) {
        this.selectedCell = cell;
        const modal = document.getElementById('attendanceModal');

        const day = cell.dataset.day;
        const section = cell.dataset.section;
        const period = cell.dataset.period;
        const key = `${day}-${section}-${period}`;
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const version = this.getCellVersion(key, weekStartStr);

        const subject = version && version.subject
            ? this.subjects.find(s => s.id == version.subject)
            : null;

        const studentIds = version && version.student && Array.isArray(version.student)
            ? version.student
            : [];
        
        const students = studentIds.map(id => this.students.find(s => s.id == id)).filter(Boolean);
        
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dayIndex = parseInt(day);
        const dayName = dayIndex >= 0 && dayIndex <= 6 ? dayNames[dayIndex] : '';
        
        const sectionName = section === 'morning' ? '上午' : section === 'afternoon' ? '下午' : '晚上';
        const periodInfo = this.periods[section] && this.periods[section][period] 
            ? this.periods[section][period] 
            : null;
        const weekRange = this.getWeekRange(this.currentDate);
        const classDate = new Date(weekRange.start);
        classDate.setDate(weekRange.start.getDate() + (dayIndex - 1));
        const formatLocalDate = d => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const dateKey = formatLocalDate(classDate);
        
        const lessonInfo = document.getElementById('attendanceLessonInfo');
        const scheduledMinutes = periodInfo ? this.timeToMinutes(periodInfo.time.split('-')[1]) - this.timeToMinutes(periodInfo.time.split('-')[0]) : 120;
        const erpActualMin = window.ScheduleErpService.getActualMinutes(this, key, dateKey);
        const actualMin = erpActualMin !== undefined
            ? erpActualMin
            : scheduledMinutes;
        const actualDisplay = this.formatDuration(Math.floor(actualMin / 60), actualMin % 60);

        lessonInfo.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <strong>${dayName} ${sectionName} ${periodInfo ? periodInfo.name : ''}</strong>
                    <div>${subject ? subject.name : '无科目'} ${periodInfo ? ' - ' + periodInfo.time : ''}</div>
                </div>
                <div class="actual-duration-display" onclick="app.showDurationEditor(event, '${key}')" title="点击修改实际上课时间">
                    <span class="actual-duration-label">实上</span>
                    <span class="actual-duration-value">${actualDisplay}</span>
                    <span class="actual-duration-edit-icon">edit</span>
                </div>
            </div>
        `;
        
        this._attModalClassFinished = this.isClassFinished(key, classDate);
        this._attModalDateKey = dateKey;
        this._attModalClassDate = classDate;
        this._attModalCourseInstanceId = version ? version.courseInstanceId : null;

        this._attModalKey = key;
        this._attModalStudents = students;
        this._attModalCellKey = key;

        // 预计算每个学生的重复类型
        this._attModalRecurrence = {};
        students.forEach(student => {
            this._attModalRecurrence[student.id] = this.getStudentRecurrenceType(key, student.id);
        });

        this.renderAttendanceStudentList(students, key);
        this.renderAttendanceRecords(students, key);

        modal.style.display = 'block';
    }

TimetableApp.prototype.getAttendanceStatusForModal = function(key, studentId) {
        const dateKey = this._attModalDateKey || '';
        if (this.erpData && Array.isArray(this.erpData.attendanceRecords)) {
            const erpRecord = this.erpData.attendanceRecords.find(record =>
                record.studentId === String(studentId) &&
                record.dateKey === dateKey &&
                (
                    (this._attModalCourseInstanceId && record.courseInstanceId === this._attModalCourseInstanceId) ||
                    record.cellKey === key
                )
            );
            if (erpRecord) return erpRecord.status;
        }
        return null;
    }

TimetableApp.prototype.closeAttendanceModal = function() {
        document.getElementById('attendanceModal').style.display = 'none';
        this.selectedCell = null;
        this._attModalClassFinished = null;
        this._attModalDateKey = null;
        this._attModalCellKey = null;
        this._attModalCourseInstanceId = null;
        this._attModalRecurrence = null;
        this.hideDurationEditor();
    }

TimetableApp.prototype.showDurationEditor = function(event, key) {
        event.stopPropagation();
        // Remove any existing editor
        this.hideDurationEditor();

        const displayEl = event.currentTarget;
        const scheduledMinutes = this.getScheduledMinutes(key);
        const erpActualMin = window.ScheduleErpService.getActualMinutes(this, key, this._attModalDateKey);
        const currentMin = erpActualMin !== undefined
            ? erpActualMin
            : scheduledMinutes;
        const currentHours = Math.floor(currentMin / 60);
        const currentMins = currentMin % 60;

        const editor = document.createElement('div');
        editor.className = 'duration-editor-dropdown';
        editor.id = 'durationEditorDropdown';
        editor.onclick = (e) => e.stopPropagation();
        editor.innerHTML = `
            <div class="duration-editor-header">修改实际上课时长</div>
            <div class="duration-editor-body">
                <div class="duration-slider-group">
                    <label>小时</label>
                    <div class="duration-slider-row">
                        <input type="range" class="duration-range" id="durationHourSlider" min="0" max="8" value="${currentHours}" oninput="app.syncActualDuration('${key}')">
                        <span class="duration-slider-val" id="durationHourVal">${currentHours}</span>
                    </div>
                </div>
                <div class="duration-slider-group">
                    <label>分钟</label>
                    <div class="duration-slider-row">
                        <input type="range" class="duration-range" id="durationMinSlider" min="0" max="55" step="5" value="${currentMins}" oninput="app.syncActualDuration('${key}')">
                        <span class="duration-slider-val" id="durationMinVal">${currentMins}</span>
                    </div>
                </div>
            </div>
        `;
        displayEl.appendChild(editor);

        // Mouse wheel support for sliders
        const hourSlider = document.getElementById('durationHourSlider');
        const minSlider = document.getElementById('durationMinSlider');
        const wheelHandler = (slider, step, cb) => {
            slider.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -step : step;
                slider.value = Math.min(slider.max, Math.max(slider.min, parseInt(slider.value) + delta));
                cb();
            }, { passive: false });
        };
        wheelHandler(hourSlider, 1, () => this.syncActualDuration(key));
        wheelHandler(minSlider, 5, () => this.syncActualDuration(key));

        this._durationEditorKey = key;

        // Close dropdown when clicking outside
        setTimeout(() => {
            this._docClickHandler = (e) => {
                if (!editor.contains(e.target) && e.target !== displayEl && !displayEl.contains(e.target)) {
                    this.hideDurationEditor();
                }
            };
            document.addEventListener('click', this._docClickHandler);
        }, 0);
    }

TimetableApp.prototype.syncActualDuration = function(key) {
        const hourSlider = document.getElementById('durationHourSlider');
        const minSlider = document.getElementById('durationMinSlider');
        const hourVal = document.getElementById('durationHourVal');
        const minVal = document.getElementById('durationMinVal');
        if (!hourSlider || !minSlider) return;

        const hours = parseInt(hourSlider.value);
        const mins = parseInt(minSlider.value);
        if (hourVal) hourVal.textContent = hours;
        if (minVal) minVal.textContent = mins;

        const totalMinutes = hours * 60 + mins;            window.ScheduleErpService.setActualMinutes(this, key, totalMinutes, this._attModalDateKey);

        this.saveData();

        // Update the display badge in real-time
        const display = this.formatDuration(hours, mins);
        const valueEl = document.querySelector('.actual-duration-value');
        if (valueEl) valueEl.textContent = display;
    }

TimetableApp.prototype.formatDuration = function(hours, mins) {
        if (hours === 0 && mins === 0) return '0min';
        if (hours === 0) return `${mins}min`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h${mins}min`;
    }

TimetableApp.prototype.hideDurationEditor = function() {
        const editor = document.getElementById('durationEditorDropdown');
        if (editor) editor.remove();
        this._durationEditorKey = null;
        if (this._docClickHandler) {
            document.removeEventListener('click', this._docClickHandler);
            this._docClickHandler = null;
        }
    }

TimetableApp.prototype.getScheduledMinutes = function(key) {
        const parts = key.split('-');
        if (parts.length !== 3) return 120;
        const section = parts[1];
        const period = parseInt(parts[2]);
        const periodInfo = this.periods[section] && this.periods[section][period]
            ? this.periods[section][period]
            : null;
        if (periodInfo && periodInfo.time) {
            const timeParts = periodInfo.time.split('-');
            if (timeParts.length === 2) {
                return this.timeToMinutes(timeParts[1]) - this.timeToMinutes(timeParts[0]);
            }
        }
        return 120;
    }

TimetableApp.prototype.renderAttendanceStudentList = function(students, key) {
        const container = document.getElementById('attendanceStudentList');
        // Attendance state is resolved through CourseInstance-aware records first.
        const att = {};

        students.forEach(student => {
            att[student.id] = this.getAttendanceStatusForModal(key, student.id);
        });

        if (students.length === 0) {
            container.innerHTML = '<div class="text-muted">该单元格暂无学生</div>';
            return;
        }

        let html = '';
        students.forEach(student => {
            let recType = (this._attModalRecurrence && this._attModalRecurrence[student.id]) || 'recurring';
            if (student.isAudition) {
                recType = 'temporary';
            }
            const isCompleted = !!student.completed;
            const auditionDisabled = student.isAudition ? 'disabled disabled-btn' : '';
            const completedDisabled = isCompleted ? 'disabled disabled-btn' : '';
            html += `
                <div class="lps-item">
                    <div>
                        <span class="lps-name">${student.name}</span>
                        <span class="lps-grade">${student.teacher || ''}</span>
                    </div>
                    <div class="lps-leave">
                        <button class="recurrence-btn ${recType === 'recurring' ? 'active recurring' : ''} ${auditionDisabled} ${completedDisabled}"
                                data-sid="${student.id}"
                                onclick="app.setStudentRecurrenceUI('${key}', '${student.id}', 'recurring', this)">循环</button>
                        <button class="recurrence-btn ${recType === 'stopped' ? 'active stopped' : ''} ${auditionDisabled} ${completedDisabled}"
                                data-sid="${student.id}"
                                onclick="app.setStudentRecurrenceUI('${key}', '${student.id}', 'stopped', this)">停止循环</button>
                        <button class="recurrence-btn ${recType === 'temporary' ? 'active temporary' : ''} ${completedDisabled}"
                                data-sid="${student.id}"
                                onclick="app.setStudentRecurrenceUI('${key}', '${student.id}', 'temporary', this)">临时</button>
                        <button class="recurrence-btn ${isCompleted ? 'active completed' : ''} ${auditionDisabled}"
                                data-sid="${student.id}"
                                onclick="app.toggleStudentCompleted('${student.id}', this)">结课</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

TimetableApp.prototype.renderAttendanceRecords = function(students, key) {
        const container = document.getElementById('attendanceRecords');
        // Attendance state is resolved through CourseInstance-aware records first.
        const att = {};

        students.forEach(student => {
            att[student.id] = this.getAttendanceStatusForModal(key, student.id);
        });

        if (students.length === 0) {
            container.innerHTML = '<div class="text-muted">暂无学生</div>';
            return;
        }

        // Finished classes auto-fill unmarked students as present.
        if (this._attModalClassFinished) {
            let autoSaved = false;
            students.forEach(student => {
                if (!att[student.id]) {
                    this.setAttendanceStatus(key, student.id, 'present');
                    att[student.id] = 'present';
                    autoSaved = true;
                }
            });
            if (autoSaved) {
                this.renderAttendanceStudentList(students, key);
            }
        }

        // 课程未结束时不自动选择任何选项；课程已结束时默认出勤
        const defaultStatus = this._attModalClassFinished ? 'present' : '';

        let html = '';
        students.forEach(student => {
            const status = att[student.id] || defaultStatus;
            html += `
                <div class="att-row">
                    <span style="font-size: 13px;">${student.name}</span>
                    <div class="att-status">
                        <button class="att-btn ${status === 'present' ? 'present' : ''}"
                                onclick="app.setAttendance('${key}', '${student.id}', 'present', this)">出勤</button>
                        <button class="att-btn ${status === 'leave' ? 'leave' : ''}"
                                onclick="app.setAttendance('${key}', '${student.id}', 'leave', this)">请假</button>
                        <button class="att-btn ${status === 'absent' ? 'absent' : ''}"
                                onclick="app.setAttendance('${key}', '${student.id}', 'absent', this)">缺勤</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

TimetableApp.prototype.setAttendance = function(key, studentId, status, btn) {
        this.setAttendanceStatus(key, studentId, status);
        
        const row = btn.closest('.att-row');
        row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('present', 'leave', 'absent'));
        btn.classList.add(status);
        
    }

TimetableApp.prototype.setAttendanceStatus = function(key, studentId, status) {
        const dateKey = this.getAttendanceDateKeyForCell(key);
        window.ScheduleErpService.upsertAttendance(this, key, studentId, status, dateKey);
        this.saveData();
    }

TimetableApp.prototype.getAttendanceDateKeyForCell = function(key) {
        const [dayStr] = key.split('-');
        const dayNum = parseInt(dayStr);

        const weekRange = this.getWeekRange(this.currentDate);
        const startDate = weekRange.start;
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + (dayNum - 1));
        targetDate.setHours(0, 0, 0, 0);

        const formatLocalDate = d => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        return formatLocalDate(targetDate);
    }

TimetableApp.prototype.getStudentAttendance = function(studentId, startDate = null, endDate = null) {
        const result = {
            present: 0,
            leave: 0,
            absent: 0,
            records: {}
        };

        if (this.erpData && Array.isArray(this.erpData.attendanceRecords)) {
            this.erpData.attendanceRecords
                .filter(record => record.studentId === String(studentId))
                .forEach(record => {
                    const recordDate = new Date(record.dateKey);
                    if (startDate && recordDate < startDate) return;
                    if (endDate && recordDate > endDate) return;

                    if (!result.records[record.dateKey]) {
                        result.records[record.dateKey] = {
                            present: 0,
                            leave: 0,
                            absent: 0,
                            records: {}
                        };
                    }

                    if (record.status === 'leave') result.leave++;
                    else if (record.status === 'absent') result.absent++;
                    else result.present++;

                    result.records[record.dateKey][record.status]++;
                    result.records[record.dateKey].records[record.cellKey] = record.status;
                });
            return result;
        }
        return result;
    }

    // ========== 学生课程重复类型（循环/停止循环/临时）——基于版本操作 ==========

TimetableApp.prototype.getStudentRecurrenceType = function(cellKey, studentId) {
        if (this.erpData && Array.isArray(this.erpData.studentCourseRelations)) {
            const weekRange = this.getWeekRange(this.currentDate);
            const currentWeekStr = this.formatLocalDate(weekRange.start);
            const version = this.getCellVersion(cellKey, currentWeekStr);
            const relation = version ? this.erpData.studentCourseRelations.find(rel =>
                rel.courseInstanceId === version.courseInstanceId && rel.studentId === String(studentId)
            ) : null;
            if (relation) {
                if (relation.relationStatus === 'temporary') return 'temporary';
                if (relation.relationStatus === 'paused' || relation.relationStatus === 'ended') return 'stopped';
            }
        }

        // 通过版本传播判断：找到当前有效版本和下一个版本。
        // 如果下一个版本科目不同或不包含该学生，则停止循环。
        const weekRange = this.getWeekRange(this.currentDate);
        const currentWeekStr = this.formatLocalDate(weekRange.start);
        const curVersion = this.getCellVersion(cellKey, currentWeekStr);

        const inCurrent = curVersion && curVersion.student && curVersion.student.includes(studentId);
        if (!inCurrent) {
            return 'none';
        }

        const nextWeekDate = new Date(weekRange.start);
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        const nextWeekStr = this.formatLocalDate(this.getWeekRange(nextWeekDate).start);
        const nextVersion = this.getCellVersion(cellKey, nextWeekStr);
        if (!nextVersion) return 'stopped';

        const sameSubject = curVersion.subject === nextVersion.subject;
        const inNext = nextVersion.student && nextVersion.student.includes(studentId);

        if (!sameSubject || !inNext) return 'stopped';

        return 'recurring';
    }

TimetableApp.prototype.setStudentRecurrence = function(cellKey, studentId, type, classDate) {
        const weekRange = this.getWeekRange(classDate || this.currentDate);
        const currentWeekStr = this.formatLocalDate(weekRange.start);
        window.ScheduleErpService.setRecurrenceStatus(this, cellKey, studentId, type, currentWeekStr);
        this.saveData();
    }

TimetableApp.prototype.setStudentRecurrenceUI = function(cellKey, studentId, type, btn) {
        const student = this.students.find(s => s.id === studentId);
        if (student && student.isAudition && type !== 'temporary') {
            return;
        }
        if (student && student.completed && type !== 'temporary') {
            student.completed = false;
            student.accountStatus = 'normal';
        }
        this.setStudentRecurrence(cellKey, studentId, type, this._attModalClassDate);
        // 更新 _attModalRecurrence 缓存
        if (!this._attModalRecurrence) this._attModalRecurrence = {};
        this._attModalRecurrence[studentId] = type;
        const row = btn.closest('.lps-leave');
        if (row) {
            row.querySelectorAll('.recurrence-btn').forEach(b => {
                b.classList.remove('active', 'recurring', 'stopped', 'temporary', 'completed');
            });
        }
        btn.classList.add('active', type);
        this.renderTimetable();
        this.renderSubjects();  // 同步刷新学生池（取消结课时需要）
        if (this._attModalStudents && this._attModalKey) {
            this.renderAttendanceStudentList(this._attModalStudents, this._attModalKey);
        }
    }

TimetableApp.prototype.isStudentOngoing = function(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student && student.completed) return false;
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);
        const relations = this.erpData && Array.isArray(this.erpData.studentCourseRelations)
            ? this.erpData.studentCourseRelations
            : [];
        const instances = this.erpData && Array.isArray(this.erpData.courseInstances)
            ? this.erpData.courseInstances
            : [];

        return relations.some(rel => {
            if (rel.studentId !== String(studentId)) return false;
            if (rel.relationStatus && rel.relationStatus !== 'recurring' && rel.relationStatus !== 'temporary') return false;
            const instance = instances.find(ci => ci.id === rel.courseInstanceId);
            return instance && instance.weekStart >= weekStartStr && !instance.isDeleted;
        });
    }

TimetableApp.prototype.isStudentCompleted = function(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student && student.completed) return true;
        const relations = this.erpData && Array.isArray(this.erpData.studentCourseRelations)
            ? this.erpData.studentCourseRelations
            : [];
        const hasHistory = relations.some(rel => rel.studentId === String(studentId));
        if (!hasHistory) return false;
        return !this.isStudentOngoing(studentId);
    }

TimetableApp.prototype.getCellLessonStart = function(cellKey, weekStartDate) {
        const parts = cellKey.split('-');
        if (parts.length !== 3) return null;

        const day = parseInt(parts[0], 10);
        const section = parts[1];
        const periodIndex = parseInt(parts[2], 10);
        const period = this.periods[section] && this.periods[section][periodIndex]
            ? this.periods[section][periodIndex]
            : null;
        if (!day || !period || !period.time) return null;

        const startTime = period.time.split('-')[0] || '00:00';
        const [hour, minute] = startTime.split(':').map(Number);
        const lessonStart = new Date(weekStartDate);
        lessonStart.setDate(weekStartDate.getDate() + day - 1);
        lessonStart.setHours(hour || 0, minute || 0, 0, 0);
        return lessonStart;
    }

TimetableApp.prototype.completeStudentAfterLesson = function(studentId, classDate, currentCellKey) {
        const weekRange = this.getWeekRange(classDate || this.currentDate);
        const currentWeekStr = this.formatLocalDate(weekRange.start);
        const nextWeekDate = new Date(weekRange.start);
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        const nextWeekStr = this.formatLocalDate(nextWeekDate);
        const clickedLessonStart = this.getCellLessonStart(currentCellKey, weekRange.start) || new Date(classDate || this.currentDate);

        const instances = this.erpData && Array.isArray(this.erpData.courseInstances)
            ? this.erpData.courseInstances
            : [];
        const cells = [...new Set(instances.map(instance => instance.cellKey).filter(Boolean))];

        cells.forEach(cellKey => {
            const versions = instances.filter(instance => instance.cellKey === cellKey && !instance.isDeleted);
            if (!versions.some(v => v.student && v.student.includes(studentId))) return;

            const lessonStart = this.getCellLessonStart(cellKey, weekRange.start);
            const cutoffWeekStr = lessonStart && lessonStart > clickedLessonStart
                ? currentWeekStr
                : nextWeekStr;

            window.ScheduleErpService.completeStudentFromWeek(this, cellKey, studentId, cutoffWeekStr);
        });
    }

TimetableApp.prototype.toggleStudentCompleted = function(studentId, btn) {
        const student = this.students.find(s => s.id === studentId);
        if (!student || student.isAudition) return; // 试听学生不能结课

        const isCompleted = !student.completed;

        if (isCompleted) {
            student.completed = true;
            student.accountStatus = 'completed';
            const cellKey = this._attModalCellKey;
            if (cellKey) {
                this.completeStudentAfterLesson(studentId, this._attModalClassDate, cellKey);
            }
        } else {
            student.completed = false;
            student.accountStatus = 'normal';
        }

        if (this.erpData && Array.isArray(this.erpData.studentCourseRelations)) {
            this.erpData.studentCourseRelations.forEach(rel => {
                if (rel.studentId === String(studentId)) {
                    rel.accountStatus = student.accountStatus;
                    rel.updatedAt = new Date().toISOString();
                }
            });
        }

        this.saveData();
        this.renderTimetable();
        this.renderSubjects();  // 同步刷新学生池
        // 刷新点名弹窗列表
        if (this._attModalStudents && this._attModalKey) {
            this.renderAttendanceStudentList(this._attModalStudents, this._attModalKey);
        }
    }
