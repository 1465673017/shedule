const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.TimetableApp = function TimetableApp() {};
vm.runInThisContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app-timetable.js'), 'utf8'),
    { filename: 'app-timetable.js' }
);

const app = new TimetableApp();
app.periods = [
    { time: '08:00-10:00' },
    { time: '10:10-12:10' },
    { time: '13:00-14:30' }
];
app.timeToMinutes = time => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

for (const [time, expectedPeriod] of [
    ['00:00', 0],
    ['07:59', 0],
    ['08:00', 0],
    ['09:59', 0],
    ['10:00', 0],
    ['10:09', 0],
    ['10:10', 1],
    ['12:09', 1],
    ['12:10', 1],
    ['12:59', 1],
    ['13:00', 2],
    ['14:30', 2],
    ['23:59', 2]
]) {
    const [hours, minutes] = time.split(':').map(Number);
    assert.strictEqual(
        app.getMemoPeriodIndexForTime(hours * 60 + minutes),
        expectedPeriod,
        `${time} should belong to period ${expectedPeriod}`
    );
}

console.log('Memo period range tests passed');
