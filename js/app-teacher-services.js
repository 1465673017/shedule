// Renderer adapter for the normalized teacher application services.
(function (global) {
    'use strict';

    function api() {
        return global.electronAPI && global.electronAPI.teacher;
    }

    function invoke(method, ...args) {
        const teacherApi = api();
        if (!teacherApi || typeof teacherApi[method] !== 'function') return Promise.resolve(null);
        return Promise.resolve(teacherApi[method](...args));
    }

    global.TeacherAppService = Object.freeze({
        isAvailable() { return !!api(); },
        getSchedule(range) { return invoke('getSchedule', range || {}); },
        getSessionDetail(sessionId) { return invoke('getSessionDetail', String(sessionId)); },
        markAttendance(input) { return invoke('markAttendance', input); },
        setActualMinutes(input) { return invoke('setActualMinutes', input); },
        completeSession(sessionId) { return invoke('completeSession', String(sessionId)); }
    });
})(window);
