const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');
const state = db.prepare('SELECT current_date FROM game_state LIMIT 1').get();
console.log(state.current_date);
db.close();
