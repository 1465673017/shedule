(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.TimetableDataSchema = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const SCHEMA_VERSION = 1;
    const APP_VERSION = '1.2.4';
    const STORAGE_KEYS = Object.freeze([
        'timetableData', 'timetableDataBackup', 'timetableDataBackupAt',
        'timetableSettings', 'timetableGrades', 'timetableSalarySettings'
    ]);

    function isObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function parseObject(input, label) {
        const value = typeof input === 'string' ? JSON.parse(input) : input;
        if (!isObject(value)) throw new Error(`${label}必须是 JSON 对象`);
        return value;
    }

    function readVersion(value) {
        if (!Object.prototype.hasOwnProperty.call(value, 'schemaVersion')) return 0;
        const version = Number(value.schemaVersion);
        if (!Number.isInteger(version) || version < 0) throw new Error('schemaVersion 无效');
        if (version > SCHEMA_VERSION) {
            throw new Error(`数据版本 ${version} 高于当前支持的版本 ${SCHEMA_VERSION}，请升级应用后重试`);
        }
        return version;
    }

    function normalizeTimetableData(input) {
        const value = parseObject(input, '课表数据');
        readVersion(value);
        return {
            ...value,
            schemaVersion: SCHEMA_VERSION,
            appVersion: typeof value.appVersion === 'string' ? value.appVersion : APP_VERSION,
            exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : null
        };
    }

    function stampTimetableData(data, now = new Date()) {
        return { ...data, schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, exportedAt: now.toISOString() };
    }

    function parseStoredJson(storage, key, fallback) {
        const raw = storage.getItem(key);
        if (!raw) return fallback;
        const value = JSON.parse(raw);
        return value == null ? fallback : value;
    }

    function createFullBackup(storage, now = new Date()) {
        const timetableRaw = storage.getItem('timetableData');
        const timetableData = timetableRaw
            ? stampTimetableData(normalizeTimetableData(timetableRaw), now)
            : stampTimetableData({}, now);
        return {
            schemaVersion: SCHEMA_VERSION,
            appVersion: APP_VERSION,
            exportedAt: now.toISOString(),
            type: 'class-schedule-full-backup',
            data: {
                timetableData,
                timetableSettings: parseStoredJson(storage, 'timetableSettings', {}),
                timetableGrades: parseStoredJson(storage, 'timetableGrades', []),
                timetableSalarySettings: parseStoredJson(storage, 'timetableSalarySettings', {}),
                timetableDataBackup: storage.getItem('timetableDataBackup'),
                timetableDataBackupAt: storage.getItem('timetableDataBackupAt')
            }
        };
    }

    function normalizeFullBackup(input) {
        const backup = parseObject(input, '备份文件');
        readVersion(backup);
        if (backup.type !== 'class-schedule-full-backup' || !isObject(backup.data)) {
            throw new Error('这不是完整课表备份文件');
        }
        const timetableData = normalizeTimetableData(backup.data.timetableData);
        if (!isObject(backup.data.timetableSettings)) throw new Error('备份中的设置数据无效');
        if (!Array.isArray(backup.data.timetableGrades)) throw new Error('备份中的年级数据无效');
        const timetableSalarySettings = backup.data.timetableSalarySettings === undefined
            ? {}
            : backup.data.timetableSalarySettings;
        if (!isObject(timetableSalarySettings)) throw new Error('备份中的工资设置数据无效');
        return { ...backup, data: { ...backup.data, timetableData, timetableSalarySettings } };
    }

    function restoreFullBackup(storage, input) {
        const backup = normalizeFullBackup(input);
        const previous = new Map(STORAGE_KEYS.map(key => [key, storage.getItem(key)]));
        const values = {
            timetableData: JSON.stringify(backup.data.timetableData),
            timetableSettings: JSON.stringify(backup.data.timetableSettings),
            timetableGrades: JSON.stringify(backup.data.timetableGrades),
            timetableSalarySettings: JSON.stringify(backup.data.timetableSalarySettings),
            timetableDataBackup: backup.data.timetableDataBackup,
            timetableDataBackupAt: backup.data.timetableDataBackupAt
        };
        try {
            STORAGE_KEYS.forEach(key => {
                const value = values[key];
                if (value === null || value === undefined || value === '') storage.removeItem(key);
                else storage.setItem(key, String(value));
            });
        } catch (error) {
            STORAGE_KEYS.forEach(key => {
                const value = previous.get(key);
                if (value === null) storage.removeItem(key);
                else storage.setItem(key, value);
            });
            throw error;
        }
        return backup;
    }

    return Object.freeze({
        APP_VERSION, SCHEMA_VERSION, STORAGE_KEYS, createFullBackup, normalizeFullBackup,
        normalizeTimetableData, restoreFullBackup, stampTimetableData
    });
});
