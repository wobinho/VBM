import { NextResponse } from 'next/server';
import { getGameState, getPlayoffBracket, getPlayoffGamesForSeries, getSeasonById } from '@/lib/db/queries';

/**
 * GET /api/playoffs
 * Returns the full playoff bracket for the active season, including all series
 * and their individual game results.
 *
 * Query params:
 *   ?list=true   → return { years, currentYear } for the season selector
 *   ?year=YYYY   → return the bracket for that season year (historical view)
 *   (no params)  → return the bracket for the currently-active season
 */
export async function GET(request: Request) {
  const { getDb } = await import('@/lib/db');
  const db = getDb();

  const { searchParams } = new URL(request.url);
  const listOnly = searchParams.get('list') === 'true';
  const yearParam = searchParams.get('year');

  const state = getGameState();
  let currentYear: number | null = null;
  if (state?.season_id) {
    const s = getSeasonById(state.season_id);
    currentYear = s?.year ?? null;
  }

  if (listOnly) {
    const years = (db.prepare(`
      SELECT DISTINCT s.year
      FROM playoff_series ps
      JOIN seasons s ON ps.season_id = s.id
      ORDER BY s.year DESC
    `).all() as { year: number }[]).map(r => r.year);
    return NextResponse.json({ years, currentYear });
  }

  let seasonId: number | null = null;
  if (yearParam) {
    const row = db.prepare('SELECT id FROM seasons WHERE year = ? ORDER BY id DESC LIMIT 1')
      .get(Number(yearParam)) as { id: number } | undefined;
    seasonId = row?.id ?? null;
  } else {
    seasonId = state?.season_id ?? null;
  }

  if (!seasonId) {
    return NextResponse.json({ error: 'No season found', currentYear }, { status: 404 });
  }

  const bracket = getPlayoffBracket(seasonId);

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
