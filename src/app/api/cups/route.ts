import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import { getGameState, getSeasonById, getUserTeam } from '@/lib/db/queries';

export const GET = withUserDb(async (request) => {
  try {
    const db = getDb();

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const listOnly = searchParams.get('list') === 'true';
    const countriesOnly = searchParams.get('countries') === 'true';
    const customListParam = searchParams.get('customList') === 'true';
    const cupIdParam = searchParams.get('cupId');
    const countryParam = searchParams.get('country');

    // Resolve the signed-in user's team country (used as the default cup country).
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    let userCountry: string | null = null;
    if (session.userId) {
      const ut = getUserTeam(session.userId);
      if (ut?.league_id) {
        const row = db.prepare('SELECT country FROM leagues WHERE id = ?')
          .get(ut.league_id) as { country: string | null } | undefined;
        userCountry = row?.country ?? null;
      }
    }

    // Resolve "current" year from the in-game date / active season.
    const state = getGameState();
    let currentYear: number | null = null;
    if (state?.season_id) {
      const s = getSeasonById(state.season_id);
      currentYear = s?.year ?? null;
    }
    if (currentYear === null && state?.current_date) {
      currentYear = parseInt(state.current_date.slice(0, 4), 10);
    }

    // Return the list of years that have a cup record (for the history selector).
    if (listOnly) {
      const years = (db.prepare(
        'SELECT DISTINCT year FROM cup_competitions ORDER BY year DESC'
      ).all() as { year: number }[]).map(r => r.year);
      return NextResponse.json({ years, currentYear, userCountry });
    }

    // Return the list of countries that have a cup for the given (or current) year.
    if (countriesOnly) {
      const targetYear = yearParam ? Number(yearParam) : currentYear;
      const countries = targetYear !== null
        ? (db.prepare(`
            SELECT DISTINCT country, name FROM cup_competitions
            WHERE year = ? AND country IS NOT NULL
            ORDER BY country ASC
          `).all(targetYear) as { country: string; name: string }[])
        : [];
      return NextResponse.json({ countries, userCountry, currentYear });
    }

    // Resolve which country's cup to show: explicit override → user's country → fallback.
    // Return every custom cup (powers the custom-save cup picker).
    if (customListParam) {
      const customCups = db.prepare(`
        SELECT id, name, status, year FROM cup_competitions
        WHERE cup_type = 'custom'
        ORDER BY id ASC
      `).all();
      return NextResponse.json({ customCups });
    }

    const resolvedCountry = countryParam ?? userCountry;

    let cup: any = null;

    if (cupIdParam) {
      // Explicit cup id — used for custom cups, which have no country.
      cup = db.prepare('SELECT * FROM cup_competitions WHERE id = ?').get(Number(cupIdParam));
    } else if (yearParam) {
      // Historical view — show the cup for the requested year (any status)
      if (resolvedCountry) {
        cup = db.prepare(`
          SELECT * FROM cup_competitions
          WHERE year = ? AND country = ?
          ORDER BY id DESC LIMIT 1
        `).get(Number(yearParam), resolvedCountry);
      }
      // Fallback if no cup exists for the resolved country in that year
      if (!cup) {
        cup = db.prepare(`
          SELECT * FROM cup_competitions
          WHERE year = ?
          ORDER BY id DESC LIMIT 1
        `).get(Number(yearParam));
      }
    } else {
      // Live view — only show a cup that belongs to the current in-game year.
      if (currentYear !== null) {
        if (resolvedCountry) {
          cup = db.prepare(`
            SELECT * FROM cup_competitions
            WHERE year = ? AND country = ?
            ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, id DESC
            LIMIT 1
          `).get(currentYear, resolvedCountry);
        }
        if (!cup) {
          cup = db.prepare(`
            SELECT * FROM cup_competitions
            WHERE year = ?
            ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, id DESC
            LIMIT 1
          `).get(currentYear);
        }
      }
    }

    if (!cup) {
      return NextResponse.json({ error: 'No active cup found', currentYear, userCountry }, { status: 404 });
    }

    // 2. Get rounds for this cup
    const rounds = db.prepare(`
      SELECT * FROM cup_rounds
      WHERE cup_id = ?
      ORDER BY round_number ASC
    `).all(cup.id) as any[];

    // 3. Get fixtures for all rounds
    const roundsWithFixtures = rounds.map(r => {
      const fixtures = db.prepare(`
        SELECT cf.*,
               ht.team_name as home_team_name,
               at.team_name as away_team_name
        FROM cup_fixtures cf
        JOIN teams ht ON cf.home_team_id = ht.id
        JOIN teams at ON cf.away_team_id = at.id
        WHERE cf.round_id = ?
        ORDER BY cf.id ASC
      `).all(r.id);

      return {
        ...r,
        fixtures
      };
    });

    return NextResponse.json({
      cup,
      rounds: roundsWithFixtures,
      userCountry
    });
  } catch (error: any) {
    console.error('Error fetching cup data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
