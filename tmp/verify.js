const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');

// Check the results of my changes
console.log('--- Checking Standings and Regions ---');
const teams = db.prepare('SELECT id, team_name, region FROM teams WHERE league_id = 1').all();
const regions = teams.reduce((acc, t) => {
  acc[t.region] = (acc[t.region] || 0) + 1;
  return acc;
}, {});
console.log('League 1 Teams per Region:', regions);

console.log('\n--- Checking Playoff Schedule for 2026 ---');
// I'll manually run the getPlayoffRoundDates logic to see if it matches my expectation
const start = new Date(2026, 4, 1);
const end = new Date(2026, 5, 30);
const all = [];
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  if ([1, 3, 5].includes(d.getDay())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    all.push(`${y}-${m}-${day}`);
  }
}
console.log('Round 1 (May):', all.slice(0, 5));
console.log('Round 2 (June):', all.slice(6, 11));

db.close();
