import Database from 'better-sqlite3';
import path from 'path';
import { runSchema } from './schema';
import { seedDatabase } from './seed';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'spike-dynasty.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run migrations on startup
    const userCols = db.prepare("PRAGMA table_info(users)").all() as {name: string}[];
    if (!userCols.find(c => c.name === 'is_admin')) {
      db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
    }

    // Check if tables exist
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='leagues'"
    ).get();

    if (!tableCheck) {
      runSchema(db);
      seedDatabase(db);
    }

    // Migration: squad_lineups table
    const squadCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='squad_lineups'"
    ).get();

    if (!squadCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS squad_lineups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_id INTEGER NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
          oh1_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
          mb1_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
          opp_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
          s_player_id   INTEGER REFERENCES players(id) ON DELETE SET NULL,
          mb2_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
          oh2_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
          l_player_id   INTEGER REFERENCES players(id) ON DELETE SET NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_squad_lineups_team_id ON squad_lineups(team_id);
      `);
      // Seed starting lineup for team 6 (Zebrette Udine) so testing works out of the box
      seedTeam6Lineup(db);
    }
  }
  return db;
}

function seedTeam6Lineup(db: Database.Database) {
  type Row = { id: number; position: string; overall: number };
  const players = db.prepare(
    'SELECT id, position, overall FROM players WHERE team_id = 6 ORDER BY overall DESC'
  ).all() as Row[];

  if (players.length < 7) return;

  const byPos: Record<string, Row[]> = {};
  for (const p of players) {
    if (!byPos[p.position]) byPos[p.position] = [];
    byPos[p.position].push(p);
  }

  const used = new Set<number>();
  const pick = (pos: string): number | null => {
    const arr = byPos[pos] ?? [];
    const p = arr.find(x => !used.has(x.id));
    if (p) { used.add(p.id); return p.id; }
    return null;
  };
  const pickAny = (): number | null => {
    for (const pos of ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero']) {
      const id = pick(pos);
      if (id !== null) return id;
    }
    const p = players.find(x => !used.has(x.id));
    if (p) { used.add(p.id); return p.id; }
    return null;
  };

  const oh1 = pick('Outside Hitter') ?? pickAny();
  const mb1 = pick('Middle Blocker')  ?? pickAny();
  const opp = pick('Opposite Hitter') ?? pickAny();
  const s   = pick('Setter')          ?? pickAny();
  const mb2 = pick('Middle Blocker')  ?? pickAny();
  const oh2 = pick('Outside Hitter')  ?? pickAny();
  const lib = pick('Libero')          ?? pickAny();

  db.prepare(`
    INSERT OR IGNORE INTO squad_lineups
      (team_id, oh1_player_id, mb1_player_id, opp_player_id, s_player_id, mb2_player_id, oh2_player_id, l_player_id)
    VALUES (6, ?, ?, ?, ?, ?, ?, ?)
  `).run(oh1, mb1, opp, s, mb2, oh2, lib);
}
