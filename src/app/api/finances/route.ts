import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { withUserDb } from '@/lib/db/with-user-db';
import { getUserTeam, getFinancialTransactions } from '@/lib/db/queries';

export const GET = withUserDb(async () => {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const ut = getUserTeam(session.userId!);
  if (!ut) return NextResponse.json({ error: 'No team found' }, { status: 404 });

  const transactions = getFinancialTransactions(ut.team_id);
  return NextResponse.json(transactions);
});
