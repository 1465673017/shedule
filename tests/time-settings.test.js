const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.TimetableApp = function TimetableApp() {};
let durationInputValue = '75';
global.document = {
    getElementById(id) {
        return id === 'periodDuration' && durationInputValue !== null
            ? { value: durationInputValue }
            : null;
    }
};

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-time.js'), 'utf8');
vm.runInThisContext(source, { filename: 'app-time.js' });

function makeApp(periods = []) {
    const app = new TimetableApp();
    app.periods = periods;
    app.renderPeriods = () => {};
    app.timeToMinutes = time => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    return app;
}

const app = makeApp([{ name: '第1节', time: '08:00-08:40' }]);
app.quickSettingsState = { periodDuration: 60 };
app.addPeriodToEnd();
assert.strictEqual(
    app.periods[1].time,
    '08:40-09:55',
    'advanced add should use the current quick-setting duration input'
);

durationInputValue = null;
const savedSettingsApp = makeApp([{ name: '第1节', time: '08:00-08:40' }]);
savedSettingsApp.quickSettingsState = { periodDuration: 60 };
savedSettingsApp.insertPeriodAfter(0);
assert.strictEqual(
    savedSettingsApp.periods[1].time,
    '08:40-09:40',
    'advanced insert should fall back to the saved quick-setting duration'
);

const inferredDurationApp = makeApp([{ name: '第1节', time: '08:00-08:50' }]);
inferredDurationApp.addPeriodToEnd();
assert.strictEqual(
    inferredDurationApp.periods[1].time,
    '08:50-09:40',
    'advanced add should infer duration from existing periods when quick settings are unavailable'
);

console.log('Time settings tests passed');
