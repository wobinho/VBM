import { NextResponse } from 'next/server';
import { getFixtures, getFixturesByDate, getScheduledDatesForSeason, getActiveSeason } from '@/lib/db/queries';

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
      const dates = getScheduledDatesForSeason(sid);
      return NextResponse.json({ dates });
    }
    return NextResponse.json({ dates: [] });
  }

  if (date) {
    const fixtures = getFixturesByDate(date, leagueId);
    return NextResponse.json(fixtures);
  }

  const fixtures = getFixtures({ seasonId, leagueId, teamId, status, gameWeek, limit });
  return NextResponse.json(fixtures);
}
