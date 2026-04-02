const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'spike-dynasty.db');
const db = new Database(dbPath);

try {
    // Check if is_admin column exists
    const cols = db.prepare("PRAGMA table_info(users)").all();
    const hasIsAdmin = cols.find(c => c.name === 'is_admin');

    if (!hasIsAdmin) {
        console.log('✓ Adding is_admin column...');
        db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
        console.log('✓ Column added');
    } else {
        console.log('✓ is_admin column already exists');
    }

    // Set test-user as admin if exists
    const result = db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'test-user'").run();
    console.log(`✓ Updated ${result.changes} user(s)`);

    const user = db.prepare("SELECT username, is_admin FROM users WHERE username = 'test-user'").get();
    if (user) {
        console.log(`✓ User: ${user.username}, is_admin: ${user.is_admin}`);
    } else {
        console.log('✗ User test-user not found');
    }
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
} finally {
    db.close();
}
