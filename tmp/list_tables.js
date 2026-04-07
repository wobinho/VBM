const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'spike-dynasty.db');
const db = new Database(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(JSON.stringify(tables, null, 2));
db.close();
