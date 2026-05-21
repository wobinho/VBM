/**
 * Per-run simulation cache.
 *
 * Holds prepared statements and a lineup cache scoped to a single sim batch
 * (advance-day, simulate-matchday, simulate-to-date). Each call site creates a
 * fresh SimCache so caches don't leak between requests.
 *
 * Two big wins over calling the regular query helpers per-fixture:
 *   1. Player rows are fetched once per team per run (a team can play in both a
 *      league fixture and a cup fixture on the same day; in simulate-to-date the
 *      same team plays many days back-to-back).
 *   2. We bypass `recomputeOverall` — the stored `overall` is already kept
 *      up-to-date by updatePlayer/training writes, so re-running the formula
 *      every match is pure overhead inside the sim path.
 */
import type Database from 'better-sqlite3';
import { getDb } from './db/index';
import type { SimLineup, SimPlayer } from './simulation-engine';
import { autoLineupFromPlayers } from './simulation-engine';
import { buildFastStrengths, type FastStrengths } from './fast-match';

interface LineupRow {
  oh1_player_id: number | null; mb1_player_id: number | null; opp_player_id: number | null;
  s_player_id: number | null;   mb2_player_id: number | null; oh2_player_id: number | null;
  l_player_id: number | null;
}

export interface SimCache {
  buildLineup: (teamId: number) => SimLineup;
  updateFixtureResult: (id: number, r: ResultRow) => void;
  updateTeamStatsAfterMatch: (
    homeTeamId: number, awayTeamId: number,
    homeSets: number, awaySets: number,
    homeTotalPoints: number, awayTotalPoints: number,
  ) => void;
  incrementMatchesPlayedForTeams: (homeTeamId: number, awayTeamId: number) => void;
  /** Reset the lineup cache — call after squad/player changes within the same run. */
  invalidateTeam: (teamId: number) => void;
}

interface ResultRow {
  home_sets: number;
  away_sets: number;
  home_points: number;
  away_points: number;
}

const PLAYER_COLS = [
  'id', 'player_name', 'team_id', 'position', 'age', 'country', 'overall',
  'attack', 'defense', 'serve', 'block', 'receive', 'setting',
  'precision', 'flair', 'digging', 'positioning', 'ball_control', 'technique', 'playmaking', 'spin',
  'speed', 'agility', 'strength', 'endurance', 'vertical', 'flexibility', 'torque', 'balance',
  'leadership', 'teamwork', 'concentration', 'pressure', 'consistency', 'vision', 'game_iq', 'intimidation',
].join(', ');

export function createSimCache(): SimCache {
  const db = getDb();

  const playersStmt = db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE team_id = ?`);
  const lineupStmt = db.prepare(`
    SELECT oh1_player_id, mb1_player_id, opp_player_id, s_player_id,
           mb2_player_id, oh2_player_id, l_player_id
    FROM squad_lineups WHERE team_id = ?
  `);

  const fixtureSelectStmt = db.prepare(
    'SELECT home_team_id, away_team_id, status FROM fixtures WHERE id = ?',
  );
  const fixtureUpdateStmt = db.prepare(`
    UPDATE fixtures
    SET status = 'completed',
        home_sets = @home_sets, away_sets = @away_sets,
        home_points = @home_points, away_points = @away_points,
        played_at = datetime('now')
    WHERE id = @id
  `);

  const teamUpdateStmt = db.prepare(`
    UPDATE teams SET
      played    = played + 1,
      won       = won  + @won,
      lost      = lost + @lost,
      points    = points + @pts,
      sets_won  = sets_won  + @sw,
      sets_lost = sets_lost + @sl,
      score_diff = score_diff + @pd
    WHERE id = @id
  `);

  // Memoize matches_played IN(?,...) statements by arity (almost always 14:
  // 7 home + 7 away starters).
  const incCache = new Map<number, Database.Statement>();
  const incFor = (n: number): Database.Statement => {
    let stmt = incCache.get(n);
    if (!stmt) {
      stmt = db.prepare(
        `UPDATE players SET matches_played = matches_played + 1 WHERE id IN (${
          Array(n).fill('?').join(',')
        })`,
      );
      incCache.set(n, stmt);
    }
    return stmt;
  };

  const lineupCache = new Map<number, SimLineup>();
  const rosterCache = new Map<number, SimPlayer[]>();

  function loadRoster(teamId: number): SimPlayer[] {
    let players = rosterCache.get(teamId);
    if (!players) {
      players = playersStmt.all(teamId) as unknown as SimPlayer[];
      rosterCache.set(teamId, players);
    }
    return players;
  }

  function buildLineup(teamId: number): SimLineup {
    const cached = lineupCache.get(teamId);
    if (cached) return cached;

    const players = loadRoster(teamId);
    const saved = lineupStmt.get(teamId) as LineupRow | undefined;

    let lu: SimLineup;
    if (saved) {
      const idMap = new Map(players.map(p => [p.id, p]));
      const candidate: SimLineup = {
        OH1: saved.oh1_player_id ? (idMap.get(saved.oh1_player_id) ?? null) : null,
        MB1: saved.mb1_player_id ? (idMap.get(saved.mb1_player_id) ?? null) : null,
        OPP: saved.opp_player_id ? (idMap.get(saved.opp_player_id) ?? null) : null,
        S:   saved.s_player_id   ? (idMap.get(saved.s_player_id)   ?? null) : null,
        MB2: saved.mb2_player_id ? (idMap.get(saved.mb2_player_id) ?? null) : null,
        OH2: saved.oh2_player_id ? (idMap.get(saved.oh2_player_id) ?? null) : null,
        L:   saved.l_player_id   ? (idMap.get(saved.l_player_id)   ?? null) : null,
      };
      const filled = Object.values(candidate).filter(Boolean).length;
      lu = filled >= 5 ? candidate : autoLineupFromPlayers(players);
    } else {
      lu = autoLineupFromPlayers(players);
    }

    lineupCache.set(teamId, lu);
    return lu;
  }

  function startingPlayerIds(teamId: number): number[] {
    const lu = buildLineup(teamId);
    const ids: number[] = [];
    for (const p of Object.values(lu)) if (p) ids.push(p.id);
    if (ids.length >= 5) return ids;
    // Fallback: top-7 by overall on the cached roster
    return [...loadRoster(teamId)]
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 7)
      .map(p => p.id);
  }

  function incrementMatchesPlayedForTeams(homeTeamId: number, awayTeamId: number): void {
    const ids = [...startingPlayerIds(homeTeamId), ...startingPlayerIds(awayTeamId)];
    if (!ids.length) return;
    incFor(ids.length).run(...ids);
  }

  return {
    buildLineup,
    incrementMatchesPlayedForTeams,

    updateFixtureResult(id, r) {
      const row = fixtureSelectStmt.get(id) as
        | { home_team_id: number; away_team_id: number; status: string }
        | undefined;
      const wasCompleted = row?.status === 'completed';
      fixtureUpdateStmt.run({ ...r, id });
      if (row && !wasCompleted) {
        incrementMatchesPlayedForTeams(row.home_team_id, row.away_team_id);
      }
    },

    updateTeamStatsAfterMatch(homeTeamId, awayTeamId, homeSets, awaySets, homeTotalPoints, awayTotalPoints) {
      const isHomeWin = homeSets > awaySets;
      const loserSets = isHomeWin ? awaySets : homeSets;
      // 3-2 → 3 / 1, otherwise 3 / 0
      const winPts  = 3;
      const losePts = loserSets === 2 ? 1 : 0;

      teamUpdateStmt.run({
        id: homeTeamId,
        won: isHomeWin ? 1 : 0, lost: isHomeWin ? 0 : 1,
        pts: isHomeWin ? winPts : losePts,
        sw: homeSets, sl: awaySets,
        pd: homeTotalPoints - awayTotalPoints,
      });
      teamUpdateStmt.run({
        id: awayTeamId,
        won: isHomeWin ? 0 : 1, lost: isHomeWin ? 1 : 0,
        pts: isHomeWin ? losePts : winPts,
        sw: awaySets, sl: homeSets,
        pd: awayTotalPoints - homeTotalPoints,
      });
    },

    invalidateTeam(teamId) {
      lineupCache.delete(teamId);
      rosterCache.delete(teamId);
    },
  };
}
