TimetableApp.prototype._saveFile = async function(data, encoding, defaultName, mimeType) {
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

TimetableApp.prototype.openExportModal = function() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            this.initLessonSheetExportRange(true);
            this.switchExportTab('schedule');
            modal.style.display = 'block';
        }
    }

TimetableApp.prototype.closeExportModal = function() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

TimetableApp.prototype.handleExportOption = async function(type) {
        this.closeExportModal();

        if (type === 'image') {
            await this.saveAsImage();
            return;
        }

        if (type === 'word') {
            await this.exportToWord();
            return;
        }

        if (type === 'excel') {
            await this.exportToExcel();
            return;
        }

        if (type === 'lessonSheetWord') {
            await this.exportLessonSheetToWord();
            return;
        }

        if (type === 'lessonSheetExcel') {
            await this.exportLessonSheetToExcel();
        }
    }

TimetableApp.prototype.switchExportTab = function(tab) {
        const tabs = {
            schedule: document.getElementById('exportTabSchedule'),
            lessonSheet: document.getElementById('exportTabLessonSheet')
        };
        const panels = {
            schedule: document.getElementById('exportPanelSchedule'),
            lessonSheet: document.getElementById('exportPanelLessonSheet')
        };

        Object.keys(tabs).forEach(key => {
            if (tabs[key]) tabs[key].classList.toggle('active', key === tab);
            if (panels[key]) panels[key].classList.toggle('active', key === tab);
        });

        if (tab === 'lessonSheet') {
            this.initLessonSheetExportRange();
        }
    }

TimetableApp.prototype.initLessonSheetExportRange = function(forceReset) {
        const startInput = document.getElementById('lessonSheetStartDate');
        const endInput = document.getElementById('lessonSheetEndDate');
        if (!startInput || !endInput) return;

        if (!forceReset && startInput.value && endInput.value) return;

        const baseDate = this.currentDate instanceof Date ? this.currentDate : new Date();
        const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

        startInput.value = this.formatLocalDate(start);
        endInput.value = this.formatLocalDate(end);
    }

TimetableApp.prototype.getLessonSheetExportRange = function() {
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

TimetableApp.prototype.getLessonSheetRowsByRange = function(startDate, endDate) {
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

                rows.push({
                    dateKey,
                    dayLabel: dayLabels[date.getDay()],
                    subject: lesson.subject || '',
                    periodLabel: this.getLessonPeriodLabel(lesson.period),
                    periodIndex: this.getPeriodNumber(lesson.period),
                    time: lesson.time || '',
                    students: studentNames,
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

TimetableApp.prototype.getLessonPeriodLabel = function(periodIndex) {
        const periodInfo = this.getPeriod(periodIndex);
        return periodInfo && periodInfo.name ? periodInfo.name : `第${this.getPeriodNumber(periodIndex)}节`;
    }

TimetableApp.prototype.exportLessonSheetToWord = async function() {
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
                    col.students { width: 118px; }
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
            alert('导出 Word 失败: ' + (error && error.message ? error.message : error));
        }
    }

TimetableApp.prototype.exportLessonSheetToExcel = async function() {
        try {
            const range = this.getLessonSheetExportRange();
            if (!range) return;

            const rows = this.getLessonSheetRowsByRange(range.startDate, range.endDate);
            if (rows.length === 0) {
                alert('所选日期范围内没有课时数据');
                return;
            }

            const title = `课时单-${range.startLabel}至${range.endLabel}`;
            let excelContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>${title}</x:Name>
                                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 18px; }
                    h1 { text-align: center; font-size: 22px; margin-bottom: 8px; }
                    .sub-title { text-align: center; color: #666; margin-bottom: 16px; font-size: 13px; }
                    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
                    col.date { width: 78px; }
                    col.subject { width: 74px; }
                    col.time { width: 88px; }
                    col.students { width: 118px; }
                    col.count { width: 42px; }
                    col.type { width: 58px; }
                    col.duration { width: 68px; }
                    th, td { border: 1px solid #333; padding: 8px 6px; text-align: center; vertical-align: middle; font-size: 12px; }
                    th { background: #f5f7fb; font-weight: bold; }
                    .left { text-align: left; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
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
                excelContent += `<tr>
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

            excelContent += `</tbody></table></body></html>`;
            await this._saveFile('\ufeff' + excelContent, 'utf-8', `${title}.xls`, 'application/vnd.ms-excel', 'xls');
        } catch (error) {
            console.error('导出 Excel 失败:', error);
            alert('导出 Excel 失败: ' + (error && error.message ? error.message : error));
        }
    }

TimetableApp.prototype.saveAsImage = function() {
        try {
            const titleInput = document.getElementById('tableTitle') || document.getElementById('timetableTitle');
            const titleText = (titleInput && titleInput.value) || '课程表';

            // 创建一个干净的容器用于截图
            const cleanContainer = document.createElement('div');
            cleanContainer.style.cssText = `
                position: absolute;
                top: -9999px;
                left: -9999px;
                width: 1000px;
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

            const controls = tableClone.querySelectorAll('.section-controls');
            controls.forEach(control => control.remove());

            const navigators = tableClone.querySelectorAll('.date-navigator');
            navigators.forEach(navigator => navigator.remove());

            const existingTitles = tableClone.querySelectorAll('h1, h2, h3, .title, .timetable-title-section, .table-title-input');
            existingTitles.forEach(title => title.remove());

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
                table-layout: fixed;
                border: 2px solid #333;
                font-size: 14px;
            `;

            const cells = table.querySelectorAll('td, th');
            cells.forEach(cell => {
                const isHeader = cell.tagName.toLowerCase() === 'th' || cell.classList.contains('period-header');
                cell.style.cssText = `
                    border: 1px solid #333;
                    padding: 12px 8px;
                    text-align: center;
                    vertical-align: middle;
                    min-width: 80px;
                    min-height: 60px;
                    font-family: "Microsoft YaHei", Arial, sans-serif;
                    font-size: 14px;
                    ${isHeader ? 'background-color: #f8f9fa; font-weight: bold;' : ''}
                `;
            });

            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
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
                width: 1000,
                height: cleanContainer.scrollHeight,
                windowWidth: 1000
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
            alert('保存图片出错: ' + (error && error.message ? error.message : error));
        }
    }

TimetableApp.prototype.saveAsImage = function() {
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
                card.style.boxShadow = 'none';
                card.style.paddingTop = '14px';
                card.style.minHeight = '88px';
            });

            table.querySelectorAll('.subject-name-light').forEach(name => {
                name.style.overflow = 'visible';
                name.style.textOverflow = 'clip';
                name.style.display = 'flex';
                name.style.alignItems = 'flex-start';
                name.style.justifyContent = 'space-between';
                name.style.gap = '8px';
                name.style.paddingRight = '0';
                name.style.minHeight = '28px';
                name.style.lineHeight = '1.4';
            });

            table.querySelectorAll('.subject-name-text').forEach(text => {
                text.style.flex = '1 1 auto';
                text.style.minWidth = '0';
                text.style.maxWidth = 'none';
                text.style.overflow = 'hidden';
                text.style.textOverflow = 'ellipsis';
                text.style.whiteSpace = 'nowrap';
            });

            table.querySelectorAll('.subject-grade-tag').forEach(tag => {
                tag.style.position = 'static';
                tag.style.top = 'auto';
                tag.style.right = 'auto';
                tag.style.transform = 'none';
                tag.style.flex = '0 0 auto';
                tag.style.minWidth = '52px';
                tag.style.lineHeight = '1.4';
                tag.style.padding = '3px 8px';
                tag.style.marginTop = '1px';
                tag.style.zIndex = '4';
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
                windowWidth: exportWidth
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
            alert('保存图片出错: ' + (error && error.message ? error.message : error));
        }
    }

TimetableApp.prototype.exportToWord = async function() {
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
                const subjectId = version ? version.subject : null;
                const studentIds = version ? (version.student || []) : [];
                const students = studentIds
                    .map(id => this.students.find(s => s.id === id))
                    .filter(Boolean);

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
                } else if (students.length > 0) {
                    const studentNames = students.map(student => student.name);
                    const studentChunks = [];
                    for (let i = 0; i < studentNames.length; i += 2) {
                        studentChunks.push(studentNames.slice(i, i + 2).join('、'));
                    }
                    const studentLines = studentChunks.map((line, idx) =>
                        `<div class="student-line">${idx === 0 ? `学生：${line}` : line}</div>`
                    ).join('');
                    wordContent += `<td><div class="cell-lines">${studentLines}</div></td>`;
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
            alert('导出 Word 出错: ' + (error && error.message ? error.message : error));
        }
    }

    // Excel导出功能 - 移动端PC端统一效果
TimetableApp.prototype.exportToExcel = async function() {
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
                    const subjectId = version ? version.subject : null;
                    const studentIds = version ? (version.student || []) : [];
                    const students = studentIds
                        .map(id => this.students.find(s => s.id === id))
                        .filter(Boolean);

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
                    } else if (students.length > 0) {
                        const studentNames = students.map(student => student.name);
                        const studentChunks = [];
                        for (let i = 0; i < studentNames.length; i += 2) {
                            studentChunks.push(studentNames.slice(i, i + 2).join('、'));
                        }
                        const studentLines = studentChunks.map((line, idx) =>
                            `<div class="student-line">${idx === 0 ? `学生：${line}` : line}</div>`
                        ).join('');
                        excelContent += `<td><div class="cell-lines">${studentLines}</div></td>`;
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
            alert('导出 Excel 出错: ' + (error && error.message ? error.message : error));
        }
    }
