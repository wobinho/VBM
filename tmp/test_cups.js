
const { getDb } = require('./src/lib/db/index');
const { generateAllCups } = require('./src/lib/cup-engine');

try {
  const db = getDb();
  console.log('Generating cups for 2026...');
  generateAllCups(2026);
  console.log('Success!');
} catch (err) {
  console.error('FAILED:', err);
  process.exit(1);
}
