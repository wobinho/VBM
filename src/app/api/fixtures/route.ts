import { NextResponse } from 'next/server';
import {
  getFixtures, getFixturesByDate, getScheduledDatesForSeason, getActiveSeason,
  getPlayoffGamesByTeam, getPlayoffGameDatesForSeason, getPlayoffGamesByDate,
  PlayoffGame, Fixture,
} from '@/lib/db/queries';

/** Convert a PlayoffGame into a Fixture-shaped object for unified calendar/list display. */
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const date     = searchParams.get('date') ?? undefined;
  const teamId   = searchParams.get('teamId')   ? Number(searchParams.get('teamId'))   : undefined;
  const leagueId = searchParams.get('leagueId') ? Number(searchParams.get('leagueId')) : undefined;
  const seasonId = searchParams.get('seasonId') ? Number(searchParams.get('seasonId')) : undefined;
  const status   = searchParams.get('status')   ?? undefined;
  const gameWeek = searchParams.get('gameWeek') ? Number(searchParams.get('gameWeek')) : undefined;
  const limit    = searchParams.get('limit')    ? Number(searchParams.get('limit'))    : undefined;
  const datesOnly = searchParams.get('datesOnly') === 'true';

  // Return just the list of scheduled dates for a season (for calendar highlighting)
  if (datesOnly && (seasonId || leagueId)) {
    let sid = seasonId;
    if (!sid && leagueId) {
      const active = getActiveSeason(leagueId);
      sid = active?.id;
    }
    if (sid) {
      const regularDates = getScheduledDatesForSeason(sid);
      const playoffDates = getPlayoffGameDatesForSeason(sid);
      const allDates = [...new Set([...regularDates, ...playoffDates])].sort();
      return NextResponse.json({ dates: allDates });
    }
    return NextResponse.json({ dates: [] });
  }

  if (date) {
    const fixtures = getFixturesByDate(date, leagueId);
    const playoffGames = getPlayoffGamesByDate(date, true);
    return NextResponse.json([...fixtures, ...playoffGames.map(playoffGameAsFixture)]);
  }

  const fixtures = getFixtures({ seasonId, leagueId, teamId, status, gameWeek, limit });

  // When fetching by teamId, also include the team's playoff games
  if (teamId) {
    const playoffGames = getPlayoffGamesByTeam(teamId);
    const mapped = playoffGames.map(playoffGameAsFixture);
    return NextResponse.json([...fixtures, ...mapped]);
  }

  return NextResponse.json(fixtures);
}
