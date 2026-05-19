import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { resetSeasonForTesting } from '@/lib/db/queries';
import { withUserDb } from '@/lib/db/with-user-db';

/**
 * POST /api/admin/reset-season
 * Admin-only. Resets the active season back to its start date for testing:
 *  - All fixtures → scheduled (scores cleared)
 *  - All team stats reset to 0
 *  - game_state rewound to season start_date
 */
export const POST = withUserDb(async () => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = resetSeasonForTesting();

    return NextResponse.json({
      ok: true,
      message: `Season reset. ${result.fixturesReset} fixtures cleared. Calendar rewound to ${result.startDate}.`,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Reset failed' }, { status: 500 });
  }
});
