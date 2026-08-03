'use strict';

let nodeSqlite = null;
if (process.env.ORAGSCHEDULE_FORCE_BETTER_SQLITE3 !== '1') {
    try {
        nodeSqlite = require('node:sqlite');
    } catch (error) {
        if (error && error.code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && error.code !== 'MODULE_NOT_FOUND') throw error;
    }
}

if (nodeSqlite) {
    module.exports = {
        openDatabase(filePath, options = {}) {
            return new nodeSqlite.DatabaseSync(filePath, { readOnly: Boolean(options.readonly) });
        },
        backupDatabase(database, destinationPath) {
            return nodeSqlite.backup(database, destinationPath);
        },
        implementation: 'node:sqlite'
    };
} else {
    const BetterSqlite3 = require('better-sqlite3');
    module.exports = {
        openDatabase(filePath, options = {}) {
            return new BetterSqlite3(filePath, { readonly: Boolean(options.readonly) });
        },
        backupDatabase(database, destinationPath) {
            return database.backup(destinationPath);
        },
        implementation: 'better-sqlite3'
    };
}
