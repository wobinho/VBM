import Database from 'better-sqlite3';

export function runSchema(db: Database.Database) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT NOT NULL UNIQUE,
      league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      team_money REAL DEFAULT 1000000.00,
      played INTEGER DEFAULT 0,
      won INTEGER DEFAULT 0,
      lost INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      goal_diff INTEGER DEFAULT 0,
      stadium TEXT DEFAULT '',
      capacity INTEGER DEFAULT 5000,
      founded TEXT DEFAULT '2020',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      attack INTEGER NOT NULL CHECK (attack >= 1 AND attack <= 100),
      defense INTEGER NOT NULL CHECK (defense >= 1 AND defense <= 100),
      serve INTEGER NOT NULL CHECK (serve >= 1 AND serve <= 100),
      block INTEGER NOT NULL CHECK (block >= 1 AND block <= 100),
      receive INTEGER NOT NULL CHECK (receive >= 1 AND receive <= 100),
      setting INTEGER NOT NULL CHECK (setting >= 1 AND setting <= 100),
      contract_years INTEGER NOT NULL DEFAULT 1,
      monthly_wage REAL NOT NULL DEFAULT 1000.00,
      player_value REAL NOT NULL DEFAULT 100000.00,
      speed INTEGER CHECK (speed >= 1 AND speed <= 100),
      agility INTEGER CHECK (agility >= 1 AND agility <= 100),
      strength INTEGER CHECK (strength >= 1 AND strength <= 100),
      endurance INTEGER CHECK (endurance >= 1 AND endurance <= 100),
      height INTEGER CHECK (height >= 150 AND height <= 220),
      leadership INTEGER CHECK (leadership >= 1 AND leadership <= 100),
      teamwork INTEGER CHECK (teamwork >= 1 AND teamwork <= 100),
      concentration INTEGER CHECK (concentration >= 1 AND concentration <= 100),
      pressure_handling INTEGER CHECK (pressure_handling >= 1 AND pressure_handling <= 100),
      jump_serve INTEGER CHECK (jump_serve >= 1 AND jump_serve <= 100),
      float_serve INTEGER CHECK (float_serve >= 1 AND float_serve <= 100),
      spike_power INTEGER CHECK (spike_power >= 1 AND spike_power <= 100),
      spike_accuracy INTEGER CHECK (spike_accuracy >= 1 AND spike_accuracy <= 100),
      block_timing INTEGER CHECK (block_timing >= 1 AND block_timing <= 100),
      dig_technique INTEGER CHECK (dig_technique >= 1 AND dig_technique <= 100),
      experience INTEGER CHECK (experience >= 1 AND experience <= 100),
      potential INTEGER CHECK (potential >= 1 AND potential <= 100),
      consistency INTEGER CHECK (consistency >= 1 AND consistency <= 100),
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
  `);
}
