const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'spike-dynasty.db');
const db = new Database(dbPath);

console.log('Applying missing migrations...');

// 1. Migration for leagues
const leagueCols = db.prepare("PRAGMA table_info(leagues)").all().map(c => c.name);
if (!leagueCols.includes('tier')) {
  console.log('Adding tier to leagues');
  db.exec("ALTER TABLE leagues ADD COLUMN tier INTEGER DEFAULT 2");
}
if (!leagueCols.includes('created_at')) {
  console.log('Adding created_at to leagues');
  db.exec("ALTER TABLE leagues ADD COLUMN created_at TEXT");
}
if (!leagueCols.includes('updated_at')) {
  console.log('Adding updated_at to leagues');
  db.exec("ALTER TABLE leagues ADD COLUMN updated_at TEXT");
}

// 2. Migration for cup tables
const cupCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cup_competitions'").get();
if (!cupCheck) {
  console.log('Creating cup tables...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cup_competitions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      cup_type    TEXT NOT NULL CHECK (cup_type IN ('national', 'cl', 'secondary')),
      format      TEXT NOT NULL CHECK (format IN ('single_elimination', 'group_knockout')),
      country     TEXT,
      year        INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(cup_type, country, year)
    );
    CREATE TABLE IF NOT EXISTS cup_rounds (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cup_id       INTEGER NOT NULL REFERENCES cup_competitions(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      round_name   TEXT NOT NULL,
      round_type   TEXT NOT NULL CHECK (round_type IN ('group', 'knockout')),
      start_date   TEXT NOT NULL,
      end_date     TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed')),
      created_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(cup_id, round_number)
    );
    CREATE TABLE IF NOT EXISTS cup_groups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id    INTEGER NOT NULL REFERENCES cup_rounds(id) ON DELETE CASCADE,
      group_name  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cup_group_teams (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id  INTEGER NOT NULL REFERENCES cup_groups(id) ON DELETE CASCADE,
      team_id   INTEGER NOT NULL REFERENCES teams(id),
      played    INTEGER DEFAULT 0,
      won       INTEGER DEFAULT 0,
      lost      INTEGER DEFAULT 0,
      points    INTEGER DEFAULT 0,
      sets_won  INTEGER DEFAULT 0,
      sets_lost INTEGER DEFAULT 0,
      UNIQUE(group_id, team_id)
    );
    CREATE TABLE IF NOT EXISTS cup_fixtures (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      cup_id          INTEGER NOT NULL REFERENCES cup_competitions(id) ON DELETE CASCADE,
      round_id        INTEGER NOT NULL REFERENCES cup_rounds(id) ON DELETE CASCADE,
      group_id        INTEGER REFERENCES cup_groups(id),
      home_team_id    INTEGER NOT NULL REFERENCES teams(id),
      away_team_id    INTEGER NOT NULL REFERENCES teams(id),
      scheduled_date  TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'postponed')),
      home_sets       INTEGER,
      away_sets       INTEGER,
      home_points     INTEGER,
      away_points     INTEGER,
      winner_team_id  INTEGER REFERENCES teams(id),
      played_at       TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cup_fixtures_date   ON cup_fixtures(scheduled_date);
  `);
  console.log('Cup tables created.');
} else {
  console.log('Cup tables already exist.');
}

console.log('All migrations applied.');
db.close();
