const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');

// Helper to format date
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// Helper to get Mon/Wed/Fri in July 2026
function getCupMatchdays(year) {
  const dates = [];
  const start = new Date(year, 6, 1); // July 1
  const end = new Date(year, 6, 31);
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day === 1 || day === 3 || day === 5) {
      dates.push(toDateStr(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates.sort();
}

db.transaction(() => {
  // 1. Wipe existing
  db.prepare('DELETE FROM cup_fixtures').run();
  db.prepare('DELETE FROM cup_rounds').run();
  db.prepare('DELETE FROM cup_competitions').run();

  const year = 2026;
  const matchdays = getCupMatchdays(year);
  
  // 2. Insert Competition
  const cupRes = db.prepare(`
    INSERT INTO cup_competitions (name, cup_type, format, country, year, status)
    VALUES ('Copa Italia', 'national', 'single_elimination', 'Italy', 2026, 'active')
  `).run();
  const cupId = cupRes.lastInsertRowid;

  // 3. Insert Rounds
  const roundNames = ['Round 1', 'Round 2', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Grand Final'];
  const roundIds = [];
  roundNames.forEach((name, i) => {
    const start = matchdays[i];
    const end = name === 'Grand Final' ? matchdays[i+2] : start;
    const res = db.prepare(`
      INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
      VALUES (?, ?, ?, 'knockout', ?, ?, 'scheduled')
    `).run(cupId, i + 1, name, start, end);
    roundIds.push(res.lastInsertRowid);
  });

  // 4. Seed Round 1 (North/South teams)
  const tier3Teams = db.prepare('SELECT id FROM teams WHERE league_id IN (2, 3)').all().map(t => t.id);
  // Shuffle basic
  for (let i = tier3Teams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tier3Teams[i], tier3Teams[j]] = [tier3Teams[j], tier3Teams[i]];
  }

  const r1Id = roundIds[0];
  const dateR1 = matchdays[0];
  for (let i = 0; i < tier3Teams.length; i += 2) {
    db.prepare(`
      INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(cupId, r1Id, tier3Teams[i], tier3Teams[i+1], dateR1);
  }

  console.log('Force-regenerated Copa Italia 2026 with July schedule.');
})();

db.close();
