import { NextResponse } from 'next/server';
import { getFixtureById, updateFixtureResult, updateTeamStatsAfterMatch, getSquadLineup, getPlayers, recordPlayoffGameResult, getGameState, getFixtures, getPlayoffGamesByDate } from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer } from '@/lib/simulation-engine';
import { getDb } from '@/lib/db';

/**
 * PATCH /api/fixtures/[id] — Save the user's manually-simulated match result,
 * then simulate all other fixtures/playoff games on the same date.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fixtureId = Number(id);
    const db = getDb();
    const { homeSets, awaySets, homePoints, awayPoints } = await req.json();

    // Look up the fixture to get its date and team IDs
    const fixture = getFixtureById(fixtureId);
    if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });

    // Save the user's fixture result and update standings
    updateFixtureResult(fixtureId, {
      home_sets:   homeSets,
      away_sets:   awaySets,
      home_points: homePoints ?? 0,
      away_points: awayPoints ?? 0,
    });
    updateTeamStatsAfterMatch(
      fixture.home_team_id, fixture.away_team_id,
      homeSets, awaySets,
      homePoints ?? 0, awayPoints ?? 0,
    );

    const targetDate = fixture.scheduled_date;

    // Simulate all remaining regular fixtures on the same date
    const dayFixtures = getFixtures({ date: targetDate });
    for (const f of dayFixtures) {
      if (f.status === 'completed' || f.id === fixtureId) continue;
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

    // Simulate all remaining playoff games on the same date
    const dayPlayoffGames = getPlayoffGamesByDate(targetDate);
    for (const pg of dayPlayoffGames) {
      if (pg.status === 'completed') continue;
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving match result:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/fixtures/[id] — fetch a single fixture */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fixture = getFixtureById(Number(id));
  if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  return NextResponse.json(fixture);
}

/**
 * POST /api/fixtures/[id] — Quick Sim: simulate the target fixture AND all other
 * fixtures/playoff games on the same date, then persist all results.
 *
 * This behaves like simulate-matchday but includes the user's game.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gameId = Number(id);
    const db = getDb();

    const state = getGameState();
    if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

    const currentDate = state.current_date;

    // Determine if this is a regular fixture or playoff game
    let targetFixture = getFixtureById(gameId);
    let isPlayoffGame = false;
    let targetPlayoffGame: any = null;
    let targetDate: string;

    if (!targetFixture) {
      targetPlayoffGame = db.prepare(`
        SELECT pg.*,
          ht.team_name AS home_team_name,
          at.team_name AS away_team_name
        FROM playoff_games pg
        JOIN teams ht ON pg.home_team_id = ht.id
        JOIN teams at ON pg.away_team_id = at.id
        WHERE pg.id = ?
      `).get(gameId) as any;

      if (!targetPlayoffGame) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
      isPlayoffGame = true;
      targetDate = targetPlayoffGame.scheduled_date;
    } else {
      targetDate = targetFixture.scheduled_date;
    }

    // ── Simulate all regular fixtures on this date ───────────────────────────────
    const dayFixtures = getFixtures({ date: targetDate });
    const simulatedRegular = [];

    for (const f of dayFixtures) {
      if (f.status === 'completed') continue;

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
      simulatedRegular.push({
        id:       f.id,
        homeTeam: updated?.home_team_name ?? f.home_team_id.toString(),
        awayTeam: updated?.away_team_name ?? f.away_team_id.toString(),
        homeSets: result.homeSets,
        awaySets: result.awaySets,
        winner:   result.winner,
        type:     'regular',
      });
    }

    // ── Simulate all playoff games on this date ─────────────────────────────────
    const dayPlayoffGames = getPlayoffGamesByDate(targetDate);
    const simulatedPlayoff = [];

    for (const pg of dayPlayoffGames) {
      if (pg.status === 'completed') continue;

      const homeLu = buildLineup(pg.home_team_id);
      const awayLu = buildLineup(pg.away_team_id);
      const result = runFullMatch(homeLu, awayLu);

      recordPlayoffGameResult(pg.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });

      simulatedPlayoff.push({
        id:       pg.id,
        homeTeam: pg.home_team_name ?? pg.home_team_id.toString(),
        awayTeam: pg.away_team_name ?? pg.away_team_id.toString(),
        homeSets: result.homeSets,
        awaySets: result.awaySets,
        winner:   result.winner,
        type:     'playoff',
      });
    }

    const allSimulated = [...simulatedRegular, ...simulatedPlayoff];

    return NextResponse.json({
      date: targetDate,
      simulatedCount: allSimulated.length,
      simulated: allSimulated,
    });
  } catch (error) {
    console.error('Error simulating fixture:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


// ─── Helper: load or auto-generate a team's lineup ───────────────────────────

function buildLineup(teamId: number): SimLineup {
  const saved = getSquadLineup(teamId);
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
    // If saved lineup has at least 5 valid players, use it; otherwise fall back to auto
    const filled = Object.values(lu).filter(Boolean).length;
    if (filled >= 5) return lu;
  }

  return autoLineupFromPlayers(players);
}
