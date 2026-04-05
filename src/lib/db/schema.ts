import Database from 'better-sqlite3';

export function runSchema(db: Database.Database) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_name TEXT NOT NULL UNIQUE,
      country TEXT DEFAULT 'Italy',
      tier INTEGER DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT NOT NULL UNIQUE,
      league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      country TEXT DEFAULT 'Italy',
      team_money REAL DEFAULT 1000000.00,
      played INTEGER DEFAULT 0,
      won INTEGER DEFAULT 0,
      lost INTEGER DEFAULT 0,
      sets_won INTEGER DEFAULT 0,
      sets_lost INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      score_diff INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      position TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age >= 16 AND age <= 50),
      country TEXT NOT NULL,
      jersey_number INTEGER NOT NULL CHECK (jersey_number >= 1 AND jersey_number <= 99),
      overall INTEGER NOT NULL CHECK (overall >= 1 AND overall <= 100),
      height INTEGER CHECK (height >= 150 AND height <= 220),
      potential INTEGER CHECK (potential >= 1 AND potential <= 100),
      -- Core Skills (50% of overall)
      attack INTEGER NOT NULL CHECK (attack >= 1 AND attack <= 100),
      defense INTEGER NOT NULL CHECK (defense >= 1 AND defense <= 100),
      serve INTEGER NOT NULL CHECK (serve >= 1 AND serve <= 100),
      block INTEGER NOT NULL CHECK (block >= 1 AND block <= 100),
      receive INTEGER NOT NULL CHECK (receive >= 1 AND receive <= 100),
      setting INTEGER NOT NULL CHECK (setting >= 1 AND setting <= 100),
      -- Technical Skills (feed into simulation only)
      precision INTEGER NOT NULL DEFAULT 50 CHECK (precision >= 1 AND precision <= 100),
      flair INTEGER NOT NULL DEFAULT 50 CHECK (flair >= 1 AND flair <= 100),
      digging INTEGER NOT NULL DEFAULT 50 CHECK (digging >= 1 AND digging <= 100),
      positioning INTEGER NOT NULL DEFAULT 50 CHECK (positioning >= 1 AND positioning <= 100),
      ball_control INTEGER NOT NULL DEFAULT 50 CHECK (ball_control >= 1 AND ball_control <= 100),
      technique INTEGER NOT NULL DEFAULT 50 CHECK (technique >= 1 AND technique <= 100),
      playmaking INTEGER NOT NULL DEFAULT 50 CHECK (playmaking >= 1 AND playmaking <= 100),
      spin INTEGER NOT NULL DEFAULT 50 CHECK (spin >= 1 AND spin <= 100),
      -- Physical Skills (25% of overall)
      speed INTEGER NOT NULL DEFAULT 50 CHECK (speed >= 1 AND speed <= 100),
      agility INTEGER NOT NULL DEFAULT 50 CHECK (agility >= 1 AND agility <= 100),
      strength INTEGER NOT NULL DEFAULT 50 CHECK (strength >= 1 AND strength <= 100),
      endurance INTEGER NOT NULL DEFAULT 50 CHECK (endurance >= 1 AND endurance <= 100),
      vertical INTEGER NOT NULL DEFAULT 50 CHECK (vertical >= 1 AND vertical <= 100),
      flexibility INTEGER NOT NULL DEFAULT 50 CHECK (flexibility >= 1 AND flexibility <= 100),
      torque INTEGER NOT NULL DEFAULT 50 CHECK (torque >= 1 AND torque <= 100),
      balance INTEGER NOT NULL DEFAULT 50 CHECK (balance >= 1 AND balance <= 100),
      -- Mental Skills (25% of overall)
      leadership INTEGER NOT NULL DEFAULT 50 CHECK (leadership >= 1 AND leadership <= 100),
      teamwork INTEGER NOT NULL DEFAULT 50 CHECK (teamwork >= 1 AND teamwork <= 100),
      concentration INTEGER NOT NULL DEFAULT 50 CHECK (concentration >= 1 AND concentration <= 100),
      pressure INTEGER NOT NULL DEFAULT 50 CHECK (pressure >= 1 AND pressure <= 100),
      consistency INTEGER NOT NULL DEFAULT 50 CHECK (consistency >= 1 AND consistency <= 100),
      vision INTEGER NOT NULL DEFAULT 50 CHECK (vision >= 1 AND vision <= 100),
      game_iq INTEGER NOT NULL DEFAULT 50 CHECK (game_iq >= 1 AND game_iq <= 100),
      intimidation INTEGER NOT NULL DEFAULT 50 CHECK (intimidation >= 1 AND intimidation <= 100),
      -- Contract
      contract_years INTEGER NOT NULL DEFAULT 1,
      monthly_wage REAL NOT NULL DEFAULT 1000.00,
      player_value REAL NOT NULL DEFAULT 100000.00,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      from_team INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      to_team INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      price REAL NOT NULL DEFAULT 0.00,
      transfer_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected', 'cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS user_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS transfer_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_amount REAL NOT NULL CHECK (offer_amount > 0),
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
      expires_at TEXT DEFAULT (datetime('now', '+7 days')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      responded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(league_id, year)
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      league_id INTEGER NOT NULL REFERENCES leagues(id),
      home_team_id INTEGER NOT NULL REFERENCES teams(id),
      away_team_id INTEGER NOT NULL REFERENCES teams(id),
      game_week INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'postponed')),
      home_sets INTEGER,
      away_sets INTEGER,
      home_points INTEGER,
      away_points INTEGER,
      played_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_date TEXT NOT NULL,
      season_id INTEGER REFERENCES seasons(id),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
    CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
    CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
    CREATE INDEX IF NOT EXISTS idx_players_overall ON players(overall);
    CREATE INDEX IF NOT EXISTS idx_transfers_player_id ON transfers(player_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
    CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);
    CREATE INDEX IF NOT EXISTS idx_transfer_offers_player_id ON transfer_offers(player_id);
    CREATE INDEX IF NOT EXISTS idx_transfer_offers_from_user ON transfer_offers(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_transfer_offers_to_user ON transfer_offers(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_transfer_offers_status ON transfer_offers(status);
    CREATE INDEX IF NOT EXISTS idx_fixtures_season_id ON fixtures(season_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_scheduled_date ON fixtures(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON fixtures(home_team_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON fixtures(away_team_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);

    CREATE TABLE IF NOT EXISTS league_configs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id  INTEGER NOT NULL UNIQUE REFERENCES leagues(id) ON DELETE CASCADE,
      config     TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_league_configs_league_id ON league_configs(league_id);

    CREATE TABLE IF NOT EXISTS league_links (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      from_league_id  INTEGER NOT NULL REFERENCES leagues(id),
      to_league_id    INTEGER NOT NULL REFERENCES leagues(id),
      from_condition  TEXT    NOT NULL,
      to_condition    TEXT    NOT NULL,
      priority        INTEGER DEFAULT 0,
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_league_links_from ON league_links(from_league_id);
    CREATE INDEX IF NOT EXISTS idx_league_links_to   ON league_links(to_league_id);
  `);
}
