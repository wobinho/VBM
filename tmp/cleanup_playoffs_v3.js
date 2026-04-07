const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');
try {
  const result = db.prepare("DELETE FROM playoff_games WHERE game_number > 3 AND status = 'scheduled'").run();
  console.log('Successfully deleted', result.changes, 'games');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  db.close();
}
