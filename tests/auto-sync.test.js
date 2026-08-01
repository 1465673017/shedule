const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const context = {
    window: {},
    document: { addEventListener() {} },
    localStorage: {},
    setInterval() {},
    clearInterval() {},
    console
};
vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app-core.js'), 'utf8'),
    context,
    { filename: 'app-core.js' }
);

const app = Object.create(vm.runInContext('TimetableApp.prototype', context));
app.formatLocalDate = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
app.addDays = (date, amount) => {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
};

const now = new Date(2026, 7, 1, 9, 0, 0);
assert.deepStrictEqual(
    { ...app.getCourseAutoSyncRange(now, 0) },
    {
        startDate: '2026-07-30',
        endDate: '2026-08-01',
        automatic: true,
        attendanceOnly: true
    },
    'the first automatic sync of the day should include today and the previous two days'
);
assert.strictEqual(
    app.getCourseAutoSyncRange(now, new Date(2026, 7, 1, 7, 0, 0).getTime()).startDate,
    '2026-08-01',
    'later automatic syncs on the same day should only include today'
);
assert.strictEqual(
    app.getCourseAutoSyncRange(now, new Date(2026, 6, 31, 23, 30, 0).getTime()).startDate,
    '2026-07-30',
    'a run on the previous calendar day should not suppress the daily three-day sync'
);

console.log('Auto-sync tests passed');
