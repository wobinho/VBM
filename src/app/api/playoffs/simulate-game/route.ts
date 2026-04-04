import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import {
  getSquadLineup, getPlayers, getUserTeam,
  recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer } from '@/lib/simulation-engine';

/**
 * POST /api/playoffs/simulate-game
 * Body: { gameId: number }
 *
 * Simulates a single playoff game (typically the user's own game).
 * Returns the match result and updated series state.
 */
export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const { getDb } = await import('@/lib/db');
  const db = getDb();

  const body = await req.json() as { gameId?: number };
  if (!body.gameId) {
    return NextResponse.json({ error: 'gameId required' }, { status: 400 });
  }

  const game = db.prepare(`
    SELECT pg.*, s.home_team_id as series_home_id, s.away_team_id as series_away_id,
      s.home_wins, s.away_wins, s.status as series_status,
      s.round, s.conference, s.season_id,
      ht.team_name as home_team_name, at.team_name as away_team_name
    FROM playoff_games pg
    JOIN playoff_series s ON pg.series_id = s.id
    JOIN teams ht ON pg.home_team_id = ht.id
    JOIN teams at ON pg.away_team_id = at.id
    WHERE pg.id = ?
  `).get(body.gameId) as Record<string, unknown> | undefined;

  if (!game) return NextResponse.json({ error: 'Playoff game not found' }, { status: 404 });
  if (game.status === 'completed') return NextResponse.json({ error: 'Already played' }, { status: 409 });
  if (game.status === 'cancelled') return NextResponse.json({ error: 'Game was cancelled (series already decided)' }, { status: 409 });

  // Optional: verify the requesting user is involved
  if (session.userId) {
    const ut = getUserTeam(session.userId);
    if (ut) {
      const tid = ut.team_id;
      const homeId = game.home_team_id as number;
      const awayId = game.away_team_id as number;
      if (tid !== homeId && tid !== awayId) {
        return NextResponse.json({ error: 'Forbidden: not your playoff game' }, { status: 403 });
      }
    }
  }

  const homeLu = buildLineup(game.home_team_id as number);
  const awayLu = buildLineup(game.away_team_id as number);
  const result = runFullMatch(homeLu, awayLu);

  const { seriesWinner, seriesComplete } = recordPlayoffGameResult(body.gameId, {
    home_sets:   result.homeSets,
    away_sets:   result.awaySets,
    home_points: result.homeTotalPoints,
    away_points: result.awayTotalPoints,
  });

  // Re-fetch updated series for response
  const updatedSeries = db.prepare(`
    SELECT ps.*, ht.team_name as home_team_name, at.team_name as away_team_name,
      wt.team_name as winner_team_name
    FROM playoff_series ps
    JOIN teams ht ON ps.home_team_id = ht.id
    JOIN teams at ON ps.away_team_id = at.id
    LEFT JOIN teams wt ON ps.winner_team_id = wt.id
    WHERE ps.id = ?
  `).get(game.series_id as number);

  return NextResponse.json({
    gameId: body.gameId,
    homeTeam: game.home_team_name,
    awayTeam: game.away_team_name,
    homeSets: result.homeSets,
    awaySets: result.awaySets,
    winner: result.winner,
    seriesWinner,
    seriesComplete,
    series: updatedSeries,
  });
}

function buildLineup(teamId: number): SimLineup {
  const saved   = getSquadLineup(teamId);
  const players = getPlayers(teamId) as unknown as SimPlayer[];

  if (saved) {
    const idMap = new Map(players.map(p => [p.id, p]));
    const lu: SimLineup = {
      OH1: saved.oh1_player_id ? (idMap.get(saved.oh1_player_id) ?? null) : null,
      MB1: saved.mb1_player_id ? (idMap.get(saved.mb1_player_id) ?? null) : null,
      OPP: saved.opp_player_id ? (idMap.get(saved.opp_player_id) ?? null) : null,
      S:   saved.s_player_id   ? (idMap.get(saved.s_player_id)   ?? null) : null,
      MB2: saved.mb2_player_id ? (idMap.get(saved.mb2_player_id) ?? null) : null,
      OH2: saved.oh2_player_id ? (idMap.get(saved.oh2_player_id) ?? null) : null,
      L:   saved.l_player_id   ? (idMap.get(saved.l_player_id)   ?? null) : null,
    };
    const filled = Object.values(lu).filter(Boolean).length;
    if (filled >= 5) return lu;
  }

  return autoLineupFromPlayers(players);
}
