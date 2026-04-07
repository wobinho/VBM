const { getDb } = require('../src/lib/db/index');
try {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(JSON.stringify(tables, null, 2));
} catch (e) {
  console.error(e);
}
