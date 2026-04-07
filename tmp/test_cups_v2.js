
const { getDb } = require('./src/lib/db/index');
const { generateAllCups } = require('./src/lib/cup-engine');

try {
  const db = getDb();
  console.log('Generating cups for 2026 (Run 1)...');
  generateAllCups(2026);
  console.log('Run 1 Success!');

  console.log('Generating cups for 2026 (Run 2 - should skip/ignore)...');
  generateAllCups(2026);
  console.log('Run 2 Success (No crash)!');

  const cups = db.prepare('SELECT id, name FROM cup_competitions WHERE year = 2026').all();
  console.log('Cups in DB:', cups);

  const rounds = db.prepare('SELECT COUNT(*) as c FROM cup_rounds WHERE cup_id = ?').get(cups[0].id);
  console.log('Rounds for first cup:', rounds.c);

} catch (err) {
  console.error('FAILED:', err);
  process.exit(1);
}
