const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'spike-dynasty.db');
const db = new Database(dbPath);

try {
    const result = db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'test-user'").run();
    console.log(`✓ Updated ${result.changes} user(s)`);

    const user = db.prepare("SELECT username, is_admin FROM users WHERE username = 'test-user'").get();
    if (user) {
        console.log(`✓ User: ${user.username}, is_admin: ${user.is_admin}`);
    } else {
        console.log('✗ User test-user not found. Create the account first by registering in the app.');
    }
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
} finally {
    db.close();
}
