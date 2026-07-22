const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.TimetableApp = function TimetableApp() {};
vm.runInThisContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app-stats.js'), 'utf8'),
    { filename: 'app-stats.js' }
);

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
console.log('Week stats overview range test passed');
