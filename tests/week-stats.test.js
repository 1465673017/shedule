const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.TimetableApp = function TimetableApp() {};
vm.runInThisContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app-stats.js'), 'utf8'),
    { filename: 'app-stats.js' }
);

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

const inputs = {
    statsStartDate: { value: '2026-07-01' },
    statsEndDate: { value: '2026-07-31' }
};
global.document = { getElementById: id => inputs[id] };

const formatDate = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const app = new TimetableApp();
app._statsDate = new Date('2026-07-10T00:00:00');
app._statsWeekMode = 'monthWeeks';
app._statsDataRevision = 0;
app.collectLessonsForDate = () => [];
app.formatStatsChartAxisDate = date => date.toISOString().slice(0, 10);

const clippedSeries = app.collectChartSeriesData(
    new Date('2026-07-01T00:00:00'),
    new Date('2026-07-31T00:00:00'),
    'week'
);
assert.deepStrictEqual(
    clippedSeries.groupStartDates.slice(0, 2).map(formatDate),
    ['2026-07-01', '2026-07-06']
);
assert.deepStrictEqual(
    clippedSeries.groupEndDates.slice(0, 2).map(formatDate),
    ['2026-07-05', '2026-07-12']
);
app.updateStatsHeader = () => {};
app.getStatsViewSubtitle = () => '';
app.renderStatsCards = () => ({});
app.updateStatsOverview = () => {};
app.renderStatsByGrade = () => {};
app.renderCharts = () => {};

const aggregateRanges = [];
app.aggregateLessons = (start, end) => {
    aggregateRanges.push([formatDate(start), formatDate(end)]);
    return [];
};
app.collectChartSeriesData = () => ({
    groupStartDates: [new Date('2026-07-01'), new Date('2026-07-06')],
    groupEndDates: [new Date('2026-07-05'), new Date('2026-07-12')]
});

app.renderWeekStats();
assert.deepStrictEqual(aggregateRanges[1], ['2026-07-06', '2026-07-12']);
console.log('week stats tests passed');
