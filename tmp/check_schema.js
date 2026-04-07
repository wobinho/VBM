const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');
const tables = ['cup_competitions', 'cup_rounds', 'cup_fixtures'];
tables.forEach(t => {
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(t);
  console.log(`Schema for ${t}:\n${schema.sql}\n`);
});
db.close();
