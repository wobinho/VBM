import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';
import { calculateOverall } from '@/lib/overall';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { withUserDb } from '@/lib/db/with-user-db';

export const PUT = withUserDb(async (
  req: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, id } = await params;
    const body = await req.json();
    const db = getDb();

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    const schemaColumns = (db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[]).map(c => c.name);
    const allowedKeys = Object.keys(body).filter(k => schemaColumns.includes(k) && k !== 'id');

    if (allowedKeys.length === 0) {
      return NextResponse.json({ error: 'No valid columns provided' }, { status: 400 });
    }

    const updates = allowedKeys.map(k => `${k} = ?`).join(', ');
    const values = allowedKeys.map(k => body[k]);

    db.prepare(`UPDATE ${name} SET ${updates} WHERE id = ?`).run(...values, id);

    // For players table: recalculate overall from current stats after any update
    if (name === 'players') {
      const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as Record<string, number | string | null> | undefined;
      if (player) {
        const stats: Record<string, number> = {};
        for (const k of ['attack','defense','serve','block','receive','setting','precision','flair','digging','positioning','ball_control','technique','playmaking','spin','speed','agility','strength','endurance','vertical','flexibility','torque','balance','leadership','teamwork','concentration','pressure','consistency','vision','game_iq','intimidation']) {
          stats[k] = Number(player[k] ?? 50);
        }
        const overall = calculateOverall(stats, String(player.position ?? ''));
        db.prepare('UPDATE players SET overall = ? WHERE id = ?').run(overall, id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});

export const DELETE = withUserDb(async (
  req: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, id } = await params;
    const db = getDb();

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    db.prepare(`DELETE FROM ${name} WHERE id = ?`).run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete row' }, { status: 500 });
  }
});
