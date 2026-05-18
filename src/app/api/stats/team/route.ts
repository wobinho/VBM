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

  // Cup wins — one row per cup competition (Grand Final may have 2 fixtures in 2-leg format)
  const cupWins = db.prepare(`
    SELECT cc.name, cc.year
    FROM cup_fixtures cf
    JOIN cup_rounds cr ON cf.round_id = cr.id
    JOIN cup_competitions cc ON cf.cup_id = cc.id
    WHERE cf.winner_team_id = ? AND cf.status = 'completed'
      AND cr.round_name IN ('Grand Final', 'Final', 'Finals')
    GROUP BY cc.id
    ORDER BY cc.year DESC
  `).all(teamId) as any[];

  for (const w of cupWins) {
    accolades.push({ type: 'cup', name: w.name, year: w.year });
  }

  // League titles (position 1 in any completed season)
  const snapshots = db.prepare(`
    SELECT * FROM team_season_snapshots WHERE team_id = ? ORDER BY season_year DESC
  `).all(teamId) as any[];

  for (const snap of snapshots) {
    if (snap.final_position === 1) {
      accolades.push({ type: 'league', name: snap.league_name ?? 'League Champion', year: snap.season_year });
    }
  }

  // ── Full cup history (all cups this team participated in, with deepest round reached) ──
  const cupHistory = db.prepare(`
    SELECT cc.name, cc.year,
           (SELECT cr2.round_name
            FROM cup_fixtures cf2
            JOIN cup_rounds cr2 ON cf2.round_id = cr2.id
            WHERE cf2.cup_id = cc.id
              AND (cf2.home_team_id = ? OR cf2.away_team_id = ?)
              AND cf2.status = 'completed'
            ORDER BY cr2.round_number DESC
            LIMIT 1) as round_reached,
           CASE WHEN EXISTS (
             SELECT 1 FROM cup_fixtures cf3
             JOIN cup_rounds cr3 ON cf3.round_id = cr3.id
             WHERE cf3.cup_id = cc.id AND cf3.winner_team_id = ?
               AND cr3.round_name IN ('Grand Final', 'Final', 'Finals')
               AND cf3.status = 'completed'
           ) THEN 1 ELSE 0 END as won
    FROM cup_fixtures cf
    JOIN cup_rounds cr ON cf.round_id = cr.id
    JOIN cup_competitions cc ON cf.cup_id = cc.id
    WHERE (cf.home_team_id = ? OR cf.away_team_id = ?) AND cf.status = 'completed'
    GROUP BY cc.id
    ORDER BY cc.year DESC, cc.name
  `).all(teamId, teamId, teamId, teamId, teamId) as any[];

  // ── Full league history (all seasons from snapshots) ──
  // Enrich each snapshot with:
  //   - overall_position / total_in_league (rank across the whole league, not just conference)
  //   - conference / conference_size (when the league is multi-conference; snapshot.final_position
  //     is already conference-relative, since end-of-season grouping is by league+region)
  //   - playoff_result (Grand Final winner, runner-up, Conference Finals loss, etc.)
  const teamRegion = (db.prepare(`SELECT region FROM teams WHERE id = ?`).get(teamId) as { region: string | null } | undefined)?.region ?? null;

  const leagueHistory = snapshots.map((snap: any) => {
    // All snapshots for this league+year (for overall rank + total team count).
    const peers = db.prepare(`
      SELECT team_id, points, score_diff, sets_won, sets_lost
      FROM team_season_snapshots
      WHERE league_id = ? AND season_year = ?
    `).all(snap.league_id, snap.season_year) as {
      team_id: number; points: number; score_diff: number; sets_won: number; sets_lost: number;
    }[];

    const overallSorted = [...peers].sort((a, b) =>
      b.points - a.points ||
      b.score_diff - a.score_diff ||
      (b.sets_won - b.sets_lost) - (a.sets_won - a.sets_lost)
    );
    const overallIdx = overallSorted.findIndex(p => p.team_id === teamId);
    const overall_position = overallIdx >= 0 ? overallIdx + 1 : null;
    const total_in_league = peers.length;

    // Conference info — only meaningful for multi_conference leagues.
    const cfgRow = db.prepare(`SELECT config FROM league_configs WHERE league_id = ?`).get(snap.league_id) as { config: string } | undefined;
    let isMultiConference = false;
    let conferenceSize: number | null = null;
    if (cfgRow?.config) {
      try {
        const cfg = JSON.parse(cfgRow.config) as { format?: { type?: string; conferences?: { size: number }[] } };
        if (cfg.format?.type === 'multi_conference') {
          isMultiConference = true;
          // Best guess at conference size — first conference's declared size.
          conferenceSize = cfg.format.conferences?.[0]?.size ?? null;
        }
      } catch { /* ignore malformed config */ }
    }

    // Playoff result for this season (if any playoff series exist).
    let playoff_result: string | null = null;
    const seasonRow = db.prepare(`
      SELECT id FROM seasons WHERE league_id = ? AND year = ?
    `).get(snap.league_id, snap.season_year) as { id: number } | undefined;

    if (seasonRow) {
      const series = db.prepare(`
        SELECT round, conference, winner_team_id, home_team_id, away_team_id, status
        FROM playoff_series
        WHERE season_id = ? AND (home_team_id = ? OR away_team_id = ?)
        ORDER BY round DESC
      `).all(seasonRow.id, teamId, teamId) as {
        round: number; conference: string | null; winner_team_id: number | null;
        home_team_id: number; away_team_id: number; status: string;
      }[];

      if (series.length > 0) {
        const deepest = series[0]; // already ordered round DESC
        const wonDeepest = deepest.winner_team_id === teamId;
        if (deepest.round === 3) {
          playoff_result = wonDeepest ? 'Champion' : 'Runner-up (Grand Final)';
        } else if (deepest.round === 2) {
          playoff_result = wonDeepest ? 'Reached Grand Final' : 'Lost Conference Finals';
        } else if (deepest.round === 1) {
          playoff_result = wonDeepest ? 'Reached Conference Finals' : 'Lost Conference Semifinals';
        }
      } else if (isMultiConference) {
        // Multi-conference league but no series means the team did not qualify for playoffs.
        playoff_result = 'Did not qualify';
      }
    }

    return {
      year: snap.season_year,
      league_name: snap.league_name ?? 'League',
      position: snap.final_position,             // conference position when multi_conference, else overall
      played: snap.played,
      won: snap.won,
      lost: snap.lost,
      points: snap.points,
      overall_position,
      total_in_league,
      is_multi_conference: isMultiConference,
      conference: isMultiConference ? teamRegion : null,
      conference_size: isMultiConference ? conferenceSize : null,
      playoff_result,
    };
  });

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
    cupHistory,
    leagueHistory,
    availableYears: years.map(r => r.year),
  });
}
