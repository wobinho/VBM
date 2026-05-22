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

    CREATE TABLE IF NOT EXISTS saves (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      save_type   TEXT NOT NULL DEFAULT 'classic' CHECK (save_type IN ('classic','custom')),
      status      TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('creating','ready')),
      created_at  TEXT DEFAULT (datetime('now')),
      last_played TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id);
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

// ============================================================
// Saves — each row is one independent game world for a user.
// The game data itself lives in its own SQLite file per save
// (see openSaveDb in ./index). This table is only the index.
// ============================================================

export interface SaveRow {
  id: string;
  user_id: string;
  name: string;
  save_type: 'classic' | 'custom';
  status: 'creating' | 'ready';
  created_at: string;
  last_played: string | null;
}

/**
 * Returns the user's classic "Main Save", creating its index row if missing.
 * The original per-user game DB predates multi-save, so its save id IS the
 * user id — that is what keeps its file at the legacy path (see openSaveDb).
 */
export function authEnsureClassicSave(userId: string): SaveRow {
  const db = getAuthDb();
  const existing = db.prepare('SELECT * FROM saves WHERE id = ?').get(userId) as SaveRow | undefined;
  if (existing) return existing;
  db.prepare(`
    INSERT OR IGNORE INTO saves (id, user_id, name, save_type, status)
    VALUES (?, ?, 'Main Save', 'classic', 'ready')
  `).run(userId, userId);
  return db.prepare('SELECT * FROM saves WHERE id = ?').get(userId) as SaveRow;
}

export function authListSaves(userId: string): SaveRow[] {
  return getAuthDb().prepare(`
    SELECT * FROM saves WHERE user_id = ?
    ORDER BY (last_played IS NULL) ASC, last_played DESC, created_at ASC
  `).all(userId) as SaveRow[];
}

export function authGetSave(id: string): SaveRow | undefined {
  return getAuthDb().prepare('SELECT * FROM saves WHERE id = ?').get(id) as SaveRow | undefined;
}

export function authCreateSave(data: {
  id: string;
  user_id: string;
  name: string;
  save_type: 'classic' | 'custom';
  status?: 'creating' | 'ready';
}) {
  return getAuthDb().prepare(`
    INSERT INTO saves (id, user_id, name, save_type, status)
    VALUES (@id, @user_id, @name, @save_type, @status)
  `).run({ ...data, status: data.status ?? 'ready' });
}

export function authUpdateSaveStatus(id: string, status: 'creating' | 'ready') {
  return getAuthDb().prepare('UPDATE saves SET status = ? WHERE id = ?').run(status, id);
}

export function authTouchSave(id: string) {
  return getAuthDb().prepare("UPDATE saves SET last_played = datetime('now') WHERE id = ?").run(id);
}

export function authDeleteSave(id: string) {
  return getAuthDb().prepare('DELETE FROM saves WHERE id = ?').run(id);
}
