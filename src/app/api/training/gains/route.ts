import { NextResponse, NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getTrainingGains, getUserTeam } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { getDb: getDbFn } = await import('@/lib/db');
  getDbFn();

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ut = getUserTeam(session.userId);
  if (!ut) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20');
  const gains = getTrainingGains(ut.team_id, limit);

  return NextResponse.json(gains);
}
