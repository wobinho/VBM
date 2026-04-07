import { NextResponse } from 'next/server';
import {
  getGameState, advanceGameDate, getFixtures, getPlayoffGamesByDate,
  updateFixtureResult, updateTeamStatsAfterMatch,
  getSquadLineup, getPlayers, runMonthlyEconomy, recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer } from '@/lib/simulation-engine';

/**
 * POST /api/simulate-to-date
 * Body: { targetDate: "YYYY-MM-DD" }
 *
 * Fast-forwards the game calendar from the current date to targetDate,
 * simulating ALL fixtures AND playoff games on every match day (including the user's team).
 * Returns a summary of every day processed.
 */
export async function POST(req: Request) {
  const { getDb } = await import('@/lib/db');
  const db = getDb();

  let { targetDate } = await req.json() as { targetDate: string };
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'Invalid targetDate' }, { status: 400 });
  }

  const state = getGameState();
  if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

  if (targetDate <= state.current_date) {
    return NextResponse.json({ error: 'Target date must be after the current date' }, { status: 400 });
  }

  // ── Gate Enforcement ───────────────────────────────────────────────────────
  // Ensure simulation doesn't skip Jun 30 or Dec 31 boundaries.
  const year = state.current_date.slice(0, 4);
  const nextJun30 = `${year}-06-30`;
  const nextDec31 = `${year}-12-31`;

  if (state.current_date < nextJun30 && targetDate > nextJun30) {
    targetDate = nextJun30;
  } else if (state.current_date < nextDec31 && targetDate > nextDec31) {
    targetDate = nextDec31;
  }

  const summary: { date: string; simulated: number }[] = [];

  let cursor = new Date(state.current_date);
  const end   = new Date(targetDate);

  const execute = db.transaction(() => {
    while (cursor <= end) {
      const dateStr = cursor.toISOString().slice(0, 10);

      // ── Simulate regular season fixtures ───────────────────────────────────────
      const fixtures = getFixtures({ date: dateStr, status: 'scheduled' });
      let daySimulated = 0;

      if (fixtures.length > 0) {
        for (const f of fixtures) {
          const homeLu = buildLineup(f.home_team_id);
          const awayLu = buildLineup(f.away_team_id);
          const result = runFullMatch(homeLu, awayLu);
          updateFixtureResult(f.id, {
            home_sets:   result.homeSets,
            away_sets:   result.awaySets,
            home_points: result.homeTotalPoints,
            away_points: result.awayTotalPoints,
          });
          updateTeamStatsAfterMatch(f.home_team_id, f.away_team_id, result.homeSets, result.awaySets, result.homeTotalPoints, result.awayTotalPoints);
          daySimulated++;
        }
      }

      // ── Simulate playoff games ────────────────────────────────────────────────
      const playoffGames = getPlayoffGamesByDate(dateStr);
      if (playoffGames.length > 0) {
        for (const pg of playoffGames) {
          if (pg.status === 'completed') continue;

          const homeLu = buildLineup(pg.home_team_id);
          const awayLu = buildLineup(pg.away_team_id);
          const result = runFullMatch(homeLu, awayLu);

          recordPlayoffGameResult(pg.id, {
            home_sets:   result.homeSets,
            away_sets:   result.awaySets,
            home_points: result.homeTotalPoints,
            away_points: result.awayTotalPoints,
          });
          daySimulated++;
        }
      }

      if (daySimulated > 0) {
        summary.push({ date: dateStr, simulated: daySimulated });
      }

      // Monthly economy on the 1st
      if (dateStr.endsWith('-01')) {
        const month = dateStr.slice(0, 7);
        const allTeams = db.prepare('SELECT id FROM teams').all() as { id: number }[];
        for (const t of allTeams) runMonthlyEconomy(t.id, month);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    advanceGameDate(targetDate);
  });

  execute();

  return NextResponse.json({ ok: true, targetDate, days: summary });
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
