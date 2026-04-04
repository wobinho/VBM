import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import {
  getGameState, getFixtures, getFixtureById,
  updateFixtureResult, updateTeamStatsAfterMatch,
  getSquadLineup, getPlayers, getUserTeam,
  getPlayoffGamesByDate, recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer } from '@/lib/simulation-engine';

/**
 * POST /api/simulate-matchday
 * Simulate all AI regular-season fixtures AND AI playoff games on the current
 * game date. The user's own fixture/game is left as 'scheduled'.
 */
export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const { getDb } = await import('@/lib/db');
  getDb();

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

  const simulated: Array<{
    id: number; homeTeam: string; awayTeam: string;
    homeSets: number; awaySets: number; winner: 'home' | 'away';
    type: 'regular' | 'playoff';
  }> = [];
  let userFixtureId: number | null = null;
  let userPlayoffGameId: number | null = null;

  for (const f of dayFixtures) {
    if (f.status === 'completed') continue;

    const isUserFixture = userTeamId !== null &&
      (f.home_team_id === userTeamId || f.away_team_id === userTeamId);

    if (isUserFixture) {
      userFixtureId = f.id;
      continue;
    }

    const homeLu = buildLineup(f.home_team_id);
    const awayLu = buildLineup(f.away_team_id);
    const result = runFullMatch(homeLu, awayLu);

    updateFixtureResult(f.id, {
      home_sets:   result.homeSets,
      away_sets:   result.awaySets,
      home_points: result.homeTotalPoints,
      away_points: result.awayTotalPoints,
    });
    updateTeamStatsAfterMatch(f.home_team_id, f.away_team_id, result.homeSets, result.awaySets, result.homeTotalPoints, result.awayTotalPoints);

    const updated = getFixtureById(f.id);
    simulated.push({
      id:       f.id,
      homeTeam: updated?.home_team_name ?? f.home_team_id.toString(),
      awayTeam: updated?.away_team_name ?? f.away_team_id.toString(),
      homeSets: result.homeSets,
      awaySets: result.awaySets,
      winner:   result.winner,
      type:     'regular',
    });
  }

  // ── Playoff games ─────────────────────────────────────────────────────────
  const dayPlayoffGames = getPlayoffGamesByDate(currentDate);

  for (const pg of dayPlayoffGames) {
    const isUserGame = userTeamId !== null &&
      (pg.home_team_id === userTeamId || pg.away_team_id === userTeamId);

    if (isUserGame) {
      userPlayoffGameId = pg.id;
      continue;
    }

    const homeLu = buildLineup(pg.home_team_id);
    const awayLu = buildLineup(pg.away_team_id);
    const result = runFullMatch(homeLu, awayLu);

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
}

function buildLineup(teamId: number): SimLineup {
  const saved   = getSquadLineup(teamId);
  const players = getPlayers(teamId) as unknown as SimPlayer[];

  if (saved) {
    const idMap = new Map(players.map(p => [p.id, p]));
    const lu: SimLineup = {
      OH1: saved.oh1_player_id ? (idMap.get(saved.oh1_player_id) ?? null) : null,
      MB1: saved.mb1_player_id ? (idMap.get(saved.mb1_player_id) ?? null) : null,
      OPP: saved.opp_player_id ? (idMap.get(saved.opp_player_id) ?? null) : null,
      S:   saved.s_player_id   ? (idMap.get(saved.s_player_id)   ?? null) : null,
      MB2: saved.mb2_player_id ? (idMap.get(saved.mb2_player_id) ?? null) : null,
      OH2: saved.oh2_player_id ? (idMap.get(saved.oh2_player_id) ?? null) : null,
      L:   saved.l_player_id   ? (idMap.get(saved.l_player_id)   ?? null) : null,
    };
    const filled = Object.values(lu).filter(Boolean).length;
    if (filled >= 5) return lu;
  }

  return autoLineupFromPlayers(players);
}
