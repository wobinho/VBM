const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');
const fixtures = db.prepare('SELECT id, scheduled_date, status, home_team_id, away_team_id FROM cup_fixtures ORDER BY scheduled_date ASC').all();
console.log(JSON.stringify(fixtures, null, 2));
db.close();
