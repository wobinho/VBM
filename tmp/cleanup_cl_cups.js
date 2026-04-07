const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');

console.log('Cleaning up non-National cup data...');

const execute = db.transaction(() => {
  // Get cup IDs for CL and Secondary
  const cups = db.prepare("SELECT id, name FROM cup_competitions WHERE cup_type IN ('cl', 'secondary')").all();
  const cupIds = cups.map(c => c.id);

  if (cupIds.length === 0) {
    console.log('No CL or Secondary cups found.');
    return;
  }

  console.log(`Found ${cupIds.length} cups to remove:`, cups.map(c => c.name).join(', '));

  // Delete from child tables first
  const queryParams = cupIds.map(() => '?').join(',');

  db.prepare(`DELETE FROM cup_fixtures WHERE cup_id IN (${queryParams})`).run(...cupIds);
  db.prepare(`DELETE FROM cup_group_teams WHERE group_id IN (SELECT id FROM cup_groups WHERE round_id IN (SELECT id FROM cup_rounds WHERE cup_id IN (${queryParams})))`).run(...cupIds);
  db.prepare(`DELETE FROM cup_groups WHERE round_id IN (SELECT id FROM cup_rounds WHERE cup_id IN (${queryParams}))`).run(...cupIds);
  db.prepare(`DELETE FROM cup_rounds WHERE cup_id IN (${queryParams})`).run(...cupIds);
  
  // Delete the competitions themselves
  db.prepare(`DELETE FROM cup_competitions WHERE id IN (${queryParams})`).run(...cupIds);
});

execute();

console.log('Cleanup complete.');
db.close();
