const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');

// Replicate generateAllCups(2026) in JS for verification
function getDatesForWeekday(startDate, endDate, weekday) {
  const dates = [];
  const d = new Date(startDate);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  while (d <= endDate) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

function getCupMatchdays(year) {
  const cupStart = new Date(year, 6, 1);  // Jul 1
  const cupEnd   = new Date(year, 6, 31); // Jul 31
  const mondays    = getDatesForWeekday(cupStart, cupEnd, 1);
  const wednesdays = getDatesForWeekday(cupStart, cupEnd, 3);
  const fridays    = getDatesForWeekday(cupStart, cupEnd, 5);
  return [...mondays, ...wednesdays, ...fridays].sort();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

db.transaction(() => {
  const year = 2026;
  const cupName = 'Copa Italia';
  const cupType = 'national';
  const format = 'single_elimination';
  const country = 'Italy';

  console.log(`Generating ${cupName} for ${year}...`);

  const cupResult = db.prepare(`
    INSERT INTO cup_competitions (name, cup_type, format, country, year, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(cupName, cupType, format, country, year);

  const cupId = Number(cupResult.lastInsertRowid);
  const matchdays = getCupMatchdays(year);
  console.log('Matchdays in July:', matchdays);

  const tier3Teams = db.prepare('SELECT id FROM teams WHERE league_id IN (2, 3)').all();
  const teamsR1 = shuffle(tier3Teams.map(t => t.id));
  console.log(`Found ${teamsR1.length} teams for R1.`);

  const roundNames = [
    'Round 1',
    'Round 2 (Premier Entry)',
    'Round of 16',
    'Quarter Finals',
    'Semi Finals',
    'Grand Final'
  ];

  const roundIds = [];
  for (let i = 0; i < roundNames.length; i++) {
    const isFinal = roundNames[i] === 'Grand Final';
    const startDate = matchdays[i] || matchdays[matchdays.length - 1];
    const endDate = isFinal 
      ? (matchdays[i + 2] || matchdays[matchdays.length - 1]) 
      : startDate;

    const res = db.prepare(`
      INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
      VALUES (?, ?, ?, 'knockout', ?, ?, 'scheduled')
    `).run(cupId, i + 1, roundNames[i], startDate, endDate);
    roundIds.push(Number(res.lastInsertRowid));
  }

  const round1Id = roundIds[0];
  const dateR1 = matchdays[0];
  for (let i = 0; i < teamsR1.length; i += 2) {
    db.prepare(`
      INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(cupId, round1Id, teamsR1[i], teamsR1[i+1], dateR1);
  }
  
  console.log('Successfully generated cup fixtures for R1.');
})();

// Summary checks
const fixtureCount = db.prepare('SELECT COUNT(*) as c FROM cup_fixtures').get().c;
const roundCount = db.prepare('SELECT COUNT(*) as c FROM cup_rounds').get().c;
console.log(`Fixtures: ${fixtureCount}, Rounds: ${roundCount}`);

db.close();
