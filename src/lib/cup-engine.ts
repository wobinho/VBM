/**
 * Cup Engine
 *
 * Drives the cup block (Aug 1 – Dec 31) with config-driven formats:
 * - single_elimination: standard knockout
 * - group_knockout: group stage (round-robin) → knockout bracket
 *
 * Cup day slots are determined by cup_type:
 * - 'national': Mondays
 * - 'cl': Wednesdays
 * - 'secondary': Fridays
 *
 * Participation is governed by LeagueConfig.cup_participation:
 * - 'all_country': all teams where teams.country = cup.country
 * - 'top_n_per_league': top N finishers from each contributing league
 * - 'none': league does not participate
 */

import { getDb } from './db/index';
import { getCupMatchdays } from './schedule-engine';
import { getLeagueConfig } from './league-engine';

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
 * Called when advancing past Jul 31 (league block ends).
 */
export function generateAllCups(year: number): void {
  const db = getDb();

  // Fetch all active leagues with configs
  const leagues = db.prepare(`
    SELECT l.id, l.tier, l.country, lc.config
    FROM leagues l
    LEFT JOIN league_configs lc ON l.id = lc.league_id
  `).all() as Array<{ id: number; tier: number; country: string; config: string | null }>;

  const cupsByType = new Map<string, { name: string; format: 'single_elimination' | 'group_knockout'; teams: Set<number> }>();

  // Determine which teams participate in which cups
  for (const league of leagues) {
    if (!league.config) continue;

    const config = JSON.parse(league.config);
    const cupParticipation = config.cup_participation;

    if (!cupParticipation || cupParticipation.qualifier === 'none') {
      continue;
    }

    let participatingTeams: number[] = [];

    if (cupParticipation.qualifier === 'all_country') {
      // All teams from this league's country
      participatingTeams = db.prepare(
        'SELECT id FROM teams WHERE country = ? ORDER BY id'
      ).all(league.country) as { id: number }[] | []
        ? (db.prepare('SELECT id FROM teams WHERE country = ?').all(league.country) as { id: number }[]).map(t => t.id)
        : [];
    } else if (cupParticipation.qualifier === 'top_n_per_league') {
      // Top N teams from this league
      const topN = cupParticipation.top_n ?? 4;
      participatingTeams = db.prepare(`
        SELECT id FROM teams
        WHERE league_id = ?
        ORDER BY points DESC, score_diff DESC, (sets_won - sets_lost) DESC
        LIMIT ?
      `).all(league.id, topN) as { id: number }[]
        ? (db.prepare(`
          SELECT id FROM teams
          WHERE league_id = ?
          ORDER BY points DESC, score_diff DESC, (sets_won - sets_lost) DESC
          LIMIT ?
        `).all(league.id, topN) as { id: number }[]).map(t => t.id)
        : [];
    }

    // Register participating teams for each cup type
    for (const cupType of (cupParticipation.cups ?? [])) {
      if (!cupsByType.has(cupType)) {
        // Determine cup name and format (simplified — can be extended to config)
        const cupName = cupType === 'national' ? `National Cup` : cupType === 'cl' ? 'Champions League' : 'Secondary Cup';
        const format: 'single_elimination' | 'group_knockout' = cupType === 'national' ? 'single_elimination' : 'group_knockout';
        cupsByType.set(cupType, { name: cupName, format, teams: new Set() });
      }
      const cup = cupsByType.get(cupType)!;
      participatingTeams.forEach(t => cup.teams.add(t));
    }
  }

  // Create each cup competition and its rounds/fixtures
  for (const [cupType, cupInfo] of cupsByType) {
    const cupName = cupInfo.name;
    const format = cupInfo.format;
    const teams = Array.from(cupInfo.teams);

    if (teams.length < 2) continue; // Can't have a cup with < 2 teams

    // Determine the country (for national cups, infer from teams; for international, NULL)
    const country = cupType === 'national'
      ? (db.prepare('SELECT DISTINCT country FROM teams WHERE id IN (?, ?, ?) LIMIT 1').get(teams[0], teams[1] ?? teams[0], teams[2] ?? teams[0]) as { country: string } | undefined)?.country ?? null
      : null;

    // Create the cup_competitions row
    const cupResult = db.prepare(`
      INSERT INTO cup_competitions (name, cup_type, format, country, year, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(cupName, cupType, format, country, year);

    const cupId = Number(cupResult.lastInsertRowid);

    // Get matchday dates for this cup type
    const matchdays = getCupMatchdays(year, cupType as 'national' | 'cl' | 'secondary');

    // Generate the bracket and fixtures
    generateCupSchedule(cupId, cupType as 'national' | 'cl' | 'secondary', format, teams, matchdays);
  }
}

/**
 * Generate the bracket structure and initial round fixtures for a cup.
 */
function generateCupSchedule(
  cupId: number,
  cupType: 'national' | 'cl' | 'secondary',
  format: 'single_elimination' | 'group_knockout',
  teams: number[],
  matchdays: string[],
): void {
  const db = getDb();

  if (format === 'single_elimination') {
    generateSingleElimination(cupId, teams, matchdays);
  } else if (format === 'group_knockout') {
    generateGroupKnockout(cupId, teams, matchdays);
  }
}

/**
 * Single-elimination bracket: seeds round 1, later rounds generated dynamically.
 */
function generateSingleElimination(cupId: number, teams: number[], matchdays: string[]): void {
  const db = getDb();
  const n = teams.length;

  // Shuffle teams to randomize bracket
  const shuffled = shuffle([...teams]);

  // Round up to next power of 2 (add byes if needed)
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(n)));
  const byeCount = nextPowerOf2 - n;

  // Create Round 1
  const roundResult = db.prepare(`
    INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
    VALUES (?, 1, 'Round of 16', 'knockout', ?, ?, 'scheduled')
  `).run(cupId, matchdays[0], matchdays[Math.min(2, matchdays.length - 1)]);

  const roundId = Number(roundResult.lastInsertRowid);

  // Pair up teams for round 1
  let fixtureIndex = 0;
  for (let i = 0; i < nextPowerOf2; i += 2) {
    const homeTeamId = i < shuffled.length ? shuffled[i] : null;
    const awayTeamId = i + 1 < shuffled.length ? shuffled[i + 1] : null;

    if (!homeTeamId || !awayTeamId) {
      // One team gets a bye (advance automatically)
      // For now, skip — can be implemented as a special "bye" fixture
      continue;
    }

    const fixtureDate = matchdays[fixtureIndex % matchdays.length];
    db.prepare(`
      INSERT INTO cup_fixtures
        (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(cupId, roundId, homeTeamId, awayTeamId, fixtureDate);

    fixtureIndex++;
  }
}

/**
 * Group-knockout: group stage (round-robin), then knockout bracket.
 */
function generateGroupKnockout(cupId: number, teams: number[], matchdays: string[]): void {
  const db = getDb();
  const n = teams.length;

  // Divide into groups (e.g., 4 groups of 4 for CL)
  const groupCount = Math.max(2, Math.ceil(n / 4));
  const teamsPerGroup = Math.ceil(n / groupCount);

  const shuffled = shuffle([...teams]);

  // Create Group Stage round
  const roundResult = db.prepare(`
    INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
    VALUES (?, 1, 'Group Stage', 'group', ?, ?, 'scheduled')
  `).run(cupId, matchdays[0], matchdays[Math.min(9, matchdays.length - 1)]);

  const roundId = Number(roundResult.lastInsertRowid);

  // Create groups and fixtures
  let teamIndex = 0;
  for (let g = 0; g < groupCount; g++) {
    const groupResult = db.prepare(`
      INSERT INTO cup_groups (round_id, group_name)
      VALUES (?, ?)
    `).run(roundId, String.fromCharCode(65 + g)); // A, B, C, ...

    const groupId = Number(groupResult.lastInsertRowid);

    const groupTeams: number[] = [];
    for (let t = 0; t < teamsPerGroup && teamIndex < shuffled.length; t++) {
      const teamId = shuffled[teamIndex++];
      groupTeams.push(teamId);

      // Insert into cup_group_teams
      db.prepare(`
        INSERT INTO cup_group_teams (group_id, team_id, played, won, lost, points, sets_won, sets_lost)
        VALUES (?, ?, 0, 0, 0, 0, 0, 0)
      `).run(groupId, teamId);
    }

    // Round-robin fixtures within the group
    let fixtureIndex = 0;
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        const fixtureDate = matchdays[fixtureIndex % matchdays.length];
        db.prepare(`
          INSERT INTO cup_fixtures
            (cup_id, round_id, group_id, home_team_id, away_team_id, scheduled_date, status)
          VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
        `).run(cupId, roundId, groupId, groupTeams[i], groupTeams[j], fixtureDate);

        fixtureIndex++;
      }
    }
  }

  // Placeholder knockout rounds (seeded after group stage completes)
  const knockoutRounds = [
    { number: 2, name: 'Quarter Finals' },
    { number: 3, name: 'Semi Finals' },
    { number: 4, name: 'Final' },
  ];

  for (const r of knockoutRounds) {
    db.prepare(`
      INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
      VALUES (?, ?, ?, 'knockout', ?, ?, 'scheduled')
    `).run(cupId, r.number, r.name, matchdays[0], matchdays[matchdays.length - 1]);
  }
}

/**
 * Advance a cup to the next round after the current round completes.
 * For single-elim: seeds next knockout round from winners.
 * For group-knockout: after group stage, seeds knockout bracket from top-2 of each group.
 */
export function advanceCupRound(cupId: number): void {
  const db = getDb();

  const cup = db.prepare('SELECT * FROM cup_competitions WHERE id = ?').get(cupId) as CupCompetition | undefined;
  if (!cup) throw new Error('Cup not found');

  const currentRound = db.prepare(`
    SELECT * FROM cup_rounds WHERE cup_id = ? AND status != 'completed'
    ORDER BY round_number ASC LIMIT 1
  `).get(cupId) as { round_number: number; round_type: string } | undefined;

  if (!currentRound) {
    // All rounds complete
    db.prepare('UPDATE cup_competitions SET status = ? WHERE id = ?').run('completed', cupId);
    return;
  }

  // Check if current round's fixtures are all complete
  const pendingFixtures = db.prepare(`
    SELECT COUNT(*) as c FROM cup_fixtures
    WHERE round_id IN (SELECT id FROM cup_rounds WHERE cup_id = ? AND round_number = ?)
      AND status != 'completed'
  `).get(cupId, currentRound.round_number) as { c: number };

  if (pendingFixtures.c > 0) {
    // Round not yet complete
    return;
  }

  // Mark current round complete
  db.prepare('UPDATE cup_rounds SET status = ? WHERE cup_id = ? AND round_number = ?')
    .run('completed', cupId, currentRound.round_number);

  // Seed next round
  const nextRound = db.prepare(`
    SELECT id, round_type FROM cup_rounds WHERE cup_id = ? AND round_number = ?
  `).get(cupId, currentRound.round_number + 1) as { id: number; round_type: string } | undefined;

  if (!nextRound) {
    // No next round — cup is complete
    db.prepare('UPDATE cup_competitions SET status = ? WHERE id = ?').run('completed', cupId);
    return;
  }

  if (currentRound.round_type === 'group' && nextRound.round_type === 'knockout') {
    // Group stage just completed — seed knockout from group winners/runners-up
    seedKnockoutFromGroups(cupId, nextRound.id);
  } else if (currentRound.round_type === 'knockout' && nextRound.round_type === 'knockout') {
    // Knockout to knockout — seed from winners
    seedNextKnockoutRound(cupId, currentRound.round_number, nextRound.id);
  }

  // Recursively advance if the next round is now complete (e.g., if it had byes)
  advanceCupRound(cupId);
}

/**
 * After group stage: seed knockout bracket from group winners.
 */
function seedKnockoutFromGroups(cupId: number, knockoutRoundId: number): void {
  const db = getDb();

  // Get the group stage round
  const groupRound = db.prepare(`
    SELECT id FROM cup_rounds WHERE cup_id = ? AND round_type = 'group'
  `).get(cupId) as { id: number };

  // Get all groups
  const groups = db.prepare(`
    SELECT id FROM cup_groups WHERE round_id = ?
  `).all(groupRound.id) as { id: number }[];

  const qualifiedTeams: number[] = [];

  // Get winner (and runner-up for top-2 advancement) from each group
  for (const group of groups) {
    const standings = db.prepare(`
      SELECT team_id, points, (sets_won - sets_lost) as set_diff
      FROM cup_group_teams
      WHERE group_id = ?
      ORDER BY points DESC, set_diff DESC
      LIMIT 2
    `).all(group.id) as { team_id: number }[];

    // For now, only take the winner; can be extended to top-2
    if (standings.length > 0) {
      qualifiedTeams.push(standings[0].team_id);
    }
  }

  // Seed knockout with qualified teams (placeholder pairing)
  const matchdays = getCupMatchdays(new Date().getFullYear(), 'national'); // Reuse matchday calendar

  for (let i = 0; i < qualifiedTeams.length; i += 2) {
    if (i + 1 < qualifiedTeams.length) {
      const fixtureDate = matchdays[i / 2 % matchdays.length];
      db.prepare(`
        INSERT INTO cup_fixtures
          (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
        VALUES (?, ?, ?, ?, ?, 'scheduled')
      `).run(cupId, knockoutRoundId, qualifiedTeams[i], qualifiedTeams[i + 1], fixtureDate);
    }
  }
}

/**
 * Knockout to knockout: seed next round from winners of current knockout round.
 */
function seedNextKnockoutRound(cupId: number, currentRoundNumber: number, nextRoundId: number): void {
  const db = getDb();

  // Get winners from current knockout round
  const currentRound = db.prepare(`
    SELECT id FROM cup_rounds WHERE cup_id = ? AND round_number = ?
  `).get(cupId, currentRoundNumber) as { id: number };

  const winners = db.prepare(`
    SELECT winner_team_id FROM cup_fixtures
    WHERE round_id = ? AND winner_team_id IS NOT NULL
  `).all(currentRound.id) as { winner_team_id: number }[];

  const matchdays = getCupMatchdays(new Date().getFullYear(), 'national');

  // Pair up winners for next round
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      const fixtureDate = matchdays[i / 2 % matchdays.length];
      db.prepare(`
        INSERT INTO cup_fixtures
          (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
        VALUES (?, ?, ?, ?, ?, 'scheduled')
      `).run(cupId, nextRoundId, winners[i].winner_team_id, winners[i + 1].winner_team_id, fixtureDate);
    }
  }
}

/**
 * Get cup fixtures scheduled for a given date.
 */
export function getCupFixturesByDate(date: string): Array<{
  id: number;
  home_team_id: number;
  away_team_id: number;
  scheduled_date: string;
  status: string;
}> {
  const db = getDb();
  return db.prepare(`
    SELECT id, home_team_id, away_team_id, scheduled_date, status
    FROM cup_fixtures
    WHERE scheduled_date = ? AND status = 'scheduled'
  `).all(date) as Array<{ id: number; home_team_id: number; away_team_id: number; scheduled_date: string; status: string }>;
}

/**
 * Record the result of a cup fixture.
 * Updates winner_team_id, updates group standings (if group fixture), then advances cup.
 */
export function recordCupFixtureResult(
  fixtureId: number,
  result: { home_sets: number; away_sets: number; home_points: number; away_points: number },
): void {
  const db = getDb();

  const fixture = db.prepare(`
    SELECT * FROM cup_fixtures WHERE id = ?
  `).get(fixtureId) as {
    id: number;
    cup_id: number;
    round_id: number;
    group_id: number | null;
    home_team_id: number;
    away_team_id: number;
  };

  const homeSets = result.home_sets;
  const awaySets = result.away_sets;

  const winner = homeSets > awaySets ? fixture.home_team_id : fixture.away_team_id;

  // Update fixture result
  db.prepare(`
    UPDATE cup_fixtures
    SET status = ?, home_sets = ?, away_sets = ?, home_points = ?, away_points = ?, winner_team_id = ?, played_at = datetime('now')
    WHERE id = ?
  `).run('completed', homeSets, awaySets, result.home_points, result.away_points, winner, fixtureId);

  // Update group standings if group fixture
  if (fixture.group_id) {
    const homeTeamGroup = db.prepare('SELECT * FROM cup_group_teams WHERE group_id = ? AND team_id = ?')
      .get(fixture.group_id, fixture.home_team_id) as { played: number; won: number; lost: number; points: number; sets_won: number; sets_lost: number };
    const awayTeamGroup = db.prepare('SELECT * FROM cup_group_teams WHERE group_id = ? AND team_id = ?')
      .get(fixture.group_id, fixture.away_team_id) as { played: number; won: number; lost: number; points: number; sets_won: number; sets_lost: number };

    const homeWins = homeSets > awaySets ? 1 : 0;
    const awayWins = awaySets > homeSets ? 1 : 0;
    const homePoints = homeWins * 3;
    const awayPoints = awayWins * 3;

    db.prepare(`
      UPDATE cup_group_teams
      SET played = ?, won = ?, lost = ?, points = ?, sets_won = ?, sets_lost = ?
      WHERE group_id = ? AND team_id = ?
    `).run(
      homeTeamGroup.played + 1,
      homeTeamGroup.won + homeWins,
      homeTeamGroup.lost + (1 - homeWins),
      homeTeamGroup.points + homePoints,
      homeTeamGroup.sets_won + homeSets,
      homeTeamGroup.sets_lost + awaySets,
      fixture.group_id,
      fixture.home_team_id,
    );

    db.prepare(`
      UPDATE cup_group_teams
      SET played = ?, won = ?, lost = ?, points = ?, sets_won = ?, sets_lost = ?
      WHERE group_id = ? AND team_id = ?
    `).run(
      awayTeamGroup.played + 1,
      awayTeamGroup.won + awayWins,
      awayTeamGroup.lost + (1 - awayWins),
      awayTeamGroup.points + awayPoints,
      awayTeamGroup.sets_won + awaySets,
      awayTeamGroup.sets_lost + homeSets,
      fixture.group_id,
      fixture.away_team_id,
    );
  }

  // Advance cup to next round if current round is complete
  const cup = db.prepare('SELECT cup_id FROM cup_fixtures WHERE id = ?').get(fixtureId) as { cup_id: number };
  advanceCupRound(cup.cup_id);
}

/**
 * Fisher-Yates shuffle — mutates array in place.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
