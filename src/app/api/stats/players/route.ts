import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const teamId = parseInt(searchParams.get('teamId') ?? '0', 10);
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
    return NextResponse.json({ history });
  }

  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

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
