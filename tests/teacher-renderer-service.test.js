'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const calls = [];
const context = {
    window: {
        electronAPI: {
            teacher: {
                getSchedule: value => { calls.push(['getSchedule', value]); return ['session']; },
                markAttendance: value => { calls.push(['markAttendance', value]); return value; }
            }
        }
    }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'app-teacher-services.js'), 'utf8'), context);

(async () => {
    assert.strictEqual(context.window.TeacherAppService.isAvailable(), true);
    assert.deepStrictEqual(Array.from(await context.window.TeacherAppService.getSchedule({ from: '2026-08-01' })), ['session']);
    await context.window.TeacherAppService.markAttendance({ sessionId: 's1', studentId: 'p1', status: 'present' });
    assert.strictEqual(calls.length, 2);

    context.window.electronAPI = null;
    assert.strictEqual(context.window.TeacherAppService.isAvailable(), false);
    assert.strictEqual(await context.window.TeacherAppService.getSessionDetail('s1'), null);
    console.log('teacher renderer service tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
