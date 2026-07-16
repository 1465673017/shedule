// app-time.js - Time management and period editing
// Auto-split from script.js

TimetableApp.prototype.openTimeManagementModal = function() {
        this.openSettingsModal('time');
    }

TimetableApp.prototype.updateTimeAdvancedSaveVisibility = function() {
        const advanced = document.getElementById('advancedSettings');
        const actions = document.getElementById('timeAdvancedSaveActions');
        if (!advanced || !actions) return;
        actions.style.display = advanced.classList.contains('expanded') ? 'flex' : 'none';
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
        this.closeSettingsModal();
    }

TimetableApp.prototype.renderPeriods = function() {
        this.renderAllPeriods();
    }

TimetableApp.prototype.renderPeriodSection = function(section, container) {
        container.innerHTML = '';
    }

TimetableApp.prototype.renderAllPeriods = function() {
        const container = document.getElementById('periodsList');
        container.innerHTML = '';

        this.periods.forEach((period, index) => {
            const [start, end] = period.time.split('-');
            
            const item = document.createElement('div');
            item.className = 'time-period-item';
            item.innerHTML = `
                <input type="text" class="period-name-input" value="${period.name}" 
                    onchange="app.updatePeriod(${index}, 'name', this.value)">
                <input type="time" class="period-time-input" value="${start}" 
                    onchange="app.updatePeriodTime(${index}, 'start', this.value)">
                <span class="period-time-separator">-</span>
                <input type="time" class="period-time-input" value="${end}" 
                    onchange="app.updatePeriodTime(${index}, 'end', this.value)">
                <button type="button" class="delete-period-btn" title="删除该时间段" aria-label="删除${period.name}" onclick="app.deletePeriod(${index})">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
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
        const prevPeriod = this.periods[index];
        const periodDuration = this.getConfiguredPeriodDuration();
        
        let newStart = '08:00';
        let newEnd = this.addMinutesToTime(newStart, periodDuration);
        
        if (prevPeriod) {
            const prevEnd = prevPeriod.time.split('-')[1];
            newStart = prevEnd;
            newEnd = this.addMinutesToTime(prevEnd, periodDuration);
            if (this.timeToMinutes(newEnd) > 24 * 60) {
                newStart = '06:00';
                newEnd = this.addMinutesToTime(newStart, periodDuration);
            }
        }
        
        const newPeriod = { name: `第${index + 2}节`, time: `${newStart}-${newEnd}` };
        this.periods.splice(index + 1, 0, newPeriod);
        
        this.renumberPeriods();
        this.renderPeriods();
    }

TimetableApp.prototype.addPeriodToEnd = function() {
        const periodDuration = this.getConfiguredPeriodDuration();
        let newStart = '08:00';
        let newEnd = this.addMinutesToTime(newStart, periodDuration);
        
        if (this.periods.length > 0) {
            const lastPeriod = this.periods[this.periods.length - 1];
            const lastEnd = lastPeriod.time.split('-')[1];
            newStart = lastEnd;
            newEnd = this.addMinutesToTime(lastEnd, periodDuration);
            if (this.timeToMinutes(newEnd) > 24 * 60) {
                newStart = '06:00';
                newEnd = this.addMinutesToTime(newStart, periodDuration);
            }
        }
        
        const newPeriod = { name: `第${this.periods.length + 1}节`, time: `${newStart}-${newEnd}` };
        this.periods.push(newPeriod);
        
        this.renderPeriods();
    }

TimetableApp.prototype.getConfiguredPeriodDuration = function() {
        const durationInput = typeof document !== 'undefined'
            ? document.getElementById('periodDuration')
            : null;
        const inputDuration = durationInput ? parseInt(durationInput.value, 10) : NaN;
        if (Number.isFinite(inputDuration) && inputDuration > 0) return inputDuration;

        const savedDuration = this.quickSettingsState
            ? parseInt(this.quickSettingsState.periodDuration, 10)
            : NaN;
        if (Number.isFinite(savedDuration) && savedDuration > 0) return savedDuration;

        if (Array.isArray(this.periods) && this.periods.length > 0 && this.periods[0].time) {
            const [start, end] = this.periods[0].time.split('-');
            const inferredDuration = this.timeToMinutes(end) - this.timeToMinutes(start);
            if (Number.isFinite(inferredDuration) && inferredDuration > 0) return inferredDuration;
        }

        return 40;
    }

TimetableApp.prototype.addMinutesToTime = function(timeStr, minutes) {
        const [hours, mins] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + mins + minutes;
        const newHours = Math.floor(totalMinutes / 60);
        const newMins = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
    }

TimetableApp.prototype.updatePeriod = function(index, field, value) {
        this.periods[index][field] = value;
    }

TimetableApp.prototype.updatePeriodTime = function(index, type, value) {
        const period = this.periods[index];
        const [start, end] = period.time.split('-');
        if (type === 'start') {
            period.time = `${value}-${end}`;
        } else {
            period.time = `${start}-${value}`;
        }
    }

TimetableApp.prototype.deletePeriod = function(index) {
        this.periods.splice(index, 1);
        this.renumberPeriods();
        this.renderPeriods();
    }

TimetableApp.prototype.renumberPeriods = function() {
        this.periods.forEach((period, index) => {
            if (!period) return;
            period.name = `第${index + 1}节`;
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
        const totalPeriods = this.periods.length;
        document.getElementById('totalPeriodCount').value = totalPeriods;

        if (this.periods.length > 0) {
            const firstPeriod = this.periods[0].time;
            document.getElementById('firstPeriodStart').value = firstPeriod.split('-')[0];
        }

        let periodDuration = 40;
        if (this.periods.length > 0) {
            const [start, end] = this.periods[0].time.split('-');
            periodDuration = this.timeToMinutes(end) - this.timeToMinutes(start);
        }
        document.getElementById('periodDuration').value = periodDuration;

        let breakDuration = 10;
        if (this.periods.length >= 2) {
            const end1 = this.periods[0].time.split('-')[1];
            const start2 = this.periods[1].time.split('-')[0];
            breakDuration = this.timeToMinutes(start2) - this.timeToMinutes(end1);
        }
        document.getElementById('breakDuration').value = breakDuration;

        this.updateLunchBreakOptions(totalPeriods);
        this.updateDinnerBreakOptions(totalPeriods);
        document.getElementById('lunchBreakPosition').value = '0';
        document.getElementById('lunchBreakDuration').value = 120;
        document.getElementById('dinnerBreakPosition').value = '0';
        document.getElementById('dinnerBreakDuration').value = 60;
    }

TimetableApp.prototype.updateLunchBreakOptions = function(totalPeriods) {
        const select = document.getElementById('lunchBreakPosition');
        select.innerHTML = '';
        
        const option0 = document.createElement('option');
        option0.value = '0';
        option0.textContent = '不插入休息1';
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
        option0.textContent = '不插入休息2';
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
        toggle.setAttribute('aria-expanded', toggle.classList.contains('expanded') ? 'true' : 'false');
        this.updateTimeAdvancedSaveVisibility();
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
        
        const nextPeriods = [];

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

            nextPeriods.push(period);

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

        this.periods = nextPeriods;

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
        this.saveData();
        this.applySettings();
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
        this.closeSettingsModal();
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
