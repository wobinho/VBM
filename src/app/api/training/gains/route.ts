import { NextResponse, NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getTrainingGains, getUserTeam } from '@/lib/db/queries';
import { withUserDb } from '@/lib/db/with-user-db';

export const GET = withUserDb(async (request: NextRequest) => {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const ut = getUserTeam(session.userId!);
  if (!ut) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20');
  const gains = getTrainingGains(ut.team_id, limit);

  return NextResponse.json(gains);
});
