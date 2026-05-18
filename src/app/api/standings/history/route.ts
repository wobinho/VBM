import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface HistoricalStandingRow {
  team_id: number;
  team_name: string;
  league_id: number;
  league_name: string | null;
  country: string | null;
  region: string | null;
  played: number;
  won: number;
  lost: number;
  points: number;
  sets_won: number;
  sets_lost: number;
  score_diff: number;
  final_position: number | null;
  season_year: number;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const yearParam = req.nextUrl.searchParams.get('year');

  const years = (db.prepare(
    'SELECT DISTINCT season_year FROM team_season_snapshots ORDER BY season_year DESC'
  ).all() as { season_year: number }[]).map(r => r.season_year);

  if (!yearParam) {
    return NextResponse.json({ years, standings: [] });
  }

  const year = Number(yearParam);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const standings = db.prepare(`
    SELECT s.team_id,
           t.team_name,
           s.league_id,
           COALESCE(s.league_name, l.league_name) AS league_name,
           l.country,
           t.region,
           s.played, s.won, s.lost, s.points,
           s.sets_won, s.sets_lost, s.score_diff,
           s.final_position,
           s.season_year
    FROM team_season_snapshots s
    LEFT JOIN teams t ON t.id = s.team_id
    LEFT JOIN leagues l ON l.id = s.league_id
    WHERE s.season_year = ?
    ORDER BY s.league_id, COALESCE(s.final_position, 999), s.points DESC
  `).all(year) as HistoricalStandingRow[];

  return NextResponse.json({ years, standings });
}
