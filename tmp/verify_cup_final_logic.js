const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');

// Mimic getCupMatchdays from schedule-engine.ts
function getCupMatchdays(year) {
  const dates = [];
  const start = new Date(year, 6, 1); // July 1
  const end = new Date(year, 6, 31);
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day === 1 || day === 3 || day === 5) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates.sort();
}

function test() {
  const year = 2026;
  const matchdays = getCupMatchdays(year);

  console.log('--- Cleaning DB ---');
  db.prepare('DELETE FROM cup_fixtures').run();
  db.prepare('DELETE FROM cup_rounds').run();
  db.prepare('DELETE FROM cup_competitions').run();

  const cupRes = db.prepare(`
    INSERT INTO cup_competitions (name, cup_type, format, country, year, status)
    VALUES ('Copa Italia Test', 'national', 'single_elimination', 'Italy', ?, 'active')
  `).run(year);
  const cupId = cupRes.lastInsertRowid;

  const roundIds = [];
  const roundNames = ['Round 1', 'Round 2', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Grand Final'];
  roundNames.forEach((name, i) => {
    const start = matchdays[i];
    const end = name === 'Grand Final' ? matchdays[i+1] : start;
    const res = db.prepare(`
      INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
      VALUES (?, ?, ?, 'knockout', ?, ?, 'scheduled')
    `).run(cupId, i + 1, name, start, end);
    roundIds.push(res.lastInsertRowid);
  });

  const finalRoundId = roundIds[roundNames.length - 1];
  const team1 = 1, team2 = 2;

  function mockRecordAndAdvance(fixtureId, winnerId, sets) {
    try {
      db.prepare("UPDATE cup_fixtures SET status = 'completed', winner_team_id = ?, home_sets = ?, away_sets = ? WHERE id = ?")
        .run(winnerId, sets[0], sets[1], fixtureId);
    } catch (e) {
      console.error('SQL Error:', e.message);
      throw e;
    }

    const fixtures = db.prepare('SELECT * FROM cup_fixtures WHERE round_id = ?').all(finalRoundId);
    const wins1 = fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team1).length;
    const wins2 = fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team2).length;

    if (wins1 >= 2 || wins2 >= 2) {
      console.log('Series won!');
      db.prepare("UPDATE cup_rounds SET status = 'completed' WHERE id = ?").run(finalRoundId);
      db.prepare("UPDATE cup_fixtures SET status = 'completed' WHERE round_id = ? AND status = 'scheduled'").run(finalRoundId);
    } else if (wins1 === 1 && wins2 === 1) {
      if (fixtures.length === 2) {
          console.log('Series tied 1-1, scheduling Game 3!');
          db.prepare(`
            INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
            VALUES (?, ?, ?, ?, ?, 'scheduled')
          `).run(cupId, finalRoundId, team1, team2, matchdays[7]);
      }
    }
  }

  console.log('Scenario A: 2-0 Sweep');
  for (let g = 0; g < 2; g++) {
    db.prepare(`
      INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(cupId, finalRoundId, team1, team2, matchdays[5 + g]);
  }
  let finalFixtures = db.prepare('SELECT id FROM cup_fixtures WHERE round_id = ?').all(finalRoundId);
  mockRecordAndAdvance(finalFixtures[0].id, 1, [3,0]);
  mockRecordAndAdvance(finalFixtures[1].id, 1, [3,0]);
  let count = db.prepare('SELECT id FROM cup_fixtures WHERE round_id = ?').all(finalRoundId).length;
  console.log(`Fixtures after 2-0: ${count}`);

  console.log('Scenario B: 1-1 Tie');
  db.prepare('DELETE FROM cup_fixtures WHERE round_id = ?').run(finalRoundId);
  for (let g = 0; g < 2; g++) {
    db.prepare(`
      INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(cupId, finalRoundId, team1, team2, matchdays[5 + g]);
  }
  finalFixtures = db.prepare('SELECT id FROM cup_fixtures WHERE round_id = ?').all(finalRoundId);
  mockRecordAndAdvance(finalFixtures[0].id, 1, [3,0]);
  mockRecordAndAdvance(finalFixtures[1].id, 2, [0,3]);
  count = db.prepare('SELECT id FROM cup_fixtures WHERE round_id = ?').all(finalRoundId).length;
  console.log(`Fixtures after 1-1: ${count}`);

  if (count === 3) console.log('✅ PASS'); else console.log('❌ FAIL');
}

test();
db.close();
