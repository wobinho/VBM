const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');
const rows = db.prepare('SELECT * FROM leagues').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
