const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');
const teams = db.prepare('SELECT id, team_name, league_id, region FROM teams WHERE league_id = 1').all();
console.log(JSON.stringify(teams, null, 2));
db.close();
