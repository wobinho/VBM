const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');

const users = db.prepare('SELECT id, email, username, display_name FROM users').all();
console.log(JSON.stringify(users, null, 2));
