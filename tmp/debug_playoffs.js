const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');
const leagues = db.prepare(`
    SELECT l.id, l.league_name, lc.config
    FROM leagues l
    LEFT JOIN league_configs lc ON lc.league_id = l.id
`).all();
console.log('Leagues Config Debug:');
leagues.forEach(l => {
    console.log(`ID: ${l.id}, Name: ${l.league_name}`);
    if (l.config) {
        const parsed = JSON.parse(l.config);
        console.log(`  Format Type: ${parsed.format?.type}`);
    } else {
        console.log('  No config found');
    }
});

const playoffCount = db.prepare('SELECT COUNT(*) as c FROM playoff_series').get();
console.log('Total Playoff Series:', playoffCount.c);

const incompleteFixtures = db.prepare('SELECT COUNT(*) as c FROM fixtures WHERE status != "completed"').get();
console.log('Incomplete Regular Fixtures:', incompleteFixtures.c);

db.close();
