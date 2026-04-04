import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import {
  getGameState, advanceGameDate, getActiveSeason,
  generatePlayoffs, getUserTeam,
} from '@/lib/db/queries';

/**
 * POST /api/proceed-to-playoffs
 *
 * Called on Aug 31 after all regular-season fixtures are complete.
 * - For Premier Division (league 1): generates the playoff bracket, advances to Sep 1.
 * - For other leagues: advances to Sep 1 (vacation / off-season).
 *
 * Returns: { qualified: boolean, playoffsGenerated: boolean, newDate: string }
 */
export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const { getDb } = await import('@/lib/db');
  getDb();

  const state = getGameState();
  if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

  if (!state.current_date.endsWith('-08-31')) {
    return NextResponse.json({ error: 'Not Aug 31 — cannot proceed to playoffs yet.' }, { status: 409 });
  }

  // Identify the user's league
  let userLeagueId: number | null = null;
  if (session.userId) {
    const ut = getUserTeam(session.userId);
    if (ut) {
      const db = getDb();
      const teamRow = db.prepare('SELECT league_id FROM teams WHERE id = ?').get(ut.team_id) as { league_id: number } | undefined;
      userLeagueId = teamRow?.league_id ?? null;
    }
  }

  // Generate playoffs for the Premier season (idempotent — safe to call even if already generated)
  let playoffsGenerated = false;
  if (state.season_id) {
    const premierSeason = getActiveSeason(1);
    if (premierSeason) {
      const result = generatePlayoffs(premierSeason.id);
      playoffsGenerated = result.seriesCreated > 0;
    }
  }

  // Advance to Sep 1
  const year = state.current_date.slice(0, 4);
  const newDate = `${year}-09-01`;
  advanceGameDate(newDate);

  const qualified = userLeagueId === 1;

  return NextResponse.json({
    qualified,
    playoffsGenerated,
    newDate,
  });
}
