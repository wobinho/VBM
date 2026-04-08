const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cup_fixtures'").get();
console.log(schema.sql);
db.close();
