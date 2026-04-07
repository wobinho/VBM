const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');
const state = db.prepare('SELECT * FROM game_state WHERE id = 1').get();
console.log('Current Date:', state.current_date);
const league1Seasons = db.prepare('SELECT id, status, year FROM seasons WHERE league_id = 1').all();
console.log('League 1 Seasons:', league1Seasons);
db.close();
