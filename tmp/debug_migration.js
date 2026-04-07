const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'spike-dynasty.db');
const db = new Database(dbPath);
const cupCompetitionsCheck = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='cup_competitions'"
).get();
console.log('cupCompetitionsCheck:', cupCompetitionsCheck);
db.close();
