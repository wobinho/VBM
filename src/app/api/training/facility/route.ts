import { NextResponse, NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getTrainingFacilities, upgradeTrainingFacility, getUserTeam } from '@/lib/db/queries';
import { getDb } from '@/lib/db';
import { UPGRADE_COST_TO_LEVEL, MAX_LEVEL } from '@/lib/training/facilities';

function getUpgradeCost(_facilityType: string, targetLevel: number): number {
  return UPGRADE_COST_TO_LEVEL[targetLevel] ?? 0;
}

export async function GET(_request: NextRequest) {
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

  const facilities = getTrainingFacilities(ut.team_id);
  const team = getDb().prepare('SELECT team_money FROM teams WHERE id = ?').get(ut.team_id) as { team_money: number };

  const result = facilities.map(f => ({
    ...f,
    upgradeCost: f.level < MAX_LEVEL ? getUpgradeCost(f.facility_type, f.level + 1) : null,
  }));

  return NextResponse.json({
    facilities: result,
    teamMoney: team.team_money,
  });
}

export async function PUT(request: NextRequest) {
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

  const body = await request.json();
  const { facilityType } = body;

  if (!facilityType) {
    return NextResponse.json({ error: 'Missing facilityType' }, { status: 400 });
  }

  const db = getDb();
  const team = db.prepare('SELECT team_money FROM teams WHERE id = ?').get(ut.team_id) as { team_money: number };

  // Get current facility
  const current = db.prepare(`
    SELECT level FROM training_facilities
    WHERE team_id = ? AND facility_type = ?
  `).get(ut.team_id, facilityType) as { level: number } | undefined;

  if (!current) {
    return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
  }

  if (current.level >= MAX_LEVEL) {
    return NextResponse.json({ error: 'Facility already at max level' }, { status: 400 });
  }

  const nextLevel = current.level + 1;
  const cost = getUpgradeCost(facilityType, nextLevel);

  if (team.team_money < cost) {
    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
  }

  // Deduct cost and upgrade
  db.prepare('UPDATE teams SET team_money = team_money - ? WHERE id = ?').run(cost, ut.team_id);
  const upgraded = upgradeTrainingFacility(ut.team_id, facilityType);

  return NextResponse.json({
    success: true,
    facility: upgraded,
    newTeamMoney: team.team_money - cost,
  });
}
