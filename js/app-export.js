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
                .time-header { background-color: #e6f3ff; font-weight: bold; width: 80px; font-size: 14px; }
                .period-header { background-color: #f0f0f0; font-weight: bold; width: 100px; font-size: 14px; }
                .time-section { background-color: #e6f3ff; font-weight: bold; vertical-align: middle; }
                .time-section.pm { background-color: #fff2e6; }
                .subject { font-weight: bold; color: #333; font-size: 14px; }
                .teacher { font-size: 12px; color: #666; margin-top: 4px; display: block; }
                .period-time { font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="main-title">${title}</div>
            <table>
                <thead>
                    <tr>
                        <th class="time-header">时段</th>
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

        // 生成课程表内容
        
        // 上午课程
        if (this.periods.morning && this.periods.morning.length > 0) {
            this.periods.morning.forEach((period, periodIndex) => {
                wordContent += `<tr>`;
                
                // 添加时段单元格
                if (periodIndex === 0) {
                    wordContent += `<td class="time-header" rowspan="${this.periods.morning.length}">上午</td>`;
                }
                
                wordContent += `<td class="period-header">${period.name}${this.settings.showPeriodTime ? `<br><small>${period.time}</small>` : ''}</td>`;
                
                // 添加每天的课程单元格
                const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
                for (let day = 1; day <= dayCount; day++) {
                    const key = `${day}-morning-${periodIndex}`;
                    const version = this.getCellVersion(key, this.formatLocalDate(this.getWeekRange(this.currentDate).start));
                    const subjectId = version ? version.subject : null;
                    
                    if (subjectId) {
                        const subject = this.subjects.find(s => s.id === subjectId);
                        if (subject) {
                            wordContent += `<td>
                                <div class="subject">${subject.name}</div>
                                <div class="teacher">${subject.teacher || ''}</div>
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
        }
        
        // 下午课程
        if (this.periods.afternoon && this.periods.afternoon.length > 0) {
            this.periods.afternoon.forEach((period, periodIndex) => {
                wordContent += `<tr>`;
                
                // 添加时段单元格
                if (periodIndex === 0) {
                    wordContent += `<td class="time-header" rowspan="${this.periods.afternoon.length}">下午</td>`;
                }
                
                wordContent += `<td class="period-header">${period.name}${this.settings.showPeriodTime ? `<br><small>${period.time}</small>` : ''}</td>`;
                
                // 添加每天的课程单元格
                const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
                for (let day = 1; day <= dayCount; day++) {
                    const key = `${day}-afternoon-${periodIndex}`;
                    const version = this.getCellVersion(key, this.formatLocalDate(this.getWeekRange(this.currentDate).start));
                    const subjectId = version ? version.subject : null;
                    
                    if (subjectId) {
                        const subject = this.subjects.find(s => s.id === subjectId);
                        if (subject) {
                            wordContent += `<td>
                                <div class="subject">${subject.name}</div>
                                <div class="teacher">${subject.teacher || ''}</div>
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
        }

        
        // 晚上课程（如果启用）
        if (this.settings.showEvening && this.periods.evening && this.periods.evening.length > 0) {
            this.periods.evening.forEach((period, periodIndex) => {
                wordContent += `<tr>`;
                
                // 添加时段单元格
                if (periodIndex === 0) {
                    wordContent += `<td class="time-header" rowspan="${this.periods.evening.length}">晚上</td>`;
                }
                
                wordContent += `<td class="period-header">${period.name}${this.settings.showPeriodTime ? `<br><small>${period.time}</small>` : ''}</td>`;
                
                // 添加每天的课程单元格
                const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
                for (let day = 1; day <= dayCount; day++) {
                    const key = `${day}-evening-${periodIndex}`;
                    const version = this.getCellVersion(key, this.formatLocalDate(this.getWeekRange(this.currentDate).start));
                    const subjectId = version ? version.subject : null;
                    
                    if (subjectId) {
                        const subject = this.subjects.find(s => s.id === subjectId);
                        if (subject) {
                            wordContent += `<td>
                                <div class="subject">${subject.name}</div>
                                <div class="teacher">${subject.teacher || ''}</div>
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
        }

        wordContent += `</tbody></table></body></html>`;

        await this._saveFile('\ufeff' + wordContent, 'utf-8', `${title}.doc`, 'application/msword', 'doc');
        } catch (error) {
            console.error('导出 Word 出错:', error);
            alert('导出 Word 出错: ' + (error && error.message ? error.message : error));
        }
    }

    // Excel瀵煎嚭鍔熻兘 - 绉诲姩绔疨C绔粺涓€鏁堟灉
TimetableApp.prototype.exportToExcel = async function() {
        try {
            const titleEl = document.getElementById('tableTitle') || document.getElementById('timetableTitle');
            const title = (titleEl && titleEl.value) || '课程表';
            
            // 鍒涘缓鍏煎Excel鐨凥TML鏍煎紡
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
                    .time-header { 
                        background-color: #e6f3ff; 
                        font-weight: bold; 
                        width: 80px; 
                        font-size: 14px;
                    }
                    .period-header { 
                        background-color: #f0f0f0; 
                        font-weight: bold; 
                        width: 100px; 
                        font-size: 14px;
                    }
                    .time-section { 
                        background-color: #e6f3ff; 
                        font-weight: bold; 
                        vertical-align: middle;
                    }
                    .time-section.pm { 
                        background-color: #fff2e6; 
                    }
                    .time-section.evening { 
                        background-color: #f0f8ff; 
                    }
                    .subject { 
                        font-weight: bold; 
                        color: #333; 
                        font-size: 14px;
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                    }
                    .teacher { 
                            font-size: 12px; 
                            color: #666; 
                            font-family: "Microsoft YaHei", Arial, sans-serif;
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
                            <th class="time-header">时段</th>
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
            
            // 上午课程
            for (let i = 0; i < this.periods.morning.length; i++) {
                const period = this.periods.morning[i];
                excelContent += '<tr>';
                
                if (i === 0) {
                    excelContent += `<td rowspan="${this.periods.morning.length}" class="time-section">上午</td>`;
                }
                
                excelContent += `<td class="period-header">${period.name}${this.settings.showPeriodTime ? `<br><span class="period-time">${period.time}</span>` : ''}</td>`;
                
                // 添加每天的课程单元格
                const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
                for (let day = 1; day <= dayCount; day++) {
                    const key = `${day}-morning-${i}`;
                    const version = this.getCellVersion(key, this.formatLocalDate(this.getWeekRange(this.currentDate).start));
                    const subjectId = version ? version.subject : null;
                    
                    if (subjectId) {
                        const subject = this.subjects.find(s => s.id === subjectId);
                        if (subject) {
                            excelContent += `<td><span class="subject">${subject.name}</span>`;
                            if (subject.teacher) {
                                excelContent += `<br><span class="teacher">${subject.teacher}</span>`;
                            }
                            excelContent += `</td>`;
                        } else {
                            excelContent += '<td></td>';
                        }
                    } else {
                        excelContent += '<td></td>';
                    }
                }
                
                excelContent += '</tr>';
            }
            
            // 下午课程
            for (let i = 0; i < this.periods.afternoon.length; i++) {
                const period = this.periods.afternoon[i];
                excelContent += '<tr>';
                
                if (i === 0) {
                    excelContent += `<td rowspan="${this.periods.afternoon.length}" class="time-section pm">下午</td>`;
                }
                
                excelContent += `<td class="period-header">${period.name}${this.settings.showPeriodTime ? `<br><span class="period-time">${period.time}</span>` : ''}</td>`;
                
                // 添加每天的课程单元格
                const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
                for (let day = 1; day <= dayCount; day++) {
                    const key = `${day}-afternoon-${i}`;
                    const version = this.getCellVersion(key, this.formatLocalDate(this.getWeekRange(this.currentDate).start));
                    const subjectId = version ? version.subject : null;
                    
                    if (subjectId) {
                        const subject = this.subjects.find(s => s.id === subjectId);
                        if (subject) {
                            excelContent += `<td><span class="subject">${subject.name}</span>`;
                            if (subject.teacher) {
                                excelContent += `<br><span class="teacher">${subject.teacher}</span>`;
                            }
                            excelContent += `</td>`;
                        } else {
                            excelContent += '<td></td>';
                        }
                    } else {
                        excelContent += '<td></td>';
                    }
                }
                
                excelContent += '</tr>';
            }
            
            
            // 晚上课程（如果启用）
            if (this.settings.showEvening && this.periods.evening && this.periods.evening.length > 0) {
                for (let i = 0; i < this.periods.evening.length; i++) {
                    const period = this.periods.evening[i];
                    excelContent += '<tr>';
                    
                    if (i === 0) {
                        excelContent += `<td rowspan="${this.periods.evening.length}" class="time-section evening">晚上</td>`;
                    }
                    
                    excelContent += `<td class="period-header">${period.name}${this.settings.showPeriodTime ? `<br><span class="period-time">${period.time}</span>` : ''}</td>`;
                    
                    // 添加每天的课程单元格
                    const dayCount = 5 + (this.settings.showSaturday ? 1 : 0) + (this.settings.showSunday ? 1 : 0);
                    for (let day = 1; day <= dayCount; day++) {
                        const key = `${day}-evening-${i}`;
                        const version = this.getCellVersion(key, this.formatLocalDate(this.getWeekRange(this.currentDate).start));
                    const subjectId = version ? version.subject : null;
                        
                        if (subjectId) {
                            const subject = this.subjects.find(s => s.id === subjectId);
                            if (subject) {
                                excelContent += `<td><span class="subject">${subject.name}</span>`;
                                if (subject.teacher) {
                                    excelContent += `<br><span class="teacher">${subject.teacher}</span>`;
                                }
                                excelContent += `</td>`;
                            } else {
                                excelContent += '<td></td>';
                            }
                        } else {
                            excelContent += '<td></td>';
                        }
                    }
                    
                    excelContent += '</tr>';
                }
            }
            
            excelContent += '</tbody></table></body></html>';

            await this._saveFile('\ufeff' + excelContent, 'utf-8', `${title}.xls`, 'application/vnd.ms-excel', 'xls');
        } catch (error) {
            console.error('导出 Excel 出错:', error);
            alert('导出 Excel 出错: ' + (error && error.message ? error.message : error));
        }
    }




