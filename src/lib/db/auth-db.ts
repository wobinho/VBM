import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let authDb: Database.Database | null = null;

function getDataDir(): string {
  return process.env.DB_DIR || path.join(process.cwd(), 'data');
}

export function getAuthDb(): Database.Database {
  if (authDb) return authDb;

  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'auth.db');
  authDb = new Database(dbPath);
  authDb.pragma('journal_mode = WAL');
  authDb.pragma('foreign_keys = ON');

  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login TEXT,
      is_active INTEGER DEFAULT 1,
      is_admin INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `;
  authDb.exec(ddl);

  return authDb;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  is_active: number;
  is_admin: number;
}

export function authGetUserByEmail(email: string): AuthUser | undefined {
  return getAuthDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as AuthUser | undefined;
}

export function authGetUserByUsername(username: string): AuthUser | undefined {
  return getAuthDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as AuthUser | undefined;
}

export function authGetUserById(id: string): AuthUser | undefined {
  return getAuthDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as AuthUser | undefined;
}

export function authCreateUser(data: {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  display_name: string;
  is_admin?: number;
}) {
  return getAuthDb().prepare(`
    INSERT INTO users (id, email, username, password_hash, display_name, is_admin)
    VALUES (@id, @email, @username, @password_hash, @display_name, @is_admin)
  `).run({ ...data, is_admin: data.is_admin ?? 0 });
}
