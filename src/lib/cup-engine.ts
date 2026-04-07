/**
 * Cup Engine
 *
 * Drives the Copa Italia (National Cup) with a 2-tier entry format:
 * - Round 1: IVL North & IVL South teams (32 teams)
 * - Round 2: R1 winners (16) + IVL Premier Division (16) (32 teams total)
 * - Round 3-5: Single elimination
 * - Final: Best-of-3 series
 *
 * Cup matchdays are on Mondays, Wednesdays, and Fridays in July (Jul 1 – Jul 31).
 */

import { getDb } from './db/index';
import { getCupMatchdays } from './schedule-engine';

export interface CupCompetition {
  id: number;
  name: string;
  cup_type: 'national' | 'cl' | 'secondary';
  format: 'single_elimination' | 'group_knockout';
  country: string | null;
  year: number;
  status: 'active' | 'completed';
}

/**
 * Generate all cup competitions for a given year.
 * Called when advancing past Jun 30 (league block ends).
 */
export function generateAllCups(year: number): void {
  const db = getDb();

  const execute = db.transaction(() => {
    _generateAllCupsInternal(db, year);
  });
  execute();
}

function _generateAllCupsInternal(db: any, year: number): void {
  // We now only generate the National Cup (Copa Italia)
  const cupName = 'Copa Italia';
  const cupType = 'national';
  const format = 'single_elimination';
  const country = 'Italy';

  // Create the cup_competitions row
  const cupResult = db.prepare(`
    INSERT OR IGNORE INTO cup_competitions (name, cup_type, format, country, year, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(cupName, cupType, format, country, year);

  if (cupResult.changes === 0) {
    // Cup already exists for this year
    return;
  }

  const cupId = Number(cupResult.lastInsertRowid);

  // Get matchday dates (Mondays)
  const matchdays = getCupMatchdays(year, 'national');

  // Fetch teams for Round 1: IVL North (2) and IVL South (3)
  const tier3Teams = db.prepare(`
    SELECT id FROM teams WHERE league_id IN (2, 3)
  `).all() as { id: number }[];

  const teamsR1 = shuffle(tier3Teams.map(t => t.id));

  // Define All Knockout Rounds
  // Round 1: 32 teams (North/South) -> 16 winners
  // Round 2: 16 winners + 16 Premier -> 16 winners
  // Round 3: Round of 16 -> 8 winners
  // Round 4: Quarter Finals -> 4 winners
  // Round 5: Semi Finals -> 2 winners
  // Round 6: Grand Final (Best of 3)
  const roundNames = [
    'Round 1',
    'Round 2 (Premier Entry)',
    'Round of 16',
    'Quarter Finals',
    'Semi Finals',
    'Grand Final'
  ];

  const roundIds: number[] = [];
  for (let i = 0; i < roundNames.length; i++) {
    const isFinal = roundNames[i] === 'Grand Final';
    const startDate = matchdays[i] || matchdays[matchdays.length - 1];
    const endDate = isFinal 
      ? (matchdays[i + 2] || matchdays[matchdays.length - 1]) 
      : startDate;

    const res = db.prepare(`
      INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
      VALUES (?, ?, ?, 'knockout', ?, ?, 'scheduled')
    `).run(cupId, i + 1, roundNames[i], startDate, endDate);
    roundIds.push(Number(res.lastInsertRowid));
  }

  // Seed Round 1
  const round1Id = roundIds[0];
  const dateR1 = matchdays[0];
  for (let i = 0; i < teamsR1.length; i += 2) {
    db.prepare(`
      INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(cupId, round1Id, teamsR1[i], teamsR1[i+1], dateR1);
  }
}

/**
 * Advance a cup to the next round after the current round completes.
 */
export function advanceCupRound(cupId: number): void {
  const db = getDb();

  const cup = db.prepare('SELECT * FROM cup_competitions WHERE id = ?').get(cupId) as CupCompetition | undefined;
  if (!cup) throw new Error('Cup not found');

  const currentRound = db.prepare(`
    SELECT * FROM cup_rounds WHERE cup_id = ? AND status != 'completed'
    ORDER BY round_number ASC LIMIT 1
  `).get(cupId) as { id: number; round_number: number; round_type: string; round_name: string } | undefined;

  if (!currentRound) {
    db.prepare('UPDATE cup_competitions SET status = ? WHERE id = ?').run('completed', cupId);
    return;
  }

  // Special Handling for Best-of-3 Final (Round 6)
  if (currentRound.round_name === 'Grand Final') {
    handleBestOf3Final(cupId, currentRound.id);
    return;
  }

  // Normal Rounds: Check if current round's fixtures are all complete
  const pendingFixtures = db.prepare(`
    SELECT COUNT(*) as c FROM cup_fixtures
    WHERE round_id = ? AND status != 'completed'
  `).get(currentRound.id) as { c: number };

  if (pendingFixtures.c > 0) return;

  // Mark current round complete
  db.prepare('UPDATE cup_rounds SET status = ? WHERE id = ?').run('completed', currentRound.id);

  // Seed next round
  const nextRound = db.prepare(`
    SELECT id, round_number, round_name FROM cup_rounds WHERE cup_id = ? AND round_number = ?
  `).get(cupId, currentRound.round_number + 1) as { id: number; round_number: number; round_name: string } | undefined;

  if (!nextRound) {
    db.prepare('UPDATE cup_competitions SET status = ? WHERE id = ?').run('completed', cupId);
    return;
  }

  if (currentRound.round_number === 1) {
    // Round 1 -> Round 2 (Inject Premier Division)
    seedRound2WithPremier(cupId, currentRound.id, nextRound.id);
  } else {
    // Standard progression
    seedNextKnockoutRound(cupId, currentRound.id, nextRound.id);
  }

  // Recursively advance (if round was already complete somehow)
  advanceCupRound(cupId);
}

/**
 * Seed Round 2: 16 winners from R1 + 16 teams from IVL Premier (1).
 */
function seedRound2WithPremier(cupId: number, r1Id: number, r2Id: number): void {
  const db = getDb();
  const winnersR1 = db.prepare(`
    SELECT winner_team_id FROM cup_fixtures WHERE round_id = ?
  `).all(r1Id) as { winner_team_id: number }[];

  const premierTeams = db.prepare(`
    SELECT id FROM teams WHERE league_id = 1
  `).all() as { id: number }[];

  const pool = shuffle([...winnersR1.map(w => w.winner_team_id), ...premierTeams.map(p => p.id)]);
  const cup = db.prepare('SELECT year FROM cup_competitions WHERE id = ?').get(cupId) as { year: number };
  const matchdays = getCupMatchdays(cup.year, 'national');
  const dateR2 = matchdays[1];

  for (let i = 0; i < pool.length; i += 2) {
    db.prepare(`
      INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(cupId, r2Id, pool[i], pool[i+1], dateR2);
  }
}

/**
 * Standard knockout seeding.
 */
function seedNextKnockoutRound(cupId: number, currentRoundId: number, nextRoundId: number): void {
  const db = getDb();
  const winners = db.prepare(`
    SELECT winner_team_id FROM cup_fixtures WHERE round_id = ?
  `).all(currentRoundId) as { winner_team_id: number }[];

  const pool = shuffle(winners.map(w => w.winner_team_id));
  const cup = db.prepare('SELECT * FROM cup_competitions WHERE id = ?').get(cupId) as CupCompetition;
  const nextRound = db.prepare('SELECT round_number FROM cup_rounds WHERE id = ?').get(nextRoundId) as { round_number: number };
  const matchdays = getCupMatchdays(cup.year, 'national');
  const date = matchdays[nextRound.round_number - 1];

  // Special Handling: Grand Final (Round 6) logic creates multiple fixtures
  const isFinal = nextRound.round_number === 6;

  for (let i = 0; i < pool.length; i += 2) {
    if (i + 1 < pool.length) {
      if (isFinal) {
        // Create 3 fixtures for BO3
        for (let g = 0; g < 3; g++) {
          const finalDate = matchdays[5 + g];
          db.prepare(`
            INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
            VALUES (?, ?, ?, ?, ?, 'scheduled')
          `).run(cupId, nextRoundId, pool[i], pool[i+1], finalDate);
        }
      } else {
        db.prepare(`
          INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
          VALUES (?, ?, ?, ?, ?, 'scheduled')
        `).run(cupId, nextRoundId, pool[i], pool[i+1], date);
      }
    }
  }
}

/**
 * Handle Best-of-3 Final series completion.
 */
function handleBestOf3Final(cupId: number, roundId: number): void {
  const db = getDb();
  const fixtures = db.prepare(`
    SELECT * FROM cup_fixtures WHERE round_id = ?
  `).all(roundId) as any[];

  if (fixtures.length === 0) return;

  const team1 = fixtures[0].home_team_id;
  const team2 = fixtures[0].away_team_id;

  const wins1 = fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team1).length;
  const wins2 = fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team2).length;

  if (wins1 >= 2 || wins2 >= 2) {
    // Series won!
    db.prepare('UPDATE cup_rounds SET status = ? WHERE id = ?').run('completed', roundId);
    db.prepare('UPDATE cup_competitions SET status = ? WHERE id = ?').run('completed', cupId);
    
    // Cancel remaining unplayed fixtures in this round if any
    db.prepare("UPDATE cup_fixtures SET status = 'completed', played_at = datetime('now') WHERE round_id = ? AND status = 'scheduled'").run(roundId);
  }
}

/**
 * Record result of a cup fixture.
 */
export function recordCupFixtureResult(
  fixtureId: number,
  result: { home_sets: number; away_sets: number; home_points: number; away_points: number },
): void {
  const db = getDb();

  const fixture = db.prepare(`
    SELECT * FROM cup_fixtures WHERE id = ?
  `).get(fixtureId) as { id: number; cup_id: number; home_team_id: number; away_team_id: number };

  if (!fixture) return;

  const winner = result.home_sets > result.away_sets ? fixture.home_team_id : fixture.away_team_id;

  db.prepare(`
    UPDATE cup_fixtures
    SET status = 'completed', 
        home_sets = ?, away_sets = ?, 
        home_points = ?, away_points = ?, 
        winner_team_id = ?, 
        played_at = datetime('now')
    WHERE id = ?
  `).run(result.home_sets, result.away_sets, result.home_points, result.away_points, winner, fixtureId);

  advanceCupRound(fixture.cup_id);
}

/**
 * Get cup fixtures for a date.
 */
export function getCupFixturesByDate(date: string): any[] {
  return getDb().prepare(`
    SELECT cf.*, ht.team_name as home_team_name, at.team_name as away_team_name, cc.name as cup_name
    FROM cup_fixtures cf
    JOIN teams ht ON cf.home_team_id = ht.id
    JOIN teams at ON cf.away_team_id = at.id
    JOIN cup_competitions cc ON cf.cup_id = cc.id
    WHERE cf.scheduled_date = ? AND cf.status = 'scheduled'
  `).all(date);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
