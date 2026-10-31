/* Target-version memo cards, inline editor and course picking; records remain SQLite-backed. */
(() => {
    'use strict';
    const palette = ['#ffe477', '#9bea8f', '#f3a6d3', '#c89bf2', '#91d3ee', '#d9d9d9', '#858585'];
    let app = null, memos = [], activeId = null, editing = false, color = palette[0];
    const $ = id => document.getElementById(id);
    const escape = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const stamp = value => {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    };
    const toInputDate = value => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };
    function activeMemo() { return memos.find(memo => memo.id === activeId) || null; }
    function titleOf(memo) { return stamp(memo.due) || stamp(memo.createdAt) || '备忘'; }
    async function reload() {
        try { memos = await window.electronAPI.memos.list(); app.memos = memos; render(); app.renderTimetable(); }
        catch (error) { window.showAppToast?.(`读取备忘录失败：${error.message || error}`); }
    }
    function makeCard(memo) {
        const entry = document.createElement('article'); entry.className = `memo-entry${memo.done ? ' is-done' : ''}${memo.id === activeId ? ' is-active' : ''}`;
        entry.style.setProperty('--memo-card-color', memo.color || palette[0]);
        const isEditing = memo.id === activeId && editing;
        const card = document.createElement('button'); card.type = 'button'; card.className = 'memo-card';
        if (isEditing) card.classList.add('is-editing');
        const title = document.createElement('strong'); title.textContent = titleOf(memo);
        let courseLabel = '';
        if (memo.cellRef) {
            const cellKey = typeof memo.cellRef === 'string' ? memo.cellRef : memo.cellRef.key;
            const parsed = app.parseCellKey(cellKey);
            if (parsed) courseLabel = `${['','周一','周二','周三','周四','周五','周六','周日'][parsed.day] || ''} ${app.periods[parsed.periodIndex]?.name || ''}`.trim();
        }
        if (!courseLabel) courseLabel = courseLabelForDue(memo.due);
        if (courseLabel) {
            const badge = document.createElement('span'); badge.className = 'memo-course-tag';
            badge.textContent = courseLabel;
            title.append(badge);
        }
        const content = document.createElement('span'); content.className = 'memo-card-content';
        const contentText = memo.content || '（无内容）';
        content.textContent = memo.note ? `${contentText}（${memo.note}）` : contentText;
        const date = document.createElement('small'); date.textContent = memo.due ? memo.due.slice(5, 10).replace('-', '-') : '';
        card.append(title, content, date);
        card.classList.toggle('done', Boolean(memo.done));
        card.addEventListener('click', async () => {
            if (isEditing) return;
            if (!memo.done && String(memo.note || '').trim() === '循环' && memo.due) {
                const nextDue = new Date(memo.due);
                if (!Number.isNaN(nextDue.getTime())) {
                    nextDue.setDate(nextDue.getDate() + 7);
                    const due = `${app.formatLocalDate(nextDue)}T${String(nextDue.getHours()).padStart(2, '0')}:${String(nextDue.getMinutes()).padStart(2, '0')}:${String(nextDue.getSeconds()).padStart(2, '0')}`;
                    const nextDueMinute = due.slice(0, 16);
                    const alreadyCreated = memos.some(item => item.id !== memo.id
                        && item.note === memo.note
                        && item.content === memo.content
                        && String(item.due || '').slice(0, 16) === nextDueMinute);
                    if (!alreadyCreated) {
                        try {
                            await window.electronAPI.memos.save({ ...memo, id: undefined, title: stamp(due), due, done: false, createdAt: undefined, updatedAt: undefined });
                        } catch (error) {
                            window.showAppToast?.(`创建下周循环备忘失败：${error.message || error}`);
                            return;
                        }
                    }
                }
            }
            await save({ ...memo, done: !memo.done });
        });
        const actions = document.createElement('div'); actions.className = `memo-card-actions${isEditing ? ' is-editing' : ''}`;
        const remove = document.createElement('button'); remove.type = 'button'; remove.title = '删除'; remove.setAttribute('aria-label', '删除'); const deleteIcon = document.createElement('img'); deleteIcon.src = './icon/memo-delete.svg'; deleteIcon.alt = ''; remove.append(deleteIcon);
        remove.addEventListener('click', async event => { event.stopPropagation(); if (memo.id === 'new') { memos = memos.filter(item => item.id !== 'new'); activeId = null; editing = false; render(); return; } try { await window.electronAPI.memos.remove(memo.id); if (activeId === memo.id) activeId = null; await reload(); } catch (error) { window.showAppToast?.(`删除失败：${error.message || error}`); } });
        if (isEditing) {
            const saveAction = document.createElement('button'); saveAction.type = 'button'; saveAction.title = '保存'; saveAction.setAttribute('aria-label', '保存'); const saveIcon = document.createElement('img'); saveIcon.src = './icon/memo-save.svg'; saveIcon.alt = ''; saveAction.append(saveIcon);
            saveAction.addEventListener('click', event => { event.stopPropagation(); entry.querySelector('form')?.requestSubmit(); });
            actions.append(remove, saveAction);
        } else {
            const edit = document.createElement('button'); edit.type = 'button'; edit.title = '编辑'; edit.setAttribute('aria-label', '编辑'); const editIcon = document.createElement('img'); editIcon.src = './icon/memo-edit.svg'; editIcon.alt = ''; edit.append(editIcon);
            edit.addEventListener('click', event => { event.stopPropagation(); select(memo.id, true); });
            actions.append(remove, edit);
        }
        entry.append(card, actions);
        if (isEditing) entry.append(buildEditor(memo));
        return entry;
    }
    function render() {
        const list = $('memoList'); const query = $('memoSearchInput').value.trim().toLocaleLowerCase(); list.replaceChildren();
        const shown = memos.filter(memo => `${memo.content} ${memo.note} ${(memo.tags || []).join(' ')}`.toLocaleLowerCase().includes(query))
            .sort((a, b) => Number(a.done) - Number(b.done) || String(b.createdAt).localeCompare(String(a.createdAt)));
        shown.forEach(memo => list.append(makeCard(memo)));
        if (!shown.length) { const empty = document.createElement('div'); empty.className = 'memo-empty'; empty.textContent = query ? '没有匹配的备忘录' : '暂无备忘'; list.append(empty); }
    }
    function buildEditor(memo) {
        const wrap = document.createElement('div'); wrap.className = 'memo-inline-editor';
        let form;
        const contentLabel = document.createElement('label'); contentLabel.className = 'memo-content-label';
        const contentHeading = document.createElement('span'); contentHeading.className = 'memo-content-heading'; contentHeading.textContent = '内容';
        const created = document.createElement('time'); created.className = 'memo-created-at'; created.textContent = `创建于 ${stamp(memo.createdAt)}`; contentHeading.append(created);
        const content = document.createElement('textarea'); content.rows = 4; content.maxLength = 20000; content.placeholder = '记录待办内容'; content.value = memo.content || ''; content.readOnly = !editing; contentLabel.append(content);
        contentLabel.prepend(contentHeading);
        const row = document.createElement('div'); row.className = 'memo-form-row';
        const dateLabel = document.createElement('label'); dateLabel.textContent = '日期 / 时间';
        const datePicker = document.createElement('div'); datePicker.className = 'memo-date-picker';
        const due = document.createElement('input'); due.type = 'datetime-local'; due.value = toInputDate(memo.due); due.readOnly = !editing;
        const calendarButton = document.createElement('button'); calendarButton.type = 'button'; calendarButton.className = 'memo-date-picker-button'; calendarButton.disabled = !editing; calendarButton.title = '选择日期和时间'; calendarButton.setAttribute('aria-label', calendarButton.title);
        const calendarIcon = document.createElement('span'); calendarIcon.className = 'memo-calendar-icon'; calendarIcon.setAttribute('aria-hidden', 'true'); calendarIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3V6M17 3V6M4 9H20M6 5H18C19.1 5 20 5.9 20 7V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V7C4 5.9 4.9 5 6 5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13H10M14 13H16M8 17H10M14 17H16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; calendarButton.append(calendarIcon);
        calendarButton.addEventListener('click', () => { if (editing) { due.showPicker?.(); due.focus(); } });
        datePicker.append(due, calendarButton); dateLabel.append(datePicker);
        const courseLabel = document.createElement('label'); courseLabel.textContent = '课程';
        const coursePicker = document.createElement('div'); coursePicker.className = 'memo-course-picker';
        const courseValue = document.createElement('input'); courseValue.readOnly = true; courseValue.placeholder = '根据日期时间自动匹配课节'; courseValue.value = courseLabelFor(memo.cellRef) || courseLabelForDue(memo.due);
        const updateCourseByDue = () => {
            if (form?.dataset.cellRef) return; // Preserve an explicitly picked timetable cell.
            courseValue.value = courseLabelForDue(due.value);
        };
        due.addEventListener('input', updateCourseByDue);
        due.addEventListener('change', updateCourseByDue);
        const inMemoWindow = document.body.classList.contains('memo-window-mode');
        const pick = document.createElement('button'); pick.type = 'button'; pick.disabled = !editing || inMemoWindow; pick.title = inMemoWindow ? '弹窗模式下不可从课表选择课程' : '从课表选择课程'; pick.setAttribute('aria-label', pick.title); const pickIcon = document.createElement('img'); pickIcon.src = './icon/course-picker.svg'; pickIcon.alt = ''; pick.append(pickIcon); pick.addEventListener('click', () => { if (document.body.classList.contains('memo-window-mode')) return; startCoursePick(due); });
        coursePicker.append(courseValue, pick); courseLabel.append(coursePicker);
        const noteLabel = document.createElement('label'); noteLabel.textContent = '备注';
        const note = document.createElement('input'); note.placeholder = '可选'; note.value = memo.note || ''; note.readOnly = !editing; noteLabel.append(note);
        if (editing) {
            const updateCardPreview = () => {
                const preview = document.querySelector('.memo-entry.is-active .memo-card-content');
                if (preview) {
                    const value = content.value || '（无内容）';
                    preview.textContent = note.value ? `${value}（${note.value}）` : value;
                }
            };
            content.addEventListener('input', updateCardPreview);
            note.addEventListener('input', updateCardPreview);
        }
        row.append(dateLabel, courseLabel, noteLabel);
        const colors = document.createElement('div'); colors.className = 'memo-colors'; const colorLabel = document.createElement('span'); colorLabel.textContent = '颜色'; colors.append(colorLabel);
        let selectedColor = memo.color || palette[0];
        palette.forEach(value => { const button = document.createElement('button'); button.type = 'button'; button.className = `memo-color${selectedColor === value ? ' selected' : ''}`; button.style.backgroundColor = value; button.disabled = !editing; button.setAttribute('aria-label', `选择颜色 ${value}`); button.addEventListener('click', () => { selectedColor = value; colors.querySelectorAll('.memo-color').forEach(item => item.classList.toggle('selected', item === button)); const entry = wrap.closest('.memo-entry'); if (entry) entry.style.setProperty('--memo-card-color', value); }); colors.append(button); });
        const actions = document.createElement('div'); actions.className = 'memo-actions';
        if (!editing) {
            const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'primary'; edit.textContent = '编辑'; edit.addEventListener('click', () => select(memo.id, true)); actions.append(edit);
        }
        form = document.createElement('form'); form.className = 'memo-form';
        form.dataset.cellRef = typeof memo.cellRef === 'object' ? JSON.stringify(memo.cellRef) : (memo.cellRef || '');
        form.append(contentLabel, colors, row, actions);
        form.addEventListener('submit', async event => { event.preventDefault(); if (!editing) return; let cellRef = memo.cellRef || null; try { cellRef = form.dataset.cellRef ? JSON.parse(form.dataset.cellRef) : cellRef; } catch { cellRef = form.dataset.cellRef || cellRef; } await save({ ...memo, id: memo.id === 'new' ? undefined : memo.id, title: stamp(due.value), content: content.value, due: due.value || null, note: note.value, color: selectedColor, tags: memo.tags || [], cellRef }); });
        wrap.append(form); return wrap;
    }
    function courseLabelFor(cellRef) {
        if (!cellRef) return '';
        if (typeof cellRef === 'string') {
            try { cellRef = JSON.parse(cellRef); } catch { /* plain cell key */ }
        }
        if (typeof cellRef === 'object') cellRef = cellRef.key;
        const parsed = app.parseCellKey(cellRef);
        if (!parsed) return '';
        return `${['','周一','周二','周三','周四','周五','周六','周日'][parsed.day] || ''} ${app.periods[parsed.periodIndex]?.name || ''}`.trim();
    }
    function courseLabelForDue(value) {
        if (!value || !app?.periods?.length) return '';
        const due = new Date(value);
        if (Number.isNaN(due.getTime())) return '';
        const periodIndex = app.getMemoPeriodIndexForTime?.(due.getHours() * 60 + due.getMinutes());
        if (!Number.isInteger(periodIndex) || periodIndex < 0) return '';
        const day = due.getDay() || 7;
        return `${['','周一','周二','周三','周四','周五','周六','周日'][day] || ''} ${app.periods[periodIndex]?.name || `第${periodIndex + 1}节`}`.trim();
    }
    function select(id, shouldEdit) { activeId = id; editing = shouldEdit; render(); }
    function applyEntryMode(mode) {
        const modal = $('memoModal');
        if (!modal) return;
        modal.classList.toggle('memo-sidebar-mode', mode === 'sidebar');
        // The always-on-top control is only relevant to the popup entry mode.
        // Keep the DOM state in sync as well as the CSS state so it is visible
        // in the popup window (and remains hidden for icon/sidebar modes).
        const pinToggle = $('memoPinToggle');
        if (pinToggle) pinToggle.hidden = mode !== 'popup';
    }
    async function save(memo) {
        try { const saved = await window.electronAPI.memos.save(memo); activeId = saved.id; editing = false; await reload(); render(); }
        catch (error) { window.showAppToast?.(`保存失败：${error.message || error}`); }
    }
    function startCoursePick(dueInput) {
        $('memoModal').style.display = 'none'; document.body.classList.add('memo-course-picking');
        const hint = document.createElement('div'); hint.className = 'memo-course-pick-hint'; hint.textContent = '请选择课表中的课程 / 节次（Esc 取消）'; document.body.append(hint);
        document.querySelectorAll('.cell').forEach(cell => cell.classList.add('memo-course-pickable'));
        const keyHandler = event => { if (event.key === 'Escape') finish(null); };
        const clickHandler = event => { const cell = event.target.closest('.cell'); if (!cell) return; event.preventDefault(); event.stopPropagation(); finish(cell); };
        function finish(cell) {
            document.removeEventListener('keydown', keyHandler, true); document.removeEventListener('click', clickHandler, true);
            document.body.classList.remove('memo-course-picking'); hint.remove(); document.querySelectorAll('.memo-course-pickable').forEach(item => item.classList.remove('memo-course-pickable'));
            $('memoModal').style.display = 'flex';
            if (!cell) return;
            const day = Number(cell.dataset.day), period = Number(cell.dataset.period), start = app.getWeekRange(app.currentDate).start;
            const date = new Date(start); date.setDate(date.getDate() + day - 1);
            const time = String(app.periods[period].time).split('-')[0]; date.setHours(Number(time.slice(0,2)), Number(time.slice(3,5)), 0, 0);
            dueInput.value = `${app.formatLocalDate(date)}T${time}`;
            const form = dueInput.closest('form'); form.dataset.cellRef = JSON.stringify({ key: app.buildCellKey(day, period), date: app.formatLocalDate(date), day, period });
            const courseValue = form.querySelector('.memo-course-picker input');
            if (courseValue) courseValue.value = courseLabelFor(form.dataset.cellRef);
            const course = dueInput.closest('.memo-form-row').querySelector('.memo-course-picker input');
            const selectedCourse = courseLabelFor(form.dataset.cellRef);
            course.value = selectedCourse;
            // Keep the visible value in sync even when the editor is wrapped in a
            // custom renderer or framework that observes input events.
            course.dispatchEvent(new Event('input', { bubbles: true }));
            course.dispatchEvent(new Event('change', { bubbles: true }));
        }
        document.addEventListener('keydown', keyHandler, true); document.addEventListener('click', clickHandler, true);
    }
    async function open(appInstance, memoId) {
        app = appInstance;
        if (!memoId && localStorage.getItem('memoEntryMode') === 'popup' && window.electronAPI?.openMemoWindow) {
            window.electronAPI.openMemoWindow();
            return;
        }
        $('memoModal').style.display = 'flex';
        applyEntryMode(localStorage.getItem('memoEntryMode') || 'icon');
        await reload();
        activeId = memoId || null; editing = false;
        if (memoId) { const memo = memos.find(item => item.id === memoId); if (memo) editing = false; }
        render();
    }
    function initialize(appInstance) {
        app = appInstance; app.memos = memos;
        $('memoEntryButton').addEventListener('click', () => open(app));
        $('memoCloseButton').addEventListener('click', () => { $('memoModal').style.display = 'none'; });
        $('memoModal').addEventListener('click', event => {
            if (event.target !== event.currentTarget) return;
            if (editing) { editing = false; render(); return; }
            event.currentTarget.style.display = 'none';
        });
        document.addEventListener('click', event => {
            const modal = $('memoModal');
            if (!modal || modal.style.display === 'none' || !modal.classList.contains('memo-sidebar-mode')) return;
            const panel = modal.querySelector('.memo-modal-content');
            if (panel && !panel.contains(event.target)) modal.style.display = 'none';
        }, true);
        $('memoSearchInput').addEventListener('input', render);
        const pinToggle = $('memoPinToggle');
        pinToggle?.setAttribute('aria-pressed', 'false');
        pinToggle?.addEventListener('click', async () => {
            // Always-on-top only applies to the dedicated popup window. The
            // same toolbar is also present in the main renderer, so guard
            // against toggling any other window.
            if (localStorage.getItem('memoEntryMode') !== 'popup'
                || !document.body.classList.contains('memo-window-mode')
                || !window.electronAPI?.toggleMemoWindowAlwaysOnTop) return;
            const result = await window.electronAPI.toggleMemoWindowAlwaysOnTop();
            const pinned = Boolean(result?.alwaysOnTop);
            pinToggle.classList.toggle('is-pinned', pinned);
            pinToggle.setAttribute('aria-pressed', String(pinned));
            pinToggle.title = pinned ? '取消置顶' : '置顶小窗';
            pinToggle.setAttribute('aria-label', pinToggle.title);
        });
        $('memoSearchToggle').addEventListener('click', () => { const panel = $('memoSearchPanel'); const opened = panel.classList.toggle('is-open'); $('memoSearchToggle').setAttribute('aria-expanded', String(opened)); if (opened) $('memoSearchInput').focus(); else { $('memoSearchInput').value = ''; render(); } });
        const viewToggle = $('memoViewToggle');
        const modes = ['icon', 'sidebar', 'popup'];
        const updateEntryMode = mode => {
            localStorage.setItem('memoEntryMode', mode);
            applyEntryMode(mode);
            viewToggle.title = `当前入口模式：${mode}`;
            viewToggle.setAttribute('aria-label', `当前入口模式：${mode}，点击切换`);
        };
        updateEntryMode(localStorage.getItem('memoEntryMode') || 'icon');
        viewToggle.addEventListener('click', () => {
            const current = localStorage.getItem('memoEntryMode') || 'icon';
            const next = modes[(modes.indexOf(current) + 1) % modes.length];
            updateEntryMode(next);
            $('memoModal').style.display = 'none';
            if (next === 'popup' && window.electronAPI?.openMemoWindow) window.electronAPI.openMemoWindow();
        });
        $('memoNewButton').addEventListener('click', () => { const now = new Date().toISOString(); activeId = 'new'; editing = true; color = palette[0]; const draft = { id: 'new', title: stamp(now), content: '', due: now, color, note: '', tags: [], done: false, createdAt: now }; memos = [draft, ...memos.filter(item => item.id !== 'new')]; render(); $('memoList').querySelector('textarea')?.focus(); });
        reload();
    }
    window.MemoFeature = { initialize, open };
})();
