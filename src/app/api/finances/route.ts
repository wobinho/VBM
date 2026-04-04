import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getUserTeam, getFinancialTransactions } from '@/lib/db/queries';

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { getDb } = await import('@/lib/db');
  getDb();

  const ut = getUserTeam(session.userId);
  if (!ut) return NextResponse.json({ error: 'No team found' }, { status: 404 });

  const transactions = getFinancialTransactions(ut.team_id);
  return NextResponse.json(transactions);
}
