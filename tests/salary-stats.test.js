const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.window = global;
global.TimetableApp = function TimetableApp() {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'app-stats.js'), 'utf8'), { filename: 'app-stats.js' });

const app = new TimetableApp();
app.getSalaryStarBonus = TimetableApp.prototype.getSalaryStarBonus;
app.getSalarySettings = () => ({ basePay: 3800, starLevel: 0, basicHours: 8 });

const juniorLesson = {
    typeStats: { '1v1': 600 },
    students: [{ id: 's1', grade: '初中', isAudition: false }]
};
let result = TimetableApp.prototype.calculateSalaryStats.call(app, [juniorLesson]);
assert.strictEqual(result.weightedHours, 10);
assert.strictEqual(result.paidHours, 2);
assert.strictEqual(result.coursePay, 80);
assert.strictEqual(result.grossPay, 3880);

app.getSalarySettings = () => ({ basePay: 3800, starLevel: 1, basicHours: 8 });
result = TimetableApp.prototype.calculateSalaryStats.call(app, [juniorLesson]);
assert.strictEqual(result.coursePay, 90, 'one-star bonus should raise the first tier from 40 to 45');

const highOneLesson = {
    typeStats: { '1v1': 600 },
    students: [{ id: 's2', grade: '高一', isAudition: false }]
};
result = TimetableApp.prototype.calculateSalaryStats.call(app, [highOneLesson]);
assert.strictEqual(result.weightedHours, 12, 'high-one grade factor should be 1.2');

app._statsDailyLessonCache = new Map([['x', {}]]);
app._statsAggregateCache = new Map([['x', {}]]);
TimetableApp.prototype.invalidateStatsCache.call(app);
assert.strictEqual(app._statsDailyLessonCache.size, 0);
assert.strictEqual(app._statsAggregateCache.size, 0);

console.log('Salary and stats cache tests passed');
