import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import { getGameState, getSeasonById } from '@/lib/db/queries';

export const GET = withUserDb(async (request) => {
  try {
    const db = getDb();

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const listOnly = searchParams.get('list') === 'true';

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
      return NextResponse.json({ years, currentYear });
    }

    let cup: any = null;

    if (yearParam) {
      // Historical view — show the cup for the requested year (any status)
      cup = db.prepare(`
        SELECT * FROM cup_competitions
        WHERE year = ?
        ORDER BY id DESC LIMIT 1
      `).get(Number(yearParam));
    } else {
      // Live view — only show a cup that belongs to the current in-game year.
      // Once the season rolls over the previous cup disappears (parallels playoffs).
      if (currentYear !== null) {
        cup = db.prepare(`
          SELECT * FROM cup_competitions
          WHERE year = ?
          ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, id DESC
          LIMIT 1
        `).get(currentYear);
      }
    }

    if (!cup) {
      return NextResponse.json({ error: 'No active cup found', currentYear }, { status: 404 });
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
      rounds: roundsWithFixtures
    });
  } catch (error: any) {
    console.error('Error fetching cup data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
