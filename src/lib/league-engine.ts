/**
 * League Engine
 *
 * Config-driven replacement for hardcoded league logic.
 * Reads from league_configs and league_links tables to drive:
 *   - Schedule generation (rounds, dates)
 *   - Post-season (playoff) generation
 *   - Promotion / relegation
 *
 * Phase 1 note: advancePlayoffRound() in queries.ts still hardcodes 'north'/'south'
 * conference names. This is acceptable while the Italian league is the only playoff
 * league. Making it config-driven is a Phase 2 concern.
 */

import { getDb } from './db/index';
import { generateRoundRobinSchedule, generateTripleRoundRobin, type FixtureSlot } from './schedule-engine';
import { getPlayoffRoundDates } from './schedule-engine';

// ── Config types ─────────────────────────────────────────────────────────────

export interface ConferenceDefinition {
  name: string;        // e.g. 'north', 'south'
  region_tag: string;  // matches teams.region column
  size: number;
}

export interface PlayoffRoundDefinition {
  name: string;
  scope: 'per_conference' | 'cross_conference';
  teams_per_conference?: number;
  matchup_pattern?: 'top_vs_bottom';
}

export interface LeagueConfig {
  team_count: number;

  format: {
    type: 'single_table' | 'multi_conference';
    conferences?: ConferenceDefinition[];
  };

  regular_season: {
    rounds: number;       // 1=single, 2=double, 3=triple round-robin
    start_month: number;  // 1-based
    start_day: number;
    end_month: number;
    end_day: number;
  };

  post_season: {
    type: 'none' | 'conference_playoffs';
    start_month?: number;
    start_day?: number;
    series_length?: number;   // e.g. 5 for best-of-5
    rounds?: PlayoffRoundDefinition[];
  };

  tiebreakers: Array<'points' | 'score_diff' | 'set_diff'>;

  cup_participation?: {
    qualifier: 'all_country' | 'top_n_per_league' | 'none';
    top_n?: number;           // used when qualifier = 'top_n_per_league'
    cups: string[];           // cup type IDs, e.g. ['national', 'cl']
  };
}

// ── League link condition types ───────────────────────────────────────────────

export interface FromCondition {
  scope: 'conference' | 'whole_table';
  conference?: string;
  position: 'bottom' | 'top';
  count: number;
}

export interface ToCondition {
  region?: string;
  position?: 'any';
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface PromotionRelegationResult {
  relegated: { teamId: number; teamName: string; fromLeague: number; toLeague: number }[];
  promoted:  { teamId: number; teamName: string; fromLeague: number; toLeague: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const tiebreakerToSql: Record<string, string> = {
  points:     'points',
  score_diff: 'score_diff',
  set_diff:   '(sets_won - sets_lost)',
};

function buildOrderClause(tiebreakers: string[], direction: 'ASC' | 'DESC'): string {
  return tiebreakers
    .map(t => `${tiebreakerToSql[t] ?? t} ${direction}`)
    .join(', ');
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getLeagueConfig(leagueId: number): LeagueConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT config FROM league_configs WHERE league_id = ?')
    .get(leagueId) as { config: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.config) as LeagueConfig;
}

/**
 * Generate a schedule for a league, driven by its config.
 * Falls back to triple round-robin (Jan–Aug) when no config exists.
 */
export function generateScheduleForLeague(
  leagueId: number,
  teamIds: number[],
  year: number,
): FixtureSlot[] {
  const config = getLeagueConfig(leagueId);
  if (!config) {
    return generateTripleRoundRobin(teamIds, year);
  }
  const rs = config.regular_season;
  const startDate = new Date(year, rs.start_month - 1, rs.start_day);
  const endDate   = new Date(year, rs.end_month   - 1, rs.end_day);
  return generateRoundRobinSchedule(teamIds, rs.rounds, startDate, endDate);
}

/**
 * Returns true when a post-season should be generated for the given season.
 * Replaces the tier-2 hardcode in shouldGeneratePlayoffs().
 */
export function shouldGeneratePostSeason(seasonId: number): boolean {
  const db = getDb();

  // Already generated?
  const existing = db.prepare('SELECT COUNT(*) as c FROM playoff_series WHERE season_id = ?')
    .get(seasonId) as { c: number };
  if (existing.c > 0) return false;

  const season = db.prepare('SELECT league_id FROM seasons WHERE id = ?')
    .get(seasonId) as { league_id: number } | undefined;
  if (!season) return false;

  const config = getLeagueConfig(season.league_id);
  if (config) {
    if (config.post_season.type === 'none') return false;
  } else {
    // Fallback: tier-2 check for leagues without config
    const tierRow = db.prepare('SELECT tier FROM leagues WHERE id = ?')
      .get(season.league_id) as { tier: number } | undefined;
    if (!tierRow || tierRow.tier !== 2) return false;
  }

  // Any regular-season fixtures still scheduled?
  const pending = db.prepare("SELECT COUNT(*) as c FROM fixtures WHERE season_id = ? AND status = 'scheduled'")
    .get(seasonId) as { c: number };
  return pending.c === 0;
}

/**
 * Generate post-season series for a given season, driven by config.
 * Replaces the hardcoded generatePlayoffs() in queries.ts.
 *
 * Only generates Round 1 — advancePlayoffRound() handles Rounds 2 and 3
 * dynamically as each round completes.
 */
export function generatePostSeason(
  seasonId: number,
): { seriesCreated: number; gamesScheduled: number } {
  const db = getDb();

  // Idempotent guard
  const existing = db.prepare('SELECT COUNT(*) as c FROM playoff_series WHERE season_id = ?')
    .get(seasonId) as { c: number };
  if (existing.c > 0) return { seriesCreated: 0, gamesScheduled: 0 };

  const season = db.prepare('SELECT * FROM seasons WHERE id = ?')
    .get(seasonId) as { id: number; league_id: number; year: number } | undefined;
  if (!season) throw new Error('Season not found');

  const config = getLeagueConfig(season.league_id);

  // If no config, fall back to tier-2 check
  if (!config) {
    const league = db.prepare('SELECT tier FROM leagues WHERE id = ?')
      .get(season.league_id) as { tier: number } | undefined;
    if (!league || league.tier !== 2) return { seriesCreated: 0, gamesScheduled: 0 };
    // No config — cannot determine conferences; return early
    return { seriesCreated: 0, gamesScheduled: 0 };
  }

  if (config.post_season.type === 'none') {
    return { seriesCreated: 0, gamesScheduled: 0 };
  }

  if (config.post_season.type !== 'conference_playoffs') {
    return { seriesCreated: 0, gamesScheduled: 0 };
  }

  const round1Def = config.post_season.rounds?.[0];
  if (!round1Def || round1Def.scope !== 'per_conference') {
    return { seriesCreated: 0, gamesScheduled: 0 };
  }

  const conferences = config.format.conferences;
  if (!conferences || conferences.length === 0) {
    return { seriesCreated: 0, gamesScheduled: 0 };
  }

  const qualifyCount = round1Def.teams_per_conference ?? 4;
  const tiebreakers  = config.tiebreakers;
  const roundDates   = getPlayoffRoundDates(season.year, 1);

  const insertSeries = db.prepare(`
    INSERT INTO playoff_series
      (season_id, league_id, round, conference, seed_high, seed_low, home_team_id, away_team_id, status)
    VALUES (@season_id, @league_id, @round, @conference, @seed_high, @seed_low, @home_team_id, @away_team_id, 'scheduled')
  `);
  const insertGame = db.prepare(`
    INSERT INTO playoff_games
      (series_id, game_number, home_team_id, away_team_id, scheduled_date, status)
    VALUES (@series_id, @game_number, @home_team_id, @away_team_id, @scheduled_date, 'scheduled')
  `);

  let seriesCreated = 0;
  let gamesScheduled = 0;

  function createSeries(
    conference: string,
    seedHigh: number,
    seedLow: number,
    highTeamId: number,
    lowTeamId: number,
  ) {
    const res = insertSeries.run({
      season_id:    season!.id,
      league_id:    season!.league_id,
      round:        1,
      conference,
      seed_high:    seedHigh,
      seed_low:     seedLow,
      home_team_id: highTeamId,
      away_team_id: lowTeamId,
    });
    const seriesId = Number(res.lastInsertRowid);
    seriesCreated++;

    // Pre-schedule games 1–3 (minimum for a sweep). Games 4–5 created dynamically.
    for (let g = 0; g < 3; g++) {
      const homeId = g < 2 ? highTeamId : lowTeamId;
      const awayId = g < 2 ? lowTeamId  : highTeamId;
      insertGame.run({
        series_id:      seriesId,
        game_number:    g + 1,
        home_team_id:   homeId,
        away_team_id:   awayId,
        scheduled_date: roundDates[g],
      });
      gamesScheduled++;
    }
  }

  db.transaction(() => {
    for (const conf of conferences) {
      const orderClause = buildOrderClause(tiebreakers, 'DESC');
      const topTeams = db.prepare(`
        SELECT id FROM teams
        WHERE league_id = ? AND region = ?
        ORDER BY ${orderClause}
        LIMIT ?
      `).all(season!.league_id, conf.region_tag, qualifyCount) as { id: number }[];

      if (topTeams.length < qualifyCount) {
        throw new Error(`Not enough teams in ${conf.name} conference (need ${qualifyCount}, found ${topTeams.length})`);
      }

      if (round1Def.matchup_pattern === 'top_vs_bottom') {
        // Pair seed 1 vs N, seed 2 vs N-1, etc.
        const half = Math.floor(qualifyCount / 2);
        for (let i = 0; i < half; i++) {
          const highSeed = i + 1;
          const lowSeed  = qualifyCount - i;
          createSeries(conf.name, highSeed, lowSeed, topTeams[i].id, topTeams[qualifyCount - 1 - i].id);
        }
      }
    }
  })();

  return { seriesCreated, gamesScheduled };
}

/**
 * Process promotion and relegation for all leagues using league_links config.
 * Replaces the hardcoded processPromotionRelegation() in queries.ts.
 */
export function processPromotionRelegationByConfig(): PromotionRelegationResult {
  const db = getDb();

  const relegated: PromotionRelegationResult['relegated'] = [];
  const promoted:  PromotionRelegationResult['promoted']  = [];

  const links = db.prepare(
    'SELECT * FROM league_links ORDER BY priority ASC'
  ).all() as Array<{
    id: number;
    from_league_id: number;
    to_league_id: number;
    from_condition: string;
    to_condition: string;
    priority: number;
  }>;

  // Pre-fetch league tiers for promotion/relegation classification
  const allLeagues = db.prepare('SELECT id, tier FROM leagues').all() as { id: number; tier: number }[];
  const leagueTier = new Map<number, number>(allLeagues.map(l => [l.id, l.tier]));

  for (const link of links) {
    const from = JSON.parse(link.from_condition) as FromCondition;
    const to   = JSON.parse(link.to_condition)   as ToCondition;

    const fromConfig  = getLeagueConfig(link.from_league_id);
    const tiebreakers = fromConfig?.tiebreakers ?? ['points', 'score_diff', 'set_diff'];
    const direction   = from.position === 'top' ? 'DESC' : 'ASC';
    const orderClause = buildOrderClause(tiebreakers, direction);

    let teams: { id: number; team_name: string }[];

    if (from.scope === 'conference' && from.conference) {
      teams = db.prepare(
        `SELECT id, team_name FROM teams WHERE league_id = ? AND region = ? ORDER BY ${orderClause} LIMIT ?`
      ).all(link.from_league_id, from.conference, from.count) as { id: number; team_name: string }[];
    } else {
      teams = db.prepare(
        `SELECT id, team_name FROM teams WHERE league_id = ? ORDER BY ${orderClause} LIMIT ?`
      ).all(link.from_league_id, from.count) as { id: number; team_name: string }[];
    }

    for (const team of teams) {
      const updateParts = ['league_id = ?'];
      const updateVals: unknown[] = [link.to_league_id];

      if (to.region) {
        updateParts.push('region = ?');
        updateVals.push(to.region);
      }
      updateVals.push(team.id);

      db.prepare(`UPDATE teams SET ${updateParts.join(', ')} WHERE id = ?`).run(...updateVals);

      const fromTier = leagueTier.get(link.from_league_id) ?? 99;
      const toTier   = leagueTier.get(link.to_league_id)   ?? 99;

      if (toTier < fromTier) {
        // Moving to a lower tier number = higher division = promotion
        promoted.push({ teamId: team.id, teamName: team.team_name, fromLeague: link.from_league_id, toLeague: link.to_league_id });
      } else {
        relegated.push({ teamId: team.id, teamName: team.team_name, fromLeague: link.from_league_id, toLeague: link.to_league_id });
      }
    }
  }

  return { relegated, promoted };
}
