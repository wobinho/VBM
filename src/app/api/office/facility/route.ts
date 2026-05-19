import { NextResponse, NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getOfficeFacilities, upgradeOfficeFacility, getUserTeam } from '@/lib/db/queries';
import { getDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import {
  OFFICE_UPGRADE_COST_TO_LEVEL,
  OFFICE_MAX_LEVEL,
  isOfficeFacilityKey,
} from '@/lib/office/facilities';

function getUpgradeCost(targetLevel: number): number {
  return OFFICE_UPGRADE_COST_TO_LEVEL[targetLevel] ?? 0;
}

export const GET = withUserDb(async (_request: NextRequest) => {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const ut = getUserTeam(session.userId!);
  if (!ut) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const facilities = getOfficeFacilities(ut.team_id);
  const team = getDb()
    .prepare('SELECT team_money FROM teams WHERE id = ?')
    .get(ut.team_id) as { team_money: number };

  const result = facilities.map(f => ({
    ...f,
    upgradeCost: f.level < OFFICE_MAX_LEVEL ? getUpgradeCost(f.level + 1) : null,
  }));

  return NextResponse.json({
    facilities: result,
    teamMoney: team.team_money,
  });
});

export const PUT = withUserDb(async (request: NextRequest) => {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const ut = getUserTeam(session.userId!);
  if (!ut) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { facilityType } = body ?? {};

  if (!facilityType || typeof facilityType !== 'string' || !isOfficeFacilityKey(facilityType)) {
    return NextResponse.json({ error: 'Invalid facilityType' }, { status: 400 });
  }

  const db = getDb();
  const team = db.prepare('SELECT team_money FROM teams WHERE id = ?').get(ut.team_id) as { team_money: number };

  const current = db.prepare(`
    SELECT level FROM training_facilities
    WHERE team_id = ? AND facility_type = ?
  `).get(ut.team_id, facilityType) as { level: number } | undefined;

  if (!current) {
    return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
  }

  if (current.level >= OFFICE_MAX_LEVEL) {
    return NextResponse.json({ error: 'Facility already at max level' }, { status: 400 });
  }

  const nextLevel = current.level + 1;
  const cost = getUpgradeCost(nextLevel);

  if (team.team_money < cost) {
    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
  }

  db.prepare('UPDATE teams SET team_money = team_money - ? WHERE id = ?').run(cost, ut.team_id);
  const upgraded = upgradeOfficeFacility(ut.team_id, facilityType);

  return NextResponse.json({
    success: true,
    facility: upgraded,
    newTeamMoney: team.team_money - cost,
  });
});
