import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import {
  getGameState, advanceGameDate,
  getFixtures, getFixtureById, updateFixtureResult, updateTeamStatsAfterMatch,
  getSeasonById, getUpcomingFixtures, getRecentResults,
  getSquadLineup, getPlayers, getUserTeam,
  getPlayoffGamesByDate, PlayoffGame, Fixture,
} from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer } from '@/lib/simulation-engine';

/** GET /api/game-state — return current game date, season, upcoming fixtures */
export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  // Ensure DB / game state is initialized
  const { getDb } = await import('@/lib/db');
  getDb();

  const state = getGameState();
  if (!state) {
    return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });
  }

  return NextResponse.json(await buildStatePayload(state, session.userId ?? null));
}

/**
 * POST /api/game-state — advance to the next match day.
 * Auto-simulates all fixtures except the user's team, which is left 'scheduled'.
 */
export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const { getDb } = await import('@/lib/db');
  getDb();

  const state = getGameState();
  if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

  const season = state.season_id ? getSeasonById(state.season_id) : null;
  if (!season) return NextResponse.json({ error: 'No active season' }, { status: 400 });

  const currentDate = state.current_date;

  // Find all fixtures with status='scheduled' after the current date, grab the earliest date
  const allScheduled = getFixtures({ seasonId: season.id, status: 'scheduled' });
  const futureDates  = [...new Set(allScheduled.map(f => f.scheduled_date))]
    .filter(d => d > currentDate)
    .sort();

  if (!futureDates.length) {
    return NextResponse.json({ done: true, message: 'Season complete — no more fixtures.' });
  }

  const nextDate = futureDates[0];

  // Get all fixtures on that date
  const dayFixtures = getFixtures({ seasonId: season.id, date: nextDate });

  // Identify user's team
  let userTeamId: number | null = null;
  if (session.userId) {
    const ut = getUserTeam(session.userId);
    userTeamId = ut?.team_id ?? null;
  }

  const simulated: Array<{
    id: number; homeTeam: string; awayTeam: string;
    homeSets: number; awaySets: number; winner: 'home' | 'away';
  }> = [];
  let userFixtureId: number | null = null;

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
    updateTeamStatsAfterMatch(f.home_team_id, f.away_team_id, result.homeSets, result.awaySets);

    const updated = getFixtureById(f.id);
    simulated.push({
      id:       f.id,
      homeTeam: updated?.home_team_name ?? f.home_team_id.toString(),
      awayTeam: updated?.away_team_name ?? f.away_team_id.toString(),
      homeSets: result.homeSets,
      awaySets: result.awaySets,
      winner:   result.winner,
    });
  }

  advanceGameDate(nextDate);

  // Check if there's a user fixture that needs playing
  const userFixture = userFixtureId ? getFixtureById(userFixtureId) : null;

  return NextResponse.json({
    done: false,
    previousDate: currentDate,
    newDate: nextDate,
    userFixtureId,
    userFixture,
    simulatedCount: simulated.length,
    simulated,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function playoffGameAsFixture(pg: PlayoffGame): Fixture & { is_playoff: true; playoff_game_id: number } {
  return {
    id: pg.id,
    season_id: 0,
    league_id: 1,
    home_team_id: pg.home_team_id,
    away_team_id: pg.away_team_id,
    game_week: 0,
    scheduled_date: pg.scheduled_date,
    status: pg.status,
    home_sets: pg.home_sets,
    away_sets: pg.away_sets,
    home_points: pg.home_points,
    away_points: pg.away_points,
    played_at: pg.played_at,
    created_at: pg.created_at,
    home_team_name: pg.home_team_name,
    away_team_name: pg.away_team_name,
    season_name: 'Playoffs',
    is_playoff: true,
    playoff_game_id: pg.id,
  };
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

async function buildStatePayload(
  state: { current_date: string; season_id: number | null },
  userId: string | null,
) {
  const season = state.season_id ? getSeasonById(state.season_id) : null;

  let userTeamId: number | null = null;
  let upcomingFixtures: ReturnType<typeof getUpcomingFixtures> = [];
  let recentResults: ReturnType<typeof getRecentResults> = [];
  let userFixtureToday = null;

  if (userId) {
    const ut = getUserTeam(userId);
    userTeamId = ut?.team_id ?? null;
  }

  if (userTeamId) {
    upcomingFixtures = getUpcomingFixtures(userTeamId, state.current_date, 5);
    recentResults    = getRecentResults(userTeamId, 5);

    const todayFixtures = getFixtures({
      date: state.current_date,
      teamId: userTeamId,
      status: 'scheduled',
    });
    if (todayFixtures.length) {
      userFixtureToday = getFixtureById(todayFixtures[0].id) ?? null;
    } else {
      // Check if the user has a playoff game today
      const todayPlayoffGames = getPlayoffGamesByDate(state.current_date);
      const userPlayoffGame = todayPlayoffGames.find(
        pg => pg.home_team_id === userTeamId || pg.away_team_id === userTeamId
      ) ?? null;
      if (userPlayoffGame) {
        userFixtureToday = playoffGameAsFixture(userPlayoffGame);
      }
    }
  }

  return {
    currentDate: state.current_date,
    season:      season ?? null,
    userTeamId,
    upcomingFixtures,
    recentResults,
    userFixtureToday,
  };
}
