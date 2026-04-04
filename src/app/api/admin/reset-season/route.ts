import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { resetSeasonForTesting } from '@/lib/db/queries';

/**
 * POST /api/admin/reset-season
 * Admin-only. Resets the active season back to its start date for testing:
 *  - All fixtures → scheduled (scores cleared)
 *  - All team stats reset to 0
 *  - game_state rewound to season start_date
 */
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { getDb } = await import('@/lib/db');
    getDb();

    const result = resetSeasonForTesting();

    return NextResponse.json({
      ok: true,
      message: `Season reset. ${result.fixturesReset} fixtures cleared. Calendar rewound to ${result.startDate}.`,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Reset failed' }, { status: 500 });
  }
}
