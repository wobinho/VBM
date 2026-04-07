const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');
const cups = db.prepare('SELECT id, name, cup_type FROM cup_competitions').all();
console.log(JSON.stringify(cups, null, 2));
db.close();
