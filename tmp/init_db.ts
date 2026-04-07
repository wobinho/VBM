// Force DB initialization and migration
import { getDb } from './src/lib/db/index';
const db = getDb();
console.log('DB Initialized and Migrations run.');
const leagues = db.prepare('SELECT id, league_name, tier FROM leagues').all();
console.log('Leagues:', leagues);
const configs = db.prepare('SELECT league_id FROM league_configs').all();
console.log('Configs for league IDs:', configs);
db.close();
