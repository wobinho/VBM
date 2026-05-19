import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { endSeason } from '@/lib/db/queries';
import { withUserDb } from '@/lib/db/with-user-db';

/**
 * POST /api/admin/end-season
 * Admin-only. Ends the current season:
 *  1. Marks all active seasons as 'completed'
 *  2. Processes promotion / relegation
 *  3. Creates new seasons (year + 1) for all leagues
 *  4. Generates fresh fixtures with the updated team rosters
 *  5. Resets all team stats and advances calendar to Jan 1 of the new year
 */
export const POST = withUserDb(async () => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = endSeason();

    const relegatedNames = result.promotion.relegated.map(r => r.teamName).join(', ') || 'none';
    const promotedNames  = result.promotion.promoted.map(p => p.teamName).join(', ') || 'none';

    return NextResponse.json({
      ok: true,
      message: `Season ${result.oldYear} ended. Season ${result.newYear} started. Relegated: ${relegatedNames}. Promoted: ${promotedNames}. ${result.fixturesGenerated} fixtures generated.`,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'End season failed' }, { status: 500 });
  }
});
