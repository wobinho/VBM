import { NextResponse } from 'next/server';
import { getGameState, getPlayoffBracket, getPlayoffGamesForSeries } from '@/lib/db/queries';

/**
 * GET /api/playoffs
 * Returns the full playoff bracket for the active season, including all series
 * and their individual game results.
 */
export async function GET() {
  const { getDb } = await import('@/lib/db');
  getDb();

  const state = getGameState();
  if (!state?.season_id) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  const bracket = getPlayoffBracket(state.season_id);

  // Attach individual game results to each series
  const enrichSeries = (series: typeof bracket.round1) =>
    series.map(s => ({
      ...s,
      games: getPlayoffGamesForSeries(s.id),
    }));

  return NextResponse.json({
    ...bracket,
    round1: enrichSeries(bracket.round1),
    round2: enrichSeries(bracket.round2),
    round3: enrichSeries(bracket.round3),
  });
}
