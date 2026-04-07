import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import {
  getGameState, advanceGameDate,
  generatePlayoffs, getUserTeam,
} from '@/lib/db/queries';
import { generateAllCups } from '@/lib/cup-engine';

/**
 * POST /api/proceed-to-playoffs
 *
 * Called on Jun 30 after the league block ends.
 * - Generates playoff brackets for ALL active tier-2 league seasons.
 * - Generates all cup competitions for the year.
 * - Advances calendar to Jul 1 (start of cup block).
 *
 * Returns: { qualified: boolean, playoffsGenerated: boolean, newDate: string }
 */
export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    const { getDb } = await import('@/lib/db');
    const db = getDb();

    const state = getGameState();
    if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

    const isJun30 = state.current_date.endsWith('-06-30');
    const isJul31 = state.current_date.endsWith('-07-31');

    if (!isJun30 && !isJul31) {
      return NextResponse.json({ error: 'Not at the end of the league block — cannot proceed to cup block yet.' }, { status: 409 });
    }

    // Identify the user's league
    let userLeagueId: number | null = null;
    if (session.userId) {
      const ut = getUserTeam(session.userId);
      if (ut) {
        const teamRow = db.prepare('SELECT league_id FROM teams WHERE id = ?').get(ut.team_id) as { league_id: number } | undefined;
        userLeagueId = teamRow?.league_id ?? null;
      }
    }

    // Generate playoffs for ALL active tier-2 league seasons (idempotent — safe to call even if already generated)
    const tier2Seasons = db.prepare(`
      SELECT s.id FROM seasons s
      JOIN leagues l ON s.league_id = l.id
      WHERE s.status = 'active' AND l.tier = 2
    `).all() as { id: number }[];

    let totalSeriesCreated = 0;
    for (const { id: seasonId } of tier2Seasons) {
      const result = generatePlayoffs(seasonId);
      totalSeriesCreated += result.seriesCreated;
    }
    const playoffsGenerated = totalSeriesCreated > 0;

    // Advance to the next day (Jul 1 or Aug 1)
    const year = state.current_date.slice(0, 4);
    const newDate = isJun30 ? `${year}-07-01` : `${year}-08-01`;
    advanceGameDate(newDate);

    // Generate all cup competitions for the year
    generateAllCups(parseInt(year));

    // User qualifies for playoffs if their league is tier-2
    const userLeagueTier = userLeagueId
      ? (db.prepare('SELECT tier FROM leagues WHERE id = ?').get(userLeagueId) as { tier: number } | undefined)?.tier ?? null
      : null;
    const qualified = userLeagueTier === 2;

    return NextResponse.json({
      qualified,
      playoffsGenerated,
      newDate,
    });
  } catch (error: any) {
    console.error('Error in proceed-to-playoffs:', error);
    return NextResponse.json({ error: error.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
