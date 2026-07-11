// app-time.js - Time management and period editing
// Auto-split from script.js

TimetableApp.prototype.openTimeManagementModal = function() {
        const modal = document.getElementById('timeManagementModal');
        modal.style.display = 'block';
        this.renderPeriods();
        this.initQuickSettings();
        this.updateShowPeriodTimeToggle();
    }

TimetableApp.prototype.updateShowPeriodTimeToggle = function() {
        const toggle = document.getElementById('showPeriodTimeToggle');
        if (toggle) {
            toggle.classList.toggle('active', this.settings.showPeriodTime);
        }
    }

TimetableApp.prototype.toggleShowPeriodTime = function() {
        this.settings.showPeriodTime = !this.settings.showPeriodTime;
        this.updateShowPeriodTimeToggle();
    }

TimetableApp.prototype.closeTimeManagementModal = function() {
        document.getElementById('timeManagementModal').style.display = 'none';
    }

TimetableApp.prototype.renderPeriods = function() {
        this.renderAllPeriods();
    }

TimetableApp.prototype.renderPeriodSection = function(section, container) {
        const periods = this.periods[section];
        container.innerHTML = '';
        
        let periodNum = this.periods.morning.length;
        if (section === 'morning') {
            periodNum = 0;
        } else if (section === 'afternoon') {
            periodNum = this.periods.morning.length;
        } else if (section === 'evening') {
            periodNum = this.periods.morning.length + this.periods.afternoon.length;
        }
        
        periods.forEach((period, index) => {
            const [start, end] = period.time.split('-');
            const currentNum = periodNum + index + 1;
            const item = document.createElement('div');
            item.className = 'time-period-item';
            item.innerHTML = `
                <input type="text" class="period-name-input" value="${period.name}" 
                    onchange="app.updatePeriod('${section}', ${index}, 'name', this.value)">
                <input type="time" class="period-time-input" value="${start}" 
                    onchange="app.updatePeriodTime('${section}', ${index}, 'start', this.value)">
                <span class="period-time-separator">-</span>
                <input type="time" class="period-time-input" value="${end}" 
                    onchange="app.updatePeriodTime('${section}', ${index}, 'end', this.value)">
                <button class="delete-period-btn" onclick="app.deletePeriod('${section}', ${index})">×</button>
            `;
            container.appendChild(item);
        });
    }

TimetableApp.prototype.renderAllPeriods = function() {
        const container = document.getElementById('periodsList');
        container.innerHTML = '';
        
        const allPeriods = [
            ...this.periods.morning.map((p, i) => ({ ...p, section: 'morning', index: i })),
            ...this.periods.afternoon.map((p, i) => ({ ...p, section: 'afternoon', index: i })),
            ...this.periods.evening.map((p, i) => ({ ...p, section: 'evening', index: i }))
        ];
        
        allPeriods.forEach((period, i) => {
            const [start, end] = period.time.split('-');
            
            const item = document.createElement('div');
            item.className = 'time-period-item';
            item.innerHTML = `
                <input type="text" class="period-name-input" value="${period.name}" 
                    onchange="app.updatePeriod('${period.section}', ${period.index}, 'name', this.value)">
                <input type="time" class="period-time-input" value="${start}" 
                    onchange="app.updatePeriodTime('${period.section}', ${period.index}, 'start', this.value)">
                <span class="period-time-separator">-</span>
                <input type="time" class="period-time-input" value="${end}" 
                    onchange="app.updatePeriodTime('${period.section}', ${period.index}, 'end', this.value)">
                <button class="delete-period-btn" onclick="app.deletePeriod('${period.section}', ${period.index})">×</button>
            `;
            container.appendChild(item);
        });
        
        const bottomAddZone = document.createElement('div');
        bottomAddZone.className = 'period-add-zone';
        bottomAddZone.innerHTML = '<span>+ 添加课时</span>';
        bottomAddZone.onclick = () => this.addPeriodToEnd();
        container.appendChild(bottomAddZone);
    }

TimetableApp.prototype.insertPeriodAfter = function(index) {
        const allPeriods = [
            ...this.periods.morning.map((p, i) => ({ ...p, section: 'morning', index: i })),
            ...this.periods.afternoon.map((p, i) => ({ ...p, section: 'afternoon', index: i })),
            ...this.periods.evening.map((p, i) => ({ ...p, section: 'evening', index: i }))
        ];
        
        const prevPeriod = allPeriods[index];
        const nextPeriod = allPeriods[index + 1];
        
        let newStart = '08:00';
        let newEnd = '08:40';
        
        if (prevPeriod) {
            const prevEnd = prevPeriod.time.split('-')[1];
            newStart = prevEnd;
            newEnd = this.addMinutesToTime(prevEnd, 40);
        }
        
        const newPeriod = { name: `第${index + 2}节`, time: `${newStart}-${newEnd}` };
        
        if (prevPeriod.section === 'morning') {
            if (index < this.periods.morning.length - 1) {
                this.periods.morning.splice(prevPeriod.index + 1, 0, newPeriod);
            } else {
                if (this.periods.afternoon.length === 0 && this.periods.evening.length === 0) {
                    this.periods.morning.push(newPeriod);
                } else {
                    this.periods.afternoon.splice(0, 0, newPeriod);
                }
            }
        } else if (prevPeriod.section === 'afternoon') {
            if (index < this.periods.morning.length + this.periods.afternoon.length - 1) {
                this.periods.afternoon.splice(prevPeriod.index + 1, 0, newPeriod);
            } else {
                this.periods.evening.splice(0, 0, newPeriod);
            }
        } else {
            this.periods.evening.splice(prevPeriod.index + 1, 0, newPeriod);
        }
        
        this.renumberPeriods();
        this.renderPeriods();
    }

TimetableApp.prototype.addPeriodToEnd = function() {
        const allPeriods = [
            ...this.periods.morning,
            ...this.periods.afternoon,
            ...this.periods.evening
        ];
        
        let newStart = '08:00';
        let newEnd = '08:40';
        
        if (allPeriods.length > 0) {
            const lastPeriod = allPeriods[allPeriods.length - 1];
            const lastEnd = lastPeriod.time.split('-')[1];
            newStart = lastEnd;
            newEnd = this.addMinutesToTime(lastEnd, 40);
        }
        
        const newPeriod = { name: `第${allPeriods.length + 1}节`, time: `${newStart}-${newEnd}` };
        
        if (this.periods.morning.length > 0 && this.periods.afternoon.length === 0) {
            this.periods.morning.push(newPeriod);
        } else if (this.periods.afternoon.length > 0 && this.periods.evening.length === 0) {
            this.periods.afternoon.push(newPeriod);
        } else {
            this.periods.evening.push(newPeriod);
        }
        
        this.renderPeriods();
    }

TimetableApp.prototype.addMinutesToTime = function(timeStr, minutes) {
        const [hours, mins] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + mins + minutes;
        const newHours = Math.floor(totalMinutes / 60);
        const newMins = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
    }

TimetableApp.prototype.updatePeriod = function(section, index, field, value) {
        this.periods[section][index][field] = value;
    }

TimetableApp.prototype.updatePeriodTime = function(section, index, type, value) {
        const period = this.periods[section][index];
        const [start, end] = period.time.split('-');
        if (type === 'start') {
            period.time = `${value}-${end}`;
        } else {
            period.time = `${start}-${value}`;
        }
    }

TimetableApp.prototype.deletePeriod = function(section, index) {
        this.periods[section].splice(index, 1);
        this.renumberPeriods();
        this.renderPeriods();
    }

TimetableApp.prototype.renumberPeriods = function() {
        let num = 1;
        ['morning', 'afternoon', 'evening'].forEach(section => {
            this.periods[section].forEach(period => {
                period.name = `第${num}节`;
                num++;
            });
        });
    }

TimetableApp.prototype.initQuickSettings = function() {
        // 优先使用上次应用的值
        if (this.quickSettingsState) {
            const qs = this.quickSettingsState;
            document.getElementById('totalPeriodCount').value = qs.totalPeriods;
            document.getElementById('firstPeriodStart').value = qs.firstStart;
            document.getElementById('periodDuration').value = qs.periodDuration;
            document.getElementById('breakDuration').value = qs.breakDuration;

            this.updateLunchBreakOptions(qs.totalPeriods);
            this.updateDinnerBreakOptions(qs.totalPeriods);

            document.getElementById('lunchBreakPosition').value = qs.lunchPosition;
            document.getElementById('lunchBreakDuration').value = qs.lunchDuration;
            document.getElementById('dinnerBreakPosition').value = qs.dinnerPosition;
            document.getElementById('dinnerBreakDuration').value = qs.dinnerDuration;
            return;
        }

        // 没有保存值时，从当前 periods 计算
        const totalPeriods = this.periods.morning.length + this.periods.afternoon.length + (this.settings.showEvening ? this.periods.evening.length : 0);
        document.getElementById('totalPeriodCount').value = totalPeriods;

        if (this.periods.morning.length > 0) {
            const firstPeriod = this.periods.morning[0].time;
            document.getElementById('firstPeriodStart').value = firstPeriod.split('-')[0];
        }

        let periodDuration = 40;
        if (this.periods.morning.length > 0) {
            const [start, end] = this.periods.morning[0].time.split('-');
            periodDuration = this.timeToMinutes(end) - this.timeToMinutes(start);
        }
        document.getElementById('periodDuration').value = periodDuration;

        let breakDuration = 10;
        if (this.periods.morning.length >= 2) {
            const end1 = this.periods.morning[0].time.split('-')[1];
            const start2 = this.periods.morning[1].time.split('-')[0];
            breakDuration = this.timeToMinutes(start2) - this.timeToMinutes(end1);
        } else if (this.periods.morning.length === 1 && this.periods.afternoon.length > 0) {
            const endMorning = this.periods.morning[0].time.split('-')[1];
            const startAfternoon = this.periods.afternoon[0].time.split('-')[0];
            const gap = this.timeToMinutes(startAfternoon) - this.timeToMinutes(endMorning);
            if (gap < 100) {
                breakDuration = gap;
            }
        }
        document.getElementById('breakDuration').value = breakDuration;

        this.updateLunchBreakOptions(totalPeriods);
        this.updateDinnerBreakOptions(totalPeriods);

        const lunchPosition = this.periods.morning.length;
        document.getElementById('lunchBreakPosition').value = lunchPosition;

        let lunchDuration = 120;
        if (this.periods.morning.length > 0 && this.periods.afternoon.length > 0) {
            const endMorning = this.periods.morning[this.periods.morning.length - 1].time.split('-')[1];
            const startAfternoon = this.periods.afternoon[0].time.split('-')[0];
            lunchDuration = this.timeToMinutes(startAfternoon) - this.timeToMinutes(endMorning) - breakDuration;
            if (lunchDuration < 0) lunchDuration = 120;
        }
        document.getElementById('lunchBreakDuration').value = lunchDuration;

        const dinnerPosition = this.periods.morning.length + this.periods.afternoon.length;
        document.getElementById('dinnerBreakPosition').value = dinnerPosition;

        let dinnerDuration = 60;
        if (this.periods.afternoon.length > 0 && this.periods.evening.length > 0) {
            const endAfternoon = this.periods.afternoon[this.periods.afternoon.length - 1].time.split('-')[1];
            const startEvening = this.periods.evening[0].time.split('-')[0];
            dinnerDuration = this.timeToMinutes(startEvening) - this.timeToMinutes(endAfternoon) - breakDuration;
            if (dinnerDuration < 0) dinnerDuration = 60;
        }
        document.getElementById('dinnerBreakDuration').value = dinnerDuration;
    }

TimetableApp.prototype.updateLunchBreakOptions = function(totalPeriods) {
        const select = document.getElementById('lunchBreakPosition');
        select.innerHTML = '';
        
        const option0 = document.createElement('option');
        option0.value = '0';
        option0.textContent = '不插入午休';
        select.appendChild(option0);
        
        for (let i = 1; i <= totalPeriods; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `第${i}节之后`;
            select.appendChild(option);
        }
    }

TimetableApp.prototype.updateDinnerBreakOptions = function(totalPeriods) {
        const select = document.getElementById('dinnerBreakPosition');
        select.innerHTML = '';
        
        const option0 = document.createElement('option');
        option0.value = '0';
        option0.textContent = '不插入晚饭';
        select.appendChild(option0);
        
        for (let i = 1; i <= totalPeriods; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `第${i}节之后`;
            select.appendChild(option);
        }
    }

TimetableApp.prototype.toggleAdvancedSettings = function() {
        const toggle = document.querySelector('.advanced-settings-toggle');
        const advanced = document.getElementById('advancedSettings');
        toggle.classList.toggle('expanded');
        advanced.classList.toggle('expanded');
    }

TimetableApp.prototype.applyQuickSettings = function() {
        const totalPeriods = parseInt(document.getElementById('totalPeriodCount').value) || 7;
        const firstStart = document.getElementById('firstPeriodStart').value || '08:00';
        const periodDuration = parseInt(document.getElementById('periodDuration').value) || 40;
        const breakDuration = parseInt(document.getElementById('breakDuration').value) || 10;
        const lunchPosition = parseInt(document.getElementById('lunchBreakPosition').value) || 4;
        const lunchDuration = parseInt(document.getElementById('lunchBreakDuration').value) || 120;
        const dinnerPosition = parseInt(document.getElementById('dinnerBreakPosition').value) || 0;
        const dinnerDuration = parseInt(document.getElementById('dinnerBreakDuration').value) || 60;

        const [startHour, startMinute] = firstStart.split(':').map(Number);
        let currentMinutes = startHour * 60 + startMinute;
        
        const morningPeriods = [];
        const afternoonPeriods = [];
        const eveningPeriods = [];

        for (let i = 1; i <= totalPeriods; i++) {
            const startStr = this.formatTime(currentMinutes);
            const endMinutes = currentMinutes + periodDuration;
            const endStr = this.formatTime(endMinutes);
            
            const period = {
                name: `第${i}节`,
                time: `${startStr}-${endStr}`
            };

            const hasLunch = lunchPosition > 0 && i === lunchPosition;
            const hasDinner = dinnerPosition > 0 && i === dinnerPosition;

            if (lunchPosition > 0 && i <= lunchPosition) {
                morningPeriods.push(period);
            } else if (dinnerPosition === 0 || (dinnerPosition > 0 && i <= dinnerPosition)) {
                afternoonPeriods.push(period);
            } else {
                eveningPeriods.push(period);
            }

            if (i < totalPeriods) {
                if (hasLunch) {
                    currentMinutes = endMinutes + lunchDuration;
                } else if (hasDinner) {
                    currentMinutes = endMinutes + dinnerDuration;
                } else {
                    currentMinutes = endMinutes + breakDuration;
                }
            }
        }

        this.periods.morning = morningPeriods;
        this.periods.afternoon = afternoonPeriods;
        this.periods.evening = eveningPeriods;

        // 记住本次应用的值，下次打开弹窗时显示
        this.quickSettingsState = {
            totalPeriods,
            firstStart,
            periodDuration,
            breakDuration,
            lunchPosition,
            lunchDuration,
            dinnerPosition,
            dinnerDuration
        };

        this.renderPeriods();
    }

TimetableApp.prototype.formatTime = function(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

TimetableApp.prototype.saveTimeManagement = function() {
        this.saveSettings();
        this.saveData();
        this.applySettings();
        this.closeTimeManagementModal();
    }

TimetableApp.prototype.saveSettings = function(e) {
        if (e) e.preventDefault();

        localStorage.setItem('timetableSettings', JSON.stringify(this.settings));
        this.saveGrades();

        if (e) {
            this.applySettings();
            this.closeSettingsModal();
        }
    }

    // 立即开始创建课程表功能
TimetableApp.prototype.startCreatingTimetable = function() {
        // 关闭教程弹窗
        this.closeTutorialModal();
        
        // 如果在手机端，确保显示科目池
        if (window.innerWidth <= 768) {
            const subjectPool = document.querySelector('.subject-pool');
            if (subjectPool) {
                subjectPool.style.display = 'block';
            }
        }
        
        // 滚动到课程表顶部，确保用户看到操作区域
        const timetableContainer = document.querySelector('.timetable-container');
        if (timetableContainer) {
            timetableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // 如果没有科目，提示用户添加
        if (this.subjects.length === 0) {
            // 显示一个简短提示
            const hint = document.createElement('div');
            hint.innerHTML = `
                <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                background: #4CAF50; color: white; padding: 15px 25px; border-radius: 8px; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; 
                animation: fadeInOut 3s ease-in-out;">
                    请点击左侧「+ 科目」按钮开始添加科目
                </div>
                <style>
                @keyframes fadeInOut {
                    0% { opacity: 0; top: 0; }
                    10% { opacity: 1; top: 20px; }
                    90% { opacity: 1; top: 20px; }
                    100% { opacity: 0; top: 0; }
                }
                </style>
            `;
            document.body.appendChild(hint);
            
            // 3秒后自动移除提示
            setTimeout(() => {
                if (hint.parentNode) {
                    hint.parentNode.removeChild(hint);
                }
            }, 3000);
        }
        
        // 如果有科目，但科目池在手机端被隐藏，提示用户如何操作
        if (this.subjects.length > 0 && window.innerWidth <= 768) {
            // 检查科目池是否可见
            const subjectPool = document.querySelector('.subject-pool');
            // 使用getComputedStyle来准确判断元素是否可见
            const computedStyle = window.getComputedStyle(subjectPool);
            if (subjectPool && (subjectPool.style.display === 'none' || computedStyle.display === 'none')) {
                // 显示一个简短提示
                const hint = document.createElement('div');
                hint.innerHTML = `
                    <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                    background: #2196F3; color: white; padding: 15px 25px; border-radius: 8px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; 
                    animation: fadeInOut 3s ease-in-out;">
                        请从上方科目池中拖拽科目到课程表中
                    </div>
                    <style>
                    @keyframes fadeInOut {
                        0% { opacity: 0; top: 0; }
                        10% { opacity: 1; top: 20px; }
                        90% { opacity: 1; top: 20px; }
                        100% { opacity: 0; top: 0; }
                    }
                    </style>
                `;
                document.body.appendChild(hint);
                
                // 3秒后自动移除提示
                setTimeout(() => {
                    if (hint.parentNode) {
                        hint.parentNode.removeChild(hint);
                    }
                }, 3000);
            }
        }
    }


