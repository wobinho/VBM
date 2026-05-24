import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import {
  getGameState, getFixtures, getFixtureById,
  getUserTeam,
  getPlayoffGamesByDate, recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFastMatch } from '@/lib/fast-match';
import { createSimCache } from '@/lib/sim-cache';

/**
 * POST /api/simulate-matchday
 * Simulate all AI regular-season fixtures AND AI playoff games on the current
 * game date. The user's own fixture/game is left as 'scheduled'.
 */
export const POST = withUserDb(async () => {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const state = getGameState();
  if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

  const currentDate = state.current_date;

  let userTeamId: number | null = null;
  if (session.userId) {
    const ut = getUserTeam(session.userId);
    userTeamId = ut?.team_id ?? null;
  }

  // ── Regular-season fixtures ───────────────────────────────────────────────
  const dayFixtures = getFixtures({ date: currentDate });
  const dayPlayoffGames = getPlayoffGamesByDate(currentDate);

  const simulated: Array<{
    id: number; homeTeam: string; awayTeam: string;
    homeSets: number; awaySets: number; winner: 'home' | 'away';
    type: 'regular' | 'playoff';
  }> = [];
  let userFixtureId: number | null = null;
  let userPlayoffGameId: number | null = null;

  const db = getDb();
  const sim = createSimCache();

  const run = db.transaction(() => {
    for (const f of dayFixtures) {
      if (f.status === 'completed') continue;

      const isUserFixture = userTeamId !== null &&
        (f.home_team_id === userTeamId || f.away_team_id === userTeamId);

      if (isUserFixture) {
        userFixtureId = f.id;
        continue;
      }

      const homeStr = sim.buildFastStrengths(f.home_team_id);
      const awayStr = sim.buildFastStrengths(f.away_team_id);
      const result = runFastMatch(homeStr, awayStr);

      sim.updateFixtureResult(f.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });
      sim.updateTeamStatsAfterMatch(
        f.home_team_id, f.away_team_id,
        result.homeSets, result.awaySets,
        result.homeTotalPoints, result.awayTotalPoints,
      );

      simulated.push({
        id:       f.id,
        homeTeam: f.home_team_name ?? f.home_team_id.toString(),
        awayTeam: f.away_team_name ?? f.away_team_id.toString(),
        homeSets: result.homeSets,
        awaySets: result.awaySets,
        winner:   result.winner,
        type:     'regular',
      });
    }

    // ── Playoff games ───────────────────────────────────────────────────────
    for (const pg of dayPlayoffGames) {
      const isUserGame = userTeamId !== null &&
        (pg.home_team_id === userTeamId || pg.away_team_id === userTeamId);

      if (isUserGame) {
        userPlayoffGameId = pg.id;
        continue;
      }

      const homeStr = sim.buildFastStrengths(pg.home_team_id);
      const awayStr = sim.buildFastStrengths(pg.away_team_id);
      const result = runFastMatch(homeStr, awayStr);

      recordPlayoffGameResult(pg.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });

      simulated.push({
        id:       pg.id,
        homeTeam: pg.home_team_name ?? pg.home_team_id.toString(),
        awayTeam: pg.away_team_name ?? pg.away_team_id.toString(),
        homeSets: result.homeSets,
        awaySets: result.awaySets,
        winner:   result.winner,
        type:     'playoff',
      });
    }
  });

  run();

  const hasAnything = dayFixtures.length > 0 || dayPlayoffGames.length > 0;
  if (!hasAnything) {
    return NextResponse.json({ done: false, message: 'No fixtures on current date.' });
  }

  const userFixture = userFixtureId ? getFixtureById(userFixtureId) : null;

  return NextResponse.json({
    date: currentDate,
    userFixtureId,
    userPlayoffGameId,
    userFixture,
    simulatedCount: simulated.length,
    simulated,
  });
});
