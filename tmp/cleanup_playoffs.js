const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');
const result = db.prepare('DELETE FROM playoff_games WHERE game_number > 3 AND status = "scheduled"').run();
console.log(`Deleted ${result.changes} extra playoff games.`);
db.close();
