import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const teamId = parseInt(searchParams.get('teamId') ?? '0', 10);
  const seasonYear = searchParams.get('year'); // null = overall

  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  // ── Team base info ──
  const team = db.prepare(`
    SELECT t.id, t.team_name, t.league_id, t.played, t.won, t.lost, t.points,
           t.sets_won, t.sets_lost, t.score_diff, l.league_name
    FROM teams t
    LEFT JOIN leagues l ON t.league_id = l.id
    WHERE t.id = ?
  `).get(teamId) as any;

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  // ── Season-filtered stats (league fixtures) ──
  let seasonStats: any = null;
  if (seasonYear) {
    const yr = parseInt(seasonYear, 10);
    const row = db.prepare(`
      SELECT
        COUNT(*) as played,
        SUM(CASE WHEN (home_team_id = ? AND home_sets > away_sets) OR (away_team_id = ? AND away_sets > home_sets) THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN (home_team_id = ? AND home_sets < away_sets) OR (away_team_id = ? AND away_sets < home_sets) THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN home_team_id = ? THEN home_sets ELSE away_sets END) as sets_won,
        SUM(CASE WHEN home_team_id = ? THEN away_sets ELSE home_sets END) as sets_lost,
        SUM(CASE WHEN home_team_id = ? THEN home_points ELSE away_points END) as points_for,
        SUM(CASE WHEN home_team_id = ? THEN away_points ELSE home_points END) as points_against
      FROM fixtures f
      JOIN seasons s ON f.season_id = s.id
      WHERE (home_team_id = ? OR away_team_id = ?)
        AND s.year = ?
        AND f.status = 'completed'
    `).get(teamId, teamId, teamId, teamId, teamId, teamId, teamId, teamId, teamId, teamId, yr) as any;

    const wins = row?.won ?? 0;
    const losses = row?.lost ?? 0;
    seasonStats = {
      played: row?.played ?? 0,
      won: wins,
      lost: losses,
      points: wins * 3 + losses,
      sets_won: row?.sets_won ?? 0,
      sets_lost: row?.sets_lost ?? 0,
      score_diff: (row?.points_for ?? 0) - (row?.points_against ?? 0),
      points_for: row?.points_for ?? 0,
      points_against: row?.points_against ?? 0,
    };

    // Position in standings for that season
    const allTeams = db.prepare(`
      SELECT
        f.home_team_id, f.away_team_id, f.home_sets, f.away_sets
      FROM fixtures f
      JOIN seasons s ON f.season_id = s.id
      WHERE s.year = ? AND s.league_id = ? AND f.status = 'completed'
    `).all(yr, team.league_id) as any[];

    const pointMap: Record<number, number> = {};
    for (const fx of allTeams) {
      const homeWin = fx.home_sets > fx.away_sets;
      pointMap[fx.home_team_id] = (pointMap[fx.home_team_id] ?? 0) + (homeWin ? 3 : 1);
      pointMap[fx.away_team_id] = (pointMap[fx.away_team_id] ?? 0) + (homeWin ? 1 : 3);
    }
    const sorted = Object.entries(pointMap).sort((a, b) => b[1] - a[1]);
    const pos = sorted.findIndex(([id]) => parseInt(id) === teamId);
    seasonStats.position = pos >= 0 ? pos + 1 : null;

    // Cup result for that year
    const cupRound = db.prepare(`
      SELECT cr.round_name, cr.round_number
      FROM cup_fixtures cf
      JOIN cup_rounds cr ON cf.round_id = cr.id
      JOIN cup_competitions cc ON cf.cup_id = cc.id
      WHERE (cf.home_team_id = ? OR cf.away_team_id = ?)
        AND cc.year = ?
        AND cf.status = 'completed'
      ORDER BY cr.round_number DESC
      LIMIT 1
    `).get(teamId, teamId, yr) as any;

    // Check if team won the final
    const cupWon = db.prepare(`
      SELECT cf.winner_team_id
      FROM cup_fixtures cf
      JOIN cup_rounds cr ON cf.round_id = cr.id
      JOIN cup_competitions cc ON cf.cup_id = cc.id
      WHERE cc.year = ? AND cf.status = 'completed'
      ORDER BY cr.round_number DESC
      LIMIT 1
    `).get(yr) as any;

    if (cupWon?.winner_team_id === teamId) {
      seasonStats.cup_result = 'Winner';
    } else if (cupRound) {
      seasonStats.cup_result = cupRound.round_name;
    } else {
      seasonStats.cup_result = 'Did not participate';
    }
  }

  // ── Accolades (all-time) ──
  const accolades: { type: string; name: string; year: number }[] = [];

  // Cup wins
  const cupWins = db.prepare(`
    SELECT cc.name, cc.year
    FROM cup_fixtures cf
    JOIN cup_rounds cr ON cf.round_id = cr.id
    JOIN cup_competitions cc ON cf.cup_id = cc.id
    WHERE cf.winner_team_id = ? AND cf.status = 'completed'
      AND cr.round_name IN ('Grand Final', 'Final', 'Finals')
    ORDER BY cc.year DESC
  `).all(teamId) as any[];

  for (const w of cupWins) {
    accolades.push({ type: 'cup', name: w.name, year: w.year });
  }

  // League titles (position 1 in any completed season)
  // We approximate by checking current team stats vs snapshot
  const snapshots = db.prepare(`
    SELECT * FROM team_season_snapshots WHERE team_id = ? ORDER BY season_year DESC
  `).all(teamId) as any[];

  for (const snap of snapshots) {
    if (snap.final_position === 1) {
      accolades.push({ type: 'league', name: snap.league_name ?? 'League Champion', year: snap.season_year });
    }
  }

  // ── Available years ──
  const years = db.prepare(`
    SELECT DISTINCT s.year
    FROM fixtures f
    JOIN seasons s ON f.season_id = s.id
    WHERE (f.home_team_id = ? OR f.away_team_id = ?) AND f.status = 'completed'
    ORDER BY s.year DESC
  `).all(teamId, teamId) as { year: number }[];

  return NextResponse.json({
    team,
    seasonStats,
    accolades,
    availableYears: years.map(r => r.year),
  });
}
