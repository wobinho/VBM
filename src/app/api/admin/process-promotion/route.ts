import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { processPromotionRelegation } from '@/lib/db/queries';

/**
 * POST /api/admin/process-promotion
 * Admin-only. Processes end-of-season promotion/relegation:
 *  - Bottom team from IVL Premier North conference → IVL North (league 2)
 *  - Bottom team from IVL Premier South conference → IVL South (league 3)
 *  - Top team from IVL North → IVL Premier (league 1, region north)
 *  - Top team from IVL South → IVL Premier (league 1, region south)
 */
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { getDb } = await import('@/lib/db');
    getDb();

    const result = processPromotionRelegation();

    const lines: string[] = [];
    for (const r of result.relegated) {
      lines.push(`${r.teamName} relegated from league ${r.fromLeague} → ${r.toLeague}`);
    }
    for (const p of result.promoted) {
      lines.push(`${p.teamName} promoted from league ${p.fromLeague} → ${p.toLeague}`);
    }

    return NextResponse.json({
      ok: true,
      message: lines.length ? lines.join('; ') : 'No changes — check that leagues have teams.',
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Promotion/relegation failed' }, { status: 500 });
  }
}
