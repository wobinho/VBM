import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const teamId = parseInt(searchParams.get('teamId') ?? '0', 10);
  const leagueId = parseInt(searchParams.get('leagueId') ?? '0', 10);
  const region = searchParams.get('region'); // 'north' | 'south' (conference)
  const seasonYear = searchParams.get('year');
  const singlePlayerId = parseInt(searchParams.get('playerId') ?? '0', 10);

  // Single player history lookup (used by player-modal)
  if (singlePlayerId) {
    const history = db.prepare(`
      SELECT season_year, team_name, team_id
      FROM player_team_history
      WHERE player_id = ?
      ORDER BY season_year ASC
    `).all(singlePlayerId) as { season_year: number; team_name: string; team_id: number | null }[];

    // Ensure current team always appears as the latest record
    const player = db.prepare(`
      SELECT p.team_id, t.team_name
      FROM players p LEFT JOIN teams t ON t.id = p.team_id
      WHERE p.id = ?
    `).get(singlePlayerId) as { team_id: number | null; team_name: string | null } | undefined;
    if (player?.team_id && player.team_name) {
      const alreadyInHistory = history.some(h => h.team_id === player.team_id);
      if (!alreadyInHistory) {
        const currentYear = db.prepare(`SELECT MAX(season_year) as yr FROM player_team_history WHERE player_id = ?`).get(singlePlayerId) as { yr: number | null } | undefined;
        const nextYear = (currentYear?.yr ?? new Date().getFullYear() - 1) + 1;
        history.push({ season_year: nextYear, team_name: player.team_name, team_id: player.team_id });
      }
    }

    return NextResponse.json({ history });
  }

  // ─── LEAGUE / CONFERENCE MODE ────────────────────────────────────────────
  // Returns aggregated stats across every team in a league (optionally
  // filtered to a specific conference/region). Used by the Stats page's
  // league-wide leaderboard view.
  if (leagueId) {
    // Resolve every team that has ever existed in this league (currently).
    const teamRows = db.prepare(
      region
        ? `SELECT id, team_name, region FROM teams WHERE league_id = ? AND region = ?`
        : `SELECT id, team_name, region FROM teams WHERE league_id = ?`
    ).all(...(region ? [leagueId, region] : [leagueId])) as { id: number; team_name: string; region: string | null }[];

    if (teamRows.length === 0) return NextResponse.json({ players: [] });
    const teamIdSet = new Set(teamRows.map(t => t.id));
    const teamIds = teamRows.map(t => t.id);
    const teamPlaceholders = teamIds.map(() => '?').join(',');

    let statsRows: any[];
    if (seasonYear) {
      const yr = parseInt(seasonYear, 10);
      statsRows = db.prepare(`
        SELECT player_id, team_id,
               SUM(points) as points, SUM(spikes) as spikes,
               SUM(blocks) as blocks, SUM(aces) as aces, SUM(digs) as digs
        FROM player_match_stats
        WHERE team_id IN (${teamPlaceholders}) AND season_year = ?
        GROUP BY player_id, team_id
      `).all(...teamIds, yr) as any[];
    } else {
      statsRows = db.prepare(`
        SELECT player_id, team_id,
               SUM(points) as points, SUM(spikes) as spikes,
               SUM(blocks) as blocks, SUM(aces) as aces, SUM(digs) as digs
        FROM player_match_stats
        WHERE team_id IN (${teamPlaceholders})
        GROUP BY player_id, team_id
      `).all(...teamIds) as any[];
    }

    if (statsRows.length === 0) return NextResponse.json({ players: [] });

    // Aggregate per-player totals (a player may have played for multiple teams
    // within this league across seasons). The "team" shown is the most-recent
    // in-league team or, if none, their current team.
    type Totals = { player_id: number; points: number; spikes: number; blocks: number; aces: number; digs: number };
    const totals = new Map<number, Totals>();
    for (const r of statsRows) {
      const cur = totals.get(r.player_id) ?? { player_id: r.player_id, points: 0, spikes: 0, blocks: 0, aces: 0, digs: 0 };
      cur.points += r.points ?? 0;
      cur.spikes += r.spikes ?? 0;
      cur.blocks += r.blocks ?? 0;
      cur.aces += r.aces ?? 0;
      cur.digs += r.digs ?? 0;
      totals.set(r.player_id, cur);
    }

    const playerIdList = Array.from(totals.keys());
    if (playerIdList.length === 0) return NextResponse.json({ players: [] });
    const playerPlaceholders = playerIdList.map(() => '?').join(',');

    const players = db.prepare(`
      SELECT p.id, p.player_name, p.position, p.overall, p.country, p.team_id,
             t.team_name as current_team_name
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.id IN (${playerPlaceholders})
    `).all(...playerIdList) as any[];

    const result = players.map(p => {
      const inLeagueNow = p.team_id != null && teamIdSet.has(p.team_id);
      return {
        ...p,
        stats: totals.get(p.id) ?? { points: 0, spikes: 0, blocks: 0, aces: 0, digs: 0 },
        seasonBreakdown: [],
        teamHistory: [],
        in_league_now: inLeagueNow,
      };
    });

    return NextResponse.json({ players: result });
  }

  if (!teamId) return NextResponse.json({ error: 'teamId or leagueId required' }, { status: 400 });

  // Get all players who have ever played for this team (via player_team_history)
  // PLUS current roster members
  const playerIds = db.prepare(`
    SELECT DISTINCT player_id FROM player_team_history WHERE team_id = ?
    UNION
    SELECT id FROM players WHERE team_id = ?
  `).all(teamId, teamId) as { player_id: number }[];

  const ids = playerIds.map(r => r.player_id);
  if (!ids.length) return NextResponse.json({ players: [] });

  const placeholders = ids.map(() => '?').join(',');

  // Base player info
  const players = db.prepare(`
    SELECT p.id, p.player_name, p.position, p.overall, p.country, p.team_id,
           t.team_name as current_team_name
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.id IN (${placeholders})
    ORDER BY p.overall DESC
  `).all(...ids) as any[];

  // Stats aggregated
  // When filtering by season: only count stats where the player was on THIS team that season
  // (use team_id column on player_match_stats)
  let statsQuery: string;
  let statsParams: any[];

  if (seasonYear) {
    const yr = parseInt(seasonYear, 10);
    statsQuery = `
      SELECT player_id,
             SUM(points) as points, SUM(spikes) as spikes,
             SUM(blocks) as blocks, SUM(aces) as aces, SUM(digs) as digs
      FROM player_match_stats
      WHERE player_id IN (${placeholders}) AND season_year = ? AND team_id = ?
      GROUP BY player_id
    `;
    statsParams = [...ids, yr, teamId];
  } else {
    // Overall: sum all stats the player accumulated while at this team across all seasons
    statsQuery = `
      SELECT player_id,
             SUM(points) as points, SUM(spikes) as spikes,
             SUM(blocks) as blocks, SUM(aces) as aces, SUM(digs) as digs
      FROM player_match_stats
      WHERE player_id IN (${placeholders}) AND team_id = ?
      GROUP BY player_id
    `;
    statsParams = [...ids, teamId];
  }

  const statsRows = db.prepare(statsQuery).all(...statsParams) as any[];
  const statsMap = new Map(statsRows.map(r => [r.player_id, r]));

  // Per-season breakdown for each player (stats while at this team only)
  const seasonBreakdownRows = db.prepare(`
    SELECT player_id, season_year,
           SUM(points) as points, SUM(spikes) as spikes,
           SUM(blocks) as blocks, SUM(aces) as aces, SUM(digs) as digs
    FROM player_match_stats
    WHERE player_id IN (${placeholders}) AND team_id = ?
    GROUP BY player_id, season_year
    ORDER BY player_id, season_year ASC
  `).all(...ids, teamId) as any[];

  const seasonBreakdownMap = new Map<number, { season_year: number; points: number; spikes: number; blocks: number; aces: number; digs: number }[]>();
  for (const row of seasonBreakdownRows) {
    if (!seasonBreakdownMap.has(row.player_id)) seasonBreakdownMap.set(row.player_id, []);
    seasonBreakdownMap.get(row.player_id)!.push({
      season_year: row.season_year,
      points: row.points ?? 0,
      spikes: row.spikes ?? 0,
      blocks: row.blocks ?? 0,
      aces: row.aces ?? 0,
      digs: row.digs ?? 0,
    });
  }

  // Team history per player
  const historyRows = db.prepare(`
    SELECT pth.player_id, pth.season_year, pth.team_name, pth.team_id
    FROM player_team_history pth
    WHERE pth.player_id IN (${placeholders})
    ORDER BY pth.season_year ASC
  `).all(...ids) as any[];

  const historyMap = new Map<number, { season_year: number; team_name: string; team_id: number | null }[]>();
  for (const row of historyRows) {
    if (!historyMap.has(row.player_id)) historyMap.set(row.player_id, []);
    historyMap.get(row.player_id)!.push({ season_year: row.season_year, team_name: row.team_name, team_id: row.team_id });
  }

  const result = players.map(p => ({
    ...p,
    stats: statsMap.get(p.id) ?? { points: 0, spikes: 0, blocks: 0, aces: 0, digs: 0 },
    seasonBreakdown: seasonBreakdownMap.get(p.id) ?? [],
    teamHistory: historyMap.get(p.id) ?? [],
  }));

  return NextResponse.json({ players: result });
}
