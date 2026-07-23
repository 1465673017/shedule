const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.TimetableApp = function TimetableApp() {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'app-stats.js'), 'utf8'), { filename: 'app-stats.js' });

function makeApp(mode) {
    const app = new TimetableApp();
    app._chartGranularity = 'week';
    app._statsWeekMode = mode;
    app._statsDataRevision = 0;
    app._durationUnitMode = false;
    app.formatStatsChartAxisDate = TimetableApp.prototype.formatStatsChartAxisDate;
    app.collectLessonsForDate = date => [{ studentCount: date.getDate(), leaveCount: 0, absentCount: 0, auditionStudentCount: 0, lessonCount: 1, students: [], time: '' }];
    app.getLessonSegmentTypeStats = () => ({ totalMinutes: 0, typeStats: {} });
    return app;
}

const start = new Date(2026, 6, 1); // Wednesday
const end = new Date(2026, 6, 31);
const clipped = TimetableApp.prototype.collectChartSeriesData.call(makeApp('monthWeeks'), start, end);
assert.deepStrictEqual(clipped.groupStartDates.map(d => d.getDate()), [1, 6, 13, 20, 27]);
assert.deepStrictEqual(clipped.groupEndDates.map(d => d.getDate()), [5, 12, 19, 26, 31]);

const naturalRange = TimetableApp.prototype.getNaturalWeekStatsRange.call({}, start, end);
const natural = TimetableApp.prototype.collectChartSeriesData.call(makeApp('naturalWeeks'), naturalRange.start, naturalRange.end);
assert.strictEqual(natural.groupStartDates[0].getMonth(), 5);
assert.strictEqual(natural.groupStartDates[0].getDate(), 29);
assert.strictEqual(natural.groupEndDates[0].getDate(), 5);
assert.ok(natural.presentData[0] > clipped.presentData[0]);
console.log('week stats tests passed');
