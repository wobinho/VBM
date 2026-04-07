const { getDb } = require('../src/lib/db/index');
try {
  console.log('Initializing DB...');
  const db = getDb();
  console.log('DB Initialized successfully.');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));
  const leagueCols = db.prepare("PRAGMA table_info(leagues)").all();
  console.log('Leagues columns:', leagueCols.map(c => c.name).join(', '));
} catch (e) {
  console.error('Error during DB initialization:', e);
  process.exit(1);
}
