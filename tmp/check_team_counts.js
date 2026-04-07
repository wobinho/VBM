const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');
const counts = db.prepare('SELECT league_id, count(*) as count FROM teams GROUP BY league_id').all();
console.log(JSON.stringify(counts, null, 2));
db.close();
