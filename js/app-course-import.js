// Recognize external course JSON and import it as the highest-priority schedule version.
(function () {
    const STATUS = { PRESENT: 'present', ATTENDANCE: 'present', ATTENDED: 'present', LEAVE: 'leave', ASK_FOR_LEAVE: 'leave', ABSENT: 'absent', ABSENCE: 'absent' };

    function extractCourses(input) {
        const value = typeof input === 'string' ? JSON.parse(input) : input;
        return walkCourses(value);
    }

    function walkCourses(value) {
        if (Array.isArray(value)) {
            const directCourses = value.filter(item => item && typeof item === 'object' && item.courseDate && Array.isArray(item.students));
            if (directCourses.length) return directCourses;
            return value.flatMap(walkCourses);
        }
        if (!value || typeof value !== 'object') return [];
        if (value.courseDate && Array.isArray(value.students)) return [value];
        return Object.values(value).flatMap(walkCourses);
    }

    function localDate(text) {
        const p = String(text || '').split('-').map(Number);
        if (p.length !== 3 || p.some(n => !Number.isFinite(n))) return null;
        const result = new Date(p[0], p[1] - 1, p[2]);
        return Number.isNaN(result.getTime()) ? null : result;
    }

    function isOneToOne(course) {
        const tags = Array.isArray(course.tags) ? course.tags.map(t => t && (t.name || t)) : [];
        const text = [course.courseName, course.type, ...tags].join(' ');
        return String(course.type || '').toUpperCase() === 'ONE_ON_ONE_COURSE'
            || /(^|[^0-9a-z])1\s*v\s*1([^0-9]|$)/i.test(text)
            || /一对一|1\s*对\s*1/.test(text);
    }

    function attendanceStatus(course, source) {
        const details = Array.isArray(course.attendentDetail) ? course.attendentDetail : [];
        const detail = details.find(d => String(d.studentId || d.id || '') === String(source.id));
        const raw = (detail && (detail.status || detail.attendentStatus || detail.attendanceStatus)) || source.attendentStatus || source.attendanceStatus;
        return raw ? STATUS[String(raw).toUpperCase()] || null : null;
    }

    function periodIndex(app, course) {
        const start = String(course.courseTime || '').slice(0, 5);
        const end = String(course.courseEndTime || '').slice(0, 5);
        const ordered = app.getOrderedPeriods();
        let found = ordered.find(x => {
            const range = String(x.period.time || '').split('-').map(v => v.trim().slice(0, 5));
            return range[0] === start && (!end || range[1] === end);
        });
        if (!found) found = ordered.find(x => String(x.period.time || '').startsWith(start));
        if (!found) throw new Error(`未找到与 ${start}-${end} 对应的课时，请先配置该时间段`);
        return found.index;
    }

    function ensureSubject(app, course) {
        const name = String(course.subject && course.subject.name || '未分类').trim();
        let subject = app.subjects.find(s => String(s.name).trim() === name);
        if (!subject) {
            subject = { id: `import_subject_${course.subject && course.subject.id || Date.now()}`, name, teacher: course.teacher && course.teacher.name || '', color: '#E5E7EB' };
            app.subjects.push(subject);
        }
        return subject;
    }

    function ensureStudent(app, source, course, oneToOne) {
        const externalId = String(source.id || '');
        const grade = String(course.grade && course.grade.name || '').trim();
        const classType = oneToOne ? '1v1' : '1vN';
        const studentClassType = student => student.classType || (student.is1v1 ? '1v1' : '1vN');
        let student = app.students.find(s =>
            externalId &&
            String(s.externalStudentId || '') === externalId &&
            studentClassType(s) === classType
        ) || app.students.find(s =>
            s.name === source.name &&
            s.grade === grade &&
            studentClassType(s) === classType &&
            (!externalId || !s.externalStudentId)
        );
        if (!student) {
            student = {
                id: externalId
                    ? `import_student_${externalId}_${classType}`
                    : `import_student_${Date.now()}_${classType}_${Math.random().toString(36).slice(2, 7)}`,
                name: source.name,
                grade
            };
            app.students.push(student);
        }
        student.externalStudentId = externalId || student.externalStudentId;
        student.grade = grade || student.grade;
        student.is1v1 = !!oneToOne;
        student.classType = classType;
        return student;
    }

    function importCourses(app, input) {
        const courses = extractCourses(input);
        if (!courses.length) throw new Error('没有识别到有效课程数据');
        let studentCount = 0;
        courses.forEach(course => {
            const date = localDate(course.courseDate);
            if (!date) throw new Error(`课程 ${course.courseName || course.id || ''} 缺少有效 courseDate`);
            const oneToOne = isOneToOne(course);
            const sourceStudents = Array.isArray(course.students) ? course.students : [];
            const students = sourceStudents.map(s => ensureStudent(app, s, course, oneToOne));
            const subject = ensureSubject(app, course);
            const day = date.getDay() || 7;
            const cellKey = app.buildCellKey(day, periodIndex(app, course));
            const weekStart = app.formatLocalDate(app.getWeekRange(date).start);
            window.ScheduleErpService.setCellVersion(app, cellKey, weekStart, subject.id, students.map(s => s.id), { source: 'course-import' });
            sourceStudents.forEach((source, i) => {
                const status = attendanceStatus(course, source);
                if (status) window.ScheduleErpService.upsertAttendance(app, cellKey, students[i].id, status, course.courseDate);
            });
            studentCount += students.length;
        });
        app.syncRealtime({ weekRange: true });
        return { courseCount: courses.length, studentCount };
    }

    window.CourseDataImportService = { extractCourses, isOneToOne, importCourses };
    TimetableApp.prototype.openCourseDataImportModal = function () { document.getElementById('courseDataImportModal').style.display = 'block'; };
    TimetableApp.prototype.closeCourseDataImportModal = function () { document.getElementById('courseDataImportModal').style.display = 'none'; };
    TimetableApp.prototype.submitCourseDataImport = function (event) {
        event.preventDefault();
        const message = document.getElementById('courseDataImportMessage');
        try {
            const result = importCourses(this, document.getElementById('courseDataImportText').value);
            message.textContent = `导入成功：${result.courseCount} 节课程，处理 ${result.studentCount} 名学生`;
        } catch (error) { message.textContent = `导入失败：${error.message}`; }
    };
})();
