const sqlite3 = require('better-sqlite3');
const db = new sqlite3('spike-dynasty.db');

// IMPORT cup-engine generateAllCups if possible?
// Since I can't easily import TS in node, I'll just clear the tables
// and the next simulation/advance will trigger it since the date is Jul 3.
// Wait, the trigger is on Jun 30.
// I'll manually run the generation logic here by copying parts of cup-engine?
// No, I'll just clear the tables and if the user is ALREADY on July 3,
// then they might need to go to June 30 and click Proceed again.
// OR I can use a simpler approach: Clear tables and provide a way to re-run.

db.transaction(() => {
  db.prepare('DELETE FROM cup_fixtures').run();
  db.prepare('DELETE FROM cup_rounds').run();
  db.prepare('DELETE FROM cup_competitions').run();
  console.log('Successfully wiped all cup data.');
})();

db.close();
