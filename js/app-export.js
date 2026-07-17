TimetableApp.prototype._saveFile = async function (data, encoding, defaultName, mimeType) {
    if (window.electronAPI && typeof window.electronAPI.saveFile === 'function') {
        return window.electronAPI.saveFile(data, encoding, defaultName, mimeType);
    }

    let blob;
    if (encoding === 'base64') {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    } else {
        blob = new Blob([data], { type: `${mimeType || 'application/octet-stream'};charset=utf-8` });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { canceled: false, filePath: defaultName || 'download' };
}

TimetableApp.prototype.getLocalizedExportError = function (error, fileType = '文件') {
    const detail = String(error && error.message ? error.message : error || '');
    if (/EBUSY|resource busy|locked|being used|open/i.test(detail)) {
        return `导出${fileType}失败：目标文件正在被占用。请关闭已打开的同名文件后重试，或更换文件名保存。`;
    }
    if (/EACCES|EPERM|permission denied|operation not permitted/i.test(detail)) {
        return `导出${fileType}失败：没有权限写入该位置。请选择其他保存位置后重试。`;
    }
    if (/ENOSPC|no space left/i.test(detail)) {
        return `导出${fileType}失败：磁盘剩余空间不足，请清理空间后重试。`;
    }
    if (/ENOENT|no such file|path.*not found/i.test(detail)) {
        return `导出${fileType}失败：保存位置不存在或已不可用，请重新选择保存位置。`;
    }
    return `导出${fileType}失败，请检查保存位置和文件状态后重试。`;
}

TimetableApp.prototype.openExportModal = function () {
    const modal = document.getElementById('exportModal');
    if (modal) {
        this.initLessonSheetExportRange(true);
        modal.style.display = 'block';
    }
}

TimetableApp.prototype.closeExportModal = function () {
    this.closeSharedDateRangePicker('lessonSheet');
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

TimetableApp.prototype.handleExportOption = async function (type) {
    this.closeExportModal();

    if (type === 'image') {
        await this.saveAsImage();
        return;
    }

    if (type === 'excel') {
        await this.exportToExcel();
        return;
    }

    if (type === 'lessonSheetExcel') {
        await this.exportLessonSheetToExcel();
    }
}

TimetableApp.prototype.initLessonSheetExportRange = function (forceReset) {
    const startInput = document.getElementById('lessonSheetStartDate');
    const endInput = document.getElementById('lessonSheetEndDate');
    if (!startInput || !endInput) return;

    if (!forceReset && startInput.value && endInput.value) {
        this.syncSharedDateRangeLabel('lessonSheet');
        return;
    }

    const baseDate = this.currentDate instanceof Date ? this.currentDate : new Date();
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

    startInput.value = this.formatLocalDate(start);
    endInput.value = this.formatLocalDate(end);
    this.syncSharedDateRangeLabel('lessonSheet');
}

TimetableApp.prototype.getLessonSheetExportRange = function () {
    const startInput = document.getElementById('lessonSheetStartDate');
    const endInput = document.getElementById('lessonSheetEndDate');
    const startValue = startInput ? startInput.value : '';
    const endValue = endInput ? endInput.value : '';

    if (!startValue || !endValue) {
        alert('请选择完整的课时单导出日期范围');
        return null;
    }

    const [startY, startM, startD] = startValue.split('-').map(Number);
    const [endY, endM, endD] = endValue.split('-').map(Number);
    const startDate = new Date(startY, startM - 1, startD);
    const endDate = new Date(endY, endM - 1, endD);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        alert('课时单导出日期无效，请重新选择');
        return null;
    }

    if (startDate > endDate) {
        alert('开始日期不能晚于结束日期');
        return null;
    }

    return {
        startDate,
        endDate,
        startLabel: startValue,
        endLabel: endValue
    };
}

TimetableApp.prototype.getLessonSheetRowsByRange = function (startDate, endDate) {
    const rows = [];
    const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        const date = new Date(current);
        const lessons = this.collectLessonsForDate(date) || [];
        lessons.forEach(lesson => {
            const dateKey = lesson.dates && lesson.dates[0] ? lesson.dates[0] : this.formatLocalDate(date);
            const studentNames = (lesson.students || [])
                .map(student => student && student.name)
                .filter(Boolean)
                .join('、');
            const actualMinutes = this.getLessonActualMinutesForStats(lesson);
            const durationMinutes = actualMinutes !== undefined
                ? actualMinutes
                : this.getLessonDurationMinutesForStats(lesson);
            const durationDisplay = this.formatDuration(
                Math.floor(durationMinutes / 60),
                durationMinutes % 60
            );
            const studentDetails = (lesson.students || []).map(student => {
                const status = student && student.status ? student.status : null;
                const studentMinutes = status === 'leave' || status === 'absent'
                    ? 0
                    : Math.max(0, Number(student && student.actualMinutes !== undefined
                        ? student.actualMinutes
                        : durationMinutes) || 0);
                return {
                    name: student && student.name ? student.name : '',
                    status,
                    isAudition: !!(student && student.isAudition),
                    is1v1: !!(student && student.is1v1),
                    grade: student && student.grade ? student.grade : '',
                    actualMinutes: studentMinutes
                };
            }).filter(student => student.name);
            const studentDurationDisplays = studentDetails.map(student => this.formatDuration(
                Math.floor(student.actualMinutes / 60),
                student.actualMinutes % 60
            ));
            const classGradeStudent = studentDetails.find(student => student.grade) || studentDetails[0];
            const studentGrades = classGradeStudent && classGradeStudent.grade
                ? classGradeStudent.grade
                : '未设置';
            const hasVariableStudentDurations = new Set(studentDetails.map(student => student.actualMinutes)).size > 1;

            rows.push({
                dateKey,
                dayLabel: dayLabels[date.getDay()],
                subject: lesson.subject || '',
                periodLabel: this.getLessonPeriodLabel(lesson.period),
                periodIndex: this.getPeriodNumber(lesson.period),
                time: lesson.time || '',
                students: studentNames,
                studentGrades,
                studentDetails,
                studentDurationDisplays,
                hasVariableStudentDurations,
                durationMinutes,
                scheduledStudents: (lesson.studentCount || 0) + (lesson.leaveCount || 0) + (lesson.absentCount || 0),
                presentCount: lesson.studentCount || 0,
                leaveCount: lesson.leaveCount || 0,
                absentCount: lesson.absentCount || 0,
                auditionCount: lesson.auditionStudentCount || 0,
                typeLabel: this.getLessonTypeKeyForStats(lesson) || '-',
                actualDuration: durationDisplay
            });
        });

        current.setDate(current.getDate() + 1);
    }

    return rows.sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        return a.periodIndex - b.periodIndex;
    });
}

TimetableApp.prototype.getLessonSheetExpandedRows = function (rows) {
    const mapStatusLabel = (status) => {
        if (status === 'leave') return '请假';
        if (status === 'absent') return '缺勤';
        return '出勤';
    };
        const mapTypeLabel = (typeLabel) => {
            if (typeLabel === '1v1') return '1v1';
            if (/^1v[234]$/.test(typeLabel || '')) return '1vN';
            return typeLabel || '-';
        };

    return rows.flatMap(row => {
        const details = Array.isArray(row.studentDetails) ? row.studentDetails : [];
        if (details.length === 0) {
            return [{
                dateKey: row.dateKey,
                studentGrade: '-',
                subject: row.subject,
                time: row.time,
                studentName: '-',
                attendanceStatus: '-',
                typeLabel: mapTypeLabel(row.typeLabel),
                actualDuration: row.actualDuration,
                isUnderTwoHours: Number(row.durationMinutes || 0) < 120,
                isOverTwoHours: Number(row.durationMinutes || 0) > 120
            }];
        }

        return details.map(student => {
            const minutes = student.status === 'leave' || student.status === 'absent'
                ? 0
                : Math.max(0, Number(student.actualMinutes !== undefined
                    ? student.actualMinutes
                    : row.durationMinutes) || 0);
            return {
                dateKey: row.dateKey,
                studentGrade: student.grade || '未设置',
                subject: row.subject,
                time: row.time,
                studentName: student.name,
                attendanceStatus: mapStatusLabel(student.status),
                typeLabel: mapTypeLabel(row.typeLabel),
                actualDuration: this.formatDuration(Math.floor(minutes / 60), minutes % 60),
                isUnderTwoHours: minutes < 120,
                isOverTwoHours: minutes > 120
            };
        });
    });
}

TimetableApp.prototype.getLessonSheetSummaryMatrix = function (rows) {
    const groups = [
        { key: 'junior', label: '初中部1.0系数' },
        { key: 'high1', label: '高一年级1.2系数' },
        { key: 'high2', label: '高二年级1.3系数' },
        { key: 'high3', label: '高三年级1.5系数' }
    ];
    const typeKeys = ['1对1', '1对2', '1对3', '1对4', '请假'];

    const detectGroup = (gradeName) => {
        const value = String(gradeName || '');
        if (value.includes('高一')) return groups[1];
        if (value.includes('高二')) return groups[2];
        if (value.includes('高三')) return groups[3];
        return groups[0];
    };
    const detectTypeKey = (typeLabel) => {
        if (typeLabel === '1v1(0.8)') return '请假';
        if (typeLabel === '1v1') return '1对1';
        if (typeLabel === '1v2') return '1对2';
        if (typeLabel === '1v3') return '1对3';
        if (typeLabel === '1v4') return '1对4';
        return '';
    };
    const ensureBucket = (target, dateKey) => {
        if (!target[dateKey]) {
            target[dateKey] = {};
            groups.forEach(group => {
                target[dateKey][group.key] = {};
                typeKeys.forEach(typeKey => {
                    target[dateKey][group.key][typeKey] = 0;
                });
            });
        }
        return target[dateKey];
    };
    const formatNumber = (value) => {
        if (!value) return '';
        const rounded = Math.round(value * 100) / 100;
        if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
        return rounded.toFixed(2).replace(/\.?0+$/, '');
    };

    const byDate = {};
    const totals = ensureBucket({ __total: null }, '__total');

    rows.forEach(row => {
        const details = Array.isArray(row.studentDetails) ? row.studentDetails : [];
        const presentStudents = details.filter(student =>
            student && !student.isAudition && student.status !== 'leave' && student.status !== 'absent'
        );
        const referenceStudent = presentStudents[0]
            || details[0];
        const group = detectGroup(referenceStudent && referenceStudent.grade);
        const presentDurations = presentStudents.map(student => Math.max(0, Number(
            student.actualMinutes !== undefined ? student.actualMinutes : row.durationMinutes
        ) || 0));
        const shouldSegment = new Set(presentDurations).size > 1;
        const allocations = shouldSegment
            ? this.getLessonSegmentTypeStats({ students: presentStudents }).typeStats
            : { [row.typeLabel]: Number(row.durationMinutes || 0) };

        const dayBucket = ensureBucket(byDate, row.dateKey);
        Object.entries(allocations).forEach(([typeLabel, minutes]) => {
            const typeKey = detectTypeKey(typeLabel);
            const hours = Number(minutes || 0) / 60;
            if (!typeKey || !hours) return;
            dayBucket[group.key][typeKey] += hours;
            totals[group.key][typeKey] += hours;
        });
    });

    const allDateKeys = rows.length > 0
        ? (() => {
            const firstDate = new Date(`${rows[0].dateKey}T00:00:00`);
            if (Number.isNaN(firstDate.getTime())) return Object.keys(byDate).sort();
            const monthStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
            const monthEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);
            const keys = [];
            for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor.setDate(cursor.getDate() + 1)) {
                keys.push(this.formatLocalDate(cursor));
            }
            return keys;
        })()
        : Object.keys(byDate).sort();

    const dayRows = allDateKeys.map(dateKey => {
        ensureBucket(byDate, dateKey);
        const date = new Date(`${dateKey}T00:00:00`);
        const dateLabel = Number.isNaN(date.getTime()) ? dateKey : `${date.getDate()}日`;
        return {
            dateKey,
            dateLabel,
            values: groups.flatMap(group => typeKeys.map(typeKey => formatNumber(byDate[dateKey][group.key][typeKey])))
        };
    });

    return {
        groups,
        typeKeys,
        totalValues: groups.flatMap(group => typeKeys.map(typeKey => formatNumber(totals[group.key][typeKey]))),
        dayRows
    };
}

TimetableApp.prototype.getLessonPeriodLabel = function (periodIndex) {
    const periodInfo = this.getPeriod(periodIndex);
    return periodInfo && periodInfo.name ? periodInfo.name : `第${this.getPeriodNumber(periodIndex)}节`;
}

TimetableApp.prototype.exportLessonSheetToWord = async function () {
    try {
        const range = this.getLessonSheetExportRange();
        if (!range) return;

        const rows = this.getLessonSheetRowsByRange(range.startDate, range.endDate);
        if (rows.length === 0) {
            alert('所选日期范围内没有课时数据');
            return;
        }

        const title = `课时单-${range.startLabel}至${range.endLabel}`;
        let wordContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    @page { margin: 1.8cm; }
                    body { font-family: 'Microsoft YaHei', 'SimSun', Arial, sans-serif; margin: 18px; color: #333; }
                    .main-title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 8px; }
                    .sub-title { text-align: center; font-size: 13px; color: #666; margin-bottom: 18px; }
                    table { border-collapse: collapse; width: 100%; table-layout: fixed; border: 1px solid #333; }
                    col.date { width: 78px; }
                    col.subject { width: 74px; }
                    col.time { width: 88px; }
                    col.students { width: 96px; }
                    col.count { width: 42px; }
                    col.type { width: 58px; }
                    col.duration { width: 68px; }
                    th, td { border: 1px solid #333; padding: 8px 6px; text-align: center; vertical-align: middle; font-size: 12px; word-break: break-word; }
                    th { background: #f5f7fb; font-weight: bold; }
                    .left { text-align: left; }
                </style>
            </head>
            <body>
                <div class="main-title">${title}</div>
                <div class="sub-title">课时统计报表</div>
                <table>
                    <colgroup>
                        <col class="date">
                        <col class="subject">
                        <col class="time">
                        <col class="students">
                        <col class="count">
                        <col class="count">
                        <col class="count">
                        <col class="count">
                        <col class="count">
                        <col class="type">
                        <col class="duration">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>科目</th>
                            <th>时间</th>
                            <th>学生</th>
                            <th>应到</th>
                            <th>实到</th>
                            <th>请假</th>
                            <th>缺课</th>
                            <th>试听</th>
                            <th>类型</th>
                            <th>实际时长</th>
                        </tr>
                    </thead>
                    <tbody>`;

        rows.forEach(row => {
            wordContent += `<tr>
                    <td>${row.dateKey}</td>
                    <td>${row.subject}</td>
                    <td>${row.time}</td>
                    <td class="left">${row.students || '-'}</td>
                    <td>${row.scheduledStudents}</td>
                    <td>${row.presentCount}</td>
                    <td>${row.leaveCount}</td>
                    <td>${row.absentCount}</td>
                    <td>${row.auditionCount}</td>
                    <td>${row.typeLabel}</td>
                    <td>${row.actualDuration}</td>
                </tr>`;
        });

        wordContent += `</tbody></table></body></html>`;
        await this._saveFile('\ufeff' + wordContent, 'utf-8', `${title}.doc`, 'application/msword', 'doc');
    } catch (error) {
        console.error('导出 Word 失败:', error);
        alert(this.getLocalizedExportError(error, 'Word'));
    }
}

TimetableApp.prototype.exportLessonSheetToExcel = async function () {
    try {
        const range = this.getLessonSheetExportRange();
        if (!range) return;

        const rows = this.getLessonSheetRowsByRange(range.startDate, range.endDate);
        if (rows.length === 0) {
            alert('所选日期范围内没有课时数据');
            return;
        }

        const title = `课时单-${range.startLabel}至${range.endLabel}`;
        const expandedRows = this.getLessonSheetExpandedRows(rows);
        const summaryMatrix = this.getLessonSheetSummaryMatrix(rows);
        const escapeXml = (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        const makeCell = (value, styleId = 'Cell') => `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
        const makeRow = (cells, cellStyles = []) => `<Row>${cells.map((value, index) => makeCell(value, cellStyles[index] || 'Cell')).join('')}</Row>`;
        const makeMergedCell = (value, mergeAcross, styleId = 'Header') => `<Cell ss:StyleID="${styleId}" ss:MergeAcross="${mergeAcross}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;

        const summaryHeaders = ['日期', '年级', '科目', '时间', '学生', '应到', '实到', '请假', '类型', '实际时长'];
        const detailHeaders = ['日期', '年级', '科目', '时间', '学生', '出勤状态', '类型', '实际时长'];
        const variableDurationColumnCount = rows.reduce((max, row) => row.hasVariableStudentDurations
            ? Math.max(max, row.studentDurationDisplays.length)
            : max, 0);

        let excelContent = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${escapeXml(title)}</Title>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Bold="1"/>
   <Interior ss:Color="#F5F7FB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderOrange">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Bold="1" ss:Color="#ED7D31"/>
   <Interior ss:Color="#F5F7FB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Bold="1"/>
   <Interior ss:Color="#C6E0B4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#5B9BD5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10"/>
  </Style>
  <Style ss:ID="CellLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10"/>
  </Style>
  <Style ss:ID="CellYellow">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10"/>
   <Interior ss:Color="#FFF200" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellLeftYellow">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10"/>
   <Interior ss:Color="#FFF200" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Color="#9C0006"/>
   <Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellLeftRed">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Color="#9C0006"/>
   <Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="课时统计汇总">
  <Table ss:ExpandedColumnCount="${1 + (summaryMatrix.groups.length * summaryMatrix.typeKeys.length)}" ss:ExpandedRowCount="${summaryMatrix.dayRows.length + 3}" x:FullColumns="1" x:FullRows="1">
   <Column ss:Width="54"/>
   ${summaryMatrix.groups.flatMap(() => summaryMatrix.typeKeys.map(() => '<Column ss:Width="48"/>')).join('')}
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String"></Data></Cell>
    ${summaryMatrix.groups.map(group => makeMergedCell(group.label, summaryMatrix.typeKeys.length - 1, 'Header')).join('')}
   </Row>
   ${makeRow(['', ...summaryMatrix.groups.flatMap(() => summaryMatrix.typeKeys)], ['Header', ...summaryMatrix.groups.flatMap(() => summaryMatrix.typeKeys.map(() => 'HeaderOrange'))])}
   ${makeRow(['日期', ...summaryMatrix.totalValues], ['Header', ...summaryMatrix.totalValues.map(() => 'SummaryGreen')])}
   ${summaryMatrix.dayRows.map(row => makeRow([row.dateLabel, ...row.values], ['SummaryBlue', ...row.values.map(() => 'Cell')])).join('')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayGridlines/>
  </WorksheetOptions>
 </Worksheet>
 <Worksheet ss:Name="课时统计1">
  <Table ss:ExpandedColumnCount="${10 + variableDurationColumnCount}" ss:ExpandedRowCount="${rows.length + 1}" x:FullColumns="1" x:FullRows="1">
   <Column ss:Width="78"/>
   <Column ss:Width="82"/>
   <Column ss:Width="74"/>
   <Column ss:Width="88"/>
   <Column ss:Width="180"/>
   <Column ss:Width="42"/>
   <Column ss:Width="42"/>
   <Column ss:Width="42"/>
   <Column ss:Width="58"/>
   <Column ss:Width="68"/>
   ${Array.from({ length: variableDurationColumnCount }, () => '<Column ss:Width="68"/>').join('')}
   ${makeRow(summaryHeaders, Array(summaryHeaders.length).fill('Header'))}
   ${rows.map(row => {
        const extraDurations = row.hasVariableStudentDurations ? row.studentDurationDisplays : [];
        const values = [
            row.dateKey,
            row.studentGrades || '未设置',
            row.subject,
            row.time,
            row.students || '-',
            row.scheduledStudents,
            row.presentCount,
            row.leaveCount + row.absentCount,
            row.typeLabel,
            row.actualDuration,
            ...extraDurations
        ];
        const isOverTwoHours = Number(row.durationMinutes || 0) > 120;
        const highlightRow = row.hasVariableStudentDurations || Number(row.durationMinutes || 0) < 120;
        const styles = isOverTwoHours
            ? values.map((_value, index) => index === 4 ? 'CellLeftRed' : 'CellRed')
            : (highlightRow
                ? values.map((_value, index) => index === 4 ? 'CellLeftYellow' : 'CellYellow')
                : ['Cell', 'Cell', 'Cell', 'Cell', 'CellLeft', 'Cell', 'Cell', 'Cell', 'Cell', 'Cell']);
        return makeRow(values, styles);
    }).join('')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayGridlines/>
  </WorksheetOptions>
 </Worksheet>
 <Worksheet ss:Name="课时统计2">
  <Table ss:ExpandedColumnCount="8" ss:ExpandedRowCount="${expandedRows.length + 1}" x:FullColumns="1" x:FullRows="1">
   <Column ss:Width="78"/>
   <Column ss:Width="82"/>
   <Column ss:Width="74"/>
   <Column ss:Width="88"/>
   <Column ss:Width="96"/>
   <Column ss:Width="64"/>
   <Column ss:Width="58"/>
   <Column ss:Width="68"/>
   ${makeRow(detailHeaders, Array(detailHeaders.length).fill('Header'))}
   ${expandedRows.map(row => {
        const values = [
            row.dateKey,
            row.studentGrade,
            row.subject,
            row.time,
            row.studentName,
            row.attendanceStatus,
            row.typeLabel,
            row.actualDuration
        ];
        const styles = row.isOverTwoHours
            ? values.map((_value, index) => index === 4 ? 'CellLeftRed' : 'CellRed')
            : (row.isUnderTwoHours
                ? values.map((_value, index) => index === 4 ? 'CellLeftYellow' : 'CellYellow')
                : ['Cell', 'Cell', 'Cell', 'Cell', 'CellLeft', 'Cell', 'Cell', 'Cell']);
        return makeRow(values, styles);
    }).join('')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayGridlines/>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

        await this._saveFile('\ufeff' + excelContent, 'utf-8', `${title}.xls`, 'application/vnd.ms-excel', 'xls');
    } catch (error) {
        console.error('导出 Excel 失败:', error);
        alert(this.getLocalizedExportError(error, 'Excel'));
    }
}

TimetableApp.prototype.saveAsImage = function () {
    try {
        const titleInput = document.getElementById('tableTitle') || document.getElementById('timetableTitle');
        const titleText = (titleInput && titleInput.value) || '课表';
        const metrics = this.getTimetableLayoutMetrics ? this.getTimetableLayoutMetrics() : {
            visibleDayCount: 7,
            tableMinWidth: 960,
            containerMinWidth: 1008
        };
        const sourceWrapper = document.querySelector('.timetable-wrapper');
        const sourceTable = document.getElementById('timetable');
        const exportWidth = Math.max(
            metrics.containerMinWidth,
            sourceWrapper ? Math.ceil(sourceWrapper.scrollWidth) : 0,
            sourceTable ? Math.ceil(sourceTable.scrollWidth + 48) : 0
        );

        const cleanContainer = document.createElement('div');
        cleanContainer.id = 'timetableImageExportCapture';
        cleanContainer.className = 'timetable-image-export-capture';
        cleanContainer.style.cssText = `
                position: absolute;
                top: -9999px;
                left: -9999px;
                width: ${exportWidth}px;
                box-sizing: border-box;
                padding: 30px;
                background: white;
                font-family: "Microsoft YaHei", Arial, sans-serif;
            `;

        const originalTable = document.querySelector('.timetable-container');
        if (!originalTable) {
            alert('未找到课程表容器，无法导出图片');
            return;
        }

        const tableClone = originalTable.cloneNode(true);

        tableClone.querySelectorAll('.section-controls').forEach(control => control.remove());
        tableClone.querySelectorAll('.date-navigator').forEach(navigator => navigator.remove());
        tableClone.querySelectorAll('h1, h2, h3, .title, .timetable-title-section, .table-title-input').forEach(title => title.remove());
        tableClone.querySelectorAll('.today-col').forEach(cell => cell.classList.remove('today-col'));
        tableClone.querySelectorAll('.today-header').forEach(cell => cell.classList.remove('today-header'));

        const clonedWrapper = tableClone.querySelector('.timetable-wrapper');
        if (clonedWrapper) {
            clonedWrapper.style.overflow = 'visible';
            clonedWrapper.style.width = '100%';
            clonedWrapper.style.minWidth = '0';
        }

        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'text-align: center; margin-bottom: 20px; padding: 0;';

        const mainTitle = document.createElement('h1');
        mainTitle.textContent = titleText;
        mainTitle.style.cssText = 'margin: 0; font-size: 28px; font-weight: bold; color: #333; font-family: "Microsoft YaHei", Arial, sans-serif;';

        titleDiv.appendChild(mainTitle);
        cleanContainer.appendChild(titleDiv);
        cleanContainer.appendChild(tableClone);

        const table = tableClone.querySelector('.timetable') || tableClone;
        table.style.cssText = `
                border-collapse: collapse;
                width: 100%;
                min-width: ${metrics.tableMinWidth}px;
                table-layout: fixed;
                border: 2px solid #333;
                font-size: 14px;
            `;

        table.querySelectorAll('td, th').forEach(cell => {
            const isHeader = cell.tagName.toLowerCase() === 'th' || cell.classList.contains('period-header');
            const isPeriodHeader = cell.classList.contains('period-header');
            cell.style.cssText = `
                    border: 1px solid #333;
                    padding: 12px 8px;
                    text-align: center;
                    vertical-align: middle;
                    min-width: 80px;
                    min-height: 60px;
                    font-family: "Microsoft YaHei", Arial, sans-serif;
                    font-size: 14px;
                    ${isHeader ? `background-color: ${isPeriodHeader ? '#ffffff' : '#f8f9fa'}; font-weight: bold;` : ''}
                `;
        });

        table.querySelectorAll('.cell').forEach(cell => {
            cell.style.overflow = 'visible';
            cell.style.background = '#ffffff';
        });

        table.querySelectorAll('.subject-bg-light').forEach(card => {
            card.style.overflow = 'visible';
            card.style.setProperty('box-shadow', 'none', 'important');
            card.style.setProperty('border-left-color', card.style.getPropertyValue('--grade-accent-color') || '#64748b', 'important');
            card.style.paddingTop = '14px';
            card.style.minHeight = '88px';
        });

        table.querySelectorAll('.subject-name-light').forEach(name => {
            name.style.setProperty('overflow', 'visible', 'important');
            name.style.setProperty('text-overflow', 'clip', 'important');
            name.style.setProperty('display', 'flex', 'important');
            name.style.setProperty('align-items', 'center', 'important');
            name.style.setProperty('justify-content', 'space-between', 'important');
            name.style.setProperty('gap', '8px', 'important');
            name.style.setProperty('padding-right', '0', 'important');
            name.style.setProperty('min-height', '28px', 'important');
            name.style.setProperty('line-height', '1.4', 'important');
        });

        table.querySelectorAll('.subject-name-text').forEach(text => {
            text.style.setProperty('display', 'block', 'important');
            text.style.setProperty('width', 'auto', 'important');
            text.style.setProperty('flex', '1 1 auto', 'important');
            text.style.setProperty('min-width', '0', 'important');
            text.style.setProperty('max-width', 'none', 'important');
            text.style.setProperty('overflow', 'hidden', 'important');
            text.style.setProperty('text-overflow', 'ellipsis', 'important');
            text.style.setProperty('white-space', 'nowrap', 'important');
        });

        table.querySelectorAll('.subject-grade-tag').forEach(tag => {
            tag.style.setProperty('position', 'static', 'important');
            tag.style.setProperty('top', 'auto', 'important');
            tag.style.setProperty('right', 'auto', 'important');
            tag.style.setProperty('transform', 'none', 'important');
            tag.style.setProperty('flex', '0 0 auto', 'important');
            tag.style.setProperty('min-width', '52px', 'important');
            tag.style.setProperty('line-height', '1.4', 'important');
            tag.style.setProperty('padding', '3px 8px', 'important');
            tag.style.setProperty('margin-top', '0', 'important');
            tag.style.setProperty('z-index', '4', 'important');
        });

        table.querySelectorAll('tr').forEach(row => {
            const rowCells = row.querySelectorAll('td, th');
            let cellIndex = 0;
            rowCells.forEach(cell => {
                if (cellIndex >= 1) {
                    const dayIndex = cellIndex - 1;
                    if (dayIndex === 5 && !this.settings.showSaturday) cell.style.display = 'none';
                    if (dayIndex === 6 && !this.settings.showSunday) cell.style.display = 'none';
                }
                cellIndex++;
            });
        });

        document.body.appendChild(cleanContainer);

        if (typeof html2canvas === 'undefined') {
            alert('图片导出组件未加载，请检查网络连接后刷新页面重试');
            document.body.removeChild(cleanContainer);
            return;
        }

        html2canvas(cleanContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            width: exportWidth,
            height: cleanContainer.scrollHeight,
            windowWidth: exportWidth,
            onclone: clonedDocument => {
                // 图片导出使用独立的浅色打印模板。只修改 html2canvas 的克隆文档，
                // 避免暗色主题中的 color-mix() 被 html2canvas 1.4.1 解析并导致导出失败。
                clonedDocument.body.classList.remove('dark-theme-active', 'light-sidebar');
                const clonedCapture = clonedDocument.getElementById('timetableImageExportCapture');
                if (clonedCapture) {
                    clonedCapture.classList.add('force-light-image-export');
                    clonedCapture.style.setProperty('background', '#ffffff', 'important');
                    clonedCapture.style.setProperty('color', '#1f2937', 'important');
                    clonedCapture.querySelectorAll('.subject-bg-light').forEach(card => {
                        card.style.setProperty('box-shadow', 'none', 'important');
                        card.style.setProperty('border-left-color', card.style.getPropertyValue('--grade-accent-color') || '#64748b', 'important');
                    });
                }
            }
        }).then(async canvas => {
            document.body.removeChild(cleanContainer);
            const base64Data = canvas.toDataURL('image/png', 1.0).replace(/^data:image\/png;base64,/, '');
            await this._saveFile(base64Data, 'base64', `${titleText}.png`, 'image/png', 'png');
        }).catch(error => {
            console.error('生成图片失败:', error);
            alert('生成图片失败，请重试');
            document.body.removeChild(cleanContainer);
        });
    } catch (error) {
        console.error('保存图片出错:', error);
        alert(this.getLocalizedExportError(error, '图片'));
    }
}

TimetableApp.prototype.exportToWord = async function () {
    try {
        const titleEl = document.getElementById('tableTitle') || document.getElementById('timetableTitle');
        const title = (titleEl && titleEl.value) || '课程表';

        // 创建用于导出 Word 的 HTML 内容
        let wordContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page { margin: 2cm; }
                body { font-family: 'Microsoft YaHei', 'SimSun', Arial, sans-serif; margin: 20px; }
                .main-title { text-align: center; color: #333; margin-bottom: 25px; font-size: 26px; font-weight: bold; }
                table { border-collapse: collapse; width: 100%; margin: 0 auto; table-layout: fixed; border: 2px solid #333; }
                th, td { border: 1px solid #333; padding: 12px 8px; text-align: center; font-size: 14px; vertical-align: middle; min-height: 60px; }
                th { background-color: #f8f9fa; font-weight: bold; }
                .period-header { background-color: #fff; font-weight: bold; width: 100px; font-size: 14px; }
                .cell-lines { text-align: left; line-height: 1.6; }
                .subject { font-weight: bold; color: #333; font-size: 14px; margin-bottom: 4px; }
                .student-line { font-size: 12px; color: #333; }
                .teacher { font-size: 12px; color: #666; margin-top: 4px; }
                .period-time { font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="main-title">${title}</div>
            <table>
                <thead>
                    <tr>
                        <th class="period-header">节次</th>
                        ${(() => {
                let headers = ['周一', '周二', '周三', '周四', '周五'];
                if (this.settings.showSaturday) headers.push('周六');
                if (this.settings.showSunday) headers.push('周日');
                return headers.map(day => `<th>${day}</th>`).join('');
            })()}
                    </tr>
                </thead>
                <tbody>`;

        const orderedPeriods = this.getOrderedPeriods();
        const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        orderedPeriods.forEach(({ index, period, periodNum }) => {
            wordContent += `<tr>`;
            wordContent += `<td class="period-header">第${periodNum}节${this.settings.showPeriodTime ? `<br><small>${period.time}</small>` : ''}</td>`;

            for (let day = 1; day <= dayCount; day++) {
                const key = this.buildCellKey(day, index);
                const version = this.getCellVersion(key, weekStartStr);
                let subjectId = version ? version.subject : null;
                const studentIds = version ? (version.student || []) : [];
                const students = studentIds
                    .map(id => this.students.find(s => s.id === id))
                    .filter(Boolean);
                if (!subjectId && students.length > 0) {
                    subjectId = this.ensureUncategorizedSubject().id;
                }

                if (subjectId) {
                    const subject = this.subjects.find(s => s.id === subjectId);
                    if (subject) {
                        const studentNames = students.map(student => student.name);
                        const studentChunks = [];
                        for (let i = 0; i < studentNames.length; i += 2) {
                            studentChunks.push(studentNames.slice(i, i + 2).join('、'));
                        }
                        const studentLines = studentChunks.map((line, idx) =>
                            `<div class="student-line">${idx === 0 ? `学生：${line}` : line}</div>`
                        ).join('');
                        wordContent += `<td>
                            <div class="cell-lines">
                                <div class="subject">课程名：${subject.name}</div>
                                ${studentLines}
                                ${subject.teacher ? `<div class="teacher">教师：${subject.teacher}</div>` : ''}
                            </div>
                        </td>`;
                    } else {
                        wordContent += `<td></td>`;
                    }
                } else {
                    wordContent += `<td></td>`;
                }
            }

            wordContent += `</tr>`;
        });

        wordContent += `</tbody></table></body></html>`;

        await this._saveFile('\ufeff' + wordContent, 'utf-8', `${title}.doc`, 'application/msword', 'doc');
    } catch (error) {
        console.error('导出 Word 出错:', error);
        alert(this.getLocalizedExportError(error, 'Word'));
    }
}

// Excel导出功能 - 移动端PC端统一效果
TimetableApp.prototype.exportToExcel = async function () {
    try {
        const titleEl = document.getElementById('tableTitle') || document.getElementById('timetableTitle');
        const title = (titleEl && titleEl.value) || '课程表';

        // 创建兼容Excel的HTML格式
        let excelContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { 
                        font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif; 
                        margin: 20px; 
                        background: white;
                    }
                    .main-title { 
                        text-align: center; 
                        color: #333; 
                        margin-bottom: 25px; 
                        font-size: 26px; 
                        font-weight: bold; 
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                    }
                    table { 
                        border-collapse: collapse; 
                        width: 800px; 
                        margin: 0 auto; 
                        table-layout: fixed; 
                        border: 2px solid #333;
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                    }
                    th, td { 
                        border: 1px solid #333; 
                        padding: 12px 8px; 
                        text-align: center; 
                        font-size: 14px; 
                        vertical-align: middle; 
                        min-height: 60px;
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                        mso-style-parent:style0;
                        mso-rotate:0;
                        mso-font-charset:134;
                        white-space: normal;
                        word-wrap: break-word;
                    }
                    th { 
                        background-color: #f8f9fa; 
                        font-weight: bold; 
                    }
                    .period-header { 
                        background-color: #fff; 
                        font-weight: bold; 
                        width: 100px; 
                        font-size: 14px;
                    }
                    .cell-lines {
                        text-align: left;
                        line-height: 1.6;
                    }
                    .subject { 
                        font-weight: bold; 
                        color: #333; 
                        font-size: 14px;
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                        margin-bottom: 4px;
                    }
                    .student-line {
                        font-size: 12px;
                        color: #333;
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                    }
                    .teacher { 
                        font-size: 12px; 
                        color: #666; 
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                        margin-top: 4px;
                    }
                    .period-time { 
                        font-size: 12px; 
                        color: #666; 
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                    }
                </style>
            </head>
            <body>
                <div class="main-title">${title}</div>
                <table>
                    <thead>
                        <tr>
                            <th class="period-header">节次</th>
                            ${(() => {
                let headers = ['周一', '周二', '周三', '周四', '周五'];
                if (this.settings.showSaturday) headers.push('周六');
                if (this.settings.showSunday) headers.push('周日');
                return headers.map(day => `<th>${day}</th>`).join('');
            })()}
                        </tr>
                    </thead>
                    <tbody>`;

        const orderedPeriods = this.getOrderedPeriods();
        const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
        const weekStartStr = this.formatLocalDate(this.getWeekRange(this.currentDate).start);

        orderedPeriods.forEach(({ index, period, periodNum }) => {
            excelContent += '<tr>';
            excelContent += `<td class="period-header">第${periodNum}节${this.settings.showPeriodTime ? `<br><span class="period-time">${period.time}</span>` : ''}</td>`;

            for (let day = 1; day <= dayCount; day++) {
                const key = this.buildCellKey(day, index);
                const version = this.getCellVersion(key, weekStartStr);
                let subjectId = version ? version.subject : null;
                const studentIds = version ? (version.student || []) : [];
                const students = studentIds
                    .map(id => this.students.find(s => s.id === id))
                    .filter(Boolean);
                if (!subjectId && students.length > 0) {
                    subjectId = this.ensureUncategorizedSubject().id;
                }

                if (subjectId) {
                    const subject = this.subjects.find(s => s.id === subjectId);
                    if (subject) {
                        const studentNames = students.map(student => student.name);
                        const studentChunks = [];
                        for (let i = 0; i < studentNames.length; i += 2) {
                            studentChunks.push(studentNames.slice(i, i + 2).join('、'));
                        }
                        const studentLines = studentChunks.map((line, idx) =>
                            `<div class="student-line">${idx === 0 ? `学生：${line}` : line}</div>`
                        ).join('');
                        excelContent += `<td><div class="cell-lines">`;
                        excelContent += `<div class="subject">课程名：${subject.name}</div>`;
                        excelContent += studentLines;
                        if (subject.teacher) {
                            excelContent += `<div class="teacher">教师：${subject.teacher}</div>`;
                        }
                        excelContent += `</div></td>`;
                    } else {
                        excelContent += '<td></td>';
                    }
                } else {
                    excelContent += '<td></td>';
                }
            }

            excelContent += '</tr>';
        });

        excelContent += '</tbody></table></body></html>';

        await this._saveFile('\ufeff' + excelContent, 'utf-8', `${title}.xls`, 'application/vnd.ms-excel', 'xls');
    } catch (error) {
        console.error('导出 Excel 出错:', error);
        alert(this.getLocalizedExportError(error, 'Excel'));
    }
}
