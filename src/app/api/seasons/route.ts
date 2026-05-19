import { NextResponse } from 'next/server';
import { withUserDb } from '@/lib/db/with-user-db';
import { getSeasons, getActiveSeason } from '@/lib/db/queries';

export const GET = withUserDb(async (request) => {
  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get('leagueId') ? Number(searchParams.get('leagueId')) : undefined;

  const seasons = getSeasons(leagueId);
  const active = leagueId ? getActiveSeason(leagueId) : undefined;

  return NextResponse.json({ seasons, active: active ?? null });
});
