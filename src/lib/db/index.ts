import Database from 'better-sqlite3';
import path from 'path';
import { runSchema } from './schema';
import { seedDatabase } from './seed';
import type { LeagueConfig } from '../league-engine';
import { generateScheduleForLeague } from '../league-engine';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'spike-dynasty.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run migrations on startup
    const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!userCols.find(c => c.name === 'is_admin')) {
      db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
    }

    // Migration: new player stat schema (Technical + expanded Physical/Mental)
    const playerCols = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
    const playerColNames = playerCols.map(c => c.name);

    // Add new Technical columns
    const technicalCols = ['precision', 'flair', 'digging', 'positioning', 'ball_control', 'technique', 'playmaking', 'spin'];
    for (const col of technicalCols) {
      if (!playerColNames.includes(col)) {
        db.exec(`ALTER TABLE players ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 50`);
      }
    }
    // Add new Physical columns
    const newPhysicalCols = ['vertical', 'flexibility', 'torque', 'balance'];
    for (const col of newPhysicalCols) {
      if (!playerColNames.includes(col)) {
        db.exec(`ALTER TABLE players ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 50`);
      }
    }
    // Add new Mental columns (rename pressure_handling → pressure, add vision/game_iq/intimidation)
    if (!playerColNames.includes('pressure')) {
      if (playerColNames.includes('pressure_handling')) {
        db.exec(`ALTER TABLE players ADD COLUMN pressure INTEGER NOT NULL DEFAULT 50`);
        db.exec(`UPDATE players SET pressure = pressure_handling`);
      } else {
        db.exec(`ALTER TABLE players ADD COLUMN pressure INTEGER NOT NULL DEFAULT 50`);
      }
    }
    const newMentalCols = ['vision', 'game_iq', 'intimidation'];
    for (const col of newMentalCols) {
      if (!playerColNames.includes(col)) {
        db.exec(`ALTER TABLE players ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 50`);
      }
    }
    // Ensure old Physical/Mental cols that were nullable are now present (speed/agility/etc already existed)
    const ensureNotNull = ['speed', 'agility', 'strength', 'endurance', 'leadership', 'teamwork', 'concentration', 'consistency'];
    for (const col of ensureNotNull) {
      if (!playerColNames.includes(col)) {
        db.exec(`ALTER TABLE players ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 50`);
      }
    }
    // Add height and potential columns if missing
    if (!playerColNames.includes('height')) {
      db.exec(`ALTER TABLE players ADD COLUMN height INTEGER`);
    }
    if (!playerColNames.includes('potential')) {
      db.exec(`ALTER TABLE players ADD COLUMN potential INTEGER`);
    }
    if (!playerColNames.includes('created_at')) {
      db.exec(`ALTER TABLE players ADD COLUMN created_at TEXT`);
    }
    if (!playerColNames.includes('updated_at')) {
      db.exec(`ALTER TABLE players ADD COLUMN updated_at TEXT`);
    }
    // Recalculate overall for existing players using new formula when migrating
    const needsOverallRecalc = !playerColNames.includes('vertical') || !playerColNames.includes('pressure');
    if (needsOverallRecalc) {
      db.exec(`
        UPDATE players SET overall = MAX(1, MIN(100, CAST(ROUND(
          (CAST(attack + defense + serve + block + receive + setting AS REAL) / 6 * 0.50) +
          (CAST(speed + agility + strength + endurance AS REAL) / 4 * 0.25) +
          (CAST(leadership + teamwork + concentration + consistency AS REAL) / 4 * 0.25)
        ) AS INTEGER)))
      `);
    }

    // Migration: region column for teams
    const teamCols = db.prepare("PRAGMA table_info(teams)").all() as { name: string }[];
    if (!teamCols.find(c => c.name === 'region')) {
      db.exec(`ALTER TABLE teams ADD COLUMN region TEXT DEFAULT 'north'`);
      const regionMap: Record<string, string> = {
        'Milan Rossoneri': 'north',
        'Milan Nerazzurri': 'north',
        'Turin Bianconeri': 'north',
        'Genoa Admirals': 'north',
        'Bologna Motors': 'north',
        'Zebrette Udine': 'north',
        'Arsenal Spezia': 'north',
        'Primogenita Piacenza': 'north',
        'Rome Imperials': 'south',
        'Roma Capitana': 'south',
        'Partenope Napoli': 'south',
        'Palermo Royals': 'south',
        'Firenze Lillies': 'south',
        'Perugia Griffins': 'south',
        'Salerno Marittimo': 'south',
        'Pisa Towers': 'south',
      };
      const updateRegion = db.prepare("UPDATE teams SET region = ? WHERE team_name = ?");
      for (const [name, region] of Object.entries(regionMap)) {
        updateRegion.run(region, name);
      }
    }

    // Always ensure south teams have correct region (handles name spelling variants)
    db.exec(`UPDATE teams SET region = 'south' WHERE team_name IN (
      'Rome Imperials','Roma Capitana','Partenope Napoli','Palermo Royals',
      'Firenze Lilies','Firenze Lillies','Perugia Griffins','Salerno Marittimo','Pisa Towers'
    )`);

    // Migration: ensure leagues table has new columns (tier, created_at, updated_at)
    const leagueCols = db.prepare("PRAGMA table_info(leagues)").all() as { name: string }[];
    const leagueColNames = leagueCols.map(c => c.name);
    if (!leagueColNames.includes('tier')) {
      db.exec("ALTER TABLE leagues ADD COLUMN tier INTEGER DEFAULT 2");
    }
    if (!leagueColNames.includes('created_at')) {
      db.exec("ALTER TABLE leagues ADD COLUMN created_at TEXT");
    }
    if (!leagueColNames.includes('updated_at')) {
      db.exec("ALTER TABLE leagues ADD COLUMN updated_at TEXT");
    }

    // Migration: playoff_series and playoff_games tables
    const playoffSeriesCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='playoff_series'"
    ).get();
    if (!playoffSeriesCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS playoff_series (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
          league_id INTEGER NOT NULL REFERENCES leagues(id),
          round INTEGER NOT NULL,           -- 1=conference semis, 2=conference finals, 3=grand final
          conference TEXT,                  -- 'north', 'south', or NULL for grand final
          seed_high INTEGER NOT NULL,       -- seeding of the higher-seeded team
          seed_low INTEGER NOT NULL,        -- seeding of the lower-seeded team
          home_team_id INTEGER NOT NULL REFERENCES teams(id),
          away_team_id INTEGER NOT NULL REFERENCES teams(id),
          home_wins INTEGER NOT NULL DEFAULT 0,
          away_wins INTEGER NOT NULL DEFAULT 0,
          winner_team_id INTEGER REFERENCES teams(id),
          status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed')),
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS playoff_games (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          series_id INTEGER NOT NULL REFERENCES playoff_series(id) ON DELETE CASCADE,
          game_number INTEGER NOT NULL,     -- 1-5 within the series
          home_team_id INTEGER NOT NULL REFERENCES teams(id),
          away_team_id INTEGER NOT NULL REFERENCES teams(id),
          scheduled_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
          home_sets INTEGER,
          away_sets INTEGER,
          home_points INTEGER,
          away_points INTEGER,
          played_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_playoff_series_season ON playoff_series(season_id);
        CREATE INDEX IF NOT EXISTS idx_playoff_series_status ON playoff_series(status);
        CREATE INDEX IF NOT EXISTS idx_playoff_games_series ON playoff_games(series_id);
        CREATE INDEX IF NOT EXISTS idx_playoff_games_date ON playoff_games(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_playoff_games_status ON playoff_games(status);
      `);
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

    // Migration: financial_transactions table
    const finCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='financial_transactions'"
    ).get();
    if (!finCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS financial_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          month TEXT NOT NULL,
          income_matchday REAL NOT NULL DEFAULT 0,
          income_sponsorship REAL NOT NULL DEFAULT 0,
          income_merchandise REAL NOT NULL DEFAULT 0,
          income_broadcast REAL NOT NULL DEFAULT 0,
          income_other REAL NOT NULL DEFAULT 0,
          expense_wages REAL NOT NULL DEFAULT 0,
          expense_staff REAL NOT NULL DEFAULT 0,
          expense_other REAL NOT NULL DEFAULT 0,
          net REAL NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(team_id, month)
        );
        CREATE INDEX IF NOT EXISTS idx_fin_team_month ON financial_transactions(team_id, month);
      `);
    }

    // Migration: league_configs, league_links, and league_presets tables
    const leagueConfigsCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='league_configs'"
    ).get();
    if (!leagueConfigsCheck) {
      db.exec(`
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

        CREATE TABLE IF NOT EXISTS league_presets (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          preset_name  TEXT    NOT NULL UNIQUE,
          config       TEXT    NOT NULL,
          created_at   TEXT    DEFAULT (datetime('now')),
          updated_at   TEXT    DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_league_presets_name ON league_presets(preset_name);
      `);
      seedLeagueConfigs(db);
    }

    // Ensure league_configs are seeded if they exist but are empty
    const emptyConfigs = db.prepare("SELECT COUNT(*) as c FROM league_configs").get() as { c: number };
    if (emptyConfigs.c === 0) {
      seedLeagueConfigs(db);
    }

    // Always ensure tiers are correct for Italian leagues
    db.exec(`UPDATE leagues SET tier = 2 WHERE league_name = 'IVL Premier Division'`);
    db.exec(`UPDATE leagues SET tier = 3 WHERE league_name IN ('IVL North', 'IVL South')`);

    // Ensure league_presets table exists if league_configs already did (migration for existing DBs)
    const presetsCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='league_presets'"
    ).get();
    if (!presetsCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS league_presets (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          preset_name  TEXT    NOT NULL UNIQUE,
          config       TEXT    NOT NULL,
          created_at   TEXT    DEFAULT (datetime('now')),
          updated_at   TEXT    DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_league_presets_name ON league_presets(preset_name);
      `);
      seedLeagueConfigs(db);
    }

    // Migration: seasons, fixtures, game_state tables
    const seasonsCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='seasons'"
    ).get();

    if (!seasonsCheck) {
      db.exec(`
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

        CREATE INDEX IF NOT EXISTS idx_fixtures_season_id ON fixtures(season_id);
        CREATE INDEX IF NOT EXISTS idx_fixtures_scheduled_date ON fixtures(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON fixtures(home_team_id);
        CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON fixtures(away_team_id);
        CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);
      `);

      // Seed initial season + schedule
      seedInitialSeason(db);
    } else {
      // Tables exist — ensure every league has a season and fixtures (handles new leagues added later)
      seedMissingLeagueSeasons(db);
    }

    // Migration: cup competition tables and config updates (Jan–Jun calendar, cup participation)
    const cupCompetitionsCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cup_competitions'"
    ).get();
    if (!cupCompetitionsCheck) {
      // Create cup tables
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
        CREATE INDEX IF NOT EXISTS idx_cup_competitions_year ON cup_competitions(year);

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
        CREATE INDEX IF NOT EXISTS idx_cup_rounds_cup_id ON cup_rounds(cup_id);

        CREATE TABLE IF NOT EXISTS cup_groups (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          round_id    INTEGER NOT NULL REFERENCES cup_rounds(id) ON DELETE CASCADE,
          group_name  TEXT NOT NULL,
          created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_cup_groups_round_id ON cup_groups(round_id);

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
        CREATE INDEX IF NOT EXISTS idx_cup_group_teams_group_id ON cup_group_teams(group_id);

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
        CREATE INDEX IF NOT EXISTS idx_cup_fixtures_cup_id ON cup_fixtures(cup_id);
        CREATE INDEX IF NOT EXISTS idx_cup_fixtures_home   ON cup_fixtures(home_team_id);
        CREATE INDEX IF NOT EXISTS idx_cup_fixtures_away   ON cup_fixtures(away_team_id);
        CREATE INDEX IF NOT EXISTS idx_cup_fixtures_status ON cup_fixtures(status);
      `);

      // Update existing league configs to new date ranges and add cup participation
      const premierConfig = {
        team_count: 16,
        format: {
          type: 'multi_conference',
          conferences: [
            { name: 'north', region_tag: 'north', size: 8 },
            { name: 'south', region_tag: 'south', size: 8 },
          ],
        },
        regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 4, end_day: 30 },
        post_season: {
          type: 'conference_playoffs',
          start_month: 5,
          start_day: 1,
          series_length: 5,
          rounds: [
            { name: 'Conference Semifinals', scope: 'per_conference', teams_per_conference: 4, matchup_pattern: 'top_vs_bottom' },
            { name: 'Conference Finals', scope: 'per_conference', matchup_pattern: 'top_vs_bottom' },
            { name: 'Grand Final', scope: 'cross_conference' },
          ],
        },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: {
          qualifier: 'top_n_per_league',
          top_n: 4,
          cups: ['national', 'cl'],
        },
      };

      const div2Config = {
        team_count: 16,
        format: { type: 'single_table' },
        regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 6, end_day: 30 },
        post_season: { type: 'none' },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: {
          qualifier: 'all_country',
          cups: ['national'],
        },
      };

      const superligaPolskaConfig = {
        team_count: 20,
        format: { type: 'single_table' },
        regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 6, end_day: 30 },
        post_season: { type: 'none' },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: {
          qualifier: 'all_country',
          cups: ['national'],
        },
      };

      // Update league configs (tier 2 = premier, tier 3 = div2, by name = superliga)
      const tier2League = db.prepare("SELECT id FROM leagues WHERE tier = 2 LIMIT 1").get() as { id: number } | undefined;
      if (tier2League) {
        db.prepare("UPDATE league_configs SET config = ? WHERE league_id = ?")
          .run(JSON.stringify(premierConfig), tier2League.id);
      }

      const tier3Leagues = db.prepare("SELECT id FROM leagues WHERE tier = 3 ORDER BY id").all() as { id: number }[];
      for (const league of tier3Leagues) {
        db.prepare("UPDATE league_configs SET config = ? WHERE league_id = ?")
          .run(JSON.stringify(div2Config), league.id);
      }

      const superligaPolskaLeague = db.prepare("SELECT id FROM leagues WHERE league_name = 'Superliga Polska' LIMIT 1")
        .get() as { id: number } | undefined;
      if (superligaPolskaLeague) {
        db.prepare("UPDATE league_configs SET config = ? WHERE league_id = ?")
          .run(JSON.stringify(superligaPolskaConfig), superligaPolskaLeague.id);
      }

      // Update league presets
      db.prepare("UPDATE league_presets SET config = ? WHERE preset_name = ?")
        .run(JSON.stringify(premierConfig), 'Italian Premier Division');
      db.prepare("UPDATE league_presets SET config = ? WHERE preset_name = ?")
        .run(JSON.stringify(div2Config), 'Division 2 Standard');
      db.prepare("UPDATE league_presets SET config = ? WHERE preset_name = ?")
        .run(JSON.stringify(superligaPolskaConfig), 'Superliga Polska Standard');
    }
  }
  return db;
}

function seedMissingLeagueSeasons(db: Database.Database) {
  const year = 2026;
  const leagues = db.prepare("SELECT id FROM leagues ORDER BY id").all() as { id: number }[];

  const insertFixture = db.prepare(`
    INSERT INTO fixtures (season_id, league_id, home_team_id, away_team_id, game_week, scheduled_date)
    VALUES (@season_id, @league_id, @home_team_id, @away_team_id, @game_week, @scheduled_date)
  `);

  for (const league of leagues) {
    const teams = db.prepare("SELECT id FROM teams WHERE league_id = ? ORDER BY id").all(league.id) as { id: number }[];
    if (teams.length < 2) continue;

    const seasonResult = db.prepare(`
      INSERT OR IGNORE INTO seasons (league_id, year, name, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(league.id, year, `${year} Season`, `${year}-01-01`, `${year}-12-31`);

    let seasonId: number;
    if (seasonResult.changes === 0) {
      const existing = db.prepare("SELECT id FROM seasons WHERE league_id = ? AND year = ?").get(league.id, year) as { id: number };
      seasonId = existing.id;
    } else {
      seasonId = Number(seasonResult.lastInsertRowid);
    }

    const existing = db.prepare("SELECT COUNT(*) as c FROM fixtures WHERE season_id = ?").get(seasonId) as { c: number };
    if (existing.c > 0) continue;

    const teamIds = teams.map(t => t.id);
    const slots = generateScheduleForLeague(league.id, teamIds, year);

    const insertAll = db.transaction(() => {
      for (const slot of slots) {
        insertFixture.run({
          season_id: seasonId,
          league_id: league.id,
          home_team_id: slot.home_team_id,
          away_team_id: slot.away_team_id,
          game_week: slot.game_week,
          scheduled_date: slot.scheduled_date,
        });
      }
    });
    insertAll();
  }
}

function seedInitialSeason(db: Database.Database) {
  // Get all leagues
  const leagues = db.prepare("SELECT id FROM leagues ORDER BY id").all() as { id: number }[];
  if (!leagues.length) return;

  const year = 2026;
  let primarySeasonId: number | null = null;

  const insertFixture = db.prepare(`
    INSERT INTO fixtures (season_id, league_id, home_team_id, away_team_id, game_week, scheduled_date)
    VALUES (@season_id, @league_id, @home_team_id, @away_team_id, @game_week, @scheduled_date)
  `);

  for (const league of leagues) {
    const teams = db.prepare("SELECT id FROM teams WHERE league_id = ? ORDER BY id").all(league.id) as { id: number }[];
    if (teams.length < 2) continue;

    const seasonName = `${year} Season`;

    // Insert season for this league
    const seasonResult = db.prepare(`
      INSERT OR IGNORE INTO seasons (league_id, year, name, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(league.id, year, seasonName, `${year}-01-01`, `${year}-12-31`);

    let seasonId: number;
    if (seasonResult.changes === 0) {
      const existing = db.prepare("SELECT id FROM seasons WHERE league_id = ? AND year = ?").get(league.id, year) as { id: number };
      seasonId = existing.id;
    } else {
      seasonId = Number(seasonResult.lastInsertRowid);
    }

    // Track the first (primary) league's season for game_state
    if (primarySeasonId === null) primarySeasonId = seasonId;

    // Only seed fixtures if none exist for this season
    const existingFixtures = db.prepare("SELECT COUNT(*) as c FROM fixtures WHERE season_id = ?").get(seasonId) as { c: number };
    if (existingFixtures.c > 0) continue;

    // Generate fixtures for this league
    const teamIds = teams.map(t => t.id);
    const slots = generateScheduleForLeague(league.id, teamIds, year);

    const insertAll = db.transaction(() => {
      for (const slot of slots) {
        insertFixture.run({
          season_id: seasonId,
          league_id: league.id,
          home_team_id: slot.home_team_id,
          away_team_id: slot.away_team_id,
          game_week: slot.game_week,
          scheduled_date: slot.scheduled_date,
        });
      }
    });
    insertAll();
  }

  // Initialize game_state to Jan 1 of season year (tied to the first league's season)
  const gs = db.prepare("SELECT id FROM game_state WHERE id = 1").get();
  if (!gs && primarySeasonId !== null) {
    db.prepare("INSERT OR IGNORE INTO game_state (id, current_date, season_id) VALUES (1, ?, ?)").run(`${year}-01-01`, primarySeasonId);
  }
}

function seedLeagueConfigs(db: Database.Database) {
  // Look up leagues by tier to avoid fragile name-string lookups
  const tier2League = db.prepare("SELECT id FROM leagues WHERE tier = 2 LIMIT 1").get() as { id: number } | undefined;
  const tier3Leagues = db.prepare("SELECT id FROM leagues WHERE tier = 3 ORDER BY id").all() as { id: number }[];

  const div2NorthLeague = tier3Leagues[0];
  const div2SouthLeague = tier3Leagues[1];

  const premierConfig: LeagueConfig = {
    team_count: 16,
    format: {
      type: 'multi_conference',
      conferences: [
        { name: 'north', region_tag: 'north', size: 8 },
        { name: 'south', region_tag: 'south', size: 8 },
      ],
    },
    regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 4, end_day: 30 },
    post_season: {
      type: 'conference_playoffs',
      start_month: 5,
      start_day: 1,
      series_length: 5,
      rounds: [
        { name: 'Conference Semifinals', scope: 'per_conference', teams_per_conference: 4, matchup_pattern: 'top_vs_bottom' },
        { name: 'Conference Finals', scope: 'per_conference', matchup_pattern: 'top_vs_bottom' },
        { name: 'Grand Final', scope: 'cross_conference' },
      ],
    },
    tiebreakers: ['points', 'score_diff', 'set_diff'],
    cup_participation: {
      qualifier: 'top_n_per_league',
      top_n: 4,
      cups: ['national', 'cl'],
    },
  };

  const div2Config: LeagueConfig = {
    team_count: 16,
    format: { type: 'single_table' },
    regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 6, end_day: 30 },
    post_season: { type: 'none' },
    tiebreakers: ['points', 'score_diff', 'set_diff'],
    cup_participation: {
      qualifier: 'all_country',
      cups: ['national'],
    },
  };

  const superligaPolska = db.prepare("SELECT id FROM leagues WHERE league_name = 'Superliga Polska' LIMIT 1").get() as { id: number } | undefined;

  const superligaPolskaConfig: LeagueConfig = {
    team_count: 20,
    format: { type: 'single_table' },
    regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 6, end_day: 30 },
    post_season: { type: 'none' },
    tiebreakers: ['points', 'score_diff', 'set_diff'],
    cup_participation: {
      qualifier: 'all_country',
      cups: ['national'],
    },
  };

  const insertPreset = db.prepare("INSERT OR IGNORE INTO league_presets (preset_name, config) VALUES (?, ?)");
  insertPreset.run("Italian Premier Division", JSON.stringify(premierConfig));
  insertPreset.run("Division 2 Standard", JSON.stringify(div2Config));
  insertPreset.run("Superliga Polska Standard", JSON.stringify(superligaPolskaConfig));

  const insertConfig = db.prepare("INSERT OR IGNORE INTO league_configs (league_id, config) VALUES (?, ?)");

  if (tier2League) {
    insertConfig.run(tier2League.id, JSON.stringify(premierConfig));
  }
  if (div2NorthLeague) {
    insertConfig.run(div2NorthLeague.id, JSON.stringify(div2Config));
  }
  if (div2SouthLeague) {
    insertConfig.run(div2SouthLeague.id, JSON.stringify(div2Config));
  }
  if (superligaPolska) {
    insertConfig.run(superligaPolska.id, JSON.stringify(superligaPolskaConfig));
  }

  // Seed league_links only if none exist
  const existingLinks = db.prepare("SELECT COUNT(*) as c FROM league_links").get() as { c: number };
  if (existingLinks.c > 0) return;

  if (!tier2League || !div2NorthLeague || !div2SouthLeague) return;

  const insertLink = db.prepare(
    "INSERT INTO league_links (from_league_id, to_league_id, from_condition, to_condition, priority) VALUES (?, ?, ?, ?, ?)"
  );

  // 1. Relegate bottom 1 of north conference from Premier → Div2 North
  insertLink.run(
    tier2League.id, div2NorthLeague.id,
    JSON.stringify({ scope: 'conference', conference: 'north', position: 'bottom', count: 1 }),
    JSON.stringify({ region: 'north', position: 'any' }),
    1
  );
  // 2. Relegate bottom 1 of south conference from Premier → Div2 South
  insertLink.run(
    tier2League.id, div2SouthLeague.id,
    JSON.stringify({ scope: 'conference', conference: 'south', position: 'bottom', count: 1 }),
    JSON.stringify({ region: 'south', position: 'any' }),
    2
  );
  // 3. Promote top 1 of Div2 North whole table → Premier, region=north
  insertLink.run(
    div2NorthLeague.id, tier2League.id,
    JSON.stringify({ scope: 'whole_table', position: 'top', count: 1 }),
    JSON.stringify({ region: 'north', position: 'any' }),
    3
  );
  // 4. Promote top 1 of Div2 South whole table → Premier, region=south
  insertLink.run(
    div2SouthLeague.id, tier2League.id,
    JSON.stringify({ scope: 'whole_table', position: 'top', count: 1 }),
    JSON.stringify({ region: 'south', position: 'any' }),
    4
  );
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
  const mb1 = pick('Middle Blocker') ?? pickAny();
  const opp = pick('Opposite Hitter') ?? pickAny();
  const s = pick('Setter') ?? pickAny();
  const mb2 = pick('Middle Blocker') ?? pickAny();
  const oh2 = pick('Outside Hitter') ?? pickAny();
  const lib = pick('Libero') ?? pickAny();

  db.prepare(`
    INSERT OR IGNORE INTO squad_lineups
      (team_id, oh1_player_id, mb1_player_id, opp_player_id, s_player_id, mb2_player_id, oh2_player_id, l_player_id)
    VALUES (6, ?, ?, ?, ?, ?, ?, ?)
  `).run(oh1, mb1, opp, s, mb2, oh2, lib);
}
