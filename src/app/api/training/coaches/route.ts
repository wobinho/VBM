import { NextResponse, NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getTrainingCoaches, insertTrainingCoach, deleteTrainingCoach, getUserTeam } from '@/lib/db/queries';
import { getDb } from '@/lib/db';
import { TRAINING_PLANS } from '@/lib/training/plans';

// Coach pool generation: deterministic based on team_id seed
function generateCoachPool(teamId: number): Array<{
  name: string;
  specialty: string;
  quality: number;
}> {
  const specialties = Object.keys(TRAINING_PLANS);
  const coachNames = [
    'Marco', 'Luca', 'Antonio', 'Giovanni', 'Roberto', 'Andrea', 'Paolo', 'Franco',
    'Giuseppe', 'Sandro', 'Riccardo', 'Alessio', 'Diego', 'Matteo', 'Fabio',
  ];
  const lastNames = [
    'Rossi', 'Bianchi', 'Ferrari', 'Russo', 'Romano', 'Costa', 'Fontana', 'Conti',
    'De Luca', 'De Lucia', 'Marino', 'Villa', 'Bergamin', 'Fiorentini', 'Soriani',
  ];

  const pool: Array<{ name: string; specialty: string; quality: number }> = [];
  const seed = teamId * 7; // Simple seed

  for (let i = 0; i < 10; i++) {
    const nameIdx = (seed + i * 11) % coachNames.length;
    const lastNameIdx = (seed + i * 13) % lastNames.length;
    const specialtyIdx = (seed + i) % specialties.length;

    // Quality distribution: 60% → 20-50, 30% → 51-75, 10% → 76-100
    const rand = (seed + i * 17) % 100;
    let quality: number;
    if (rand < 60) {
      quality = 20 + ((seed + i * 19) % 31);
    } else if (rand < 90) {
      quality = 51 + ((seed + i * 21) % 25);
    } else {
      quality = 76 + ((seed + i * 23) % 25);
    }

    pool.push({
      name: `${coachNames[nameIdx]} ${lastNames[lastNameIdx]}`,
      specialty: specialties[specialtyIdx],
      quality: Math.max(1, Math.min(100, quality)),
    });
  }

  return pool;
}

function getCoachHireCost(quality: number): number {
  return quality * 800;
}

function getCoachMonthlyWage(quality: number): number {
  return quality * 60;
}

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

  const hired = getTrainingCoaches(ut.team_id);
  const pool = generateCoachPool(ut.team_id).map(c => ({
    ...c,
    hireCost: getCoachHireCost(c.quality),
    monthlyWage: getCoachMonthlyWage(c.quality),
    stars: Math.ceil((c.quality / 100) * 5),
  }));

  const team = getDb().prepare('SELECT team_money FROM teams WHERE id = ?').get(ut.team_id) as { team_money: number };

  return NextResponse.json({
    hired: hired.map(h => ({
      ...h,
      stars: Math.ceil((h.quality / 100) * 5),
    })),
    pool,
    teamMoney: team.team_money,
    maxCoaches: 3,
  });
}

export async function POST(request: NextRequest) {
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
  const { name, specialty, quality } = body;

  if (!name || !specialty || quality === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getDb();
  const team = db.prepare('SELECT team_money FROM teams WHERE id = ?').get(ut.team_id) as { team_money: number };
  const hired = getTrainingCoaches(ut.team_id);

  if (hired.length >= 3) {
    return NextResponse.json({ error: 'Already have 3 coaches' }, { status: 400 });
  }

  const hireCost = getCoachHireCost(quality);
  const monthlyWage = getCoachMonthlyWage(quality);

  if (team.team_money < hireCost) {
    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
  }

  // Deduct hire cost
  db.prepare('UPDATE teams SET team_money = team_money - ? WHERE id = ?').run(hireCost, ut.team_id);

  // Insert coach
  const coach = insertTrainingCoach(ut.team_id, name, specialty, quality, monthlyWage);

  return NextResponse.json({
    success: true,
    coach: { ...coach, stars: Math.ceil((coach.quality / 100) * 5) },
    newTeamMoney: team.team_money - hireCost,
  });
}

export async function DELETE(request: NextRequest) {
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

  const coachId = parseInt(request.nextUrl.searchParams.get('coachId') ?? '0');
  if (!coachId) {
    return NextResponse.json({ error: 'Missing coachId' }, { status: 400 });
  }

  deleteTrainingCoach(coachId, ut.team_id);
  return NextResponse.json({ success: true });
}
