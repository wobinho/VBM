import Database from 'better-sqlite3';
import path from 'path';
import { runSchema } from './schema';
import { seedDatabase } from './seed';
import { generateTripleRoundRobin } from '../schedule-engine';

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

    // Migration: new player stat schema (Technical + expanded Physical/Mental)
    const playerCols = db.prepare("PRAGMA table_info(players)").all() as {name: string}[];
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
    }
  }
  return db;
}

function seedInitialSeason(db: Database.Database) {
  // Get the first active league
  const league = db.prepare("SELECT id FROM leagues ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  if (!league) return;

  // Get all teams in that league
  const teams = db.prepare("SELECT id FROM teams WHERE league_id = ? ORDER BY id").all(league.id) as { id: number }[];
  if (teams.length < 2) return;

  const year = 2026;
  const seasonName = `${year} Season`;

  // Insert season
  const seasonResult = db.prepare(`
    INSERT OR IGNORE INTO seasons (league_id, year, name, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(league.id, year, seasonName, `${year}-01-01`, `${year}-12-31`);

  let seasonId: number;
  if (seasonResult.changes === 0) {
    // Already existed
    const existing = db.prepare("SELECT id FROM seasons WHERE league_id = ? AND year = ?").get(league.id, year) as { id: number };
    seasonId = existing.id;
  } else {
    seasonId = Number(seasonResult.lastInsertRowid);
  }

  // Only seed fixtures if none exist for this season
  const existingFixtures = db.prepare("SELECT COUNT(*) as c FROM fixtures WHERE season_id = ?").get(seasonId) as { c: number };
  if (existingFixtures.c > 0) {
    // Set game_state if missing
    const gs = db.prepare("SELECT id FROM game_state WHERE id = 1").get();
    if (!gs) {
      db.prepare("INSERT OR IGNORE INTO game_state (id, current_date, season_id) VALUES (1, ?, ?)").run(`${year}-01-01`, seasonId);
    }
    return;
  }

  // Generate fixtures
  const teamIds = teams.map(t => t.id);
  const slots = generateTripleRoundRobin(teamIds, year);

  const insertFixture = db.prepare(`
    INSERT INTO fixtures (season_id, league_id, home_team_id, away_team_id, game_week, scheduled_date)
    VALUES (@season_id, @league_id, @home_team_id, @away_team_id, @game_week, @scheduled_date)
  `);
  const insertAll = db.transaction(() => {
    for (const slot of slots) {
      insertFixture.run({
        season_id:      seasonId,
        league_id:      league.id,
        home_team_id:   slot.home_team_id,
        away_team_id:   slot.away_team_id,
        game_week:      slot.game_week,
        scheduled_date: slot.scheduled_date,
      });
    }
  });
  insertAll();

  // Initialize game_state to Jan 1 of season year
  db.prepare("INSERT OR REPLACE INTO game_state (id, current_date, season_id) VALUES (1, ?, ?)").run(`${year}-01-01`, seasonId);
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
