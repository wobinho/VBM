import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import {
  getGameState, advanceGameDate, getFixtures,
  updateFixtureResult, updateTeamStatsAfterMatch,
  getSquadLineup, getPlayers, getUserTeam, runMonthlyEconomy,
  shouldGeneratePlayoffs, generatePlayoffs,
  getPlayoffGamesByDate, recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer } from '@/lib/simulation-engine';
import { getCupFixturesByDate, recordCupFixtureResult } from '@/lib/cup-engine';

/**
 * POST /api/advance-day — advance the game calendar by exactly 1 day.
 *
 * Block condition:  The user's own fixture for today exists and is NOT completed.
 * Allow condition:  The user's fixture is completed (or there is no user fixture today).
 * Auto-resolve:     On success, simulate all remaining unresolved AI fixtures for today
 *                   before advancing the date.
 */
export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const { getDb } = await import('@/lib/db');
  getDb();

  const state = getGameState();
  if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

  // Block on Jun 30: league block ends and cup block begins. User must press
  // "Proceed to Cup Block" to advance to Jul 1.
  if (state.current_date.endsWith('-06-30') || state.current_date.endsWith('-07-31')) {
    return NextResponse.json(
      { error: 'season_gate', message: 'The league block has ended. Use the "Proceed to Cup Block" button to continue.' },
      { status: 409 },
    );
  }

  // Block on Dec 31: use the "Proceed to Next Season" button instead.
  if (state.current_date.endsWith('-12-31')) {
    return NextResponse.json(
      { error: 'season_gate', message: 'The season is over. Use the "Proceed to Next Season" button to continue.' },
      { status: 409 },
    );
  }

  // Fetch fixtures across ALL leagues for today
  const todayFixtures = getFixtures({ date: state.current_date });

  // Resolve user's team id from session
  let userTeamId: number | null = null;
  if (session.userId) {
    const ut = getUserTeam(session.userId);
    userTeamId = ut?.team_id ?? null;
  }

  // Find the user's fixture for today (if any)
  const userFixture = userTeamId !== null
    ? todayFixtures.find(f => f.home_team_id === userTeamId || f.away_team_id === userTeamId) ?? null
    : null;

  // Block if the user's own match hasn't been simulated yet
  if (userFixture && userFixture.status !== 'completed') {
    return NextResponse.json(
      { error: 'user_fixture_pending', message: 'Simulate your match before advancing the day.' },
      { status: 409 },
    );
  }

  // Also block if the user has an unplayed playoff game today
  const todayPlayoffGames = getPlayoffGamesByDate(state.current_date);
  const userPlayoffGame = userTeamId !== null
    ? todayPlayoffGames.find(pg => pg.home_team_id === userTeamId || pg.away_team_id === userTeamId) ?? null
    : null;
  if (userPlayoffGame && userPlayoffGame.status === 'scheduled') {
    return NextResponse.json(
      { error: 'user_fixture_pending', message: 'Simulate your playoff game before advancing the day.' },
      { status: 409 },
    );
  }

  // Also block if the user has an unplayed cup fixture today
  const todayCupFixtures = getCupFixturesByDate(state.current_date);
  const userCupFixture = userTeamId !== null
    ? todayCupFixtures.find(cf => cf.home_team_id === userTeamId || cf.away_team_id === userTeamId) ?? null
    : null;
  if (userCupFixture && userCupFixture.status === 'scheduled') {
    return NextResponse.json(
      { error: 'user_fixture_pending', message: 'Simulate your cup fixture before advancing the day.' },
      { status: 409 },
    );
  }

  // Auto-simulate all remaining AI regular-season fixtures for today
  const remaining = todayFixtures.filter(f => f.status !== 'completed' && f.id !== userFixture?.id);
  for (const f of remaining) {
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
  }

  // Also auto-simulate any AI playoff games scheduled for today
  // (user playoff games are left for the user to play manually)
  for (const pg of todayPlayoffGames) {
    const isUserGame = userTeamId !== null &&
      (pg.home_team_id === userTeamId || pg.away_team_id === userTeamId);
    if (isUserGame) continue;

    const homeLu = buildLineup(pg.home_team_id);
    const awayLu = buildLineup(pg.away_team_id);
    const result = runFullMatch(homeLu, awayLu);
    recordPlayoffGameResult(pg.id, {
      home_sets:   result.homeSets,
      away_sets:   result.awaySets,
      home_points: result.homeTotalPoints,
      away_points: result.awayTotalPoints,
    });
  }

  // Also auto-simulate any AI cup fixtures scheduled for today
  // (user cup fixtures are left for the user to play manually)
  for (const cf of todayCupFixtures) {
    const isUserGame = userTeamId !== null &&
      (cf.home_team_id === userTeamId || cf.away_team_id === userTeamId);
    if (isUserGame) continue;

    const homeLu = buildLineup(cf.home_team_id);
    const awayLu = buildLineup(cf.away_team_id);
    const result = runFullMatch(homeLu, awayLu);
    recordCupFixtureResult(cf.id, {
      home_sets:   result.homeSets,
      away_sets:   result.awaySets,
      home_points: result.homeTotalPoints,
      away_points: result.awayTotalPoints,
    });
  }

  // Advance by exactly 1 calendar day
  const current = new Date(state.current_date);
  current.setDate(current.getDate() + 1);
  const newDate = current.toISOString().slice(0, 10);

  advanceGameDate(newDate);

  // Monthly economy: fire on the 1st of each month
  let monthlyEconomyRan = false;
  if (newDate.endsWith('-01')) {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const month = newDate.slice(0, 7); // "YYYY-MM"
    const allTeams = db.prepare('SELECT id FROM teams').all() as { id: number }[];
    for (const t of allTeams) {
      runMonthlyEconomy(t.id, month);
    }
    monthlyEconomyRan = true;
  }

  // Auto-generate playoffs for any tier-2 league season that just had its last fixture played
  let playoffsGenerated = false;
  {
    const db = getDb();
    const tier2Seasons = db.prepare(`
      SELECT s.id FROM seasons s
      JOIN leagues l ON s.league_id = l.id
      WHERE s.status = 'active' AND l.tier = 2
    `).all() as { id: number }[];
    for (const { id: sid } of tier2Seasons) {
      if (shouldGeneratePlayoffs(sid)) {
        generatePlayoffs(sid);
        playoffsGenerated = true;
      }
    }
  }

  // Check if the new date has any fixtures, playoff games, or cup fixtures
  const dayFixtures = getFixtures({ date: newDate });
  const dayPlayoffGames = getPlayoffGamesByDate(newDate);
  const dayCupFixtures = getCupFixturesByDate(newDate);
  const hasMatchDay = dayFixtures.length > 0 || dayPlayoffGames.length > 0 || dayCupFixtures.length > 0;

  return NextResponse.json({
    previousDate: state.current_date,
    newDate,
    hasMatchDay,
    fixtureCount: dayFixtures.length + dayPlayoffGames.length + dayCupFixtures.length,
    autoSimulated: remaining.length,
    monthlyEconomyRan,
    playoffsGenerated,
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
