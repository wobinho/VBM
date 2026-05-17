import { NextResponse, NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getTrainingAssignments, upsertTrainingAssignment, deleteTrainingAssignment, getUserTeam } from '@/lib/db/queries';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { getDb: getDbFn } = await import('@/lib/db');
  getDbFn();

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teamId = parseInt(request.nextUrl.searchParams.get('teamId') ?? '0');
  if (!teamId) {
    return NextResponse.json({ error: 'Missing teamId' }, { status: 400 });
  }

  // Verify user owns this team
  const ut = getUserTeam(session.userId);
  if (!ut || ut.team_id !== teamId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const assignments = getTrainingAssignments(teamId);
  return NextResponse.json(assignments);
}

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { getDb: getDbFn } = await import('@/lib/db');
  getDbFn();

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { playerId, planKey } = body;

  if (!playerId || !planKey) {
    return NextResponse.json({ error: 'Missing playerId or planKey' }, { status: 400 });
  }

  // Verify player belongs to user's team
  const ut = getUserTeam(session.userId);
  if (!ut) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const player = db.prepare('SELECT team_id FROM players WHERE id = ?').get(playerId) as { team_id: number } | undefined;
  if (!player || player.team_id !== ut.team_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  upsertTrainingAssignment(playerId, planKey);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { getDb: getDbFn } = await import('@/lib/db');
  getDbFn();

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const playerId = parseInt(request.nextUrl.searchParams.get('playerId') ?? '0');
  if (!playerId) {
    return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
  }

  // Verify player belongs to user's team
  const ut = getUserTeam(session.userId);
  if (!ut) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const player = db.prepare('SELECT team_id FROM players WHERE id = ?').get(playerId) as { team_id: number } | undefined;
  if (!player || player.team_id !== ut.team_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  deleteTrainingAssignment(playerId);
  return NextResponse.json({ success: true });
}
