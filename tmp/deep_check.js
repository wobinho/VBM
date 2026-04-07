const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');
const configs = db.prepare('SELECT * FROM league_configs').all();
console.log('League Configs Table Content:', configs);
const leagues = db.prepare('SELECT id, league_name, tier FROM leagues').all();
console.log('Leagues Table Content:', leagues);
db.close();
