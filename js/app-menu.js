// 菜单按钮下拉菜单：点击展开一个以按钮为右上角的弹出菜单。
// 注意：本逻辑必须放在外部文件 —— 页面 CSP 为 script-src 'self'，内联脚本会被拦截。
(() => {
    'use strict';

    const button = document.querySelector('.menu-trigger');
    if (!button) return;

    let menu = null;
    let shortcuts = [];
    let editingShortcutId = null;
    const systemFileIcons = new Map();

    const saveShortcuts = async () => {
        try { await window.electronAPI.saveNavigationShortcuts(shortcuts); }
        catch (error) { window.showAppToast?.(`保存导航失败：${error.message || error}`); }
    };

    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const getTargetName = target => {
        const value = String(target || '').trim().replace(/[\\/]+$/, '');
        if (!value || /^https?:\/\//i.test(value)) return '';
        const withoutQuery = value.split(/[?#]/, 1)[0];
        const lastSegment = withoutQuery.split(/[\\/]/).filter(Boolean).pop() || '';
        try { return decodeURIComponent(lastSegment); } catch (_) { return lastSegment; }
    };
    const renderShortcutList = () => {
        const list = document.getElementById('navigationShortcutList');
        if (!list) return;
        list.replaceChildren();
        shortcuts.forEach(shortcut => {
            const row = document.createElement('div');
            row.className = 'navigation-shortcut-saved-item';
            const icon = shortcut.icon || systemFileIcons.get(shortcut.target) || '';
            row.innerHTML = `<span class="navigation-shortcut-saved-icon">${icon ? `<img src="${icon}" alt="">` : '↗'}</span><span class="navigation-shortcut-saved-text"><strong>${escapeHtml(shortcut.title)}</strong><small>${escapeHtml(shortcut.target)}</small></span><div class="navigation-shortcut-item-actions"><button type="button" class="navigation-shortcut-edit" aria-label="编辑 ${escapeHtml(shortcut.title)}">编辑</button><button type="button" class="navigation-shortcut-delete" aria-label="删除 ${escapeHtml(shortcut.title)}">删除</button></div>`;
            row.querySelector('.navigation-shortcut-edit').addEventListener('click', () => {
                editingShortcutId = shortcut.id;
                document.getElementById('navigationShortcutTitleInput').value = shortcut.title;
                document.getElementById('navigationShortcutTargetInput').value = shortcut.target;
                document.getElementById('navigationShortcutIconButton').dataset.icon = shortcut.icon || '';
                const preview = document.getElementById('navigationShortcutIconPreview');
                const previewIcon = shortcut.icon || systemFileIcons.get(shortcut.target) || '';
                preview.innerHTML = previewIcon ? `<img src="${previewIcon}" alt="">` : '＋';
                document.getElementById('navigationShortcutAddButton').textContent = '保存修改';
                document.getElementById('navigationShortcutTitleInput').focus();
            });
            row.querySelector('.navigation-shortcut-delete').addEventListener('click', async () => {
                shortcuts = shortcuts.filter(item => item.id !== shortcut.id);
                await saveShortcuts();
                renderShortcutList();
                renderMenuItems();
            });
            list.appendChild(row);
        });
    };

    const renderMenuItems = () => {
        if (!menu) return;
        const list = menu.querySelector('.app-menu-list');
        list.replaceChildren();
        const addItem = (label, icon, run, extraClass = '') => {
            const entry = document.createElement('button');
            entry.type = 'button';
            entry.className = `app-menu-item ${extraClass}`.trim();
            entry.setAttribute('role', 'menuitem');
            entry.setAttribute('aria-label', label);
            entry.title = label;
            entry.innerHTML = `${icon}<span>${escapeHtml(label)}</span>`;
            entry.addEventListener('click', () => { closeMenu(true); run(); });
            list.appendChild(entry);
        };
        addItem('课时统计', '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V11M10 20V4M16 20v-7M22 20V8M2 20h21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="8" r="1.5" fill="currentColor"/></svg>', () => app.openStatsModal(app.currentDate));
        shortcuts.forEach(shortcut => {
            const resolvedIcon = shortcut.icon || systemFileIcons.get(shortcut.target) || '';
            addItem(shortcut.title, resolvedIcon ? `<img src="${escapeHtml(resolvedIcon)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><svg hidden viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="2"/></svg>` : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', async () => {
                try { await window.electronAPI.openNavigationShortcut(shortcut.target); }
                catch (error) { window.showAppToast?.(`无法打开导航目标：${error.message || error}`); }
            });
        });
        addItem('添加导航', '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', () => { editingShortcutId = null; resetShortcutForm(); openShortcutModal(); }, 'app-menu-add-shortcut');
        positionMenu();
    };

    const openShortcutModal = () => {
        const modal = document.getElementById('navigationShortcutModal');
        if (!modal) return;
        modal.style.display = 'flex';
        renderShortcutList();
    };

    const resetShortcutForm = () => {
        document.getElementById('navigationShortcutTitleInput').value = '';
        document.getElementById('navigationShortcutTargetInput').value = '';
        document.getElementById('navigationShortcutIconButton').dataset.icon = '';
        document.getElementById('navigationShortcutIconPreview').textContent = '＋';
        document.getElementById('navigationShortcutAddButton').textContent = '添加到菜单';
    };

    const initShortcutManager = async () => {
        shortcuts = await window.electronAPI.loadNavigationShortcuts().catch(() => []);
        await Promise.all(shortcuts.filter(item => !item.icon && !/^https?:\/\//i.test(item.target)).map(async item => {
            const result = await window.electronAPI.getNavigationShortcutFileIcon(item.target).catch(() => null);
            if (result?.dataUrl) systemFileIcons.set(item.target, result.dataUrl);
        }));
        document.getElementById('navigationShortcutIconButton')?.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.chooseNavigationShortcutIcon();
                if (result?.dataUrl) {
                    document.getElementById('navigationShortcutIconPreview').innerHTML = `<img src="${result.dataUrl}" alt="">`;
                    document.getElementById('navigationShortcutIconButton').dataset.icon = result.dataUrl;
                }
            } catch (error) { window.showAppToast?.(`选择图片失败：${error.message || error}`); }
        });
        const browseForTarget = async mode => {
            try {
                const result = await window.electronAPI.chooseNavigationShortcutTarget(mode);
                if (result?.target) {
                    document.getElementById('navigationShortcutTargetInput').value = result.target;
                    if (mode === 'file' && !document.getElementById('navigationShortcutIconButton').dataset.icon) {
                        const icon = await window.electronAPI.getNavigationShortcutFileIcon(result.target).catch(() => null);
                        if (icon?.dataUrl) {
                            systemFileIcons.set(result.target, icon.dataUrl);
                            document.getElementById('navigationShortcutIconPreview').innerHTML = `<img src="${icon.dataUrl}" alt="">`;
                        }
                    }
                }
            } catch (error) { window.showAppToast?.(`选择位置失败：${error.message || error}`); }
        };
        document.getElementById('navigationShortcutBrowseButton')?.addEventListener('click', () => browseForTarget('file'));
        document.getElementById('navigationShortcutBrowseFolderButton')?.addEventListener('click', () => browseForTarget('folder'));
        document.getElementById('navigationShortcutAddButton')?.addEventListener('click', async () => {
            const titleInput = document.getElementById('navigationShortcutTitleInput');
            const targetInput = document.getElementById('navigationShortcutTargetInput');
            const target = targetInput.value.trim();
            const title = titleInput.value.trim() || getTargetName(target);
            if (!target || !title) { window.showAppToast?.('请输入有效的本机位置，或为网页链接填写标题'); return; }
            let icon = document.getElementById('navigationShortcutIconButton').dataset.icon || '';
            if (!icon && !/^https?:\/\//i.test(target)) {
                const result = await window.electronAPI.getNavigationShortcutFileIcon(target).catch(() => null);
                icon = result?.dataUrl || '';
                if (icon) systemFileIcons.set(target, icon);
            }
            if (editingShortcutId) {
                const index = shortcuts.findIndex(item => item.id === editingShortcutId);
                if (index >= 0) shortcuts[index] = { ...shortcuts[index], title, target, icon };
                editingShortcutId = null;
            } else {
                shortcuts.push({ id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`), title, target, icon });
            }
            await saveShortcuts();
            resetShortcutForm();
            renderShortcutList();
            renderMenuItems();
        });
        app.closeNavigationShortcutModal = () => { document.getElementById('navigationShortcutModal').style.display = 'none'; };
        document.getElementById('navigationShortcutCloseButton')?.addEventListener('click', app.closeNavigationShortcutModal);
        document.getElementById('navigationShortcutModal')?.addEventListener('click', event => {
            if (event.target === event.currentTarget) app.closeNavigationShortcutModal();
        });
    };

    const closeMenu = (restoreFocus = false) => {
        if (!menu) return;
        const closing = menu;
        // 先置空再移除：remove() 会触发被移除节点上的 focusout（relatedTarget 为 null），
        // 此时 focusout 处理器会误判为“焦点移出菜单”而再次 closeMenu，对已脱离文档的节点重复 remove() 会抛错
        menu = null;
        closing.remove();
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) button.focus();
    };

    // 菜单按钮作为弹出窗口的右上角：右边缘与按钮对齐，向下展开，并保持在视口内
    const positionMenu = () => {
        if (!menu) return;
        const rect = button.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const gap = 8;
        menu.style.left = `${Math.max(8, Math.min(rect.right - menuRect.width, window.innerWidth - menuRect.width - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(rect.bottom + gap, window.innerHeight - menuRect.height - 8))}px`;
    };

    const buildMenu = () => {
        menu = document.createElement('div');
        menu.className = 'app-menu-popover';
        menu.id = 'appMenuPopover';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', '菜单');

        const list = document.createElement('div');
        list.className = 'app-menu-list';
        menu.appendChild(list);
        document.body.appendChild(menu);
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-controls', menu.id);
        renderMenuItems();
        positionMenu();
    };

    button.addEventListener('click', () => {
        // 按钮被隐藏（如备忘录独立窗口）时不弹出
        if (!button.offsetWidth && !button.offsetHeight) return;
        if (menu) { closeMenu(); return; }
        buildMenu();
    });

    document.addEventListener('pointerdown', event => {
        if (menu && !menu.contains(event.target) && !button.contains(event.target)) closeMenu();
    });

    document.addEventListener('focusout', event => {
        if (menu && !menu.contains(event.relatedTarget) && !button.contains(event.relatedTarget)) closeMenu();
    });

    document.addEventListener('keydown', event => {
        if (!menu) return;
        if (event.key === 'Escape') { closeMenu(true); return; }
        const items = Array.from(menu.querySelectorAll('.app-menu-item'));
        if (!items.length) return;
        const index = items.indexOf(document.activeElement);
        let next = -1;
        if (event.key === 'ArrowDown') next = (index + 1) % items.length;
        else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = items.length - 1;
        if (next !== -1) {
            event.preventDefault();
            items[next].focus();
        }
    });

    window.addEventListener('resize', () => { if (menu) positionMenu(); });
    window.addEventListener('scroll', () => { if (menu) positionMenu(); }, true);
    initShortcutManager();
})();
