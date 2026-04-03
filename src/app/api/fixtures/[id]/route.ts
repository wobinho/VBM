import { NextResponse } from 'next/server';
import { getFixtureById, updateFixtureResult, updateTeamStatsAfterMatch, getSquadLineup, getPlayers } from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer } from '@/lib/simulation-engine';

/** GET /api/fixtures/[id] — fetch a single fixture */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fixture = getFixtureById(Number(id));
  if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  return NextResponse.json(fixture);
}

/**
 * POST /api/fixtures/[id] — simulate this fixture and persist the result.
 *
 * Body: optional `{ homeLineup?, awayLineup? }` — if not provided, lineups
 * are loaded from squad_lineups or auto-generated from the team's roster.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fixtureId = Number(id);

  const fixture = getFixtureById(fixtureId);
  if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  if (fixture.status === 'completed') {
    return NextResponse.json({ error: 'Fixture already played', fixture }, { status: 409 });
  }

  // Build lineups
  const homeLu = await buildLineup(fixture.home_team_id);
  const awayLu = await buildLineup(fixture.away_team_id);

  // Run simulation
  const result = runFullMatch(homeLu, awayLu);

  // Persist result + update standings in a single transaction
  updateFixtureResult(fixtureId, {
    home_sets:   result.homeSets,
    away_sets:   result.awaySets,
    home_points: result.homeTotalPoints,
    away_points: result.awayTotalPoints,
  });

  updateTeamStatsAfterMatch(
    fixture.home_team_id,
    fixture.away_team_id,
    result.homeSets,
    result.awaySets,
  );

  const updated = getFixtureById(fixtureId);
  return NextResponse.json({ fixture: updated, result });
}

// ─── Helper: load or auto-generate a team's lineup ───────────────────────────

async function buildLineup(teamId: number): Promise<SimLineup> {
  const saved = getSquadLineup(teamId);
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
    // If saved lineup has at least 5 valid players, use it; otherwise fall back to auto
    const filled = Object.values(lu).filter(Boolean).length;
    if (filled >= 5) return lu;
  }

  return autoLineupFromPlayers(players);
}
