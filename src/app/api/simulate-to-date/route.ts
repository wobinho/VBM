import { NextResponse } from 'next/server';
import {
  getGameState, advanceGameDate, getFixtures, getPlayoffGamesByDate,
  updateFixtureResult, updateTeamStatsAfterMatch,
  getSquadLineup, getPlayers, runMonthlyEconomy, recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer, PlayerStatLine } from '@/lib/simulation-engine';
import { getCupFixturesByDate, recordCupFixtureResult } from '@/lib/cup-engine';

/**
 * POST /api/simulate-to-date
 * Body: { targetDate: "YYYY-MM-DD" }
 *
 * Streams day-by-day simulation progress using Server-Sent Events (SSE).
 * Simulates ALL fixtures AND playoff games on every match day, reporting progress in real-time.
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

  const { generateAllCups } = await import('@/lib/cup-engine');
  const { generatePlayoffs } = await import('@/lib/db/queries');

  // Pre-generate playoffs if we're simulating into the playoff period (May 1 - Jun 30)
  // but haven't reached Jun 30 yet
  const year = parseInt(state.current_date.slice(0, 4), 10);
  const currentDate = new Date(state.current_date);
  const targetDateObj = new Date(targetDate);
  const may1 = new Date(year, 4, 1);
  const jun30 = new Date(year, 5, 30);

  // If target is in playoff period but current is before Jun 30, generate playoffsNow
  if (targetDateObj >= may1 && targetDateObj <= jun30 && currentDate < jun30) {
    const tier2Seasons = db.prepare(`
      SELECT s.id FROM seasons s
      JOIN leagues l ON s.league_id = l.id
      WHERE s.status = 'active' AND l.tier = 2
    `).all() as { id: number }[];

    for (const { id: seasonId } of tier2Seasons) {
      generatePlayoffs(seasonId);
    }
  }

  // Create a ReadableStream to send SSE updates
  const stream = new ReadableStream({
    start(controller) {
      (async () => {
        try {
          let cursor = new Date(state.current_date);
          const end = new Date(targetDate);
          const totalDays = Math.ceil((end.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          let daysProcessed = 0;

          const execute = db.transaction(() => {
            while (cursor <= end) {
              const dateStr = cursor.toISOString().slice(0, 10);
              daysProcessed++;

              // ── Gate: Generate playoffs if reaching Jun 30 ───────────────────────────────
              const year = dateStr.slice(0, 4);
              if (dateStr === `${year}-06-30`) {
                // Generate playoffs for all tier-2 league seasons
                const tier2Seasons = db.prepare(`
                  SELECT s.id FROM seasons s
                  JOIN leagues l ON s.league_id = l.id
                  WHERE s.status = 'active' AND l.tier = 2
                `).all() as { id: number }[];

                for (const { id: seasonId } of tier2Seasons) {
                  generatePlayoffs(seasonId);
                }
              }

              // ── Gate: Generate cups if reaching Jul 1 ───────────────────────────────────
              if (dateStr === `${year}-07-01`) {
                generateAllCups(parseInt(year, 10));
              }

              // ── Simulate regular season fixtures ───────────────────────────────────────
              const fixtures = getFixtures({ date: dateStr, status: 'scheduled' });
              const matchesOnDay = [];

              if (fixtures.length > 0) {
                for (const f of fixtures) {
                  const homeLu = buildLineup(f.home_team_id);
                  const awayLu = buildLineup(f.away_team_id);
                  const result = runFullMatch(homeLu, awayLu, f.home_team_id, f.away_team_id);
                  updateFixtureResult(f.id, {
                    home_sets:   result.homeSets,
                    away_sets:   result.awaySets,
                    home_points: result.homeTotalPoints,
                    away_points: result.awayTotalPoints,
                  });
                  updateTeamStatsAfterMatch(f.home_team_id, f.away_team_id, result.homeSets, result.awaySets, result.homeTotalPoints, result.awayTotalPoints);
                  if (result.playerStats?.length) {
                    insertPlayerMatchStats(db, result.playerStats, 'league', f.id, parseInt(dateStr.slice(0, 4), 10));
                  }

                  matchesOnDay.push({
                    type: 'league',
                    home: f.home_team_name,
                    away: f.away_team_name,
                    result: `${result.homeSets}-${result.awaySets}`,
                  });
                }
              }

              // ── Simulate playoff games ────────────────────────────────────────────────
              const playoffGames = getPlayoffGamesByDate(dateStr);
              if (playoffGames.length > 0) {
                for (const pg of playoffGames) {
                  if (pg.status === 'completed') continue;

                  const homeLu = buildLineup(pg.home_team_id);
                  const awayLu = buildLineup(pg.away_team_id);
                  const result = runFullMatch(homeLu, awayLu, pg.home_team_id, pg.away_team_id);

                  recordPlayoffGameResult(pg.id, {
                    home_sets:   result.homeSets,
                    away_sets:   result.awaySets,
                    home_points: result.homeTotalPoints,
                    away_points: result.awayTotalPoints,
                  });
                  if (result.playerStats?.length) {
                    insertPlayerMatchStats(db, result.playerStats, 'playoff', pg.id, parseInt(dateStr.slice(0, 4), 10));
                  }

                  matchesOnDay.push({
                    type: 'playoff',
                    home: pg.home_team_name,
                    away: pg.away_team_name,
                    result: `${result.homeSets}-${result.awaySets}`,
                  });
                }
              }

              // ── Simulate cup fixtures ────────────────────────────────────────────────────
              const cupFixtures = getCupFixturesByDate(dateStr);
              if (cupFixtures.length > 0) {
                for (const cf of cupFixtures) {
                  if (cf.status === 'completed') continue;

                  const homeLu = buildLineup(cf.home_team_id);
                  const awayLu = buildLineup(cf.away_team_id);
                  const result = runFullMatch(homeLu, awayLu, cf.home_team_id, cf.away_team_id);

                  recordCupFixtureResult(cf.id, {
                    home_sets:   result.homeSets,
                    away_sets:   result.awaySets,
                    home_points: result.homeTotalPoints,
                    away_points: result.awayTotalPoints,
                  });
                  if (result.playerStats?.length) {
                    insertPlayerMatchStats(db, result.playerStats, 'cup', cf.id, parseInt(dateStr.slice(0, 4), 10));
                  }

                  matchesOnDay.push({
                    type: 'cup',
                    cup: cf.cup_name,
                    home: cf.home_team_name,
                    away: cf.away_team_name,
                    result: `${result.homeSets}-${result.awaySets}`,
                  });
                }
              }

              // Monthly economy on the 1st
              if (dateStr.endsWith('-01')) {
                const month = dateStr.slice(0, 7);
                const allTeams = db.prepare('SELECT id FROM teams').all() as { id: number }[];
                for (const t of allTeams) runMonthlyEconomy(t.id, month);
              }

              // Send SSE update for this day
              const data = {
                date: dateStr,
                matches: matchesOnDay,
                progress: {
                  current: daysProcessed,
                  total: totalDays,
                  percent: Math.round((daysProcessed / totalDays) * 100),
                },
              };
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
              );

              cursor.setDate(cursor.getDate() + 1);
            }

            advanceGameDate(targetDate);
          });

          execute();

          // Send completion event
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ status: 'complete', targetDate })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error('Error in simulate-to-date:', error);
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ status: 'error', error: String(error) })}\n\n`)
          );
          controller.close();
        }
      })();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function insertPlayerMatchStats(
  db: any,
  stats: PlayerStatLine[],
  fixtureType: 'league' | 'playoff' | 'cup',
  fixtureId: number,
  seasonYear: number,
) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO player_match_stats
      (player_id, team_id, season_year, fixture_type, fixture_id, points, spikes, blocks, aces, digs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of stats) {
    stmt.run(s.playerId, s.teamId || null, seasonYear, fixtureType, fixtureId, s.points, s.spikes, s.blocks, s.aces, s.digs);
  }
}
