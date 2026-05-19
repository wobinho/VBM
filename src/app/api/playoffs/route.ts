import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import { getGameState, getPlayoffBracket, getPlayoffGamesForSeries, getSeasonById, getUserTeam } from '@/lib/db/queries';

/**
 * GET /api/playoffs
 * Returns the playoff bracket for the signed-in user's country (tier-2 league).
 * Falls back to the active game-state season when there is no signed-in user.
 *
 * Query params:
 *   ?list=true   → return { years, currentYear, leagueName } for the season selector
 *   ?year=YYYY   → return the bracket for that season year in the user's country
 *   (no params)  → return the bracket for the current season in the user's country
 */
export const GET = withUserDb(async (request) => {
  const db = getDb();

  const { searchParams } = new URL(request.url);
  const listOnly = searchParams.get('list') === 'true';
  const yearParam = searchParams.get('year');

  // Resolve the relevant tier-2 league from the user's team. A user team may
  // sit in a tier-3 sub-conference (e.g. FVL North) — in that case we look up
  // the tier-2 Premier league for the same country.
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  let leagueId: number | null = null;
  let leagueName: string | null = null;
  if (session.userId) {
    const ut = getUserTeam(session.userId);
    if (ut?.league_id) {
      const teamLeague = db.prepare(`
        SELECT id, country, tier FROM leagues WHERE id = ?
      `).get(ut.league_id) as { id: number; country: string | null; tier: number } | undefined;

      if (teamLeague) {
        if (teamLeague.tier === 2) {
          leagueId = teamLeague.id;
        } else if (teamLeague.country) {
          const premier = db.prepare(`
            SELECT id FROM leagues WHERE country = ? AND tier = 2 LIMIT 1
          `).get(teamLeague.country) as { id: number } | undefined;
          if (premier) leagueId = premier.id;
        }
        if (leagueId) {
          const row = db.prepare('SELECT league_name FROM leagues WHERE id = ?').get(leagueId) as { league_name: string } | undefined;
          leagueName = row?.league_name ?? null;
        }
      }
    }
  }

  const state = getGameState();

  // Current year for the resolved league (or the game-state fallback)
  let currentYear: number | null = null;
  if (leagueId) {
    const row = db.prepare(`
      SELECT year FROM seasons WHERE league_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1
    `).get(leagueId) as { year: number } | undefined;
    currentYear = row?.year ?? null;
  } else if (state?.season_id) {
    const s = getSeasonById(state.season_id);
    currentYear = s?.year ?? null;
  }

  if (listOnly) {
    const years = leagueId
      ? (db.prepare(`
          SELECT DISTINCT s.year
          FROM playoff_series ps
          JOIN seasons s ON ps.season_id = s.id
          WHERE ps.league_id = ?
          ORDER BY s.year DESC
        `).all(leagueId) as { year: number }[]).map(r => r.year)
      : (db.prepare(`
          SELECT DISTINCT s.year
          FROM playoff_series ps
          JOIN seasons s ON ps.season_id = s.id
          ORDER BY s.year DESC
        `).all() as { year: number }[]).map(r => r.year);
    return NextResponse.json({ years, currentYear, leagueName });
  }

  // Resolve the season we want the bracket for.
  let seasonId: number | null = null;
  if (yearParam) {
    if (leagueId) {
      const row = db.prepare(`
        SELECT id FROM seasons WHERE league_id = ? AND year = ? ORDER BY id DESC LIMIT 1
      `).get(leagueId, Number(yearParam)) as { id: number } | undefined;
      seasonId = row?.id ?? null;
    } else {
      const row = db.prepare('SELECT id FROM seasons WHERE year = ? ORDER BY id DESC LIMIT 1')
        .get(Number(yearParam)) as { id: number } | undefined;
      seasonId = row?.id ?? null;
    }
  } else if (leagueId) {
    const row = db.prepare(`
      SELECT id FROM seasons WHERE league_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1
    `).get(leagueId) as { id: number } | undefined;
    seasonId = row?.id ?? null;
  } else {
    seasonId = state?.season_id ?? null;
  }

  if (!seasonId) {
    return NextResponse.json({ error: 'No season found', currentYear, leagueName }, { status: 404 });
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
    leagueName,
    round1: enrichSeries(bracket.round1),
    round2: enrichSeries(bracket.round2),
    round3: enrichSeries(bracket.round3),
  });
});
