import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import {
  getGameState, advanceGameDate, getFixtures,
  getUserTeam, runMonthlyEconomy,
  shouldGeneratePlayoffs, generatePlayoffs,
  getPlayoffGamesByDate, recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFullMatch } from '@/lib/simulation-engine';
import { getCupFixturesByDate, recordCupFixtureResult } from '@/lib/cup-engine';
import { tickTraining } from '@/lib/training/engine';
import { createSimCache } from '@/lib/sim-cache';

/**
 * POST /api/advance-day — advance the game calendar by exactly 1 day.
 *
 * Block condition:  The user's own fixture for today exists and is NOT completed.
 * Allow condition:  The user's fixture is completed (or there is no user fixture today).
 * Auto-resolve:     On success, simulate all remaining unresolved AI fixtures for today
 *                   before advancing the date.
 */
export const POST = withUserDb(async () => {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

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

  // Advance by exactly 1 calendar day
  const current = new Date(state.current_date);
  current.setDate(current.getDate() + 1);
  const newDate = current.toISOString().slice(0, 10);

  const db = getDb();
  const sim = createSimCache();

  // Counts captured inside the transaction so the response stays accurate.
  let trainingGainCount = 0;
  let monthlyEconomyRan = false;
  let playoffsGenerated = false;

  // Wrap the entire day's work in a single transaction. The default better-sqlite3
  // behavior is to fsync after every statement; for ~30 AI fixtures + 600 training
  // ticks + monthly economy this means thousands of small fsyncs per day.
  const runDay = db.transaction(() => {
    // Auto-simulate all remaining AI regular-season fixtures for today
    const remaining = todayFixtures.filter(f => f.status !== 'completed' && f.id !== userFixture?.id);
    for (const f of remaining) {
      const homeLu = sim.buildLineup(f.home_team_id);
      const awayLu = sim.buildLineup(f.away_team_id);
      const result = runFullMatch(homeLu, awayLu);
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
    }

    // Also auto-simulate any AI playoff games scheduled for today
    // (user playoff games are left for the user to play manually)
    for (const pg of todayPlayoffGames) {
      const isUserGame = userTeamId !== null &&
        (pg.home_team_id === userTeamId || pg.away_team_id === userTeamId);
      if (isUserGame) continue;

      const homeLu = sim.buildLineup(pg.home_team_id);
      const awayLu = sim.buildLineup(pg.away_team_id);
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

      const homeLu = sim.buildLineup(cf.home_team_id);
      const awayLu = sim.buildLineup(cf.away_team_id);
      const result = runFullMatch(homeLu, awayLu);
      recordCupFixtureResult(cf.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });
    }

    advanceGameDate(newDate);

    // Training tick: only run for teams that actually have an active training
    // assignment. Skipping the other ~600 teams avoids a getPlayers() pass per
    // team per day.
    const trainingTeamRows = db.prepare(`
      SELECT DISTINCT p.team_id AS id
      FROM training_assignments ta
      JOIN players p ON ta.player_id = p.id
      WHERE p.team_id IS NOT NULL
    `).all() as { id: number }[];
    for (const t of trainingTeamRows) {
      const gains = tickTraining(t.id, newDate);
      trainingGainCount += gains.length;
      // Player stats may have changed — refresh the cached roster for the team.
      if (gains.length) sim.invalidateTeam(t.id);
    }

    // Monthly economy: fire on the 1st of each month
    if (newDate.endsWith('-01')) {
      const month = newDate.slice(0, 7); // "YYYY-MM"
      const allTeams = db.prepare('SELECT id FROM teams').all() as { id: number }[];
      for (const t of allTeams) {
        runMonthlyEconomy(t.id, month);
      }
      monthlyEconomyRan = true;
    }

    // Auto-generate playoffs for any tier-2 league season that just had its last fixture played
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
  });

  runDay();

  // Counts and "has match day" computed after the transaction commits.
  const remainingCount = todayFixtures.filter(f => f.status !== 'completed' && f.id !== userFixture?.id).length;

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
    autoSimulated: remainingCount,
    trainingGainCount,
    monthlyEconomyRan,
    playoffsGenerated,
  });
});
